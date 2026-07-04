import { execa } from 'execa';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { loadConfig } from './config.js';
import { mergeMcpConfigs } from './resolver.js';
import type { ResolvedBundle } from '../types/index.js';

export async function launchBundle(
  resolved: ResolvedBundle,
  userArgs: string[] = []
): Promise<void> {
  const config = loadConfig();

  if (!config.realClaudePath) {
    throw new Error('Real claude path not configured. Run: claude-bundle setup');
  }

  // Build command line arguments
  const args: string[] = [];

  // Add plugin directories
  for (const pluginDir of resolved.pluginDirs) {
    args.push('--plugin-dir', pluginDir);
  }

  // Handle MCP config
  const mcpPaths: string[] = [];
  if (resolved.mcpPath) {
    mcpPaths.push(resolved.mcpPath);
  }
  // Also check included plugins for mcp.json
  for (const pluginDir of resolved.pluginDirs) {
    const pluginMcp = join(pluginDir, 'mcp.json');
    if (existsSync(pluginMcp)) {
      mcpPaths.push(pluginMcp);
    }
  }

  if (mcpPaths.length > 0) {
    const merged = mergeMcpConfigs(mcpPaths);
    const tmpDir = join(process.env.TMPDIR || '/tmp', 'claude-bundle');
    mkdirSync(tmpDir, { recursive: true });
    const mergedMcpPath = join(tmpDir, `mcp-${resolved.name}.json`);
    writeFileSync(mergedMcpPath, JSON.stringify(merged, null, 2));
    args.push('--strict-mcp-config', '--mcp-config', mergedMcpPath);
  }

  // Add memory directory
  if (resolved.memoryPath) {
    args.push('--add-dir', resolved.memoryPath);
  }

  // Inject readme as system prompt
  const readmePath = join(resolved.bundlePath, 'README.md');
  if (existsSync(readmePath)) {
    const readme = readFileSync(readmePath, 'utf-8');
    args.push('--append-system-prompt', readme);
  }

  // Add user arguments
  args.push(...userArgs);

  // Print banner
  console.log(`\n┌─ claude-bundle ──────────────────┐`);
  console.log(`│  Launching: ${resolved.name.padEnd(26)} │`);
  console.log(`│  ${resolved.manifest.description.slice(0, 32).padEnd(32)} │`);
  console.log(`└──────────────────────────────────┘\n`);

  // Exec with secrets as env vars
  await execa(config.realClaudePath, args, {
    stdio: 'inherit',
    env: { ...process.env, ...resolved.secrets },
  });
}
