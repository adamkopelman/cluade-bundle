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
