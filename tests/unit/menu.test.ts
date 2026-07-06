import { test, expect, vi, beforeEach } from 'vitest';

const { mockSelect } = vi.hoisted(() => ({ mockSelect: vi.fn() }));
vi.mock('@inquirer/prompts', () => ({ select: mockSelect }));

import { showMenu } from '../../src/core/menu';
import type { BundleEntry } from '../../src/core/registry';

beforeEach(() => {
  mockSelect.mockReset();
});

test('showMenu returns null and does not prompt when there are no bundles', async () => {
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

  const result = await showMenu([]);

  expect(result).toBeNull();
  expect(mockSelect).not.toHaveBeenCalled();
  expect(logSpy).toHaveBeenCalledWith('No bundles installed. Run: claude-bundle add <git-url>');

  logSpy.mockRestore();
});

test('showMenu builds one choice per bundle plus a "none" option and returns the selection', async () => {
  const bundles: BundleEntry[] = [
    { name: 'manager', path: '/b/manager', url: 'https://x', description: 'Team mgmt' },
    { name: 'writer', path: '/b/writer', url: 'https://y', description: 'Writing tools' },
  ];
  mockSelect.mockResolvedValue('writer');

  const result = await showMenu(bundles);

  expect(result).toBe('writer');
  expect(mockSelect).toHaveBeenCalledTimes(1);
  const call = mockSelect.mock.calls[0][0] as { message: string; choices: Array<{ value: unknown }> };
  expect(call.message).toBe('Which bundle?');
  expect(call.choices.map((c) => c.value)).toEqual(['manager', 'writer', '---', null]);
});

test('showMenu resolves to null when the user picks the plain session option', async () => {
  const bundles: BundleEntry[] = [{ name: 'manager', path: '/b/manager', url: 'https://x' }];
  mockSelect.mockResolvedValue(null);

  const result = await showMenu(bundles);

  expect(result).toBeNull();
});
