import { test, expect, vi, beforeEach } from 'vitest';

const { mockAddBundle } = vi.hoisted(() => ({ mockAddBundle: vi.fn() }));
vi.mock('../../../src/core/registry.js', () => ({ addBundle: mockAddBundle }));

import { addCommand } from '../../../src/commands/add';

beforeEach(() => {
  mockAddBundle.mockReset();
  mockAddBundle.mockResolvedValue(undefined);
});

test('addCommand calls addBundle with the given url', async () => {
  await addCommand(['https://github.com/user/manager-bundle.git']);
  expect(mockAddBundle).toHaveBeenCalledWith('https://github.com/user/manager-bundle.git');
});

test('addCommand exits with an error when no url is given', async () => {
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('exit');
  });
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  await expect(addCommand([])).rejects.toThrow('exit');
  expect(errorSpy).toHaveBeenCalledWith('Usage: claude-bundle add <git-url>');
  expect(mockAddBundle).not.toHaveBeenCalled();

  exitSpy.mockRestore();
  errorSpy.mockRestore();
});
