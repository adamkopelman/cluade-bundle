import { homedir } from 'os';
import { join } from 'path';

const BASE_DIR = join(homedir(), '.claude-bundle');

export const getBundleDir = () => join(BASE_DIR, 'bundles');
export const getPluginsDir = () => join(BASE_DIR, 'plugins');
export const getSecretsDir = () => join(BASE_DIR, 'secrets');
export const getConfigPath = () => join(BASE_DIR, 'config.json');
