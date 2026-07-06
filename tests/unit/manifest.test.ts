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
