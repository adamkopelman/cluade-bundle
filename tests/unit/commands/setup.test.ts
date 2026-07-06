import { test, expect, vi, beforeEach } from 'vitest';

const { mockExecSync, mockLoadConfig, mockSaveConfig, mockInput, mockAppendFileSync } = vi.hoisted(() => ({
  mockExecSync: vi.fn(),
  mockLoadConfig: vi.fn(),
  mockSaveConfig: vi.fn(),
  mockInput: vi.fn(),
  mockAppendFileSync: vi.fn(),
}));
vi.mock('child_process', () => ({ execSync: mockExecSync }));
vi.mock('../../../src/core/config.js', () => ({ loadConfig: mockLoadConfig, saveConfig: mockSaveConfig }));
vi.mock('@inquirer/prompts', () => ({ input: mockInput }));
vi.mock('fs', () => ({ existsSync: vi.fn(), readFileSync: vi.fn(), appendFileSync: mockAppendFileSync }));

import { setupCommand } from '../../../src/commands/setup';

beforeEach(() => {
  mockExecSync.mockReset();
  mockLoadConfig.mockReset();
  mockSaveConfig.mockReset();
  mockInput.mockReset();
  mockAppendFileSync.mockReset();
  mockLoadConfig.mockReturnValue({ version: '1', realClaudePath: '', bundles: {} });
});

test('setupCommand exits with an error when claude is not found in PATH', async () => {
  mockExecSync.mockImplementation(() => {
    throw new Error('not found');
  });
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('exit');
  });
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  await expect(setupCommand()).rejects.toThrow('exit');
  expect(errorSpy).toHaveBeenCalledWith('Could not find "claude" in PATH');
  expect(mockSaveConfig).not.toHaveBeenCalled();

  exitSpy.mockRestore();
  errorSpy.mockRestore();
});

test('setupCommand saves the discovered claude path and skips the alias when declined', async () => {
  mockExecSync.mockReturnValue('/usr/local/bin/claude\n');
  mockInput.mockResolvedValue('no');

  await setupCommand();

  expect(mockSaveConfig).toHaveBeenCalledWith(
    expect.objectContaining({ realClaudePath: '/usr/local/bin/claude' })
  );
  expect(mockAppendFileSync).not.toHaveBeenCalled();
});

test('setupCommand appends the shell alias when the user accepts', async () => {
  mockExecSync.mockReturnValue('/usr/local/bin/claude\n');
  mockInput.mockResolvedValue('yes');

  await setupCommand();

  expect(mockAppendFileSync).toHaveBeenCalledTimes(1);
  const [, content] = mockAppendFileSync.mock.calls[0];
  expect(content).toBe('alias claude="claude-bundle"\n');
});
