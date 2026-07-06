import { test, expect, vi, beforeEach } from 'vitest';

const {
  mockListBundles, mockLoadManifest, mockResolveBundle, mockPromptForSecrets, mockLaunchBundle,
} = vi.hoisted(() => ({
  mockListBundles: vi.fn(),
  mockLoadManifest: vi.fn(),
  mockResolveBundle: vi.fn(),
  mockPromptForSecrets: vi.fn(),
  mockLaunchBundle: vi.fn(),
}));
vi.mock('../../../src/core/registry.js', () => ({ listBundles: mockListBundles }));
vi.mock('../../../src/core/manifest.js', () => ({ loadManifest: mockLoadManifest }));
vi.mock('../../../src/core/resolver.js', () => ({ resolveBundle: mockResolveBundle }));
vi.mock('../../../src/core/secrets.js', () => ({ promptForSecrets: mockPromptForSecrets }));
vi.mock('../../../src/core/launcher.js', () => ({ launchBundle: mockLaunchBundle }));

import { useCommand } from '../../../src/commands/use';

beforeEach(() => {
  mockListBundles.mockReset();
  mockLoadManifest.mockReset();
  mockResolveBundle.mockReset();
  mockPromptForSecrets.mockReset();
  mockLaunchBundle.mockReset();
});

test('useCommand exits with an error when no name is given', async () => {
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('exit');
  });
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  await expect(useCommand([])).rejects.toThrow('exit');
  expect(errorSpy).toHaveBeenCalledWith('Usage: claude-bundle use <name>');

  exitSpy.mockRestore();
  errorSpy.mockRestore();
});

test('useCommand exits with an error when the bundle is not found', async () => {
  mockListBundles.mockReturnValue([]);
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('exit');
  });
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  await expect(useCommand(['ghost'])).rejects.toThrow('exit');
  expect(errorSpy).toHaveBeenCalledWith('Bundle "ghost" not found');

  exitSpy.mockRestore();
  errorSpy.mockRestore();
});

test('useCommand skips prompting for secrets when none are required', async () => {
  const bundle = { name: 'manager', path: '/b/manager', url: 'https://x' };
  const manifest = { name: 'manager', description: 'desc', requires_secrets: [] };
  const resolved = { name: 'manager', manifest, bundlePath: '/b/manager', pluginDirs: [], secrets: {} };

  mockListBundles.mockReturnValue([bundle]);
  mockLoadManifest.mockReturnValue(manifest);
  mockResolveBundle.mockResolvedValue(resolved);
  mockLaunchBundle.mockResolvedValue(undefined);

  await useCommand(['manager', '--extra']);

  expect(mockPromptForSecrets).not.toHaveBeenCalled();
  expect(mockLaunchBundle).toHaveBeenCalledWith(resolved, ['--extra']);
});

test('useCommand prompts for and attaches required secrets before launching', async () => {
  const bundle = { name: 'manager', path: '/b/manager', url: 'https://x' };
  const manifest = { name: 'manager', description: 'desc', requires_secrets: ['TOKEN'] };
  const resolved = { name: 'manager', manifest, bundlePath: '/b/manager', pluginDirs: [], secrets: {} };

  mockListBundles.mockReturnValue([bundle]);
  mockLoadManifest.mockReturnValue(manifest);
  mockResolveBundle.mockResolvedValue(resolved);
  mockPromptForSecrets.mockResolvedValue({ TOKEN: 'abc' });
  mockLaunchBundle.mockResolvedValue(undefined);

  await useCommand(['manager']);

  expect(mockPromptForSecrets).toHaveBeenCalledWith('manager', ['TOKEN']);
  expect(mockLaunchBundle).toHaveBeenCalledWith({ ...resolved, secrets: { TOKEN: 'abc' } }, []);
});
