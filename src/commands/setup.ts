import { execSync } from 'child_process';
import { existsSync, readFileSync, appendFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { loadConfig, saveConfig } from '../core/config.js';

export async function setupCommand(): Promise<void> {
  console.log('Setting up claude-bundle...\n');

  // Find real claude binary
  let realClaudePath = '';
  try {
    realClaudePath = execSync('which claude', { encoding: 'utf-8' }).trim();
  } catch {
    console.error('Could not find "claude" in PATH');
    console.error('Please ensure Claude Code is installed');
    process.exit(1);
  }

  // Store in config
  const config = loadConfig();
  config.realClaudePath = realClaudePath;
  saveConfig(config);

  console.log(`Found claude at: ${realClaudePath}`);
  console.log('\nTo use claude-bundle as your default claude command:');
  console.log('  Add this to your shell profile (.bashrc, .zshrc, etc.):');
  console.log(`  alias claude="claude-bundle"\n`);

  // Optionally offer to add alias
  const { input } = await import('@inquirer/prompts');
  const shell = process.env.SHELL?.split('/').pop() || 'bash';
  const rcFile = shell === 'zsh' ? '.zshrc' : '.bashrc';
  const rcPath = join(homedir(), rcFile);

  const shouldAdd = await input({
    message: `Add alias to ~/${rcFile}? (yes/no)`,
    default: 'no',
  });

  if (shouldAdd.toLowerCase() === 'yes') {
    const aliasLine = `alias claude="claude-bundle"\n`;
    appendFileSync(rcPath, aliasLine);
    console.log(`Added alias to ~/${rcFile}`);
    console.log('Run: source ~/' + rcFile);
  }

  console.log('\nSetup complete!');
}
