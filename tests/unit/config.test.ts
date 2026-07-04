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
