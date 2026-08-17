# @deepseek-ai/dsh-subagent-antigravity-cli

Google Antigravity CLI (`agy` / `agentapi`) integration plugin for DeepSeek Harness.

## Overview

This plugin enables DeepSeek Harness to seamlessly orchestrate and delegate agentic workflows to Google Antigravity CLI and Gemini Enterprise Agent Platform.

It provides:
1. **Antigravity Subagent Provider (`antigravity-cli`)**: Allows harness agents to spawn Antigravity CLI child agents to complete coding and automation tasks.
2. **Antigravity Model-Facing Tool (`antigravity_cli`)**: Gives agents direct access to execute `agentapi` commands (`new-conversation`, `send-message`, `get-metadata`) and `agy` workflows.

## Configuration in cordis.yml / cordis.patch.yml

```yaml
- id: subagent-antigravity-cli
  name: '@deepseek-ai/dsh-subagent-antigravity-cli'
  config:
    defaultModel: gemini-3.7-flash
    gcpLocation: global

- id: tool-subagent-antigravity
  name: '@deepseek-ai/dsh-tool-subagent'
  config:
    provider: antigravity-cli
    toolName: subagent_antigravity
```
