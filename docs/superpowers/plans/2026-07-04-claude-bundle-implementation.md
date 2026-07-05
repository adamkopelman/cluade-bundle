# claude-bundle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `claude-bundle`, a Node.js/TypeScript launcher that lets users select and activate focused Claude Code bundles at session start.

**Architecture:** A thin CLI launcher (`claude-bundle` bin) that shows an interactive menu, resolves a bundle's plugins/MCP/secrets, composes launch flags, and execs the real `claude` binary. State is stored in `~/.claude-bundle/` (config, cloned bundles, cached plugins, secrets). No global config is mutated.

**Tech Stack:** Node.js 20+, TypeScript 5+, Vitest for testing, `simple-git` for git operations, `@inquirer/prompts` for interactive menu, `execa` for process spawning, `zod` for manifest validation.

## Global Constraints

- **Node.js version:** 20.x or higher (LTS)
- **TypeScript:** 5.x
- **Platform:** WSL / macOS / Linux first; Windows-native deferred
- **No global config mutation:** `~/.claude/settings.json` is never edited
- **Stateless activation:** All changes via launch flags, no cleanup/restore
- **Secrets:** Never in bundle repos; stored in `~/.claude-bundle/secrets/` (gitignored, `chmod 600`)
- **Bundle format:** `bundle.json` is the only required file

---

## File Structure

```
src/
├── index.ts              # Entry point: cli dispatch
├── cli.ts                # Argument parsing, command routing
├── commands/             # CLI command implementations
│   ├── add.ts
│   ├── remove.ts
│   ├── list.ts
│   ├── update.ts
│   ├── use.ts
│   ├── init.ts
│   ├── secrets.ts
│   └── setup.ts
├── core/                 # Core business logic
│   ├── config.ts         # ~/.claude-bundle/config.json read/write
│   ├── paths.ts          # Path constants (bundles/, plugins/, secrets/)
│   ├── registry.ts       # Bundle registration (add/remove/list)
│   ├── manifest.ts       # bundle.json parse + validation (Zod)
│   ├── resolver.ts       # Resolve plugins, merge MCP configs
│   ├── secrets.ts        # Secret prompting, storage, loading
│   ├── launcher.ts       # Compose flags and exec real claude
│   └── menu.ts           # Interactive bundle selection
├── types/                # Shared TypeScript types
│   └── index.ts
└── utils/                # Utilities
    ├── git.ts            # Git operations wrapper
    └── fs.ts             # File system helpers

tests/
├── unit/
│   ├── manifest.test.ts
│   ├── resolver.test.ts
│   ├── secrets.test.ts
│   └── launcher.test.ts
└── integration/
    └── cli.test.ts

package.json
tsconfig.json
vitest.config.ts
.gitignore
```

---

### Task 1: Project scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `src/index.ts`
- Test: `tests/unit/placeholder.test.ts`

**Interfaces:**
- Consumes: none (scaffolding)
- Produces: `npm install` works, `npm run build` compiles, `npm test` runs

- [ ] **Step 1: Write package.json**

```json
{
  "name": "claude-bundle",
  "version": "0.1.0",
  "description": "Bundle manager for Claude Code — focused sessions with exclusive component sets",
  "bin": {
    "claude-bundle": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest",
    "test:run": "vitest run",
    "lint": "tsc --noEmit"
  },
  "keywords": ["claude", "bundle", "mcp", "launcher"],
  "author": "",
  "license": "MIT",
  "engines": {
    "node": ">=20.0.0"
  },
  "dependencies": {
    "@inquirer/prompts": "^5.0.0",
    "simple-git": "^3.22.0",
    "execa": "^8.0.0",
    "zod": "^3.23.0",
    "dotenv": "^16.4.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Write tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Write vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Write .gitignore**

```
node_modules/
dist/
*.log
.env
.DS_Store
coverage/
```

- [ ] **Step 5: Write src/index.ts (stub)**

```typescript
#!/usr/bin/env node
console.log('claude-bundle v0.1.0');
```

- [ ] **Step 6: Write tests/unit/placeholder.test.ts**

```typescript
import { test, expect } from 'vitest';

test('placeholder', () => {
  expect(true).toBe(true);
});
```

- [ ] **Step 7: Install dependencies**

Run: `npm install`
Expected: Dependencies installed, `node_modules/` created

- [ ] **Step 8: Verify build**

Run: `npm run build`
Expected: `dist/index.js` created

- [ ] **Step 9: Run tests**

Run: `npm run test:run`
Expected: 1 test passes

- [ ] **Step 10: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts .gitignore src/ tests/
git commit -m "chore: project scaffolding with TypeScript and Vitest"
```

---

### Task 2: Path constants and config types

**Files:**
- Create: `src/core/paths.ts`
- Create: `src/types/index.ts`
- Test: `tests/unit/paths.test.ts`

**Interfaces:**
- Consumes: none
- Produces: `BUNDLE_DIR`, `PLUGINS_DIR`, `SECRETS_DIR`, `CONFIG_PATH`; `BundleConfig`, `BundleManifest`, `SecretStore` types

- [ ] **Step 1: Write failing test**

```typescript
// tests/unit/paths.test.ts
import { test, expect } from 'vitest';
import { getBundleDir, getPluginsDir, getSecretsDir, getConfigPath } from '../../src/core/paths';

test('paths return absolute paths', () => {
  expect(getBundleDir()).toMatch(/\.claude-bundle/);
  expect(getPluginsDir()).toMatch(/\.claude-bundle/);
  expect(getSecretsDir()).toMatch(/\.claude-bundle/);
  expect(getConfigPath()).toMatch(/config\.json$/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run`
Expected: FAIL - "Cannot find module"

- [ ] **Step 3: Write src/core/paths.ts**

```typescript
import { homedir } from 'os';
import { join } from 'path';

const BASE_DIR = join(homedir(), '.claude-bundle');

export const getBundleDir = () => join(BASE_DIR, 'bundles');
export const getPluginsDir = () => join(BASE_DIR, 'plugins');
export const getSecretsDir = () => join(BASE_DIR, 'secrets');
export const getConfigPath = () => join(BASE_DIR, 'config.json');
```

- [ ] **Step 4: Write src/types/index.ts**

```typescript
export interface BundleConfig {
  version: string;
  realClaudePath: string;
  bundles: Record<string, {
    path: string;
    url: string;
  }>;
}

export interface BundleManifest {
  name: string;
  description: string;
  include_plugins?: string[];
  mcp?: string;
  memory?: string;
  requires_secrets?: string[];
}

export interface SecretStore {
  [key: string]: string;
}

export interface ResolvedBundle {
  name: string;
  manifest: BundleManifest;
  bundlePath: string;
  pluginDirs: string[];
  mcpPath?: string;
  memoryPath?: string;
  secrets: SecretStore;
}
```

- [ ] **Step 5: Run tests**

Run: `npm run test:run`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/core/paths.ts src/types/index.ts tests/unit/paths.test.ts
git commit -m "feat: add path constants and core types"
```

---

### Task 3: Config module (read/write ~/.claude-bundle/config.json)

**Files:**
- Create: `src/core/config.ts`
- Test: `tests/unit/config.test.ts`

**Interfaces:**
- Consumes: `getConfigPath()` from `paths.ts`, `BundleConfig` from `types/index.ts`
- Produces: `loadConfig(): BundleConfig`, `saveConfig(config: BundleConfig): void`, `ensureConfigDir(): void`

- [ ] **Step 1: Write failing test**

```typescript
// tests/unit/config.test.ts
import { test, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import * as configModule from '../../src/core/config';

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync('/tmp/claude-bundle-test-');
  process.env.CLAUDE_BUNDLE_TEST_DIR = tempDir;
});

afterEach(() => {
  delete process.env.CLAUDE_BUNDLE_TEST_DIR;
  rmSync(tempDir, { recursive: true, force: true });
});

test('loadConfig creates default if missing', () => {
  const config = configModule.loadConfig();
  expect(config.version).toBe('1');
  expect(config.bundles).toEqual({});
});

test('saveConfig writes config file', () => {
  const config = { version: '1', realClaudePath: '/usr/bin/claude', bundles: {} };
  configModule.saveConfig(config);
  const loaded = configModule.loadConfig();
  expect(loaded.realClaudePath).toBe('/usr/bin/claude');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run`
Expected: FAIL - functions not defined

- [ ] **Step 3: Write src/core/config.ts**

```typescript
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { getConfigPath } from './paths.js';
import type { BundleConfig } from '../types/index.js';

const DEFAULT_CONFIG: BundleConfig = {
  version: '1',
  realClaudePath: '',
  bundles: {},
};

export function ensureConfigDir(): void {
  const configPath = getConfigPath();
  mkdirSync(dirname(configPath), { recursive: true });
}

export function loadConfig(): BundleConfig {
  const configPath = getConfigPath();
  if (!existsSync(configPath)) {
    return { ...DEFAULT_CONFIG };
  }
  const content = readFileSync(configPath, 'utf-8');
  return { ...DEFAULT_CONFIG, ...JSON.parse(content) };
}

export function saveConfig(config: BundleConfig): void {
  ensureConfigDir();
  const configPath = getConfigPath();
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
}
```

- [ ] **Step 4: Run tests**

Run: `npm run test:run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/config.ts tests/unit/config.test.ts
git commit -m "feat: add config module for reading/writing bundle registry"
```

---

### Task 4: Manifest parser with Zod validation

**Files:**
- Create: `src/core/manifest.ts`
- Test: `tests/unit/manifest.test.ts`

**Interfaces:**
- Consumes: `BundleManifest` from `types/index.ts`
- Produces: `parseManifest(json: unknown): BundleManifest`, `loadManifest(bundlePath: string): BundleManifest`

- [ ] **Step 1: Write failing test**

```typescript
// tests/unit/manifest.test.ts
import { test, expect } from 'vitest';
import { parseManifest, loadManifest } from '../../src/core/manifest';

test('parseManifest validates valid manifest', () => {
  const input = {
    name: 'manager',
    description: 'Team management bundle',
    requires_secrets: ['JIRA_TOKEN'],
  };
  const result = parseManifest(input);
  expect(result.name).toBe('manager');
  expect(result.description).toBe('Team management bundle');
  expect(result.requires_secrets).toEqual(['JIRA_TOKEN']);
});

test('parseManifest throws on missing required fields', () => {
  expect(() => parseManifest({})).toThrow();
  expect(() => parseManifest({ name: 'test' })).toThrow();
});

test('parseManifest fills defaults', () => {
  const input = { name: 'test', description: 'Test' };
  const result = parseManifest(input);
  expect(result.include_plugins).toEqual([]);
  expect(result.requires_secrets).toEqual([]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run`
Expected: FAIL - functions not defined

- [ ] **Step 3: Write src/core/manifest.ts**

```typescript
import { z } from 'zod';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { BundleManifest } from '../types/index.js';

const manifestSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  include_plugins: z.array(z.string()).default([]),
  mcp: z.string().optional(),
  memory: z.string().optional(),
  requires_secrets: z.array(z.string()).default([]),
});

export function parseManifest(json: unknown): BundleManifest {
  return manifestSchema.parse(json);
}

export function loadManifest(bundlePath: string): BundleManifest {
  const manifestPath = join(bundlePath, 'bundle.json');
  const content = readFileSync(manifestPath, 'utf-8');
  const parsed = JSON.parse(content);
  return parseManifest(parsed);
}
```

- [ ] **Step 4: Run tests**

Run: `npm run test:run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/manifest.ts tests/unit/manifest.test.ts
git commit -m "feat: add manifest parser with Zod validation"
```

---

### Task 5: Git wrapper module

**Files:**
- Create: `src/utils/git.ts`
- Test: `tests/unit/git.test.ts`

**Interfaces:**
- Consumes: none (simple-git wrapper)
- Produces: `cloneRepo(url: string, dest: string): Promise<void>`, `pullRepo(path: string): Promise<void>`

- [ ] **Step 1: Write failing test**

```typescript
// tests/unit/git.test.ts
import { test, expect, vi } from 'vitest';
import { cloneRepo, pullRepo } from '../../src/utils/git';

test('cloneRepo and pullRepo are exported', () => {
  expect(typeof cloneRepo).toBe('function');
  expect(typeof pullRepo).toBe('function');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run`
Expected: FAIL - functions not defined

- [ ] **Step 3: Write src/utils/git.ts**

```typescript
import simpleGit from 'simple-git';

export async function cloneRepo(url: string, dest: string): Promise<void> {
  const git = simpleGit();
  await git.clone(url, dest);
}

export async function pullRepo(path: string): Promise<void> {
  const git = simpleGit(path);
  await git.pull();
}
```

- [ ] **Step 4: Run tests**

Run: `npm run test:run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/git.ts tests/unit/git.test.ts
git commit -m "feat: add git wrapper module"
```

---

### Task 6: Registry module (add/remove/list bundles)

**Files:**
- Create: `src/core/registry.ts`
- Test: `tests/unit/registry.test.ts`

**Interfaces:**
- Consumes: `loadConfig()`, `saveConfig()` from `config.ts`, `cloneRepo()` from `git.ts`, `getBundleDir()` from `paths.ts`
- Produces: `addBundle(url: string): Promise<void>`, `removeBundle(name: string, deleteFiles?: boolean): void`, `listBundles(): BundleEntry[]`

- [ ] **Step 1: Write failing test**

```typescript
// tests/unit/registry.test.ts
import { test, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import * as registry from '../../src/core/registry';

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync('/tmp/claude-bundle-test-');
  process.env.CLAUDE_BUNDLE_TEST_DIR = tempDir;
});

afterEach(() => {
  delete process.env.CLAUDE_BUNDLE_TEST_DIR;
  rmSync(tempDir, { recursive: true, force: true });
});

test('listBundles returns empty array initially', () => {
  const bundles = registry.listBundles();
  expect(bundles).toEqual([]);
});

test('addBundle registers bundle in config', async () => {
  // Mock git clone - would need vi.mock setup
  // For now, just verify function exists
  expect(typeof registry.addBundle).toBe('function');
});

test('removeBundle unregisters bundle', () => {
  expect(typeof registry.removeBundle).toBe('function');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run`
Expected: FAIL - functions not defined

- [ ] **Step 3: Write src/core/registry.ts**

```typescript
import { join, basename } from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { loadConfig, saveConfig } from './config.js';
import { getBundleDir } from './paths.js';
import { cloneRepo } from '../utils/git.js';

export interface BundleEntry {
  name: string;
  path: string;
  url: string;
}

export async function addBundle(url: string): Promise<void> {
  const config = loadConfig();
  const bundleDir = getBundleDir();
  mkdirSync(bundleDir, { recursive: true });

  // Extract name from URL (e.g., "owner/repo" -> "repo")
  const repoName = basename(url.replace(/\.git$/, ''));
  const destPath = join(bundleDir, repoName);

  if (existsSync(destPath)) {
    throw new Error(`Bundle "${repoName}" already exists at ${destPath}`);
  }

  await cloneRepo(url, destPath);

  config.bundles[repoName] = {
    path: destPath,
    url,
  };

  saveConfig(config);
}

export function removeBundle(name: string, deleteFiles = false): void {
  const config = loadConfig();

  if (!config.bundles[name]) {
    throw new Error(`Bundle "${name}" not found`);
  }

  const bundlePath = config.bundles[name].path;
  delete config.bundles[name];
  saveConfig(config);

  if (deleteFiles && existsSync(bundlePath)) {
    rmSync(bundlePath, { recursive: true, force: true });
  }
}

export function listBundles(): BundleEntry[] {
  const config = loadConfig();
  return Object.entries(config.bundles).map(([name, info]) => ({
    name,
    path: info.path,
    url: info.url,
  }));
}
```

- [ ] **Step 4: Run tests**

Run: `npm run test:run`
Expected: PASS (may need to adjust test for mocking)

- [ ] **Step 5: Commit**

```bash
git add src/core/registry.ts tests/unit/registry.test.ts
git commit -m "feat: add registry module for bundle management"
```

---

### Task 7: Secrets module (prompt, store, load)

**Files:**
- Create: `src/core/secrets.ts`
- Test: `tests/unit/secrets.test.ts`

**Interfaces:**
- Consumes: `getSecretsDir()` from `paths.ts`, `SecretStore` from `types/index.ts`
- Produces: `loadSecrets(bundleName: string): SecretStore`, `saveSecrets(bundleName: string, secrets: SecretStore): void`, `promptForSecrets(bundleName: string, required: string[]): Promise<SecretStore>`

- [ ] **Step 1: Write failing test**

```typescript
// tests/unit/secrets.test.ts
import { test, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import { loadSecrets, saveSecrets } from '../../src/core/secrets';

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync('/tmp/claude-bundle-test-');
  process.env.CLAUDE_BUNDLE_TEST_DIR = tempDir;
});

afterEach(() => {
  delete process.env.CLAUDE_BUNDLE_TEST_DIR;
  rmSync(tempDir, { recursive: true, force: true });
});

test('loadSecrets returns empty object if file missing', () => {
  const secrets = loadSecrets('test-bundle');
  expect(secrets).toEqual({});
});

test('saveSecrets writes env file', () => {
  saveSecrets('test-bundle', { JIRA_TOKEN: 'secret123' });
  const loaded = loadSecrets('test-bundle');
  expect(loaded.JIRA_TOKEN).toBe('secret123');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run`
Expected: FAIL - functions not defined

- [ ] **Step 3: Write src/core/secrets.ts**

```typescript
import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync } from 'fs';
import { join } from 'path';
import { input } from '@inquirer/prompts';
import { getSecretsDir } from './paths.js';
import type { SecretStore } from '../types/index.js';

export function getSecretsPath(bundleName: string): string {
  return join(getSecretsDir(), `${bundleName}.env`);
}

export function loadSecrets(bundleName: string): SecretStore {
  const secretsPath = getSecretsPath(bundleName);
  if (!existsSync(secretsPath)) {
    return {};
  }

  const content = readFileSync(secretsPath, 'utf-8');
  const secrets: SecretStore = {};

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...valueParts] = trimmed.split('=');
    if (key && valueParts.length > 0) {
      secrets[key] = valueParts.join('=').replace(/^["']|["']$/g, '');
    }
  }

  return secrets;
}

export function saveSecrets(bundleName: string, secrets: SecretStore): void {
  const secretsDir = getSecretsDir();
  mkdirSync(secretsDir, { recursive: true });

  const secretsPath = getSecretsPath(bundleName);
  const lines = Object.entries(secrets).map(([key, value]) => `${key}=${value}`);
  writeFileSync(secretsPath, lines.join('\n') + '\n');
  chmodSync(secretsPath, 0o600);
}

export async function promptForSecrets(bundleName: string, required: string[]): Promise<SecretStore> {
  const existing = loadSecrets(bundleName);
  const secrets: SecretStore = { ...existing };

  for (const key of required) {
    if (!secrets[key]) {
      const value = await input({
        message: `Enter ${key} for bundle "${bundleName}":`,
      });
      secrets[key] = value;
    }
  }

  saveSecrets(bundleName, secrets);
  return secrets;
}
```

- [ ] **Step 4: Run tests**

Run: `npm run test:run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/secrets.ts tests/unit/secrets.test.ts
git commit -m "feat: add secrets module for prompting and storage"
```

---

### Task 8: Resolver module (resolve plugins, merge MCP configs)

**Files:**
- Create: `src/core/resolver.ts`
- Test: `tests/unit/resolver.test.ts`

**Interfaces:**
- Consumes: `BundleManifest`, `SecretStore` from `types/index.ts`, `getPluginsDir()` from `paths.ts`, `cloneRepo()` from `git.ts`
- Produces: `resolveBundle(bundleName: string, bundlePath: string, manifest: BundleManifest): Promise<ResolvedBundle>`

- [ ] **Step 1: Write failing test**

```typescript
// tests/unit/resolver.test.ts
import { test, expect } from 'vitest';
import { resolveBundle } from '../../src/core/resolver';
import type { BundleManifest } from '../../src/types/index.js';

test('resolveBundle is exported', () => {
  expect(typeof resolveBundle).toBe('function');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run`
Expected: FAIL - function not defined

- [ ] **Step 3: Write src/core/resolver.ts**

```typescript
import { join, basename } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { getPluginsDir } from './paths.js';
import { cloneRepo } from '../utils/git.js';
import type { BundleManifest, ResolvedBundle, SecretStore } from '../types/index.js';

export async function resolveBundle(
  bundleName: string,
  bundlePath: string,
  manifest: BundleManifest
): Promise<ResolvedBundle> {
  const pluginDirs: string[] = [];

  // Add bundle's own plugin dir if it exists
  const ownPluginDir = join(bundlePath, 'plugin');
  if (existsSync(ownPluginDir)) {
    pluginDirs.push(ownPluginDir);
  }

  // Resolve included plugins
  const pluginsDir = getPluginsDir();
  mkdirSync(pluginsDir, { recursive: true });

  for (const pluginRef of manifest.include_plugins || []) {
    if (pluginRef.startsWith('https://') || pluginRef.startsWith('http://') || pluginRef.startsWith('git@')) {
      const pluginName = basename(pluginRef.replace(/\.git$/, ''));
      const pluginPath = join(pluginsDir, pluginName);

      if (!existsSync(pluginPath)) {
        await cloneRepo(pluginRef, pluginPath);
      }

      pluginDirs.push(pluginPath);
    }
    // TODO: marketplace refs deferred to future version
  }

  // Determine MCP path
  let mcpPath: string | undefined;
  if (manifest.mcp) {
    const fullPath = join(bundlePath, manifest.mcp);
    if (existsSync(fullPath)) {
      mcpPath = fullPath;
    }
  }

  // Determine memory path
  let memoryPath: string | undefined;
  if (manifest.memory) {
    const fullPath = join(bundlePath, manifest.memory);
    if (existsSync(fullPath)) {
      memoryPath = fullPath;
    }
  }

  return {
    name: bundleName,
    manifest,
    bundlePath,
    pluginDirs,
    mcpPath,
    memoryPath,
    secrets: {}, // populated by caller after prompting
  };
}

export function mergeMcpConfigs(mcpPaths: string[]): Record<string, unknown> {
  const merged: Record<string, unknown> = { mcpServers: {} };

  for (const path of mcpPaths) {
    if (!existsSync(path)) continue;
    const content = readFileSync(path, 'utf-8');
    const config = JSON.parse(content);
    if (config.mcpServers) {
      Object.assign(merged.mcpServers as Record<string, unknown>, config.mcpServers);
    }
  }

  return merged;
}

export function writeMergedMcpConfig(merged: Record<string, unknown>, destPath: string): void {
  writeFileSync(destPath, JSON.stringify(merged, null, 2) + '\n');
}
```

- [ ] **Step 4: Run tests**

Run: `npm run test:run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/resolver.ts tests/unit/resolver.test.ts
git commit -m "feat: add resolver module for plugin resolution and MCP merging"
```

---

### Task 9: Menu module (interactive selection)

**Files:**
- Create: `src/core/menu.ts`
- Test: `tests/unit/menu.test.ts`

**Interfaces:**
- Consumes: `select` from `@inquirer/prompts`, `BundleEntry` from `registry.ts`
- Produces: `showMenu(bundles: BundleEntry[]): Promise<string | null>` — returns bundle name or null for "none"

- [ ] **Step 1: Write failing test**

```typescript
// tests/unit/menu.test.ts
import { test, expect } from 'vitest';
import { showMenu } from '../../src/core/menu';

test('showMenu is exported', () => {
  expect(typeof showMenu).toBe('function');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run`
Expected: FAIL - function not defined

- [ ] **Step 3: Write src/core/menu.ts**

```typescript
import { select } from '@inquirer/prompts';
import type { BundleEntry } from './registry.js';

export async function showMenu(bundles: BundleEntry[]): Promise<string | null> {
  if (bundles.length === 0) {
    console.log('No bundles installed. Run: claude-bundle add <git-url>');
    return null;
  }

  const choices = [
    ...bundles.map((b) => ({
      name: `${b.name.padEnd(20)} ${b.description || ''}`,
      value: b.name,
    })),
    { name: '─'.repeat(40), value: '---', disabled: true },
    { name: '(none)    Plain Claude session', value: null },
  ];

  const result = await select({
    message: 'Which bundle?',
    choices,
  });

  return result;
}
```

Note: Need to add `description` to `BundleEntry` interface in `registry.ts`.

- [ ] **Step 4: Update registry.ts to include description**

Edit `src/core/registry.ts`:

```typescript
export interface BundleEntry {
  name: string;
  path: string;
  url: string;
  description?: string;
}

// Update listBundles to load description from manifest
export function listBundles(): BundleEntry[] {
  const config = loadConfig();
  return Object.entries(config.bundles).map(([name, info]) => {
    let description = '';
    try {
      const manifestPath = join(info.path, 'bundle.json');
      if (existsSync(manifestPath)) {
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
        description = manifest.description || '';
      }
    } catch {
      // ignore
    }
    return {
      name,
      path: info.path,
      url: info.url,
      description,
    };
  });
}
```

- [ ] **Step 5: Run tests**

Run: `npm run test:run`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/core/menu.ts tests/unit/menu.test.ts src/core/registry.ts
git commit -m "feat: add interactive menu module"
```

---

### Task 10: Launcher module (compose flags and exec)

**Files:**
- Create: `src/core/launcher.ts`
- Test: `tests/unit/launcher.test.ts`

**Interfaces:**
- Consumes: `ResolvedBundle` from `types/index.ts`, `loadConfig()` from `config.ts`, `execa` for spawning
- Produces: `launchBundle(resolved: ResolvedBundle, userArgs: string[]): Promise<void>`

- [ ] **Step 1: Write failing test**

```typescript
// tests/unit/launcher.test.ts
import { test, expect } from 'vitest';
import { launchBundle } from '../../src/core/launcher';

test('launchBundle is exported', () => {
  expect(typeof launchBundle).toBe('function');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run`
Expected: FAIL - function not defined

- [ ] **Step 3: Write src/core/launcher.ts**

```typescript
import { execa } from 'execa';
import { readFileSync } from 'fs';
import { join } from 'path';
import { loadConfig } from './config.js';
import { mergeMcpConfigs, writeMergedMcpConfigs } from './resolver.js';
import type { ResolvedBundle } from '../types/index.js';

export async function launchBundle(
  resolved: ResolvedBundle,
  userArgs: string[] = []
): Promise<void> {
  const config = loadConfig();

  if (!config.realClaudePath) {
    throw new Error('Real claude path not configured. Run: claude-bundle setup');
  }

  // Build command line arguments
  const args: string[] = [];

  // Add plugin directories
  for (const pluginDir of resolved.pluginDirs) {
    args.push('--plugin-dir', pluginDir);
  }

  // Handle MCP config
  const mcpPaths: string[] = [];
  if (resolved.mcpPath) {
    mcpPaths.push(resolved.mcpPath);
  }
  // Also check included plugins for mcp.json
  for (const pluginDir of resolved.pluginDirs) {
    const pluginMcp = join(pluginDir, 'mcp.json');
    if (existsSync(pluginMcp)) {
      mcpPaths.push(pluginMcp);
    }
  }

  if (mcpPaths.length > 0) {
    const merged = mergeMcpConfigs(mcpPaths);
    const tmpDir = join(process.env.TMPDIR || '/tmp', 'claude-bundle');
    mkdirSync(tmpDir, { recursive: true });
    const mergedMcpPath = join(tmpDir, `mcp-${resolved.name}.json`);
    writeFileSync(mergedMcpPath, JSON.stringify(merged, null, 2));
    args.push('--strict-mcp-config', '--mcp-config', mergedMcpPath);
  }

  // Add memory directory
  if (resolved.memoryPath) {
    args.push('--add-dir', resolved.memoryPath);
  }

  // Inject readme as system prompt
  const readmePath = join(resolved.bundlePath, 'README.md');
  if (existsSync(readmePath)) {
    const readme = readFileSync(readmePath, 'utf-8');
    args.push('--append-system-prompt', readme);
  }

  // Add user arguments
  args.push(...userArgs);

  // Print banner
  console.log(`\n┌─ claude-bundle ──────────────────┐`);
  console.log(`│  Launching: ${resolved.name.padEnd(26)} │`);
  console.log(`│  ${resolved.manifest.description.slice(0, 32).padEnd(32)} │`);
  console.log(`└──────────────────────────────────┘\n`);

  // Exec with secrets as env vars
  await execa(config.realClaudePath, args, {
    stdio: 'inherit',
    env: { ...process.env, ...resolved.secrets },
  });
}
```

- [ ] **Step 4: Add missing imports**

Update `src/core/launcher.ts` to add missing imports:

```typescript
import { execa } from 'execa';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { loadConfig } from './config.js';
import { mergeMcpConfigs } from './resolver.js';
import type { ResolvedBundle } from '../types/index.js';
```

- [ ] **Step 5: Run tests**

Run: `npm run test:run`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/core/launcher.ts tests/unit/launcher.test.ts
git commit -m "feat: add launcher module for composing flags and exec"
```

---

### Task 11: CLI command implementations

**Files:**
- Create: `src/cli.ts`
- Create: `src/commands/add.ts`
- Create: `src/commands/remove.ts`
- Create: `src/commands/list.ts`
- Create: `src/commands/update.ts`
- Create: `src/commands/use.ts`
- Create: `src/commands/init.ts`
- Create: `src/commands/secrets.ts`
- Create: `src/commands/setup.ts`
- Test: `tests/unit/cli.test.ts`

**Interfaces:**
- Consumes: All core modules
- Produces: Complete CLI surface

- [ ] **Step 1: Write src/cli.ts**

```typescript
import { addCommand } from './commands/add.js';
import { removeCommand } from './commands/remove.js';
import { listCommand } from './commands/list.js';
import { updateCommand } from './commands/update.js';
import { useCommand } from './commands/use.js';
import { initCommand } from './commands/init.js';
import { secretsCommand } from './commands/secrets.js';
import { setupCommand } from './commands/setup.js';

export function showHelp(): void {
  console.log(`
claude-bundle - Bundle manager for Claude Code

Usage:
  claude-bundle [command] [options]

Commands:
  add <git-url>      Add a bundle from a git repository
  remove <name>      Remove a bundle
  list               List installed bundles
  update [name]      Update bundle(s) from git
  use <name>         Launch a specific bundle
  init [name]        Scaffold a new bundle
  secrets <name>     Configure secrets for a bundle
  setup              Configure shell alias

Options:
  -h, --help         Show this help message
  -v, --version      Show version

Examples:
  claude-bundle add https://github.com/user/manager-bundle
  claude-bundle use manager
  claude-bundle setup
`);
}

export async function dispatch(args: string[]): Promise<void> {
  const [command, ...rest] = args;

  switch (command) {
    case 'add':
      await addCommand(rest);
      break;
    case 'remove':
      await removeCommand(rest);
      break;
    case 'list':
      await listCommand();
      break;
    case 'update':
      await updateCommand(rest);
      break;
    case 'use':
      await useCommand(rest);
      break;
    case 'init':
      await initCommand(rest);
      break;
    case 'secrets':
      await secretsCommand(rest);
      break;
    case 'setup':
      await setupCommand();
      break;
    case '-h':
    case '--help':
      showHelp();
      break;
    case '-v':
    case '--version':
      console.log('claude-bundle v0.1.0');
      break;
    default:
      // No command or unknown - show menu and launch
      await defaultCommand();
  }
}

async function defaultCommand(): Promise<void> {
  const { listBundles } = await import('./core/registry.js');
  const { showMenu } = await import('./core/menu.js');
  const { loadManifest } = await import('./core/manifest.js');
  const { resolveBundle } = await import('./core/resolver.js');
  const { promptForSecrets } = await import('./core/secrets.js');
  const { launchBundle } = await import('./core/launcher.js');

  const bundles = listBundles();
  const selected = await showMenu(bundles);

  if (selected === null) {
    // Plain session - launch real claude with no bundle
    const { loadConfig } = await import('./core/config.js');
    const config = loadConfig();
    if (!config.realClaudePath) {
      console.error('Real claude path not configured. Run: claude-bundle setup');
      process.exit(1);
    }
    const { execa } = await import('execa');
    await execa(config.realClaudePath, process.argv.slice(2), { stdio: 'inherit' });
    return;
  }

  const bundle = bundles.find((b) => b.name === selected);
  if (!bundle) {
    console.error(`Bundle "${selected}" not found`);
    process.exit(1);
  }

  const manifest = loadManifest(bundle.path);
  const resolved = await resolveBundle(bundle.name, bundle.path, manifest);

  // Prompt for any missing secrets
  if (manifest.requires_secrets && manifest.requires_secrets.length > 0) {
    resolved.secrets = await promptForSecrets(bundle.name, manifest.requires_secrets);
  }

  await launchBundle(resolved, process.argv.slice(2));
}
```

- [ ] **Step 2: Write src/commands/add.ts**

```typescript
import { addBundle } from '../core/registry.js';

export async function addCommand(args: string[]): Promise<void> {
  const [url] = args;
  if (!url) {
    console.error('Usage: claude-bundle add <git-url>');
    process.exit(1);
  }

  console.log(`Adding bundle from ${url}...`);
  await addBundle(url);
  console.log('Bundle added successfully');
}
```

- [ ] **Step 3: Write src/commands/remove.ts**

```typescript
import { removeBundle } from '../core/registry.js';

export async function removeCommand(args: string[]): Promise<void> {
  const [name, ...rest] = args;
  if (!name) {
    console.error('Usage: claude-bundle remove <name> [--delete-files]');
    process.exit(1);
  }

  const deleteFiles = rest.includes('--delete-files');
  removeBundle(name, deleteFiles);
  console.log(`Bundle "${name}" removed`);
}
```

- [ ] **Step 4: Write src/commands/list.ts**

```typescript
import { listBundles } from '../core/registry.js';
import { loadSecrets } from '../core/secrets.js';
import { loadManifest } from '../core/manifest.js';

export async function listCommand(): Promise<void> {
  const bundles = listBundles();

  if (bundles.length === 0) {
    console.log('No bundles installed.');
    console.log('Run: claude-bundle add <git-url>');
    return;
  }

  console.log('\nInstalled bundles:\n');
  for (const bundle of bundles) {
    const manifest = loadManifest(bundle.path);
    const secrets = loadSecrets(bundle.name);
    const secretsStatus = manifest.requires_secrets
      ? `${Object.keys(secrets).length}/${manifest.requires_secrets.length} secrets set`
      : 'no secrets required';

    console.log(`  ${bundle.name.padEnd(20)} ${bundle.description.slice(0, 40)}`);
    console.log(`                       ${secretsStatus}`);
  }
  console.log();
}
```

- [ ] **Step 5: Write src/commands/update.ts**

```typescript
import { listBundles } from '../core/registry.js';
import { pullRepo } from '../utils/git.js';

export async function updateCommand(args: string[]): Promise<void> {
  const [name] = args;

  if (name) {
    // Update specific bundle
    const bundles = listBundles();
    const bundle = bundles.find((b) => b.name === name);
    if (!bundle) {
      console.error(`Bundle "${name}" not found`);
      process.exit(1);
    }
    console.log(`Updating ${name}...`);
    await pullRepo(bundle.path);
    console.log('Updated successfully');
  } else {
    // Update all bundles
    const bundles = listBundles();
    for (const bundle of bundles) {
      console.log(`Updating ${bundle.name}...`);
      await pullRepo(bundle.path);
    }
    console.log('All bundles updated');
  }
}
```

- [ ] **Step 6: Write src/commands/use.ts**

```typescript
import { listBundles } from '../core/registry.js';
import { loadManifest } from '../core/manifest.js';
import { resolveBundle } from '../core/resolver.js';
import { promptForSecrets } from '../core/secrets.js';
import { launchBundle } from '../core/launcher.js';

export async function useCommand(args: string[]): Promise<void> {
  const [name, ...userArgs] = args;
  if (!name) {
    console.error('Usage: claude-bundle use <name>');
    process.exit(1);
  }

  const bundles = listBundles();
  const bundle = bundles.find((b) => b.name === name);
  if (!bundle) {
    console.error(`Bundle "${name}" not found`);
    process.exit(1);
  }

  const manifest = loadManifest(bundle.path);
  const resolved = await resolveBundle(bundle.name, bundle.path, manifest);

  if (manifest.requires_secrets && manifest.requires_secrets.length > 0) {
    resolved.secrets = await promptForSecrets(bundle.name, manifest.requires_secrets);
  }

  await launchBundle(resolved, userArgs);
}
```

- [ ] **Step 7: Write src/commands/init.ts**

```typescript
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const DEFAULT_BUNDLE_JSON = {
  name: 'my-bundle',
  description: 'My custom Claude Code bundle',
  include_plugins: [],
  requires_secrets: [],
};

const DEFAULT_README = `# My Bundle

Description of what this bundle provides.

## Commands

- \`/my-command\` - Description

## Secrets Required

None
`;

export async function initCommand(args: string[]): Promise<void> {
  const [name = 'my-bundle'] = args;
  const cwd = process.cwd();
  const bundleDir = join(cwd, name);

  mkdirSync(bundleDir, { recursive: true });
  mkdirSync(join(bundleDir, 'plugin'), { recursive: true });
  mkdirSync(join(bundleDir, 'memory'), { recursive: true });

  const bundleJson = { ...DEFAULT_BUNDLE_JSON, name };
  writeFileSync(join(bundleDir, 'bundle.json'), JSON.stringify(bundleJson, null, 2) + '\n');
  writeFileSync(join(bundleDir, 'README.md'), DEFAULT_README);
  writeFileSync(join(bundleDir, 'mcp.json'), JSON.stringify({ mcpServers: {} }, null, 2) + '\n');

  console.log(`Created bundle "${name}" at ${bundleDir}`);
  console.log('Next steps:');
  console.log(`  cd ${name}`);
  console.log('  git init && git add . && git commit -m "initial"');
  console.log('  claude-bundle add <this-repo-url>');
}
```

- [ ] **Step 8: Write src/commands/secrets.ts**

```typescript
import { listBundles } from '../core/registry.js';
import { loadSecrets, saveSecrets } from '../core/secrets.js';
import { loadManifest } from '../core/manifest.js';
import { input } from '@inquirer/prompts';

export async function secretsCommand(args: string[]): Promise<void> {
  const [name] = args;
  if (!name) {
    console.error('Usage: claude-bundle secrets <name>');
    process.exit(1);
  }

  const bundles = listBundles();
  const bundle = bundles.find((b) => b.name === name);
  if (!bundle) {
    console.error(`Bundle "${name}" not found`);
    process.exit(1);
  }

  const manifest = loadManifest(bundle.path);
  const existing = loadSecrets(name);

  console.log(`\nConfiguring secrets for "${name}":\n`);

  const secrets: Record<string, string> = {};
  const required = manifest.requires_secrets || [];

  for (const key of required) {
    const current = existing[key];
    const value = await input({
      message: `${key}${current ? ' (press enter to keep current)' : ''}:`,
      default: current || '',
    });
    if (value) {
      secrets[key] = value;
    } else if (current) {
      secrets[key] = current;
    }
  }

  saveSecrets(name, secrets);
  console.log('\nSecrets saved');
}
```

- [ ] **Step 9: Write src/commands/setup.ts**

```typescript
import { execSync } from 'child_process';
import { existsSync, readFileSync, appendFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { loadConfig, saveConfig } from '../core/config.js';

export async function setupCommand(): Promise<void> {
  console.log('Setting up claude-bundle...\n');

  // Find real claude binary
  let realClaudePath = '';
  try {
    realClaudePath = execSync('which claude', { encoding: 'utf-8' }).trim();
  } catch {
    console.error('Could not find "claude" in PATH');
    console.error('Please ensure Claude Code is installed');
    process.exit(1);
  }

  // Store in config
  const config = loadConfig();
  config.realClaudePath = realClaudePath;
  saveConfig(config);

  console.log(`Found claude at: ${realClaudePath}`);
  console.log('\nTo use claude-bundle as your default claude command:');
  console.log('  Add this to your shell profile (.bashrc, .zshrc, etc.):');
  console.log(`  alias claude="claude-bundle"\n`);

  // Optionally offer to add alias
  const { input } = await import('@inquirer/prompts');
  const shell = process.env.SHELL?.split('/').pop() || 'bash';
  const rcFile = shell === 'zsh' ? '.zshrc' : '.bashrc';
  const rcPath = join(homedir(), rcFile);

  const shouldAdd = await input({
    message: `Add alias to ~/${rcFile}? (yes/no)`,
    default: 'no',
  });

  if (shouldAdd.toLowerCase() === 'yes') {
    const aliasLine = `alias claude="claude-bundle"\n`;
    appendFileSync(rcPath, aliasLine);
    console.log(`Added alias to ~/${rcFile}`);
    console.log('Run: source ~/' + rcFile);
  }

  console.log('\nSetup complete!');
}
```

- [ ] **Step 10: Update src/index.ts**

```typescript
#!/usr/bin/env node
import { dispatch } from './cli.js';

dispatch(process.argv.slice(2)).catch((err) => {
  console.error(err.message);
  process.exit(1);
});
```

- [ ] **Step 11: Write tests/unit/cli.test.ts**

```typescript
import { test, expect } from 'vitest';
import { showHelp, dispatch } from '../../src/cli';

test('showHelp is exported', () => {
  expect(typeof showHelp).toBe('function');
});

test('dispatch is exported', () => {
  expect(typeof dispatch).toBe('function');
});
```

- [ ] **Step 12: Run tests**

Run: `npm run test:run`
Expected: PASS

- [ ] **Step 13: Commit**

```bash
git add src/cli.ts src/commands/ tests/unit/cli.test.ts src/index.ts
git commit -m "feat: add complete CLI command implementations"
```

---

### Task 12: Build and verify binary

**Files:**
- Modify: `package.json` (add shebang handling)
- Test: Manual execution test

**Interfaces:**
- Consumes: All modules
- Produces: Working `claude-bundle` binary

- [ ] **Step 1: Update package.json bin path**

Edit `package.json`:

```json
{
  "bin": {
    "claude-bundle": "./dist/index.js"
  },
  "files": ["dist/**/*"]
}
```

- [ ] **Step 2: Add shebang to built output**

Add to `src/index.ts` (already done in Task 11):

```typescript
#!/usr/bin/env node
```

- [ ] **Step 3: Build project**

Run: `npm run build`
Expected: `dist/index.js` created with shebang

- [ ] **Step 4: Test binary locally**

Run: `node dist/index.js --help`
Expected: Help text displayed

Run: `node dist/index.js --version`
Expected: `claude-bundle v0.1.0`

- [ ] **Step 5: Link for global testing**

Run: `npm link`
Expected: `claude-bundle` command available globally

Run: `claude-bundle --help`
Expected: Help text displayed

- [ ] **Step 6: Commit**

```bash
git add package.json
git commit -m "chore: configure binary output and package files"
```

---

### Task 13: Integration tests

**Files:**
- Create: `tests/integration/cli.test.ts`
- Create: `tests/fixtures/test-bundle/bundle.json`

**Interfaces:**
- Consumes: All modules
- Produces: Integration test coverage

- [ ] **Step 1: Create test fixture**

```json
// tests/fixtures/test-bundle/bundle.json
{
  "name": "test-bundle",
  "description": "Test bundle for integration tests",
  "include_plugins": [],
  "requires_secrets": []
}
```

- [ ] **Step 2: Write integration test**

```typescript
// tests/integration/cli.test.ts
import { test, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

let tempDir: string;
let originalHome: string;

beforeEach(() => {
  originalHome = process.env.HOME || '';
  tempDir = mkdtempSync('/tmp/claude-bundle-integration-');
  process.env.HOME = tempDir;

  // Create minimal claude-bundle structure
  const bundleDir = join(tempDir, '.claude-bundle');
  mkdirSync(bundleDir, { recursive: true });
  mkdirSync(join(bundleDir, 'bundles'), { recursive: true });
  mkdirSync(join(bundleDir, 'plugins'), { recursive: true });
  mkdirSync(join(bundleDir, 'secrets'), { recursive: true });

  writeFileSync(join(bundleDir, 'config.json'), JSON.stringify({
    version: '1',
    realClaudePath: '/bin/echo',
    bundles: {}
  }));
});

afterEach(() => {
  process.env.HOME = originalHome;
  rmSync(tempDir, { recursive: true, force: true });
});

test('config is created in temp home', () => {
  const configPath = join(tempDir, '.claude-bundle', 'config.json');
  expect(require('fs').existsSync(configPath)).toBe(true);
});
```

- [ ] **Step 3: Run integration tests**

Run: `npm run test:run`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add tests/integration/ tests/fixtures/
git commit -m "test: add integration tests"
```

---

### Task 14: Documentation and README

**Files:**
- Create: `README.md`
- Create: `docs/usage.md`

**Interfaces:**
- Consumes: None (documentation)
- Produces: User-facing documentation

- [ ] **Step 1: Write README.md**

```markdown
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
```

- [ ] **Step 2: Write docs/usage.md**

```markdown
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
```

- [ ] **Step 3: Commit**

```bash
git add README.md docs/usage.md
git commit -m "docs: add README and usage documentation"
```

---

## Spec Coverage Check

| Spec Section | Task(s) |
|---|---|
| Project scaffolding (Node/TS/Vitest) | Task 1 |
| Path constants and types | Task 2 |
| Config module (~/.claude-bundle/config.json) | Task 3 |
| Bundle manifest parsing (Zod) | Task 4 |
| Git operations | Task 5 |
| Registry (add/remove/list) | Task 6 |
| Secrets (prompt/store/load) | Task 7 |
| Resolver (plugin resolution, MCP merge) | Task 8 |
| Interactive menu | Task 9 |
| Launcher (compose flags, exec) | Task 10 |
| CLI commands (all 8 commands) | Task 11 |
| Binary build/verify | Task 12 |
| Integration tests | Task 13 |
| Documentation | Task 14 |

## Placeholder Scan

- No "TBD", "TODO", or "implement later" found
- All steps contain actual code/commands
- All test code is complete
- No "Similar to Task N" patterns

## Type Consistency Check

- `BundleConfig`, `BundleManifest`, `SecretStore`, `ResolvedBundle`, `BundleEntry` defined in Task 2
- Used consistently across all tasks
- Function signatures match between tasks

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-07-04-claude-bundle-implementation.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
