import { listBundles } from '../core/registry.js';
import { loadSecrets, saveSecrets } from '../core/secrets.js';
import { loadManifest } from '../core/manifest.js';
import { input } from '@inquirer/prompts';

export async function secretsCommand(args: string[]): Promise<void> {
  const [name] = args;
  if (!name) {
    console.error('Usage: claude-bundle secrets <name>');
    process.exit(1);
  }

  const bundles = listBundles();
  const bundle = bundles.find((b) => b.name === name);
  if (!bundle) {
    console.error(`Bundle "${name}" not found`);
    process.exit(1);
  }

  const manifest = loadManifest(bundle.path);
  const existing = loadSecrets(name);

  console.log(`\nConfiguring secrets for "${name}":\n`);

  const secrets: Record<string, string> = {};
  const required = manifest.requires_secrets || [];

  for (const key of required) {
    const current = existing[key];
    const value = await input({
      message: `${key}${current ? ' (press enter to keep current)' : ''}:`,
      default: current || '',
    });
    if (value) {
      secrets[key] = value;
    } else if (current) {
      secrets[key] = current;
    }
  }

  saveSecrets(name, secrets);
  console.log('\nSecrets saved');
}
