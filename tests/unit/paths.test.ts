import { test, expect } from 'vitest';
import { getBundleDir, getPluginsDir, getSecretsDir, getConfigPath } from '../../src/core/paths';

test('paths return absolute paths', () => {
  expect(getBundleDir()).toMatch(/\.claude-bundle/);
  expect(getPluginsDir()).toMatch(/\.claude-bundle/);
  expect(getSecretsDir()).toMatch(/\.claude-bundle/);
  expect(getConfigPath()).toMatch(/config\.json$/);
});
