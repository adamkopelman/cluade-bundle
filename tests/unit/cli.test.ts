import { test, expect, vi, beforeEach } from 'vitest';

const {
  mockAddCommand, mockRemoveCommand, mockListCommand, mockUpdateCommand,
  mockUseCommand, mockInitCommand, mockSecretsCommand, mockSetupCommand,
} = vi.hoisted(() => ({
  mockAddCommand: vi.fn(),
  mockRemoveCommand: vi.fn(),
  mockListCommand: vi.fn(),
  mockUpdateCommand: vi.fn(),
  mockUseCommand: vi.fn(),
  mockInitCommand: vi.fn(),
  mockSecretsCommand: vi.fn(),
  mockSetupCommand: vi.fn(),
}));

vi.mock('../../src/commands/add.js', () => ({ addCommand: mockAddCommand }));
vi.mock('../../src/commands/remove.js', () => ({ removeCommand: mockRemoveCommand }));
vi.mock('../../src/commands/list.js', () => ({ listCommand: mockListCommand }));
vi.mock('../../src/commands/update.js', () => ({ updateCommand: mockUpdateCommand }));
vi.mock('../../src/commands/use.js', () => ({ useCommand: mockUseCommand }));
vi.mock('../../src/commands/init.js', () => ({ initCommand: mockInitCommand }));
vi.mock('../../src/commands/secrets.js', () => ({ secretsCommand: mockSecretsCommand }));
vi.mock('../../src/commands/setup.js', () => ({ setupCommand: mockSetupCommand }));

const {
  mockListBundles, mockShowMenu, mockLoadManifest, mockResolveBundle,
  mockPromptForSecrets, mockLaunchBundle, mockLoadConfig, mockExeca,
} = vi.hoisted(() => ({
  mockListBundles: vi.fn(),
  mockShowMenu: vi.fn(),
  mockLoadManifest: vi.fn(),
  mockResolveBundle: vi.fn(),
  mockPromptForSecrets: vi.fn(),
  mockLaunchBundle: vi.fn(),
  mockLoadConfig: vi.fn(),
  mockExeca: vi.fn(),
}));

vi.mock('../../src/core/registry.js', () => ({ listBundles: mockListBundles }));
vi.mock('../../src/core/menu.js', () => ({ showMenu: mockShowMenu }));
vi.mock('../../src/core/manifest.js', () => ({ loadManifest: mockLoadManifest }));
vi.mock('../../src/core/resolver.js', () => ({ resolveBundle: mockResolveBundle }));
vi.mock('../../src/core/secrets.js', () => ({ promptForSecrets: mockPromptForSecrets }));
vi.mock('../../src/core/launcher.js', () => ({ launchBundle: mockLaunchBundle }));
vi.mock('../../src/core/config.js', () => ({ loadConfig: mockLoadConfig }));
vi.mock('execa', () => ({ execa: mockExeca }));

import { showHelp, dispatch } from '../../src/cli';

beforeEach(() => {
  vi.resetAllMocks();
});

test('showHelp and dispatch are exported functions', () => {
  expect(typeof showHelp).toBe('function');
  expect(typeof dispatch).toBe('function');
});

test('dispatch routes "add" to addCommand with the remaining args', async () => {
  await dispatch(['add', 'https://example.com/repo.git']);
  expect(mockAddCommand).toHaveBeenCalledWith(['https://example.com/repo.git']);
});

test('dispatch routes "remove" to removeCommand', async () => {
  await dispatch(['remove', 'my-bundle', '--delete-files']);
  expect(mockRemoveCommand).toHaveBeenCalledWith(['my-bundle', '--delete-files']);
});

test('dispatch routes "list" to listCommand with no args', async () => {
  await dispatch(['list']);
  expect(mockListCommand).toHaveBeenCalledWith();
});

test('dispatch routes "update" to updateCommand', async () => {
  await dispatch(['update', 'my-bundle']);
  expect(mockUpdateCommand).toHaveBeenCalledWith(['my-bundle']);
});

test('dispatch routes "use" to useCommand', async () => {
  await dispatch(['use', 'my-bundle']);
  expect(mockUseCommand).toHaveBeenCalledWith(['my-bundle']);
});

test('dispatch routes "init" to initCommand', async () => {
  await dispatch(['init', 'my-bundle']);
  expect(mockInitCommand).toHaveBeenCalledWith(['my-bundle']);
});

test('dispatch routes "secrets" to secretsCommand', async () => {
  await dispatch(['secrets', 'my-bundle']);
  expect(mockSecretsCommand).toHaveBeenCalledWith(['my-bundle']);
});

test('dispatch routes "setup" to setupCommand with no args', async () => {
  await dispatch(['setup']);
  expect(mockSetupCommand).toHaveBeenCalledWith();
});

test('dispatch shows help text for "-h" and "--help"', async () => {
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

  await dispatch(['-h']);
  await dispatch(['--help']);

  expect(logSpy).toHaveBeenCalledTimes(2);
  expect(logSpy.mock.calls[0][0]).toContain('claude-bundle - Bundle manager for Claude Code');
  logSpy.mockRestore();
});

test('dispatch prints the version for "-v" and "--version"', async () => {
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

  await dispatch(['-v']);
  await dispatch(['--version']);

  expect(logSpy).toHaveBeenCalledWith('claude-bundle v0.1.0');
  logSpy.mockRestore();
});

test('dispatch with no command launches a plain session when "none" is selected', async () => {
  mockListBundles.mockReturnValue([
    { name: 'manager', path: '/bundles/manager', url: 'https://x', description: 'desc' },
  ]);
  mockShowMenu.mockResolvedValue(null);
  mockLoadConfig.mockReturnValue({ version: '1', realClaudePath: '/bin/echo', bundles: {} });
  mockExeca.mockResolvedValue({});

  const originalArgv = process.argv;
  process.argv = ['node', 'claude-bundle'];
  try {
    await dispatch([]);
  } finally {
    process.argv = originalArgv;
  }

  expect(mockShowMenu).toHaveBeenCalledWith([
    { name: 'manager', path: '/bundles/manager', url: 'https://x', description: 'desc' },
  ]);
  expect(mockExeca).toHaveBeenCalledWith('/bin/echo', [], { stdio: 'inherit' });
});

test('dispatch with no command resolves and launches the selected bundle', async () => {
  const bundle = { name: 'manager', path: '/bundles/manager', url: 'https://x', description: 'desc' };
  const manifest = {
    name: 'manager',
    description: 'desc',
    include_plugins: [],
    requires_secrets: ['TOKEN'],
  };
  const resolved = {
    name: 'manager',
    manifest,
    bundlePath: '/bundles/manager',
    pluginDirs: [],
    secrets: {},
  };

  mockListBundles.mockReturnValue([bundle]);
  mockShowMenu.mockResolvedValue('manager');
  mockLoadManifest.mockReturnValue(manifest);
  mockResolveBundle.mockResolvedValue(resolved);
  mockPromptForSecrets.mockResolvedValue({ TOKEN: 'secret' });
  mockLaunchBundle.mockResolvedValue(undefined);

  const originalArgv = process.argv;
  process.argv = ['node', 'claude-bundle'];
  try {
    await dispatch([]);
  } finally {
    process.argv = originalArgv;
  }

  expect(mockLoadManifest).toHaveBeenCalledWith('/bundles/manager');
  expect(mockResolveBundle).toHaveBeenCalledWith('manager', '/bundles/manager', manifest);
  expect(mockPromptForSecrets).toHaveBeenCalledWith('manager', ['TOKEN']);
  expect(mockLaunchBundle).toHaveBeenCalledWith({ ...resolved, secrets: { TOKEN: 'secret' } }, []);
});

test('dispatch with no command exits when the selected bundle is missing from the list', async () => {
  mockListBundles.mockReturnValue([]);
  mockShowMenu.mockResolvedValue('ghost');
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('exit');
  });
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  await expect(dispatch([])).rejects.toThrow('exit');
  expect(errorSpy).toHaveBeenCalledWith('Bundle "ghost" not found');
  expect(exitSpy).toHaveBeenCalledWith(1);

  exitSpy.mockRestore();
  errorSpy.mockRestore();
});
