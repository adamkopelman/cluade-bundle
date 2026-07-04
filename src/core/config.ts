import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { getConfigPath } from './paths.js';
import type { BundleConfig } from '../types/index.js';

const DEFAULT_CONFIG: BundleConfig = {
  version: '1',
  realClaudePath: '',
  bundles: {},
};

export function ensureConfigDir(): void {
  const configPath = getConfigPath();
  mkdirSync(dirname(configPath), { recursive: true });
}

export function loadConfig(): BundleConfig {
  const configPath = getConfigPath();
  if (!existsSync(configPath)) {
    return { ...DEFAULT_CONFIG };
  }
  const content = readFileSync(configPath, 'utf-8');
  return { ...DEFAULT_CONFIG, ...JSON.parse(content) };
}

export function saveConfig(config: BundleConfig): void {
  ensureConfigDir();
  const configPath = getConfigPath();
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
}
