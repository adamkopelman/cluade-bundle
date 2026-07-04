import { addCommand } from './commands/add.js';
import { removeCommand } from './commands/remove.js';
import { listCommand } from './commands/list.js';
import { updateCommand } from './commands/update.js';
import { useCommand } from './commands/use.js';
import { initCommand } from './commands/init.js';
import { secretsCommand } from './commands/secrets.js';
import { setupCommand } from './commands/setup.js';

export function showHelp(): void {
  console.log(`
claude-bundle - Bundle manager for Claude Code

Usage:
  claude-bundle [command] [options]

Commands:
  add <git-url>      Add a bundle from a git repository
  remove <name>      Remove a bundle
  list               List installed bundles
  update [name]      Update bundle(s) from git
  use <name>         Launch a specific bundle
  init [name]        Scaffold a new bundle
  secrets <name>     Configure secrets for a bundle
  setup              Configure shell alias

Options:
  -h, --help         Show this help message
  -v, --version      Show version

Examples:
  claude-bundle add https://github.com/user/manager-bundle
  claude-bundle use manager
  claude-bundle setup
`);
}

export async function dispatch(args: string[]): Promise<void> {
  const [command, ...rest] = args;

  switch (command) {
    case 'add':
      await addCommand(rest);
      break;
    case 'remove':
      await removeCommand(rest);
      break;
    case 'list':
      await listCommand();
      break;
    case 'update':
      await updateCommand(rest);
      break;
    case 'use':
      await useCommand(rest);
      break;
    case 'init':
      await initCommand(rest);
      break;
    case 'secrets':
      await secretsCommand(rest);
      break;
    case 'setup':
      await setupCommand();
      break;
    case '-h':
    case '--help':
      showHelp();
      break;
    case '-v':
    case '--version':
      console.log('claude-bundle v0.1.0');
      break;
    default:
      // No command or unknown - show menu and launch
      await defaultCommand();
  }
}

async function defaultCommand(): Promise<void> {
  const { listBundles } = await import('./core/registry.js');
  const { showMenu } = await import('./core/menu.js');
  const { loadManifest } = await import('./core/manifest.js');
  const { resolveBundle } = await import('./core/resolver.js');
  const { promptForSecrets } = await import('./core/secrets.js');
  const { launchBundle } = await import('./core/launcher.js');

  const bundles = listBundles();
  const selected = await showMenu(bundles);

  if (selected === null) {
    // Plain session - launch real claude with no bundle
    const { loadConfig } = await import('./core/config.js');
    const config = loadConfig();
    if (!config.realClaudePath) {
      console.error('Real claude path not configured. Run: claude-bundle setup');
      process.exit(1);
    }
    const { execa } = await import('execa');
    await execa(config.realClaudePath, process.argv.slice(2), { stdio: 'inherit' });
    return;
  }

  const bundle = bundles.find((b) => b.name === selected);
  if (!bundle) {
    console.error(`Bundle "${selected}" not found`);
    process.exit(1);
  }

  const manifest = loadManifest(bundle.path);
  const resolved = await resolveBundle(bundle.name, bundle.path, manifest);

  // Prompt for any missing secrets
  if (manifest.requires_secrets && manifest.requires_secrets.length > 0) {
    resolved.secrets = await promptForSecrets(bundle.name, manifest.requires_secrets);
  }

  await launchBundle(resolved, process.argv.slice(2));
}
