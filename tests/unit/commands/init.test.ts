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
