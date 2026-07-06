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
