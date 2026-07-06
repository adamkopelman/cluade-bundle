import { test, expect, vi, beforeEach } from 'vitest';

const { mockListBundles, mockLoadSecrets, mockSaveSecrets, mockLoadManifest, mockInput } = vi.hoisted(() => ({
  mockListBundles: vi.fn(),
  mockLoadSecrets: vi.fn(),
  mockSaveSecrets: vi.fn(),
  mockLoadManifest: vi.fn(),
  mockInput: vi.fn(),
}));
vi.mock('../../../src/core/registry.js', () => ({ listBundles: mockListBundles }));
vi.mock('../../../src/core/secrets.js', () => ({ loadSecrets: mockLoadSecrets, saveSecrets: mockSaveSecrets }));
vi.mock('../../../src/core/manifest.js', () => ({ loadManifest: mockLoadManifest }));
vi.mock('@inquirer/prompts', () => ({ input: mockInput }));

import { secretsCommand } from '../../../src/commands/secrets';

beforeEach(() => {
  mockListBundles.mockReset();
  mockLoadSecrets.mockReset();
  mockSaveSecrets.mockReset();
  mockLoadManifest.mockReset();
  mockInput.mockReset();
});

test('secretsCommand exits with an error when no name is given', async () => {
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('exit');
  });
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  await expect(secretsCommand([])).rejects.toThrow('exit');
  expect(errorSpy).toHaveBeenCalledWith('Usage: claude-bundle secrets <name>');

  exitSpy.mockRestore();
  errorSpy.mockRestore();
});

test('secretsCommand exits with an error when the bundle is not found', async () => {
  mockListBundles.mockReturnValue([]);
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('exit');
  });
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  await expect(secretsCommand(['ghost'])).rejects.toThrow('exit');
  expect(errorSpy).toHaveBeenCalledWith('Bundle "ghost" not found');

  exitSpy.mockRestore();
  errorSpy.mockRestore();
});

test('secretsCommand prompts for each required secret, defaulting to the current value', async () => {
  mockListBundles.mockReturnValue([{ name: 'manager', path: '/b/manager', url: 'https://x' }]);
  mockLoadManifest.mockReturnValue({ name: 'manager', description: 'desc', requires_secrets: ['A', 'B'] });
  mockLoadSecrets.mockReturnValue({ A: 'existing-a' });
  mockInput.mockImplementation(async ({ default: def }: { default: string }) => (def ? def : 'typed-b'));

  await secretsCommand(['manager']);

  expect(mockInput).toHaveBeenCalledTimes(2);
  expect(mockInput).toHaveBeenNthCalledWith(1, { message: 'A (press enter to keep current):', default: 'existing-a' });
  expect(mockInput).toHaveBeenNthCalledWith(2, { message: 'B:', default: '' });
  expect(mockSaveSecrets).toHaveBeenCalledWith('manager', { A: 'existing-a', B: 'typed-b' });
});
