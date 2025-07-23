# Git Summary VSCode Extension

This extension generates summaries of your git commits using OpenAI's GPT models.

## Features

- Generate summaries of git commits for a specified time range
- Filter commits by author
- Support for custom OpenAI models and API endpoints
- Customize output file location
- Multiple summary modes:
  - Subject-only mode: Quick summary based on commit messages
  - Full mode: Detailed analysis including code changes
  - Both mode: Generate both types of summaries
- Configurable limit for code changes included

## Requirements

- Git installed and accessible from command line
- OpenAI API key
- Active VSCode workspace

## Extension Settings

This extension contributes the following settings:

* `gitSummary.timeRange`: Time range for commit history (e.g., '1 week', '2 days', '1 month')
* `gitSummary.author`: Filter commits by author (empty for all authors)
* `gitSummary.model`: OpenAI model to use for summary generation (e.g., 'gpt-3.5-turbo', 'gpt-4', or your custom model)
* `gitSummary.baseURL`: Custom base URL for OpenAI API (empty for default OpenAI endpoint)
* `gitSummary.outputPath`: Custom output path for summary files (empty for workspace root)
* `gitSummary.summaryMode`: What information to use for generating the summary:
  - `subject`: Only use commit subjects (faster, more concise)
  - `full`: Use full commit diffs (more detailed, includes code analysis)
  - `both`: Generate two summaries using both methods
* `gitSummary.maxCodeChanges`: Maximum number of lines of code changes to include in the summary

## Usage

1. Open Command Palette (Cmd+Shift+P / Ctrl+Shift+P)
2. Type "Generate Git Summary" and select the command
3. If not already provided, enter your OpenAI API key when prompted
4. Wait for the summary to be generated
5. The summary will be saved as a markdown file and opened automatically

## Extension Settings Example

```json
{
  "gitSummary.timeRange": "2 weeks",
  "gitSummary.author": "John Doe",
  "gitSummary.model": "gpt-4",
  "gitSummary.baseURL": "https://your-custom-endpoint/v1",
  "gitSummary.outputPath": "/path/to/summaries",
  "gitSummary.summaryMode": "both",
  "gitSummary.maxCodeChanges": 2000
}
```

## Using Custom OpenAI API Endpoints

You can use this extension with:
- Official OpenAI API (leave baseURL empty)
- Azure OpenAI Service (set appropriate baseURL)
- Self-hosted OpenAI-compatible endpoints
- Other API-compatible services

Just set the appropriate `baseURL` in your settings and ensure your API key has the correct permissions.

## Output Format

The generated summary will be saved as a markdown file with:
- Date of generation
- Overview section with AI-generated summary (or two summaries in 'both' mode)
- Detailed list of all commits in the time range
- Code changes for each commit (in 'full' or 'both' mode)
