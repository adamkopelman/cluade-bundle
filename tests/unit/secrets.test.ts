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
