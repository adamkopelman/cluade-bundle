import { join, basename } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { getPluginsDir } from './paths.js';
import { cloneRepo } from '../utils/git.js';
import type { BundleManifest, ResolvedBundle, SecretStore } from '../types/index.js';

export async function resolveBundle(
  bundleName: string,
  bundlePath: string,
  manifest: BundleManifest
): Promise<ResolvedBundle> {
  const pluginDirs: string[] = [];

  // Add bundle's own plugin dir if it exists
  const ownPluginDir = join(bundlePath, 'plugin');
  if (existsSync(ownPluginDir)) {
    pluginDirs.push(ownPluginDir);
  }

  // Resolve included plugins
  const pluginsDir = getPluginsDir();
  mkdirSync(pluginsDir, { recursive: true });

  for (const pluginRef of manifest.include_plugins || []) {
    if (pluginRef.startsWith('https://') || pluginRef.startsWith('http://') || pluginRef.startsWith('git@')) {
      const pluginName = basename(pluginRef.replace(/\.git$/, ''));
      const pluginPath = join(pluginsDir, pluginName);

      if (!existsSync(pluginPath)) {
        await cloneRepo(pluginRef, pluginPath);
      }

      pluginDirs.push(pluginPath);
    }
    // TODO: marketplace refs deferred to future version
  }

  // Determine MCP path
  let mcpPath: string | undefined;
  if (manifest.mcp) {
    const fullPath = join(bundlePath, manifest.mcp);
    if (existsSync(fullPath)) {
      mcpPath = fullPath;
    }
  }

  // Determine memory path
  let memoryPath: string | undefined;
  if (manifest.memory) {
    const fullPath = join(bundlePath, manifest.memory);
    if (existsSync(fullPath)) {
      memoryPath = fullPath;
    }
  }

  return {
    name: bundleName,
    manifest,
    bundlePath,
    pluginDirs,
    mcpPath,
    memoryPath,
    secrets: {}, // populated by caller after prompting
  };
}

export function mergeMcpConfigs(mcpPaths: string[]): Record<string, unknown> {
  const merged: Record<string, unknown> = { mcpServers: {} };

  for (const path of mcpPaths) {
    if (!existsSync(path)) continue;
    const content = readFileSync(path, 'utf-8');
    const config = JSON.parse(content);
    if (config.mcpServers) {
      Object.assign(merged.mcpServers as Record<string, unknown>, config.mcpServers);
    }
  }

  return merged;
}

export function writeMergedMcpConfig(merged: Record<string, unknown>, destPath: string): void {
  writeFileSync(destPath, JSON.stringify(merged, null, 2) + '\n');
}
