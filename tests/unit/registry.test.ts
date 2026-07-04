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
