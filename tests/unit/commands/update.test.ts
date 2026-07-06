import { test, expect, vi, beforeEach } from 'vitest';

const { mockListBundles, mockPullRepo } = vi.hoisted(() => ({
  mockListBundles: vi.fn(),
  mockPullRepo: vi.fn(),
}));
vi.mock('../../../src/core/registry.js', () => ({ listBundles: mockListBundles }));
vi.mock('../../../src/utils/git.js', () => ({ pullRepo: mockPullRepo, cloneRepo: vi.fn() }));

import { updateCommand } from '../../../src/commands/update';

beforeEach(() => {
  mockListBundles.mockReset();
  mockPullRepo.mockReset();
  mockPullRepo.mockResolvedValue(undefined);
});

test('updateCommand pulls a single named bundle', async () => {
  mockListBundles.mockReturnValue([{ name: 'manager', path: '/b/manager', url: 'https://x' }]);

  await updateCommand(['manager']);

  expect(mockPullRepo).toHaveBeenCalledWith('/b/manager');
  expect(mockPullRepo).toHaveBeenCalledTimes(1);
});

test('updateCommand exits with an error when the named bundle is not found', async () => {
  mockListBundles.mockReturnValue([]);
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('exit');
  });
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  await expect(updateCommand(['ghost'])).rejects.toThrow('exit');
  expect(errorSpy).toHaveBeenCalledWith('Bundle "ghost" not found');

  exitSpy.mockRestore();
  errorSpy.mockRestore();
});

test('updateCommand pulls every bundle when no name is given', async () => {
  mockListBundles.mockReturnValue([
    { name: 'manager', path: '/b/manager', url: 'https://x' },
    { name: 'writer', path: '/b/writer', url: 'https://y' },
  ]);

  await updateCommand([]);

  expect(mockPullRepo).toHaveBeenCalledTimes(2);
  expect(mockPullRepo).toHaveBeenCalledWith('/b/manager');
  expect(mockPullRepo).toHaveBeenCalledWith('/b/writer');
});
