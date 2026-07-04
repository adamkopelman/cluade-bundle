import { join, basename } from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { loadConfig, saveConfig } from './config.js';
import { getBundleDir } from './paths.js';
import { cloneRepo } from '../utils/git.js';

export interface BundleEntry {
  name: string;
  path: string;
  url: string;
}

export async function addBundle(url: string): Promise<void> {
  const config = loadConfig();
  const bundleDir = getBundleDir();
  mkdirSync(bundleDir, { recursive: true });

  // Extract name from URL (e.g., "owner/repo" -> "repo")
  const repoName = basename(url.replace(/\.git$/, ''));
  const destPath = join(bundleDir, repoName);

  if (existsSync(destPath)) {
    throw new Error(`Bundle "${repoName}" already exists at ${destPath}`);
  }

  await cloneRepo(url, destPath);

  config.bundles[repoName] = {
    path: destPath,
    url,
  };

  saveConfig(config);
}

export function removeBundle(name: string, deleteFiles = false): void {
  const config = loadConfig();

  if (!config.bundles[name]) {
    throw new Error(`Bundle "${name}" not found`);
  }

  const bundlePath = config.bundles[name].path;
  delete config.bundles[name];
  saveConfig(config);

  if (deleteFiles && existsSync(bundlePath)) {
    rmSync(bundlePath, { recursive: true, force: true });
  }
}

export function listBundles(): BundleEntry[] {
  const config = loadConfig();
  return Object.entries(config.bundles).map(([name, info]) => ({
    name,
    path: info.path,
    url: info.url,
  }));
}
