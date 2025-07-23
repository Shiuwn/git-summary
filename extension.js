const vscode = require('vscode');
const { OpenAI } = require('openai');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function getCommitDetails(hash, workspacePath, maxLines) {
  try {
    const diff = execSync(`git show --unified=3 ${hash}`, {
      cwd: workspacePath,
      maxBuffer: 1024 * 1024 * 5 // 5MB buffer
    }).toString();

    // 提取代码变更
    const lines = diff.split('\n');
    let changes = [];
    let isInDiff = false;

    for (const line of lines) {
      if (line.startsWith('diff --git')) {
        isInDiff = true;
        changes.push(line);
      } else if (isInDiff && changes.length < maxLines) {
        if (line.startsWith('+') || line.startsWith('-')) {
          changes.push(line);
        }
      }
    }

    return changes.join('\n');
  } catch (error) {
    console.error(`Error getting diff for commit ${hash}:`, error);
    return '';
  }
}

async function generateSummary(openai, commits, workspaceFolder, mode, maxCodeChanges, model) {
  let commitData = '';
  let promptContent = '';

  if (mode === 'subject') {
    commitData = commits.map(commit => commit.subject).join('\n');
    promptContent = '你是一个工作总结专家，请根据以下提交记录生成一个简洁的工作总结（最多200字）。按照功能或模块来组织内容，突出重要改动。';
  } else {
    // mode is 'full'
    for (const commit of commits) {
      commitData += `\nCommit: ${commit.subject}\n`;
      commitData += `Changes:\n${getCommitDetails(commit.hash, workspaceFolder.uri.fsPath, maxCodeChanges)}\n`;
    }
    promptContent = '你是一个代码审查和工作总结专家，请根据以下提交记录及其代码变更生成一个详细的工作总结（最多500字）。按照功能或模块来组织内容，重点说明代码变更的影响和改进。';
  }

  const response = await openai.chat.completions.create({
    model: model,
    messages: [
      {
        role: 'system',
        content: promptContent
      },
      {
        role: 'user',
        content: `本周提交记录:\n${commitData}`
      }
    ],
    temperature: 0.7,
    max_tokens: mode === 'subject' ? 500 : 1000
  });

  return response.choices[0].message.content;
}

function activate(context) {
  let disposable = vscode.commands.registerCommand('git-summary.generate', async () => {
    try {
      // Get workspace folder
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        throw new Error('No workspace folder found');
      }

      // Get configuration
      const config = vscode.workspace.getConfiguration('gitSummary');
      const timeRange = config.get('timeRange');
      const author = config.get('author');
      const model = config.get('model');
      const outputPath = config.get('outputPath');
      const summaryMode = config.get('summaryMode');
      const maxCodeChanges = config.get('maxCodeChanges');
      const baseURL = config.get('baseURL');

      // Get OpenAI API key
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        const input = await vscode.window.showInputBox({
          prompt: 'Please enter your OpenAI API key',
          password: true
        });
        if (!input) {
          throw new Error('OpenAI API key is required');
        }
        process.env.OPENAI_API_KEY = input;
      }

      // Initialize OpenAI client with optional baseURL
      const openaiConfig = {
        apiKey: process.env.OPENAI_API_KEY
      };

      if (baseURL) {
        openaiConfig.baseURL = baseURL;
      }

      const openai = new OpenAI(openaiConfig);

      // Get git commits
      const authorFilter = author ? `--author="${author}"` : '';
      const command = `git log --since="${timeRange}" ${authorFilter} --pretty=format:"%H|%an|%s"`;

      const commits = execSync(command, { cwd: workspaceFolder.uri.fsPath })
        .toString()
        .split('\n')
        .filter(Boolean)
        .map(line => {
          const [hash, commitAuthor, subject] = line.split('|');
          return { hash, author: commitAuthor, subject };
        });

      if (commits.length === 0) {
        throw new Error(`No commits found in the last ${timeRange}`);
      }

      // Show progress
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Generating summary...",
        cancellable: false
      }, async (progress) => {
        let summaries = {};

        if (summaryMode === 'both') {
          progress.report({ message: "Generating subject-based summary..." });
          summaries.subject = await generateSummary(openai, commits, workspaceFolder, 'subject', maxCodeChanges, model);

          progress.report({ message: "Generating code-based summary..." });
          summaries.full = await generateSummary(openai, commits, workspaceFolder, 'full', maxCodeChanges, model);
        } else {
          progress.report({ message: "Analyzing commits..." });
          summaries[summaryMode] = await generateSummary(openai, commits, workspaceFolder, summaryMode, maxCodeChanges, model);
        }

        // Generate final document
        let finalSummary = `# Git Commits Summary (${new Date().toLocaleDateString('zh-CN')})\n\n`;

        if (summaryMode === 'both') {
          finalSummary += `## 基于提交信息的总结\n\n${summaries.subject}\n\n`;
          finalSummary += `## 基于代码变更的总结\n\n${summaries.full}\n\n`;
        } else {
          finalSummary += `## Overview\n\n${summaries[summaryMode]}\n\n`;
        }

        finalSummary += `## Detailed Commits\n\n`;

        if (summaryMode === 'full' || summaryMode === 'both') {
          finalSummary += commits.map(commit => {
            const changes = getCommitDetails(commit.hash, workspaceFolder.uri.fsPath, maxCodeChanges);
            return `### ${commit.subject}\n\n\`\`\`diff\n${changes}\n\`\`\`\n`;
          }).join('\n');
        } else {
          finalSummary += commits.map(commit => `- ${commit.subject}`).join('\n');
        }

        // Determine output path
        const date = new Date().toISOString().split('T')[0];
        const filename = `work-summary-${date}.md`;
        const outputDir = outputPath || workspaceFolder.uri.fsPath;
        const fullPath = path.join(outputDir, filename);

        // Ensure output directory exists
        fs.mkdirSync(outputDir, { recursive: true });

        // Write summary
        fs.writeFileSync(fullPath, finalSummary);

        // Open the generated file
        const doc = await vscode.workspace.openTextDocument(fullPath);
        await vscode.window.showTextDocument(doc);

        vscode.window.showInformationMessage(`Summary generated and saved to ${filename}`);
      });
    } catch (error) {
      vscode.window.showErrorMessage(`Error: ${error.message}`);
    }
  });

  context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
