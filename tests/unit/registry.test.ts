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
