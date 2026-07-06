import { test, expect, vi, beforeEach } from 'vitest';

const { mockClone, mockPull, mockSimpleGit } = vi.hoisted(() => {
  const mockClone = vi.fn();
  const mockPull = vi.fn();
  const mockSimpleGit = vi.fn(() => ({ clone: mockClone, pull: mockPull }));
  return { mockClone, mockPull, mockSimpleGit };
});

vi.mock('simple-git', () => ({
  default: mockSimpleGit,
}));

import { cloneRepo, pullRepo } from '../../src/utils/git';

beforeEach(() => {
  mockClone.mockReset();
  mockPull.mockReset();
  mockSimpleGit.mockClear();
});

test('cloneRepo calls simpleGit().clone with the url and destination', async () => {
  await cloneRepo('https://example.com/repo.git', '/tmp/dest');

  expect(mockSimpleGit).toHaveBeenCalledWith();
  expect(mockClone).toHaveBeenCalledWith('https://example.com/repo.git', '/tmp/dest');
});

test('pullRepo calls simpleGit(path).pull()', async () => {
  await pullRepo('/tmp/bundle-path');

  expect(mockSimpleGit).toHaveBeenCalledWith('/tmp/bundle-path');
  expect(mockPull).toHaveBeenCalledTimes(1);
});
