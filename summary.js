import { execSync } from 'child_process';
import { OpenAI } from 'openai';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

// 初始化OpenAI客户端
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 获取最近一周的git提交记录
function getLastWeekCommits() {
  // 修改命令以包含作者信息，并只获取特定作者的提交
  const command =
    'git log --since="1 week ago" --author="shiu" --pretty=format:"%H|%an|%s"';
  try {
    const commits = execSync(command)
      .toString()
      .split('\n')
      .filter(Boolean)
      .map(line => {
        const [hash, author, subject] = line.split('|');
        return { hash, author, subject };
      });
    return commits;
  } catch (error) {
    console.error('获取git提交记录失败:', error);
    return [];
  }
}

// 使用OpenAI总结提交信息
async function summarizeCommits(commits) {
  try {
    const commitMessages = commits.map(commit => commit.subject).join('\n');

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content:
            '你是一个工作总结专家，请根据以下提交记录生成一个简洁的工作总结（最多200字）。按照功能或模块来组织内容，突出重要改动。',
        },
        {
          role: 'user',
          content: `本周提交记录:\n${commitMessages}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error('调用OpenAI API失败:', error);
    return '无法生成总结';
  }
}

// 主函数
async function main() {
  console.log('开始生成工作总结...');

  // 获取提交记录
  const commits = getLastWeekCommits();
  if (commits.length === 0) {
    console.log('没有找到最近一周的提交记录');
    return;
  }

  console.log(`找到 ${commits.length} 个提交`);

  // 生成总结
  const summary = await summarizeCommits(commits);

  // 生成最终文档
  const commitList = commits.map(commit => `- ${commit.subject}`).join('\n');
  const finalSummary = `# 最近一周工作总结 (${new Date().toLocaleDateString('zh-CN')})\n\n## 总体概述\n\n${summary}\n\n## 详细提交记录\n\n${commitList}`;

  // 将总结写入文件
  const date = new Date().toISOString().split('T')[0];
  const filename = `work-summary-${date}.md`;
  fs.writeFileSync(filename, finalSummary);

  console.log(`总结已生成并保存到 ${filename}`);
}

// 运行脚本
main().catch(console.error);
