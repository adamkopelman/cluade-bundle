import { test, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, statSync, writeFileSync, mkdirSync } from 'fs';

const { mockInput } = vi.hoisted(() => ({ mockInput: vi.fn() }));
vi.mock('@inquirer/prompts', () => ({ input: mockInput }));

import { loadSecrets, saveSecrets, promptForSecrets, getSecretsPath } from '../../src/core/secrets';
import { getSecretsDir } from '../../src/core/paths';

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
  mkdirSync(getSecretsDir(), { recursive: true });
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
