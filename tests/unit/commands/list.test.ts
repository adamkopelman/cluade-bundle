import { test, expect, vi, beforeEach } from 'vitest';

const { mockListBundles, mockLoadManifest, mockLoadSecrets } = vi.hoisted(() => ({
  mockListBundles: vi.fn(),
  mockLoadManifest: vi.fn(),
  mockLoadSecrets: vi.fn(),
}));
vi.mock('../../../src/core/registry.js', () => ({ listBundles: mockListBundles }));
vi.mock('../../../src/core/manifest.js', () => ({ loadManifest: mockLoadManifest }));
vi.mock('../../../src/core/secrets.js', () => ({ loadSecrets: mockLoadSecrets }));

import { listCommand } from '../../../src/commands/list';

beforeEach(() => {
  mockListBundles.mockReset();
  mockLoadManifest.mockReset();
  mockLoadSecrets.mockReset();
});

test('listCommand prints a message when there are no bundles', async () => {
  mockListBundles.mockReturnValue([]);
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

  await listCommand();

  expect(logSpy).toHaveBeenCalledWith('No bundles installed.');
  logSpy.mockRestore();
});

test('listCommand prints each bundle with its secrets status', async () => {
  mockListBundles.mockReturnValue([
    { name: 'manager', path: '/b/manager', url: 'https://x', description: 'Team mgmt' },
  ]);
  mockLoadManifest.mockReturnValue({ name: 'manager', description: 'Team mgmt', requires_secrets: ['A', 'B'] });
  mockLoadSecrets.mockReturnValue({ A: 'set' });
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

  await listCommand();

  const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
  expect(output).toContain('manager');
  expect(output).toContain('1/2 secrets set');
  logSpy.mockRestore();
});
