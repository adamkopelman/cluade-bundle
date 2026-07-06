# Tests + npm Publish Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace claude-bundle's stub test suite with real behavioral tests covering every `src/` module and command, and add GitHub Actions workflows that run CI on every push/PR and publish to npm when a GitHub Release is published.

**Architecture:** Unit tests use `vi.mock` (via `vi.hoisted` for shared mock references) to isolate each module from its external dependencies (`simple-git`, `execa`, `@inquirer/prompts`, `child_process`) while exercising real logic. Modules that only touch the filesystem (`config`, `paths`, `secrets`, `resolver`'s mcp merging) are tested against real temp directories rather than mocked, following the existing `CLAUDE_BUNDLE_TEST_DIR` convention already used in this repo. One integration test drives the full CLI (`add` → `list` → `use` → `update` → `remove`) against a real local git repository fixture, so it runs fully offline with no network access. Two GitHub Actions workflows are added: `ci.yml` (build+test gate on every push/PR to `master`) and `publish.yml` (build+test+publish gate, triggered by a published GitHub Release, authenticating to npm via an `NPM_TOKEN` secret).

**Tech Stack:** TypeScript, Vitest 1.6 (`vi.hoisted`, `vi.mock`, `vi.spyOn`), Node.js's built-in `fs`/`child_process`, GitHub Actions (`actions/checkout@v4`, `actions/setup-node@v4`).

## Global Constraints

- Node engine floor is `>=20.0.0` (from `package.json` `engines`) — CI and publish workflows must use Node 20.x or newer.
- No new npm dependencies are needed. All mocking uses Vitest's built-in `vi.mock`/`vi.hoisted`/`vi.spyOn` — do not add `sinon`, `jest`, `nock`, etc.
- `tsconfig.json` excludes `tests/` from type-checking (`"exclude": ["node_modules", "dist", "tests"]`) — test files are transpiled but not strictly type-checked by `npm run lint`. Don't fight this; loose typing in test files (e.g. `mock.calls[0][0]`) is acceptable and already the codebase's convention.
- Follow the existing temp-directory convention already used in `tests/unit/config.test.ts`, `tests/unit/registry.test.ts`, and `tests/unit/secrets.test.ts`: set `process.env.CLAUDE_BUNDLE_TEST_DIR` to a freshly created `mkdtempSync('/tmp/claude-bundle-test-')` directory in `beforeEach`, and `rmSync(..., { recursive: true, force: true })` it in `afterEach`. This is what makes `src/core/paths.ts` resolve to an isolated sandbox instead of the real `~/.claude-bundle`.
- `simple-git`'s default export is a callable factory function (CommonJS, `esModuleInterop`) — mock it as `{ default: mockSimpleGit }`. `execa` and `@inquirer/prompts` are ESM packages with named exports (`execa`, `select`, `input`) — mock them as `{ execa: mockFn }` / `{ select: mockFn }` / `{ input: mockFn }`.
- Never delete or weaken an existing passing test. `tests/unit/config.test.ts`, `tests/unit/paths.test.ts` are already adequate as real tests — leave them untouched.
- Commit after every task using this repo's existing prefix convention seen in `git log`: `test:`, `chore:`, `ci:`.

---

## File Structure

**New test files:**
- `tests/unit/commands/add.test.ts` — mocks `core/registry.js`
- `tests/unit/commands/remove.test.ts` — mocks `core/registry.js`
- `tests/unit/commands/list.test.ts` — mocks `core/registry.js`, `core/manifest.js`, `core/secrets.js`
- `tests/unit/commands/update.test.ts` — mocks `core/registry.js`, `utils/git.js`
- `tests/unit/commands/use.test.ts` — mocks `core/registry.js`, `core/manifest.js`, `core/resolver.js`, `core/secrets.js`, `core/launcher.js`
- `tests/unit/commands/init.test.ts` — real filesystem, `process.chdir`
- `tests/unit/commands/secrets.test.ts` — mocks `core/registry.js`, `core/secrets.js`, `core/manifest.js`, `@inquirer/prompts`
- `tests/unit/commands/setup.test.ts` — mocks `child_process`, `core/config.js`, `@inquirer/prompts`, `fs`

**Rewritten test files (replacing stub content with real assertions):**
- `tests/unit/git.test.ts` — mocks `simple-git`
- `tests/unit/menu.test.ts` — mocks `@inquirer/prompts`
- `tests/unit/launcher.test.ts` — mocks `execa`, real temp filesystem
- `tests/unit/resolver.test.ts` — mocks `utils/git.js`, real temp filesystem
- `tests/unit/registry.test.ts` — mocks `utils/git.js`, real temp filesystem (extends existing tests)
- `tests/unit/secrets.test.ts` — mocks `@inquirer/prompts` (extends existing tests)
- `tests/unit/manifest.test.ts` — adds `loadManifest` coverage (extends existing tests)
- `tests/unit/cli.test.ts` — mocks all 8 command modules plus core modules used by `defaultCommand`
- `tests/integration/cli.test.ts` — full round-trip against a local git fixture repo

**Deleted:**
- `tests/unit/placeholder.test.ts`

**Unchanged (already adequate):**
- `tests/unit/config.test.ts`, `tests/unit/paths.test.ts`

**Modified non-test files:**
- `package.json` — add `prepublishOnly` script

**New CI/CD files:**
- `.github/workflows/ci.yml`
- `.github/workflows/publish.yml`

---

### Task 1: Housekeeping — remove placeholder test, add publish safety script

**Files:**
- Delete: `tests/unit/placeholder.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: nothing consumed by later tasks; purely cleanup.

- [ ] **Step 1: Delete the placeholder test**

```bash
rm tests/unit/placeholder.test.ts
```

- [ ] **Step 2: Add a `prepublishOnly` script to `package.json`**

Open `package.json` and change the `scripts` block from:

```json
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest",
    "test:run": "vitest run",
    "lint": "tsc --noEmit"
  },
```

to:

```json
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest",
    "test:run": "vitest run",
    "lint": "tsc --noEmit",
    "prepublishOnly": "npm run build"
  },
```

This guarantees `dist/` is rebuilt from source immediately before `npm publish` runs — whether triggered by CI or by a maintainer running `npm publish` locally — so a stale `dist/` can never ship.

- [ ] **Step 3: Verify the remaining suite still passes**

Run: `npx vitest run`
Expected: `11 passed (11)` test files (one fewer than before), all green.

- [ ] **Step 4: Commit**

```bash
git add package.json
git rm tests/unit/placeholder.test.ts
git commit -m "chore: remove placeholder test and guard publish with prebuild"
```

---

### Task 2: Real unit tests for `src/utils/git.ts`

**Files:**
- Modify: `tests/unit/git.test.ts`

**Interfaces:**
- Consumes: `cloneRepo(url: string, dest: string): Promise<void>`, `pullRepo(path: string): Promise<void>` from `src/utils/git.ts`.
- Produces: establishes the `simple-git` mocking pattern (`vi.hoisted` + `{ default: mockSimpleGit }`) reused by Tasks 6 and 7.

- [ ] **Step 1: Write the test file**

```typescript
import { test, expect, vi, beforeEach } from 'vitest';

const { mockClone, mockPull, mockSimpleGit } = vi.hoisted(() => {
  const mockClone = vi.fn();
  const mockPull = vi.fn();
  const mockSimpleGit = vi.fn(() => ({ clone: mockClone, pull: mockPull }));
  return { mockClone, mockPull, mockSimpleGit };
});

vi.mock('simple-git', () => ({
  default: mockSimpleGit,
}));

import { cloneRepo, pullRepo } from '../../src/utils/git';

beforeEach(() => {
  mockClone.mockReset();
  mockPull.mockReset();
  mockSimpleGit.mockClear();
});

test('cloneRepo calls simpleGit().clone with the url and destination', async () => {
  await cloneRepo('https://example.com/repo.git', '/tmp/dest');

  expect(mockSimpleGit).toHaveBeenCalledWith();
  expect(mockClone).toHaveBeenCalledWith('https://example.com/repo.git', '/tmp/dest');
});

test('pullRepo calls simpleGit(path).pull()', async () => {
  await pullRepo('/tmp/bundle-path');

  expect(mockSimpleGit).toHaveBeenCalledWith('/tmp/bundle-path');
  expect(mockPull).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run tests/unit/git.test.ts`
Expected: `2 passed (2)`

- [ ] **Step 3: Commit**

```bash
git add tests/unit/git.test.ts
git commit -m "test: verify git wrapper delegates to simple-git"
```

---

### Task 3: Real unit tests for `src/core/menu.ts`

**Files:**
- Modify: `tests/unit/menu.test.ts`

**Interfaces:**
- Consumes: `showMenu(bundles: BundleEntry[]): Promise<string | null>` from `src/core/menu.ts`; `BundleEntry` type from `src/core/registry.ts`.
- Produces: establishes the `@inquirer/prompts` mocking pattern (`{ select: mockSelect }`) reused by Task 8's `use` menu-dispatch paths do not need it directly, but Task 16 (`commands/secrets.test.ts`) and Task 17 (`commands/setup.test.ts`) reuse the same `{ input: mockInput }` shape for the sibling export.

- [ ] **Step 1: Write the test file**

```typescript
import { test, expect, vi, beforeEach } from 'vitest';

const { mockSelect } = vi.hoisted(() => ({ mockSelect: vi.fn() }));
vi.mock('@inquirer/prompts', () => ({ select: mockSelect }));

import { showMenu } from '../../src/core/menu';
import type { BundleEntry } from '../../src/core/registry';

beforeEach(() => {
  mockSelect.mockReset();
});

test('showMenu returns null and does not prompt when there are no bundles', async () => {
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

  const result = await showMenu([]);

  expect(result).toBeNull();
  expect(mockSelect).not.toHaveBeenCalled();
  expect(logSpy).toHaveBeenCalledWith('No bundles installed. Run: claude-bundle add <git-url>');

  logSpy.mockRestore();
});

test('showMenu builds one choice per bundle plus a "none" option and returns the selection', async () => {
  const bundles: BundleEntry[] = [
    { name: 'manager', path: '/b/manager', url: 'https://x', description: 'Team mgmt' },
    { name: 'writer', path: '/b/writer', url: 'https://y', description: 'Writing tools' },
  ];
  mockSelect.mockResolvedValue('writer');

  const result = await showMenu(bundles);

  expect(result).toBe('writer');
  expect(mockSelect).toHaveBeenCalledTimes(1);
  const call = mockSelect.mock.calls[0][0] as { message: string; choices: Array<{ value: unknown }> };
  expect(call.message).toBe('Which bundle?');
  expect(call.choices.map((c) => c.value)).toEqual(['manager', 'writer', '---', null]);
});

test('showMenu resolves to null when the user picks the plain session option', async () => {
  const bundles: BundleEntry[] = [{ name: 'manager', path: '/b/manager', url: 'https://x' }];
  mockSelect.mockResolvedValue(null);

  const result = await showMenu(bundles);

  expect(result).toBeNull();
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run tests/unit/menu.test.ts`
Expected: `3 passed (3)`

- [ ] **Step 3: Commit**

```bash
git add tests/unit/menu.test.ts
git commit -m "test: verify menu choice construction and selection handling"
```

---

### Task 4: Expand unit tests for `src/core/secrets.ts`

**Files:**
- Modify: `tests/unit/secrets.test.ts`

**Interfaces:**
- Consumes: `loadSecrets`, `saveSecrets`, `promptForSecrets`, `getSecretsPath` from `src/core/secrets.ts`.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the test file**

```typescript
import { test, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, statSync, writeFileSync } from 'fs';

const { mockInput } = vi.hoisted(() => ({ mockInput: vi.fn() }));
vi.mock('@inquirer/prompts', () => ({ input: mockInput }));

import { loadSecrets, saveSecrets, promptForSecrets, getSecretsPath } from '../../src/core/secrets';

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync('/tmp/claude-bundle-test-');
  process.env.CLAUDE_BUNDLE_TEST_DIR = tempDir;
  mockInput.mockReset();
});

afterEach(() => {
  delete process.env.CLAUDE_BUNDLE_TEST_DIR;
  rmSync(tempDir, { recursive: true, force: true });
});

test('loadSecrets returns empty object if file missing', () => {
  const secrets = loadSecrets('test-bundle');
  expect(secrets).toEqual({});
});

test('saveSecrets writes env file that loadSecrets can read back', () => {
  saveSecrets('test-bundle', { JIRA_TOKEN: 'secret123' });
  const loaded = loadSecrets('test-bundle');
  expect(loaded.JIRA_TOKEN).toBe('secret123');
});

test('saveSecrets writes the file with 0600 permissions', () => {
  saveSecrets('test-bundle', { JIRA_TOKEN: 'secret123' });
  const mode = statSync(getSecretsPath('test-bundle')).mode & 0o777;
  expect(mode).toBe(0o600);
});

test('loadSecrets ignores blank lines and comments and strips quotes', () => {
  writeFileSync(
    getSecretsPath('test-bundle'),
    ['# a comment', '', 'TOKEN="quoted value"', "OTHER='single quoted'", 'PLAIN=bareword'].join('\n')
  );

  expect(loadSecrets('test-bundle')).toEqual({
    TOKEN: 'quoted value',
    OTHER: 'single quoted',
    PLAIN: 'bareword',
  });
});

test('promptForSecrets only prompts for keys that are not already set', async () => {
  saveSecrets('test-bundle', { EXISTING: 'already-set' });
  mockInput.mockResolvedValue('typed-value');

  const result = await promptForSecrets('test-bundle', ['EXISTING', 'NEW_KEY']);

  expect(mockInput).toHaveBeenCalledTimes(1);
  expect(mockInput).toHaveBeenCalledWith({ message: 'Enter NEW_KEY for bundle "test-bundle":' });
  expect(result).toEqual({ EXISTING: 'already-set', NEW_KEY: 'typed-value' });
  expect(loadSecrets('test-bundle')).toEqual({ EXISTING: 'already-set', NEW_KEY: 'typed-value' });
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run tests/unit/secrets.test.ts`
Expected: `5 passed (5)`

- [ ] **Step 3: Commit**

```bash
git add tests/unit/secrets.test.ts
git commit -m "test: cover secrets parsing, permissions, and prompting"
```

---

### Task 5: Expand unit tests for `src/core/manifest.ts`

**Files:**
- Modify: `tests/unit/manifest.test.ts`

**Interfaces:**
- Consumes: `parseManifest`, `loadManifest` from `src/core/manifest.ts`; existing fixture `tests/fixtures/test-bundle/bundle.json`.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the test file**

```typescript
import { test, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
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

test('loadManifest reads and parses bundle.json from a bundle path', () => {
  const bundlePath = join(process.cwd(), 'tests', 'fixtures', 'test-bundle');

  const manifest = loadManifest(bundlePath);

  expect(manifest.name).toBe('test-bundle');
  expect(manifest.description).toBe('Test bundle for integration tests');
  expect(manifest.include_plugins).toEqual([]);
  expect(manifest.requires_secrets).toEqual([]);
});

test('loadManifest throws when bundle.json is missing from the given path', () => {
  const emptyDir = mkdtempSync('/tmp/claude-bundle-test-');

  expect(() => loadManifest(emptyDir)).toThrow();

  rmSync(emptyDir, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run tests/unit/manifest.test.ts`
Expected: `5 passed (5)`

- [ ] **Step 3: Commit**

```bash
git add tests/unit/manifest.test.ts
git commit -m "test: cover loadManifest reading bundle.json from disk"
```

---

### Task 6: Real unit tests for `src/core/resolver.ts`

**Files:**
- Modify: `tests/unit/resolver.test.ts`

**Interfaces:**
- Consumes: `resolveBundle`, `mergeMcpConfigs`, `writeMergedMcpConfig` from `src/core/resolver.ts`; `BundleManifest` type from `src/types/index.ts`; mocks `cloneRepo` from `src/utils/git.ts` (pattern established in Task 2).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the test file**

```typescript
import { test, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';

const { mockCloneRepo } = vi.hoisted(() => ({ mockCloneRepo: vi.fn() }));
vi.mock('../../src/utils/git.js', () => ({ cloneRepo: mockCloneRepo, pullRepo: vi.fn() }));

import { resolveBundle, mergeMcpConfigs, writeMergedMcpConfig } from '../../src/core/resolver';
import type { BundleManifest } from '../../src/types/index.js';

let tempDir: string;
let bundlePath: string;

beforeEach(() => {
  tempDir = mkdtempSync('/tmp/claude-bundle-test-');
  process.env.CLAUDE_BUNDLE_TEST_DIR = tempDir;
  bundlePath = join(tempDir, 'bundle');
  mkdirSync(bundlePath, { recursive: true });

  mockCloneRepo.mockReset();
  mockCloneRepo.mockImplementation(async (_url: string, dest: string) => {
    mkdirSync(dest, { recursive: true });
  });
});

afterEach(() => {
  delete process.env.CLAUDE_BUNDLE_TEST_DIR;
  rmSync(tempDir, { recursive: true, force: true });
});

function manifest(overrides: Partial<BundleManifest> = {}): BundleManifest {
  return { name: 'manager', description: 'desc', include_plugins: [], requires_secrets: [], ...overrides };
}

test("resolveBundle includes the bundle's own plugin dir when it exists", async () => {
  mkdirSync(join(bundlePath, 'plugin'), { recursive: true });

  const resolved = await resolveBundle('manager', bundlePath, manifest());

  expect(resolved.pluginDirs).toEqual([join(bundlePath, 'plugin')]);
  expect(resolved.name).toBe('manager');
  expect(resolved.secrets).toEqual({});
});

test('resolveBundle omits the own plugin dir when it does not exist', async () => {
  const resolved = await resolveBundle('manager', bundlePath, manifest());
  expect(resolved.pluginDirs).toEqual([]);
});

test('resolveBundle clones git-url plugin refs into the plugins dir', async () => {
  const resolved = await resolveBundle('manager', bundlePath, manifest({
    include_plugins: ['https://github.com/user/some-plugin.git'],
  }));

  expect(mockCloneRepo).toHaveBeenCalledTimes(1);
  const [url, dest] = mockCloneRepo.mock.calls[0];
  expect(url).toBe('https://github.com/user/some-plugin.git');
  expect(dest).toMatch(/some-plugin$/);
  expect(resolved.pluginDirs).toEqual([dest]);
});

test('resolveBundle does not re-clone a plugin that already exists on disk', async () => {
  const resolved1 = await resolveBundle('manager', bundlePath, manifest({
    include_plugins: ['https://github.com/user/some-plugin.git'],
  }));
  mockCloneRepo.mockClear();

  const resolved2 = await resolveBundle('manager', bundlePath, manifest({
    include_plugins: ['https://github.com/user/some-plugin.git'],
  }));

  expect(mockCloneRepo).not.toHaveBeenCalled();
  expect(resolved2.pluginDirs).toEqual(resolved1.pluginDirs);
});

test('resolveBundle resolves mcpPath only when the referenced file exists', async () => {
  writeFileSync(join(bundlePath, 'mcp.json'), JSON.stringify({ mcpServers: {} }));

  const resolved = await resolveBundle('manager', bundlePath, manifest({ mcp: 'mcp.json' }));
  expect(resolved.mcpPath).toBe(join(bundlePath, 'mcp.json'));

  const resolvedMissing = await resolveBundle('manager', bundlePath, manifest({ mcp: 'missing.json' }));
  expect(resolvedMissing.mcpPath).toBeUndefined();
});

test('resolveBundle resolves memoryPath only when the referenced dir exists', async () => {
  mkdirSync(join(bundlePath, 'memory'), { recursive: true });

  const resolved = await resolveBundle('manager', bundlePath, manifest({ memory: 'memory' }));
  expect(resolved.memoryPath).toBe(join(bundlePath, 'memory'));

  const resolvedMissing = await resolveBundle('manager', bundlePath, manifest({ memory: 'nope' }));
  expect(resolvedMissing.memoryPath).toBeUndefined();
});

test('mergeMcpConfigs merges mcpServers keys across files and skips missing paths', () => {
  const fileA = join(tempDir, 'a.json');
  const fileB = join(tempDir, 'b.json');
  writeFileSync(fileA, JSON.stringify({ mcpServers: { a: { command: 'a-cmd' } } }));
  writeFileSync(fileB, JSON.stringify({ mcpServers: { b: { command: 'b-cmd' } } }));

  const merged = mergeMcpConfigs([fileA, fileB, join(tempDir, 'missing.json')]);

  expect(merged.mcpServers).toEqual({ a: { command: 'a-cmd' }, b: { command: 'b-cmd' } });
});

test('writeMergedMcpConfig writes formatted JSON to the destination path', () => {
  const destPath = join(tempDir, 'merged.json');

  writeMergedMcpConfig({ mcpServers: { x: { command: 'x' } } }, destPath);

  expect(existsSync(destPath)).toBe(true);
  const content = JSON.parse(readFileSync(destPath, 'utf-8'));
  expect(content).toEqual({ mcpServers: { x: { command: 'x' } } });
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run tests/unit/resolver.test.ts`
Expected: `8 passed (8)`

- [ ] **Step 3: Commit**

```bash
git add tests/unit/resolver.test.ts
git commit -m "test: cover plugin resolution, mcp/memory paths, and config merging"
```

---

### Task 7: Expand unit tests for `src/core/registry.ts`

**Files:**
- Modify: `tests/unit/registry.test.ts`

**Interfaces:**
- Consumes: `addBundle`, `removeBundle`, `listBundles` from `src/core/registry.ts`; `loadConfig` from `src/core/config.ts`; mocks `cloneRepo` from `src/utils/git.ts`.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the test file**

```typescript
import { test, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const { mockCloneRepo } = vi.hoisted(() => ({ mockCloneRepo: vi.fn() }));
vi.mock('../../src/utils/git.js', () => ({ cloneRepo: mockCloneRepo, pullRepo: vi.fn() }));

import * as registry from '../../src/core/registry';
import { loadConfig } from '../../src/core/config';

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync('/tmp/claude-bundle-test-');
  process.env.CLAUDE_BUNDLE_TEST_DIR = tempDir;

  mockCloneRepo.mockReset();
  mockCloneRepo.mockImplementation(async (_url: string, dest: string) => {
    mkdirSync(dest, { recursive: true });
  });
});

afterEach(() => {
  delete process.env.CLAUDE_BUNDLE_TEST_DIR;
  rmSync(tempDir, { recursive: true, force: true });
});

test('listBundles returns empty array initially', () => {
  expect(registry.listBundles()).toEqual([]);
});

test('addBundle clones the repo and registers it in config', async () => {
  await registry.addBundle('https://github.com/user/manager-bundle.git');

  expect(mockCloneRepo).toHaveBeenCalledTimes(1);
  const [url, dest] = mockCloneRepo.mock.calls[0];
  expect(url).toBe('https://github.com/user/manager-bundle.git');
  expect(dest).toMatch(/manager-bundle$/);

  const config = loadConfig();
  expect(config.bundles['manager-bundle']).toEqual({
    path: dest,
    url: 'https://github.com/user/manager-bundle.git',
  });
});

test('addBundle throws if a bundle with the same name already exists on disk', async () => {
  await registry.addBundle('https://github.com/user/manager-bundle.git');
  mockCloneRepo.mockClear();

  await expect(
    registry.addBundle('https://github.com/other/manager-bundle.git')
  ).rejects.toThrow(/already exists/);
  expect(mockCloneRepo).not.toHaveBeenCalled();
});

test('removeBundle throws for an unknown bundle name', () => {
  expect(() => registry.removeBundle('ghost')).toThrow('Bundle "ghost" not found');
});

test('removeBundle unregisters the bundle from config without deleting files by default', async () => {
  await registry.addBundle('https://github.com/user/manager-bundle.git');
  const bundlePath = loadConfig().bundles['manager-bundle'].path;

  registry.removeBundle('manager-bundle');

  expect(loadConfig().bundles['manager-bundle']).toBeUndefined();
  expect(existsSync(bundlePath)).toBe(true);
});

test('removeBundle deletes bundle files when deleteFiles is true', async () => {
  await registry.addBundle('https://github.com/user/manager-bundle.git');
  const bundlePath = loadConfig().bundles['manager-bundle'].path;

  registry.removeBundle('manager-bundle', true);

  expect(existsSync(bundlePath)).toBe(false);
});

test("listBundles reads the description from each bundle's manifest", async () => {
  await registry.addBundle('https://github.com/user/manager-bundle.git');
  const bundlePath = loadConfig().bundles['manager-bundle'].path;
  writeFileSync(join(bundlePath, 'bundle.json'), JSON.stringify({ description: 'Team management bundle' }));

  const bundles = registry.listBundles();

  expect(bundles).toEqual([
    {
      name: 'manager-bundle',
      path: bundlePath,
      url: 'https://github.com/user/manager-bundle.git',
      description: 'Team management bundle',
    },
  ]);
});

test('listBundles falls back to an empty description when the manifest is missing', async () => {
  await registry.addBundle('https://github.com/user/manager-bundle.git');

  const bundles = registry.listBundles();

  expect(bundles[0].description).toBe('');
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run tests/unit/registry.test.ts`
Expected: `7 passed (7)`

- [ ] **Step 3: Commit**

```bash
git add tests/unit/registry.test.ts
git commit -m "test: cover bundle add/remove/list against a real config sandbox"
```

---

### Task 8: Real unit tests for `src/core/launcher.ts`

**Files:**
- Modify: `tests/unit/launcher.test.ts`

**Interfaces:**
- Consumes: `launchBundle(resolved: ResolvedBundle, userArgs?: string[]): Promise<void>` from `src/core/launcher.ts`; `saveConfig` from `src/core/config.ts`; `ResolvedBundle` type from `src/types/index.ts`. Mocks `execa` from the `execa` package.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the test file**

```typescript
import { test, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

const { mockExeca } = vi.hoisted(() => ({ mockExeca: vi.fn() }));
vi.mock('execa', () => ({ execa: mockExeca }));

import { launchBundle } from '../../src/core/launcher';
import { saveConfig } from '../../src/core/config';
import type { ResolvedBundle } from '../../src/types/index.js';

let tempDir: string;
let bundlePath: string;

beforeEach(() => {
  tempDir = mkdtempSync('/tmp/claude-bundle-test-');
  process.env.CLAUDE_BUNDLE_TEST_DIR = tempDir;
  process.env.TMPDIR = tempDir;
  bundlePath = join(tempDir, 'bundle');
  mkdirSync(bundlePath, { recursive: true });

  mockExeca.mockReset();
  mockExeca.mockResolvedValue({});
});

afterEach(() => {
  delete process.env.CLAUDE_BUNDLE_TEST_DIR;
  delete process.env.TMPDIR;
  rmSync(tempDir, { recursive: true, force: true });
});

function baseResolved(overrides: Partial<ResolvedBundle> = {}): ResolvedBundle {
  return {
    name: 'manager',
    manifest: {
      name: 'manager',
      description: 'A team management bundle for everything',
      include_plugins: [],
      requires_secrets: [],
    },
    bundlePath,
    pluginDirs: [],
    secrets: {},
    ...overrides,
  };
}

test('launchBundle throws when realClaudePath is not configured', async () => {
  saveConfig({ version: '1', realClaudePath: '', bundles: {} });

  await expect(launchBundle(baseResolved())).rejects.toThrow(
    'Real claude path not configured. Run: claude-bundle setup'
  );
  expect(mockExeca).not.toHaveBeenCalled();
});

test('launchBundle execs the real claude binary with plugin dirs and user args', async () => {
  saveConfig({ version: '1', realClaudePath: '/bin/echo', bundles: {} });
  const pluginDir = join(tempDir, 'plugin-a');
  mkdirSync(pluginDir, { recursive: true });

  await launchBundle(baseResolved({ pluginDirs: [pluginDir] }), ['--foo']);

  expect(mockExeca).toHaveBeenCalledTimes(1);
  const [bin, args, opts] = mockExeca.mock.calls[0];
  expect(bin).toBe('/bin/echo');
  expect(args).toEqual(expect.arrayContaining(['--plugin-dir', pluginDir, '--foo']));
  expect(opts).toMatchObject({ stdio: 'inherit' });
});

test('launchBundle merges mcp configs from bundle mcpPath and plugin dirs', async () => {
  saveConfig({ version: '1', realClaudePath: '/bin/echo', bundles: {} });

  const ownMcpPath = join(bundlePath, 'mcp.json');
  writeFileSync(ownMcpPath, JSON.stringify({ mcpServers: { own: { command: 'own-cmd' } } }));

  const pluginDir = join(tempDir, 'plugin-a');
  mkdirSync(pluginDir, { recursive: true });
  writeFileSync(join(pluginDir, 'mcp.json'), JSON.stringify({ mcpServers: { fromPlugin: { command: 'plugin-cmd' } } }));

  await launchBundle(baseResolved({ pluginDirs: [pluginDir], mcpPath: ownMcpPath }));

  const [, args] = mockExeca.mock.calls[0];
  const mcpFlagIndex = args.indexOf('--mcp-config');
  expect(mcpFlagIndex).toBeGreaterThan(-1);
  const mergedPath = args[mcpFlagIndex + 1];
  const merged = JSON.parse(readFileSync(mergedPath, 'utf-8'));
  expect(merged.mcpServers).toEqual({
    own: { command: 'own-cmd' },
    fromPlugin: { command: 'plugin-cmd' },
  });
  expect(args).toContain('--strict-mcp-config');
});

test('launchBundle adds --add-dir for memoryPath when present', async () => {
  saveConfig({ version: '1', realClaudePath: '/bin/echo', bundles: {} });
  const memoryPath = join(tempDir, 'memory');
  mkdirSync(memoryPath, { recursive: true });

  await launchBundle(baseResolved({ memoryPath }));

  const [, args] = mockExeca.mock.calls[0];
  expect(args).toEqual(expect.arrayContaining(['--add-dir', memoryPath]));
});

test('launchBundle appends the bundle README as a system prompt when present', async () => {
  saveConfig({ version: '1', realClaudePath: '/bin/echo', bundles: {} });
  writeFileSync(join(bundlePath, 'README.md'), '# Manager bundle instructions');

  await launchBundle(baseResolved());

  const [, args] = mockExeca.mock.calls[0];
  const flagIndex = args.indexOf('--append-system-prompt');
  expect(flagIndex).toBeGreaterThan(-1);
  expect(args[flagIndex + 1]).toBe('# Manager bundle instructions');
});

test('launchBundle passes resolved secrets merged with process.env', async () => {
  saveConfig({ version: '1', realClaudePath: '/bin/echo', bundles: {} });

  await launchBundle(baseResolved({ secrets: { JIRA_TOKEN: 'abc123' } }));

  const [, , opts] = mockExeca.mock.calls[0];
  expect(opts.env.JIRA_TOKEN).toBe('abc123');
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run tests/unit/launcher.test.ts`
Expected: `6 passed (6)`

- [ ] **Step 3: Commit**

```bash
git add tests/unit/launcher.test.ts
git commit -m "test: cover launcher arg building, mcp merging, and secret env injection"
```

---

### Task 9: Real unit tests for `src/cli.ts`

**Files:**
- Modify: `tests/unit/cli.test.ts`

**Interfaces:**
- Consumes: `showHelp`, `dispatch(args: string[]): Promise<void>` from `src/cli.ts`. Mocks all 8 command modules (`src/commands/*.js`) plus the core modules `defaultCommand` dynamically imports (`core/registry.js`, `core/menu.js`, `core/manifest.js`, `core/resolver.js`, `core/secrets.js`, `core/launcher.js`, `core/config.js`) and `execa`.
- Produces: nothing consumed by later tasks.

**Important implementation detail:** `defaultCommand` (in `src/cli.ts`) reads `process.argv.slice(2)` directly rather than the `args` parameter passed into `dispatch`. In production this is harmless because `src/index.ts` calls `dispatch(process.argv.slice(2))`, so they're always identical — but in a unit test calling `dispatch([])` directly, `process.argv` still holds Vitest's own CLI arguments. The two `defaultCommand` tests below stub `process.argv` for the duration of the test to keep assertions deterministic.

- [ ] **Step 1: Write the test file**

```typescript
import { test, expect, vi, beforeEach } from 'vitest';

const {
  mockAddCommand, mockRemoveCommand, mockListCommand, mockUpdateCommand,
  mockUseCommand, mockInitCommand, mockSecretsCommand, mockSetupCommand,
} = vi.hoisted(() => ({
  mockAddCommand: vi.fn(),
  mockRemoveCommand: vi.fn(),
  mockListCommand: vi.fn(),
  mockUpdateCommand: vi.fn(),
  mockUseCommand: vi.fn(),
  mockInitCommand: vi.fn(),
  mockSecretsCommand: vi.fn(),
  mockSetupCommand: vi.fn(),
}));

vi.mock('../../src/commands/add.js', () => ({ addCommand: mockAddCommand }));
vi.mock('../../src/commands/remove.js', () => ({ removeCommand: mockRemoveCommand }));
vi.mock('../../src/commands/list.js', () => ({ listCommand: mockListCommand }));
vi.mock('../../src/commands/update.js', () => ({ updateCommand: mockUpdateCommand }));
vi.mock('../../src/commands/use.js', () => ({ useCommand: mockUseCommand }));
vi.mock('../../src/commands/init.js', () => ({ initCommand: mockInitCommand }));
vi.mock('../../src/commands/secrets.js', () => ({ secretsCommand: mockSecretsCommand }));
vi.mock('../../src/commands/setup.js', () => ({ setupCommand: mockSetupCommand }));

const {
  mockListBundles, mockShowMenu, mockLoadManifest, mockResolveBundle,
  mockPromptForSecrets, mockLaunchBundle, mockLoadConfig, mockExeca,
} = vi.hoisted(() => ({
  mockListBundles: vi.fn(),
  mockShowMenu: vi.fn(),
  mockLoadManifest: vi.fn(),
  mockResolveBundle: vi.fn(),
  mockPromptForSecrets: vi.fn(),
  mockLaunchBundle: vi.fn(),
  mockLoadConfig: vi.fn(),
  mockExeca: vi.fn(),
}));

vi.mock('../../src/core/registry.js', () => ({ listBundles: mockListBundles }));
vi.mock('../../src/core/menu.js', () => ({ showMenu: mockShowMenu }));
vi.mock('../../src/core/manifest.js', () => ({ loadManifest: mockLoadManifest }));
vi.mock('../../src/core/resolver.js', () => ({ resolveBundle: mockResolveBundle }));
vi.mock('../../src/core/secrets.js', () => ({ promptForSecrets: mockPromptForSecrets }));
vi.mock('../../src/core/launcher.js', () => ({ launchBundle: mockLaunchBundle }));
vi.mock('../../src/core/config.js', () => ({ loadConfig: mockLoadConfig }));
vi.mock('execa', () => ({ execa: mockExeca }));

import { showHelp, dispatch } from '../../src/cli';

beforeEach(() => {
  vi.resetAllMocks();
});

test('showHelp and dispatch are exported functions', () => {
  expect(typeof showHelp).toBe('function');
  expect(typeof dispatch).toBe('function');
});

test('dispatch routes "add" to addCommand with the remaining args', async () => {
  await dispatch(['add', 'https://example.com/repo.git']);
  expect(mockAddCommand).toHaveBeenCalledWith(['https://example.com/repo.git']);
});

test('dispatch routes "remove" to removeCommand', async () => {
  await dispatch(['remove', 'my-bundle', '--delete-files']);
  expect(mockRemoveCommand).toHaveBeenCalledWith(['my-bundle', '--delete-files']);
});

test('dispatch routes "list" to listCommand with no args', async () => {
  await dispatch(['list']);
  expect(mockListCommand).toHaveBeenCalledWith();
});

test('dispatch routes "update" to updateCommand', async () => {
  await dispatch(['update', 'my-bundle']);
  expect(mockUpdateCommand).toHaveBeenCalledWith(['my-bundle']);
});

test('dispatch routes "use" to useCommand', async () => {
  await dispatch(['use', 'my-bundle']);
  expect(mockUseCommand).toHaveBeenCalledWith(['my-bundle']);
});

test('dispatch routes "init" to initCommand', async () => {
  await dispatch(['init', 'my-bundle']);
  expect(mockInitCommand).toHaveBeenCalledWith(['my-bundle']);
});

test('dispatch routes "secrets" to secretsCommand', async () => {
  await dispatch(['secrets', 'my-bundle']);
  expect(mockSecretsCommand).toHaveBeenCalledWith(['my-bundle']);
});

test('dispatch routes "setup" to setupCommand with no args', async () => {
  await dispatch(['setup']);
  expect(mockSetupCommand).toHaveBeenCalledWith();
});

test('dispatch shows help text for "-h" and "--help"', async () => {
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

  await dispatch(['-h']);
  await dispatch(['--help']);

  expect(logSpy).toHaveBeenCalledTimes(2);
  expect(logSpy.mock.calls[0][0]).toContain('claude-bundle - Bundle manager for Claude Code');
  logSpy.mockRestore();
});

test('dispatch prints the version for "-v" and "--version"', async () => {
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

  await dispatch(['-v']);
  await dispatch(['--version']);

  expect(logSpy).toHaveBeenCalledWith('claude-bundle v0.1.0');
  logSpy.mockRestore();
});

test('dispatch with no command launches a plain session when "none" is selected', async () => {
  mockListBundles.mockReturnValue([
    { name: 'manager', path: '/bundles/manager', url: 'https://x', description: 'desc' },
  ]);
  mockShowMenu.mockResolvedValue(null);
  mockLoadConfig.mockReturnValue({ version: '1', realClaudePath: '/bin/echo', bundles: {} });
  mockExeca.mockResolvedValue({});

  const originalArgv = process.argv;
  process.argv = ['node', 'claude-bundle'];
  try {
    await dispatch([]);
  } finally {
    process.argv = originalArgv;
  }

  expect(mockShowMenu).toHaveBeenCalledWith([
    { name: 'manager', path: '/bundles/manager', url: 'https://x', description: 'desc' },
  ]);
  expect(mockExeca).toHaveBeenCalledWith('/bin/echo', [], { stdio: 'inherit' });
});

test('dispatch with no command resolves and launches the selected bundle', async () => {
  const bundle = { name: 'manager', path: '/bundles/manager', url: 'https://x', description: 'desc' };
  const manifest = {
    name: 'manager',
    description: 'desc',
    include_plugins: [],
    requires_secrets: ['TOKEN'],
  };
  const resolved = {
    name: 'manager',
    manifest,
    bundlePath: '/bundles/manager',
    pluginDirs: [],
    secrets: {},
  };

  mockListBundles.mockReturnValue([bundle]);
  mockShowMenu.mockResolvedValue('manager');
  mockLoadManifest.mockReturnValue(manifest);
  mockResolveBundle.mockResolvedValue(resolved);
  mockPromptForSecrets.mockResolvedValue({ TOKEN: 'secret' });
  mockLaunchBundle.mockResolvedValue(undefined);

  const originalArgv = process.argv;
  process.argv = ['node', 'claude-bundle'];
  try {
    await dispatch([]);
  } finally {
    process.argv = originalArgv;
  }

  expect(mockLoadManifest).toHaveBeenCalledWith('/bundles/manager');
  expect(mockResolveBundle).toHaveBeenCalledWith('manager', '/bundles/manager', manifest);
  expect(mockPromptForSecrets).toHaveBeenCalledWith('manager', ['TOKEN']);
  expect(mockLaunchBundle).toHaveBeenCalledWith({ ...resolved, secrets: { TOKEN: 'secret' } }, []);
});

test('dispatch with no command exits when the selected bundle is missing from the list', async () => {
  mockListBundles.mockReturnValue([]);
  mockShowMenu.mockResolvedValue('ghost');
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('exit');
  });
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  await expect(dispatch([])).rejects.toThrow('exit');
  expect(errorSpy).toHaveBeenCalledWith('Bundle "ghost" not found');
  expect(exitSpy).toHaveBeenCalledWith(1);

  exitSpy.mockRestore();
  errorSpy.mockRestore();
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run tests/unit/cli.test.ts`
Expected: `13 passed (13)`

- [ ] **Step 3: Commit**

```bash
git add tests/unit/cli.test.ts
git commit -m "test: cover CLI dispatch routing and the default menu flow"
```

---

### Task 10: Unit tests for `src/commands/add.ts`

**Files:**
- Create: `tests/unit/commands/add.test.ts`

**Interfaces:**
- Consumes: `addCommand(args: string[]): Promise<void>` from `src/commands/add.ts`. Mocks `addBundle` from `src/core/registry.ts`.

- [ ] **Step 1: Write the test file**

```typescript
import { test, expect, vi, beforeEach } from 'vitest';

const { mockAddBundle } = vi.hoisted(() => ({ mockAddBundle: vi.fn() }));
vi.mock('../../../src/core/registry.js', () => ({ addBundle: mockAddBundle }));

import { addCommand } from '../../../src/commands/add';

beforeEach(() => {
  mockAddBundle.mockReset();
  mockAddBundle.mockResolvedValue(undefined);
});

test('addCommand calls addBundle with the given url', async () => {
  await addCommand(['https://github.com/user/manager-bundle.git']);
  expect(mockAddBundle).toHaveBeenCalledWith('https://github.com/user/manager-bundle.git');
});

test('addCommand exits with an error when no url is given', async () => {
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('exit');
  });
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  await expect(addCommand([])).rejects.toThrow('exit');
  expect(errorSpy).toHaveBeenCalledWith('Usage: claude-bundle add <git-url>');
  expect(mockAddBundle).not.toHaveBeenCalled();

  exitSpy.mockRestore();
  errorSpy.mockRestore();
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run tests/unit/commands/add.test.ts`
Expected: `2 passed (2)`

- [ ] **Step 3: Commit**

```bash
git add tests/unit/commands/add.test.ts
git commit -m "test: cover add command usage and delegation to addBundle"
```

---

### Task 11: Unit tests for `src/commands/remove.ts`

**Files:**
- Create: `tests/unit/commands/remove.test.ts`

**Interfaces:**
- Consumes: `removeCommand(args: string[]): Promise<void>` from `src/commands/remove.ts`. Mocks `removeBundle` from `src/core/registry.ts`.

- [ ] **Step 1: Write the test file**

```typescript
import { test, expect, vi, beforeEach } from 'vitest';

const { mockRemoveBundle } = vi.hoisted(() => ({ mockRemoveBundle: vi.fn() }));
vi.mock('../../../src/core/registry.js', () => ({ removeBundle: mockRemoveBundle }));

import { removeCommand } from '../../../src/commands/remove';

beforeEach(() => {
  mockRemoveBundle.mockReset();
});

test('removeCommand removes a bundle without deleting files by default', async () => {
  await removeCommand(['manager']);
  expect(mockRemoveBundle).toHaveBeenCalledWith('manager', false);
});

test('removeCommand deletes files when --delete-files is passed', async () => {
  await removeCommand(['manager', '--delete-files']);
  expect(mockRemoveBundle).toHaveBeenCalledWith('manager', true);
});

test('removeCommand exits with an error when no name is given', async () => {
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('exit');
  });
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  await expect(removeCommand([])).rejects.toThrow('exit');
  expect(errorSpy).toHaveBeenCalledWith('Usage: claude-bundle remove <name> [--delete-files]');
  expect(mockRemoveBundle).not.toHaveBeenCalled();

  exitSpy.mockRestore();
  errorSpy.mockRestore();
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run tests/unit/commands/remove.test.ts`
Expected: `3 passed (3)`

- [ ] **Step 3: Commit**

```bash
git add tests/unit/commands/remove.test.ts
git commit -m "test: cover remove command flag parsing and delegation"
```

---

### Task 12: Unit tests for `src/commands/list.ts`

**Files:**
- Create: `tests/unit/commands/list.test.ts`

**Interfaces:**
- Consumes: `listCommand(): Promise<void>` from `src/commands/list.ts`. Mocks `listBundles` from `src/core/registry.ts`, `loadManifest` from `src/core/manifest.ts`, `loadSecrets` from `src/core/secrets.ts`.

- [ ] **Step 1: Write the test file**

```typescript
import { test, expect, vi, beforeEach } from 'vitest';

const { mockListBundles, mockLoadManifest, mockLoadSecrets } = vi.hoisted(() => ({
  mockListBundles: vi.fn(),
  mockLoadManifest: vi.fn(),
  mockLoadSecrets: vi.fn(),
}));
vi.mock('../../../src/core/registry.js', () => ({ listBundles: mockListBundles }));
vi.mock('../../../src/core/manifest.js', () => ({ loadManifest: mockLoadManifest }));
vi.mock('../../../src/core/secrets.js', () => ({ loadSecrets: mockLoadSecrets }));

import { listCommand } from '../../../src/commands/list';

beforeEach(() => {
  mockListBundles.mockReset();
  mockLoadManifest.mockReset();
  mockLoadSecrets.mockReset();
});

test('listCommand prints a message when there are no bundles', async () => {
  mockListBundles.mockReturnValue([]);
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

  await listCommand();

  expect(logSpy).toHaveBeenCalledWith('No bundles installed.');
  logSpy.mockRestore();
});

test('listCommand prints each bundle with its secrets status', async () => {
  mockListBundles.mockReturnValue([
    { name: 'manager', path: '/b/manager', url: 'https://x', description: 'Team mgmt' },
  ]);
  mockLoadManifest.mockReturnValue({ name: 'manager', description: 'Team mgmt', requires_secrets: ['A', 'B'] });
  mockLoadSecrets.mockReturnValue({ A: 'set' });
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

  await listCommand();

  const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
  expect(output).toContain('manager');
  expect(output).toContain('1/2 secrets set');
  logSpy.mockRestore();
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run tests/unit/commands/list.test.ts`
Expected: `2 passed (2)`

- [ ] **Step 3: Commit**

```bash
git add tests/unit/commands/list.test.ts
git commit -m "test: cover list command output and secrets status line"
```

---

### Task 13: Unit tests for `src/commands/update.ts`

**Files:**
- Create: `tests/unit/commands/update.test.ts`

**Interfaces:**
- Consumes: `updateCommand(args: string[]): Promise<void>` from `src/commands/update.ts`. Mocks `listBundles` from `src/core/registry.ts`, `pullRepo` from `src/utils/git.ts`.

- [ ] **Step 1: Write the test file**

```typescript
import { test, expect, vi, beforeEach } from 'vitest';

const { mockListBundles, mockPullRepo } = vi.hoisted(() => ({
  mockListBundles: vi.fn(),
  mockPullRepo: vi.fn(),
}));
vi.mock('../../../src/core/registry.js', () => ({ listBundles: mockListBundles }));
vi.mock('../../../src/utils/git.js', () => ({ pullRepo: mockPullRepo, cloneRepo: vi.fn() }));

import { updateCommand } from '../../../src/commands/update';

beforeEach(() => {
  mockListBundles.mockReset();
  mockPullRepo.mockReset();
  mockPullRepo.mockResolvedValue(undefined);
});

test('updateCommand pulls a single named bundle', async () => {
  mockListBundles.mockReturnValue([{ name: 'manager', path: '/b/manager', url: 'https://x' }]);

  await updateCommand(['manager']);

  expect(mockPullRepo).toHaveBeenCalledWith('/b/manager');
  expect(mockPullRepo).toHaveBeenCalledTimes(1);
});

test('updateCommand exits with an error when the named bundle is not found', async () => {
  mockListBundles.mockReturnValue([]);
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('exit');
  });
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  await expect(updateCommand(['ghost'])).rejects.toThrow('exit');
  expect(errorSpy).toHaveBeenCalledWith('Bundle "ghost" not found');

  exitSpy.mockRestore();
  errorSpy.mockRestore();
});

test('updateCommand pulls every bundle when no name is given', async () => {
  mockListBundles.mockReturnValue([
    { name: 'manager', path: '/b/manager', url: 'https://x' },
    { name: 'writer', path: '/b/writer', url: 'https://y' },
  ]);

  await updateCommand([]);

  expect(mockPullRepo).toHaveBeenCalledTimes(2);
  expect(mockPullRepo).toHaveBeenCalledWith('/b/manager');
  expect(mockPullRepo).toHaveBeenCalledWith('/b/writer');
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run tests/unit/commands/update.test.ts`
Expected: `3 passed (3)`

- [ ] **Step 3: Commit**

```bash
git add tests/unit/commands/update.test.ts
git commit -m "test: cover update command single-bundle and update-all paths"
```

---

### Task 14: Unit tests for `src/commands/use.ts`

**Files:**
- Create: `tests/unit/commands/use.test.ts`

**Interfaces:**
- Consumes: `useCommand(args: string[]): Promise<void>` from `src/commands/use.ts`. Mocks `listBundles` (registry), `loadManifest` (manifest), `resolveBundle` (resolver), `promptForSecrets` (secrets), `launchBundle` (launcher).

- [ ] **Step 1: Write the test file**

```typescript
import { test, expect, vi, beforeEach } from 'vitest';

const {
  mockListBundles, mockLoadManifest, mockResolveBundle, mockPromptForSecrets, mockLaunchBundle,
} = vi.hoisted(() => ({
  mockListBundles: vi.fn(),
  mockLoadManifest: vi.fn(),
  mockResolveBundle: vi.fn(),
  mockPromptForSecrets: vi.fn(),
  mockLaunchBundle: vi.fn(),
}));
vi.mock('../../../src/core/registry.js', () => ({ listBundles: mockListBundles }));
vi.mock('../../../src/core/manifest.js', () => ({ loadManifest: mockLoadManifest }));
vi.mock('../../../src/core/resolver.js', () => ({ resolveBundle: mockResolveBundle }));
vi.mock('../../../src/core/secrets.js', () => ({ promptForSecrets: mockPromptForSecrets }));
vi.mock('../../../src/core/launcher.js', () => ({ launchBundle: mockLaunchBundle }));

import { useCommand } from '../../../src/commands/use';

beforeEach(() => {
  mockListBundles.mockReset();
  mockLoadManifest.mockReset();
  mockResolveBundle.mockReset();
  mockPromptForSecrets.mockReset();
  mockLaunchBundle.mockReset();
});

test('useCommand exits with an error when no name is given', async () => {
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('exit');
  });
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  await expect(useCommand([])).rejects.toThrow('exit');
  expect(errorSpy).toHaveBeenCalledWith('Usage: claude-bundle use <name>');

  exitSpy.mockRestore();
  errorSpy.mockRestore();
});

test('useCommand exits with an error when the bundle is not found', async () => {
  mockListBundles.mockReturnValue([]);
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('exit');
  });
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  await expect(useCommand(['ghost'])).rejects.toThrow('exit');
  expect(errorSpy).toHaveBeenCalledWith('Bundle "ghost" not found');

  exitSpy.mockRestore();
  errorSpy.mockRestore();
});

test('useCommand skips prompting for secrets when none are required', async () => {
  const bundle = { name: 'manager', path: '/b/manager', url: 'https://x' };
  const manifest = { name: 'manager', description: 'desc', requires_secrets: [] };
  const resolved = { name: 'manager', manifest, bundlePath: '/b/manager', pluginDirs: [], secrets: {} };

  mockListBundles.mockReturnValue([bundle]);
  mockLoadManifest.mockReturnValue(manifest);
  mockResolveBundle.mockResolvedValue(resolved);
  mockLaunchBundle.mockResolvedValue(undefined);

  await useCommand(['manager', '--extra']);

  expect(mockPromptForSecrets).not.toHaveBeenCalled();
  expect(mockLaunchBundle).toHaveBeenCalledWith(resolved, ['--extra']);
});

test('useCommand prompts for and attaches required secrets before launching', async () => {
  const bundle = { name: 'manager', path: '/b/manager', url: 'https://x' };
  const manifest = { name: 'manager', description: 'desc', requires_secrets: ['TOKEN'] };
  const resolved = { name: 'manager', manifest, bundlePath: '/b/manager', pluginDirs: [], secrets: {} };

  mockListBundles.mockReturnValue([bundle]);
  mockLoadManifest.mockReturnValue(manifest);
  mockResolveBundle.mockResolvedValue(resolved);
  mockPromptForSecrets.mockResolvedValue({ TOKEN: 'abc' });
  mockLaunchBundle.mockResolvedValue(undefined);

  await useCommand(['manager']);

  expect(mockPromptForSecrets).toHaveBeenCalledWith('manager', ['TOKEN']);
  expect(mockLaunchBundle).toHaveBeenCalledWith({ ...resolved, secrets: { TOKEN: 'abc' } }, []);
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run tests/unit/commands/use.test.ts`
Expected: `4 passed (4)`

- [ ] **Step 3: Commit**

```bash
git add tests/unit/commands/use.test.ts
git commit -m "test: cover use command secret prompting and launch delegation"
```

---

### Task 15: Unit tests for `src/commands/init.ts`

**Files:**
- Create: `tests/unit/commands/init.test.ts`

**Interfaces:**
- Consumes: `initCommand(args: string[]): Promise<void>` from `src/commands/init.ts`. No mocks — exercises the real filesystem via `process.chdir` into a temp directory.

- [ ] **Step 1: Write the test file**

```typescript
import { test, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { initCommand } from '../../../src/commands/init';

let tempDir: string;
let originalCwd: string;

beforeEach(() => {
  originalCwd = process.cwd();
  tempDir = mkdtempSync('/tmp/claude-bundle-test-');
  process.chdir(tempDir);
});

afterEach(() => {
  process.chdir(originalCwd);
  rmSync(tempDir, { recursive: true, force: true });
});

test('initCommand scaffolds a bundle directory with the default name', async () => {
  await initCommand([]);

  const bundleDir = join(tempDir, 'my-bundle');
  expect(existsSync(join(bundleDir, 'plugin'))).toBe(true);
  expect(existsSync(join(bundleDir, 'memory'))).toBe(true);
  expect(existsSync(join(bundleDir, 'README.md'))).toBe(true);

  const manifest = JSON.parse(readFileSync(join(bundleDir, 'bundle.json'), 'utf-8'));
  expect(manifest.name).toBe('my-bundle');
  expect(manifest.include_plugins).toEqual([]);
  expect(manifest.requires_secrets).toEqual([]);

  const mcp = JSON.parse(readFileSync(join(bundleDir, 'mcp.json'), 'utf-8'));
  expect(mcp).toEqual({ mcpServers: {} });
});

test('initCommand uses the given name for the bundle directory and manifest', async () => {
  await initCommand(['support-bundle']);

  const bundleDir = join(tempDir, 'support-bundle');
  expect(existsSync(bundleDir)).toBe(true);

  const manifest = JSON.parse(readFileSync(join(bundleDir, 'bundle.json'), 'utf-8'));
  expect(manifest.name).toBe('support-bundle');
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run tests/unit/commands/init.test.ts`
Expected: `2 passed (2)`

- [ ] **Step 3: Commit**

```bash
git add tests/unit/commands/init.test.ts
git commit -m "test: cover init command bundle scaffolding on real filesystem"
```

---

### Task 16: Unit tests for `src/commands/secrets.ts`

**Files:**
- Create: `tests/unit/commands/secrets.test.ts`

**Interfaces:**
- Consumes: `secretsCommand(args: string[]): Promise<void>` from `src/commands/secrets.ts`. Mocks `listBundles` (registry), `loadSecrets`/`saveSecrets` (secrets), `loadManifest` (manifest), `input` (`@inquirer/prompts`).

- [ ] **Step 1: Write the test file**

```typescript
import { test, expect, vi, beforeEach } from 'vitest';

const { mockListBundles, mockLoadSecrets, mockSaveSecrets, mockLoadManifest, mockInput } = vi.hoisted(() => ({
  mockListBundles: vi.fn(),
  mockLoadSecrets: vi.fn(),
  mockSaveSecrets: vi.fn(),
  mockLoadManifest: vi.fn(),
  mockInput: vi.fn(),
}));
vi.mock('../../../src/core/registry.js', () => ({ listBundles: mockListBundles }));
vi.mock('../../../src/core/secrets.js', () => ({ loadSecrets: mockLoadSecrets, saveSecrets: mockSaveSecrets }));
vi.mock('../../../src/core/manifest.js', () => ({ loadManifest: mockLoadManifest }));
vi.mock('@inquirer/prompts', () => ({ input: mockInput }));

import { secretsCommand } from '../../../src/commands/secrets';

beforeEach(() => {
  mockListBundles.mockReset();
  mockLoadSecrets.mockReset();
  mockSaveSecrets.mockReset();
  mockLoadManifest.mockReset();
  mockInput.mockReset();
});

test('secretsCommand exits with an error when no name is given', async () => {
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('exit');
  });
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  await expect(secretsCommand([])).rejects.toThrow('exit');
  expect(errorSpy).toHaveBeenCalledWith('Usage: claude-bundle secrets <name>');

  exitSpy.mockRestore();
  errorSpy.mockRestore();
});

test('secretsCommand exits with an error when the bundle is not found', async () => {
  mockListBundles.mockReturnValue([]);
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('exit');
  });
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  await expect(secretsCommand(['ghost'])).rejects.toThrow('exit');
  expect(errorSpy).toHaveBeenCalledWith('Bundle "ghost" not found');

  exitSpy.mockRestore();
  errorSpy.mockRestore();
});

test('secretsCommand prompts for each required secret, defaulting to the current value', async () => {
  mockListBundles.mockReturnValue([{ name: 'manager', path: '/b/manager', url: 'https://x' }]);
  mockLoadManifest.mockReturnValue({ name: 'manager', description: 'desc', requires_secrets: ['A', 'B'] });
  mockLoadSecrets.mockReturnValue({ A: 'existing-a' });
  mockInput.mockImplementation(async ({ default: def }: { default: string }) => (def ? def : 'typed-b'));

  await secretsCommand(['manager']);

  expect(mockInput).toHaveBeenCalledTimes(2);
  expect(mockInput).toHaveBeenNthCalledWith(1, { message: 'A (press enter to keep current):', default: 'existing-a' });
  expect(mockInput).toHaveBeenNthCalledWith(2, { message: 'B:', default: '' });
  expect(mockSaveSecrets).toHaveBeenCalledWith('manager', { A: 'existing-a', B: 'typed-b' });
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run tests/unit/commands/secrets.test.ts`
Expected: `3 passed (3)`

- [ ] **Step 3: Commit**

```bash
git add tests/unit/commands/secrets.test.ts
git commit -m "test: cover secrets command prompting and current-value defaults"
```

---

### Task 17: Unit tests for `src/commands/setup.ts`

**Files:**
- Create: `tests/unit/commands/setup.test.ts`

**Interfaces:**
- Consumes: `setupCommand(): Promise<void>` from `src/commands/setup.ts`. Mocks `execSync` (`child_process`), `loadConfig`/`saveConfig` (`src/core/config.ts`), `input` (`@inquirer/prompts`), and `fs` (only `appendFileSync` matters — `existsSync`/`readFileSync` are unused dead imports in `setup.ts`, mocked as no-ops).

- [ ] **Step 1: Write the test file**

```typescript
import { test, expect, vi, beforeEach } from 'vitest';

const { mockExecSync, mockLoadConfig, mockSaveConfig, mockInput, mockAppendFileSync } = vi.hoisted(() => ({
  mockExecSync: vi.fn(),
  mockLoadConfig: vi.fn(),
  mockSaveConfig: vi.fn(),
  mockInput: vi.fn(),
  mockAppendFileSync: vi.fn(),
}));
vi.mock('child_process', () => ({ execSync: mockExecSync }));
vi.mock('../../../src/core/config.js', () => ({ loadConfig: mockLoadConfig, saveConfig: mockSaveConfig }));
vi.mock('@inquirer/prompts', () => ({ input: mockInput }));
vi.mock('fs', () => ({ existsSync: vi.fn(), readFileSync: vi.fn(), appendFileSync: mockAppendFileSync }));

import { setupCommand } from '../../../src/commands/setup';

beforeEach(() => {
  mockExecSync.mockReset();
  mockLoadConfig.mockReset();
  mockSaveConfig.mockReset();
  mockInput.mockReset();
  mockAppendFileSync.mockReset();
  mockLoadConfig.mockReturnValue({ version: '1', realClaudePath: '', bundles: {} });
});

test('setupCommand exits with an error when claude is not found in PATH', async () => {
  mockExecSync.mockImplementation(() => {
    throw new Error('not found');
  });
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('exit');
  });
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  await expect(setupCommand()).rejects.toThrow('exit');
  expect(errorSpy).toHaveBeenCalledWith('Could not find "claude" in PATH');
  expect(mockSaveConfig).not.toHaveBeenCalled();

  exitSpy.mockRestore();
  errorSpy.mockRestore();
});

test('setupCommand saves the discovered claude path and skips the alias when declined', async () => {
  mockExecSync.mockReturnValue('/usr/local/bin/claude\n');
  mockInput.mockResolvedValue('no');

  await setupCommand();

  expect(mockSaveConfig).toHaveBeenCalledWith(
    expect.objectContaining({ realClaudePath: '/usr/local/bin/claude' })
  );
  expect(mockAppendFileSync).not.toHaveBeenCalled();
});

test('setupCommand appends the shell alias when the user accepts', async () => {
  mockExecSync.mockReturnValue('/usr/local/bin/claude\n');
  mockInput.mockResolvedValue('yes');

  await setupCommand();

  expect(mockAppendFileSync).toHaveBeenCalledTimes(1);
  const [, content] = mockAppendFileSync.mock.calls[0];
  expect(content).toBe('alias claude="claude-bundle"\n');
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run tests/unit/commands/setup.test.ts`
Expected: `3 passed (3)`

- [ ] **Step 3: Commit**

```bash
git add tests/unit/commands/setup.test.ts
git commit -m "test: cover setup command claude discovery and alias prompt"
```

---

### Task 18: Rewrite the integration test as a real offline CLI round-trip

**Files:**
- Modify: `tests/integration/cli.test.ts`

**Interfaces:**
- Consumes: `dispatch` from `src/cli.ts`, `loadConfig`/`saveConfig` from `src/core/config.ts`, `loadSecrets` from `src/core/secrets.ts`. Mocks only `@inquirer/prompts` (so the `use` command's secret prompt is deterministic) — everything else runs for real, including a real local git clone/pull via `simple-git` and a real subprocess exec of `/bin/echo` via `execa`.

This test creates a real git repository fixture on disk to act as the "upstream" bundle source, so `claude-bundle add <local-path>` performs an actual `git clone` with zero network access (git supports local filesystem paths as clone sources).

- [ ] **Step 1: Write the test file**

```typescript
import { test, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';

const { mockInput } = vi.hoisted(() => ({ mockInput: vi.fn() }));
vi.mock('@inquirer/prompts', () => ({ input: mockInput, select: vi.fn() }));

import { dispatch } from '../../src/cli';
import { loadConfig, saveConfig } from '../../src/core/config';
import { loadSecrets } from '../../src/core/secrets';

let tempDir: string;
let upstreamDir: string;

function createUpstreamBundleRepo(dir: string): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'bundle.json'),
    JSON.stringify(
      {
        name: 'integration-bundle',
        description: 'Bundle used by the CLI integration test',
        include_plugins: [],
        requires_secrets: ['DEMO_TOKEN'],
      },
      null,
      2
    )
  );
  writeFileSync(join(dir, 'README.md'), '# Integration bundle\n\nInjected as system prompt.\n');
  mkdirSync(join(dir, 'plugin'), { recursive: true });
  writeFileSync(join(dir, 'plugin', '.gitkeep'), '');

  execSync('git init -q', { cwd: dir });
  execSync('git config user.email test@example.com', { cwd: dir });
  execSync('git config user.name "Test User"', { cwd: dir });
  execSync('git add .', { cwd: dir });
  execSync('git commit -q -m initial', { cwd: dir });
}

beforeEach(() => {
  tempDir = mkdtempSync('/tmp/claude-bundle-integration-');
  process.env.CLAUDE_BUNDLE_TEST_DIR = tempDir;
  upstreamDir = join(tempDir, 'upstream', 'integration-bundle');
  createUpstreamBundleRepo(upstreamDir);
  mockInput.mockReset();
});

afterEach(() => {
  delete process.env.CLAUDE_BUNDLE_TEST_DIR;
  rmSync(tempDir, { recursive: true, force: true });
});

test('add, list, use, update, and remove a bundle end-to-end against a local git repo', async () => {
  await dispatch(['add', upstreamDir]);

  const configAfterAdd = loadConfig();
  expect(Object.keys(configAfterAdd.bundles)).toEqual(['integration-bundle']);
  const bundlePath = configAfterAdd.bundles['integration-bundle'].path;
  expect(existsSync(join(bundlePath, 'bundle.json'))).toBe(true);

  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  await dispatch(['list']);
  const listOutput = logSpy.mock.calls.map((c) => c[0]).join('\n');
  expect(listOutput).toContain('integration-bundle');
  logSpy.mockRestore();

  configAfterAdd.realClaudePath = '/bin/echo';
  saveConfig(configAfterAdd);

  mockInput.mockResolvedValue('demo-secret-value');
  await dispatch(['use', 'integration-bundle']);
  expect(loadSecrets('integration-bundle')).toEqual({ DEMO_TOKEN: 'demo-secret-value' });

  await expect(dispatch(['update', 'integration-bundle'])).resolves.toBeUndefined();

  await dispatch(['remove', 'integration-bundle', '--delete-files']);
  expect(loadConfig().bundles['integration-bundle']).toBeUndefined();
  expect(existsSync(bundlePath)).toBe(false);
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run tests/integration/cli.test.ts`
Expected: `1 passed (1)`

If it fails on the `git commit` step inside `createUpstreamBundleRepo` with an "author identity unknown" error, double-check that both `git config` calls run before `git commit` and that `cwd: dir` is passed to every `execSync` call — the repo-local config only applies inside that directory.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/cli.test.ts
git commit -m "test: rewrite integration test as a real offline CLI round-trip"
```

---

### Task 19: Add `ci.yml` — test gate on every push/PR

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: a GitHub Actions workflow that runs `npm ci`, `npm run lint`, `npm run build`, `npm run test:run` on pushes and pull requests targeting `master`.

- [ ] **Step 1: Write the workflow file**

```yaml
name: CI

on:
  push:
    branches: [master]
  pull_request:
    branches: [master]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: ['20.x', '22.x']
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: npm

      - run: npm ci
      - run: npm run lint
      - run: npm run build
      - run: npm run test:run
```

- [ ] **Step 2: Validate the workflow YAML parses correctly**

Run: `node -e "require('js-yaml')" 2>/dev/null || python3 -c "import yaml, sys; yaml.safe_load(open('.github/workflows/ci.yml'))" 2>&1 || cat .github/workflows/ci.yml`
Expected: no YAML parse errors (if neither `js-yaml` nor `python3`'s `yaml` module is available, visually confirm the file's indentation matches the block above exactly — 2-space indents, no tabs).

- [ ] **Step 3: Confirm the local scripts referenced by the workflow actually succeed**

Run: `npm run lint && npm run build && npm run test:run`
Expected: all three commands exit `0`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add build+test workflow for pushes and pull requests"
```

---

### Task 20: Add `publish.yml` — publish to npm on GitHub Release

**Files:**
- Create: `.github/workflows/publish.yml`

**Interfaces:**
- Produces: a GitHub Actions workflow triggered by `release: published` that verifies the release tag matches `package.json`'s version, then builds, tests, and runs `npm publish` authenticated via the `NPM_TOKEN` repository secret.

- [ ] **Step 1: Write the workflow file**

```yaml
name: Publish to npm

on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v4

      - name: Verify package.json version matches the release tag
        run: |
          PKG_VERSION="v$(node -p "require('./package.json').version")"
          if [ "$PKG_VERSION" != "$GITHUB_REF_NAME" ]; then
            echo "package.json version ($PKG_VERSION) does not match release tag ($GITHUB_REF_NAME)" >&2
            exit 1
          fi

      - uses: actions/setup-node@v4
        with:
          node-version: '20.x'
          registry-url: 'https://registry.npmjs.org'
          cache: npm

      - run: npm ci
      - run: npm run lint
      - run: npm run build
      - run: npm run test:run

      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

This expects release tags in the form `vX.Y.Z` (e.g. `v0.1.0`) matching `package.json`'s `version` field (`0.1.0`). Bump `package.json`'s version and commit that before drafting a matching-named GitHub Release; otherwise the "Verify package.json version" step fails fast before anything is published.

- [ ] **Step 2: Validate the workflow YAML parses correctly**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/publish.yml'))" 2>&1 || cat .github/workflows/publish.yml`
Expected: no YAML parse errors.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/publish.yml
git commit -m "ci: add npm publish workflow triggered by GitHub Release"
```

- [ ] **Step 4: One-time manual setup (not scriptable — do this in the GitHub/npm UI before the first release)**

1. On npmjs.com: generate an "Automation" access token for your account (or an npm Granular Access Token scoped to publish `claude-bundle`).
2. On GitHub: go to this repo's **Settings → Secrets and variables → Actions → New repository secret**, name it `NPM_TOKEN`, and paste the token value.
3. When ready to publish: bump `version` in `package.json`, commit, push to `master`, then draft a GitHub Release with tag `vX.Y.Z` matching that version and click **Publish release** — this fires the workflow.

---

### Task 21: Full-suite verification

**Files:** none (verification only)

- [ ] **Step 1: Run the entire test suite**

Run: `npm run test:run`
Expected: all test files pass, including the 8 new `tests/unit/commands/*.test.ts` files, the rewritten `tests/unit/*.test.ts` files, and the rewritten `tests/integration/cli.test.ts`. Zero failures.

- [ ] **Step 2: Run the build and lint one more time end-to-end**

Run: `npm run lint && npm run build`
Expected: both exit `0` with no errors.

- [ ] **Step 3: Confirm nothing was left uncommitted**

Run: `git status`
Expected: working tree clean (or only expected untracked `dist/` output, which is gitignored).
