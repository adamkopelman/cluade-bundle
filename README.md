# claude-bundle

Bundle manager for Claude Code — focused sessions with exclusive component sets.

## What is claude-bundle?

`claude-bundle` lets you group Claude Code components — MCP servers, skills,
slash commands, agents, hooks, and memory — into named, purpose-built
**bundles**. When you start Claude Code it asks which bundle you want;
the chosen bundle's components are loaded and **everything else is off**,
giving you a clean, focused session tailored to what you're doing.

## Installation

```bash
npm install -g claude-bundle
claude-bundle setup
```

Then add the alias to your shell profile:

```bash
alias claude="claude-bundle"
```

## Quick Start

```bash
# Add a bundle
claude-bundle add https://github.com/user/manager-bundle

# List installed bundles
claude-bundle list

# Launch a specific bundle
claude-bundle use manager

# Or just run `claude` to see the menu
claude
```

## Creating Bundles

```bash
# Scaffold a new bundle
claude-bundle init my-bundle
cd my-bundle

# Edit bundle.json, README.md, add your skills/commands
# Then publish to git and add it
```

## Bundle Format

A bundle is a git repo with:

```
my-bundle/
├── bundle.json          # Required manifest
├── README.md            # Shown to user + injected into session
├── plugin/              # Your inline plugin content
│   ├── skills/
│   ├── commands/
│   ├── agents/
│   └── hooks/
├── mcp.json             # Your MCP servers
└── memory/
    └── CLAUDE.md        # Team/project memory
```

See `docs/usage.md` for full documentation.

## Commands

| Command | Description |
|---------|-------------|
| `claude-bundle add <url>` | Add a bundle from git |
| `claude-bundle remove <name>` | Remove a bundle |
| `claude-bundle list` | List installed bundles |
| `claude-bundle update [name]` | Update bundle(s) |
| `claude-bundle use <name>` | Launch a specific bundle |
| `claude-bundle init [name]` | Scaffold a new bundle |
| `claude-bundle secrets <name>` | Configure secrets |
| `claude-bundle setup` | Configure shell alias |
