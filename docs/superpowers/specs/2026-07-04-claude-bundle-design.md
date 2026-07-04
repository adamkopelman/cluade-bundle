# claude-bundle — Design Spec

**Date:** 2026-07-04
**Status:** Approved (design phase)

## Purpose

`claude-bundle` lets you group Claude Code components — MCP servers, skills,
slash commands, agents, hooks, and memory — into named, purpose-built
**bundles** (e.g. a "manager" bundle, an "ic-dev" bundle). When you start
Claude Code it asks which bundle you want; the chosen bundle's components are
loaded and **everything else is off**, giving you a clean, focused session
tailored to what you're doing. Bundles are git repos, so they're shareable and
versioned.

## Core Decisions (locked)

| Decision | Choice |
|---|---|
| Launch trigger | `claude` is aliased to the `claude-bundle` launcher; typing `claude` shows the bundle menu, then starts a normal session |
| Activation scope | **Fully exclusive** — only the chosen bundle's components are active; everything else is off. Menu always offers a "none / plain session" escape hatch |
| Activation mechanism | Composed **launch flags** on the real `claude` binary — **no global config is ever mutated** (stateless, no cleanup/restore) |
| Distribution | **One git repo per bundle**, tracked in a local list (`claude-bundle add <git-url>`) |
| Composition | A bundle may **include other plugins** (external git URLs / marketplace refs) in addition to its own inline content |
| Secrets | Manifest **declares** required secret names; launcher **prompts on first use** and stores them locally (gitignored); injects as env vars at launch |
| Tech stack | Node.js + TypeScript, shipped as a global npm package with a `claude-bundle` bin |
| Platform | WSL / macOS / Linux first; Windows-native deferred |

## Architecture

`claude-bundle` is a thin **launcher** aliased to `claude`. Every invocation:

1. Loads the local bundle list (`~/.claude-bundle/config.json`).
2. Shows an interactive menu of registered bundles **plus a "none / plain
   session" option**.
3. For the chosen bundle, **composes a `claude` command line** that loads only
   that bundle's components, injects its secrets as env vars, and prints +
   injects its readme.
4. `exec`s the **real `claude` binary** (resolved by stored absolute path, not
   the alias — so there is no infinite loop), passing through any user-supplied
   args (e.g. `claude --resume`).

Fully-exclusive activation is achieved **entirely through launch flags** — the
global `~/.claude/settings.json` is never edited, so "everything else is off"
is the natural default (the session only sees what the flags pass in) and there
is nothing to restore on exit.

### Component → launch-flag mapping

Verified against `claude --help`; these flags exist today:

| Bundle contains | Loaded via |
|---|---|
| MCP servers | `--strict-mcp-config --mcp-config <merged-mcp.json>` |
| skills + commands + agents + hooks (own + included) | one `--plugin-dir <path>` per plugin (repeatable) |
| memory (CLAUDE.md) | `--add-dir <bundle>/memory` |
| readme → injected so Claude knows the bundle's commands | `--append-system-prompt "<README contents>"` |
| bundle settings | `--settings <bundle>/settings.json` (when present) |
| secrets | injected as environment variables on the child `claude` process |

## Bundle Format

A bundle is a git repo. `bundle.json` is the only required file.

```
manager-bundle/
├── bundle.json          # manifest (required)
├── README.md            # shown to the user + injected into the session
├── plugin/              # this bundle's own inline plugin content (optional)
│   ├── skills/
│   ├── commands/        # e.g. /manager-broadcast
│   ├── agents/
│   └── hooks/
├── mcp.json             # this bundle's own MCP servers (optional)
└── memory/
    └── CLAUDE.md        # team facts, context, conventions (optional)
```

### Manifest (`bundle.json`)

```json
{
  "name": "manager",
  "description": "Team management: Jira, Mattermost, Obsidian, team memory",
  "include_plugins": [
    "https://github.com/someone/great-standup-skill",
    "marketplace:claude-plugins-official/mcp-server-dev"
  ],
  "mcp": "mcp.json",
  "memory": "memory/CLAUDE.md",
  "requires_secrets": ["JIRA_TOKEN", "MATTERMOST_TOKEN", "OUTLOOK_TOKEN"]
}
```

Field semantics:

- `name` (required, string) — unique id used in the menu, `use <name>`, and the
  secrets filename.
- `description` (required, string) — one-line menu subtitle.
- `include_plugins` (optional, string[]) — external plugins to load alongside
  the bundle. Each entry is a git URL or `marketplace:<market>/<plugin>` ref.
  Resolved and cached into `~/.claude-bundle/plugins/`.
- `mcp` (optional, string) — path within the repo to this bundle's MCP config.
- `memory` (optional, string) — path within the repo to a CLAUDE.md file.
- `requires_secrets` (optional, string[]) — secret **names** (never values)
  the bundle's MCP config references.

### Composition & activation resolution

At activation the launcher:

1. Parses/validates `bundle.json`.
2. Resolves `include_plugins`: for each, ensures a local cached clone exists
   (clone if missing) in `~/.claude-bundle/plugins/`.
3. Collects plugin dirs = the bundle's own `plugin/` (if present) + each
   resolved included plugin → emits one `--plugin-dir` per dir.
4. Merges MCP servers: the bundle's `mcp.json` **plus** any `mcp.json`/`.mcp.json`
   contributed by included plugins → writes a single merged config to a temp
   file → `--strict-mcp-config --mcp-config <merged>`.
5. Loads/creates secrets (see below), injects as env vars.
6. Adds `--add-dir <memory>` and `--append-system-prompt "<README>"`.
7. Execs the real `claude` with the composed flags + pass-through user args.

## Secrets Flow

- On activation the launcher reads `requires_secrets` and checks
  `~/.claude-bundle/secrets/<name>.env` (gitignored, `chmod 600`).
- Any missing secret → **masked prompt**, then saved to that file.
- All of the bundle's secrets are injected as **environment variables** on the
  child `claude` process, so the bundle's `mcp.json` can reference
  `${JIRA_TOKEN}` etc.
- Secrets are never written into the bundle repo.
- `claude-bundle secrets <name>` re-enters/updates a bundle's secrets.

## CLI Surface

| Command | Behavior |
|---|---|
| `claude` (aliased) / `claude-bundle` | Show menu → launch chosen bundle (or plain session) |
| `claude-bundle add <git-url>` | Clone a bundle repo into the store, register in `config.json` |
| `claude-bundle remove <name>` | Un-register a bundle (optionally delete its clone) |
| `claude-bundle list` | List installed bundles + status (secrets set? up to date?) |
| `claude-bundle update [name]` | `git pull` a bundle (and its included plugins); all if no name |
| `claude-bundle use <name>` | Skip the menu; launch that bundle directly |
| `claude-bundle init [name]` | Scaffold a new bundle repo skeleton |
| `claude-bundle secrets <name>` | (Re)enter secrets for a bundle |
| `claude-bundle setup` | Write the `alias claude="claude-bundle"` line into the shell rc (with confirmation) and discover + store the real `claude` binary path |

## Session Experience

```
$ claude
┌─ claude-bundle ──────────────────┐
│  Which bundle?                    │
│  ❯ manager   Team mgmt: Jira…     │
│    ic-dev    Backend dev stack    │
│    personal  Journaling + notes   │
│    ─────────                      │
│    (none)    plain claude session │
└───────────────────────────────────┘
```

On select → resolve plugins → print a short readme banner (bundle name, what's
loaded, its custom commands) → the same readme is `--append-system-prompt`'d so
Claude itself knows the bundle's commands → the real session starts. Choosing
"(none)" execs the real `claude` with no bundle flags (a normal session).

## `claude-bundle` Internal Structure

- **Tech stack:** Node.js + TypeScript, global npm package exposing a
  `claude-bundle` bin.
- **Install:** `npm i -g claude-bundle`, then `claude-bundle setup`.
- **Local state** (`~/.claude-bundle/`):
  - `config.json` — registered bundles (name → repo path + origin URL) and the
    resolved real-`claude` binary path.
  - `bundles/` — cloned bundle repos.
  - `plugins/` — cached included (external) plugins.
  - `secrets/` — gitignored per-bundle `.env` files (`chmod 600`).
- **Modules:**
  - `cli` — argument parsing / command dispatch.
  - `registry` — add/remove/list/update; git clone & pull.
  - `manifest` — parse & validate `bundle.json`.
  - `resolver` — turn a bundle into plugin dirs + a merged MCP config file.
  - `secrets` — prompt, store, load, inject.
  - `launcher` — compose flags and `exec` the real `claude`.
  - `menu` — interactive bundle selection.
  - `setup` — shell-rc alias installation + real-`claude` discovery.

## Non-Goals / Deferred

- Windows-native (non-WSL) shell integration.
- Per-project pinned/default bundle (menu-skip memory) — possible later.
- A hosted bundle registry/marketplace — bundles are plain git URLs for now.
- Mid-session bundle switching (would require a restart; out of scope).

## Open Points (finalize during planning)

- Exact npm libraries for interactive prompt and git operations.
- Merge strategy for MCP-server name collisions across included plugins
  (proposed default: bundle's own `mcp.json` wins; warn on conflict).
- Whether `--settings` is always emitted or only when a bundle ships settings.
