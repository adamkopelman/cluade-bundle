# claude-bundle Usage Guide

## Bundle Manifest (bundle.json)

```json
{
  "name": "manager",
  "description": "Team management bundle",
  "include_plugins": [
    "https://github.com/someone/great-standup-skill"
  ],
  "mcp": "mcp.json",
  "memory": "memory/CLAUDE.md",
  "requires_secrets": ["JIRA_TOKEN", "MATTERMOST_TOKEN"]
}
```

## Secrets

Secrets are stored in `~/.claude-bundle/secrets/<bundle>.env` (chmod 600).
They're prompted for on first use and injected as environment variables.

## How It Works

When you run `claude` (aliased to `claude-bundle`):

1. Shows interactive menu of installed bundles
2. Resolves the selected bundle's plugins and MCP configs
3. Prompts for any missing secrets
4. Composes launch flags for the real `claude` binary
5. Execs with exclusive activation (only bundle components loaded)

## Architecture

See the design spec at `docs/superpowers/specs/2026-07-04-claude-bundle-design.md`.
