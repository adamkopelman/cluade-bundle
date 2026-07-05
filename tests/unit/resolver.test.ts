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
