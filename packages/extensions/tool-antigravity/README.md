# @deepseek-ai/dsh-tool-antigravity

Antigravity CLI (`agy`) plugin for the DeepSeek Harness.
Enables running prompts, subtasks, and agent workflows using the Gemini model family via the Antigravity CLI.

## Tools Provided

- `antigravity_run`: Execute a task with Gemini models (e.g. `gemini-3.7-flash-high`, `gemini-3.7-flash-medium`, `gemini-3.7-flash-low`, `gemini-3.1-pro-high`).
- `antigravity_models`: List available Gemini models in the CLI environment.
- `antigravity_agents`: List available Antigravity agents.

## Configuration

```yaml
- id: tool-antigravity
  name: @deepseek-ai/dsh-tool-antigravity
  config:
    defaultModel: gemini-3.7-flash-high
    timeoutMs: 300000
```
