import { test, expect, vi, beforeEach } from 'vitest';

const { mockRemoveBundle } = vi.hoisted(() => ({ mockRemoveBundle: vi.fn() }));
vi.mock('../../../src/core/registry.js', () => ({ removeBundle: mockRemoveBundle }));

import { removeCommand } from '../../../src/commands/remove';

beforeEach(() => {
  mockRemoveBundle.mockReset();
});

test('removeCommand removes a bundle without deleting files by default', async () => {
  await removeCommand(['manager']);
  expect(mockRemoveBundle).toHaveBeenCalledWith('manager', false);
});

test('removeCommand deletes files when --delete-files is passed', async () => {
  await removeCommand(['manager', '--delete-files']);
  expect(mockRemoveBundle).toHaveBeenCalledWith('manager', true);
});

test('removeCommand exits with an error when no name is given', async () => {
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('exit');
  });
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  await expect(removeCommand([])).rejects.toThrow('exit');
  expect(errorSpy).toHaveBeenCalledWith('Usage: claude-bundle remove <name> [--delete-files]');
  expect(mockRemoveBundle).not.toHaveBeenCalled();

  exitSpy.mockRestore();
  errorSpy.mockRestore();
});
