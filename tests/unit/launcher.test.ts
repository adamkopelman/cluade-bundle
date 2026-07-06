import { test, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

const { mockExeca } = vi.hoisted(() => ({ mockExeca: vi.fn() }));
vi.mock('execa', () => ({ execa: mockExeca }));

import { launchBundle } from '../../src/core/launcher';
import { saveConfig } from '../../src/core/config';
import type { ResolvedBundle } from '../../src/types/index.js';

let tempDir: string;
let bundlePath: string;

beforeEach(() => {
  tempDir = mkdtempSync('/tmp/claude-bundle-test-');
  process.env.CLAUDE_BUNDLE_TEST_DIR = tempDir;
  process.env.TMPDIR = tempDir;
  bundlePath = join(tempDir, 'bundle');
  mkdirSync(bundlePath, { recursive: true });

  mockExeca.mockReset();
  mockExeca.mockResolvedValue({});
});

afterEach(() => {
  delete process.env.CLAUDE_BUNDLE_TEST_DIR;
  delete process.env.TMPDIR;
  rmSync(tempDir, { recursive: true, force: true });
});

function baseResolved(overrides: Partial<ResolvedBundle> = {}): ResolvedBundle {
  return {
    name: 'manager',
    manifest: {
      name: 'manager',
      description: 'A team management bundle for everything',
      include_plugins: [],
      requires_secrets: [],
    },
    bundlePath,
    pluginDirs: [],
    secrets: {},
    ...overrides,
  };
}

test('launchBundle throws when realClaudePath is not configured', async () => {
  saveConfig({ version: '1', realClaudePath: '', bundles: {} });

  await expect(launchBundle(baseResolved())).rejects.toThrow(
    'Real claude path not configured. Run: claude-bundle setup'
  );
  expect(mockExeca).not.toHaveBeenCalled();
});

test('launchBundle execs the real claude binary with plugin dirs and user args', async () => {
  saveConfig({ version: '1', realClaudePath: '/bin/echo', bundles: {} });
  const pluginDir = join(tempDir, 'plugin-a');
  mkdirSync(pluginDir, { recursive: true });

  await launchBundle(baseResolved({ pluginDirs: [pluginDir] }), ['--foo']);

  expect(mockExeca).toHaveBeenCalledTimes(1);
  const [bin, args, opts] = mockExeca.mock.calls[0];
  expect(bin).toBe('/bin/echo');
  expect(args).toEqual(expect.arrayContaining(['--plugin-dir', pluginDir, '--foo']));
  expect(opts).toMatchObject({ stdio: 'inherit' });
});

test('launchBundle merges mcp configs from bundle mcpPath and plugin dirs', async () => {
  saveConfig({ version: '1', realClaudePath: '/bin/echo', bundles: {} });

  const ownMcpPath = join(bundlePath, 'mcp.json');
  writeFileSync(ownMcpPath, JSON.stringify({ mcpServers: { own: { command: 'own-cmd' } } }));

  const pluginDir = join(tempDir, 'plugin-a');
  mkdirSync(pluginDir, { recursive: true });
  writeFileSync(join(pluginDir, 'mcp.json'), JSON.stringify({ mcpServers: { fromPlugin: { command: 'plugin-cmd' } } }));

  await launchBundle(baseResolved({ pluginDirs: [pluginDir], mcpPath: ownMcpPath }));

  const [, args] = mockExeca.mock.calls[0];
  const mcpFlagIndex = args.indexOf('--mcp-config');
  expect(mcpFlagIndex).toBeGreaterThan(-1);
  const mergedPath = args[mcpFlagIndex + 1];
  const merged = JSON.parse(readFileSync(mergedPath, 'utf-8'));
  expect(merged.mcpServers).toEqual({
    own: { command: 'own-cmd' },
    fromPlugin: { command: 'plugin-cmd' },
  });
  expect(args).toContain('--strict-mcp-config');
});

test('launchBundle adds --add-dir for memoryPath when present', async () => {
  saveConfig({ version: '1', realClaudePath: '/bin/echo', bundles: {} });
  const memoryPath = join(tempDir, 'memory');
  mkdirSync(memoryPath, { recursive: true });

  await launchBundle(baseResolved({ memoryPath }));

  const [, args] = mockExeca.mock.calls[0];
  expect(args).toEqual(expect.arrayContaining(['--add-dir', memoryPath]));
});

test('launchBundle appends the bundle README as a system prompt when present', async () => {
  saveConfig({ version: '1', realClaudePath: '/bin/echo', bundles: {} });
  writeFileSync(join(bundlePath, 'README.md'), '# Manager bundle instructions');

  await launchBundle(baseResolved());

  const [, args] = mockExeca.mock.calls[0];
  const flagIndex = args.indexOf('--append-system-prompt');
  expect(flagIndex).toBeGreaterThan(-1);
  expect(args[flagIndex + 1]).toBe('# Manager bundle instructions');
});

test('launchBundle passes resolved secrets merged with process.env', async () => {
  saveConfig({ version: '1', realClaudePath: '/bin/echo', bundles: {} });

  await launchBundle(baseResolved({ secrets: { JIRA_TOKEN: 'abc123' } }));

  const [, , opts] = mockExeca.mock.calls[0];
  expect(opts.env.JIRA_TOKEN).toBe('abc123');
});
