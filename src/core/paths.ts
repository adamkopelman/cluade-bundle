import { homedir } from 'os';
import { join } from 'path';

function getBaseDir(): string {
  if (process.env.CLAUDE_BUNDLE_TEST_DIR) {
    return join(process.env.CLAUDE_BUNDLE_TEST_DIR, '.claude-bundle');
  }
  return join(homedir(), '.claude-bundle');
}

export const getBundleDir = () => join(getBaseDir(), 'bundles');
export const getPluginsDir = () => join(getBaseDir(), 'plugins');
export const getSecretsDir = () => join(getBaseDir(), 'secrets');
export const getConfigPath = () => join(getBaseDir(), 'config.json');
