import { test, expect } from 'vitest';
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
