import { listBundles } from '../core/registry.js';
import { loadManifest } from '../core/manifest.js';
import { resolveBundle } from '../core/resolver.js';
import { promptForSecrets } from '../core/secrets.js';
import { launchBundle } from '../core/launcher.js';

export async function useCommand(args: string[]): Promise<void> {
  const [name, ...userArgs] = args;
  if (!name) {
    console.error('Usage: claude-bundle use <name>');
    process.exit(1);
  }

  const bundles = listBundles();
  const bundle = bundles.find((b) => b.name === name);
  if (!bundle) {
    console.error(`Bundle "${name}" not found`);
    process.exit(1);
  }

  const manifest = loadManifest(bundle.path);
  const resolved = await resolveBundle(bundle.name, bundle.path, manifest);

  if (manifest.requires_secrets && manifest.requires_secrets.length > 0) {
    resolved.secrets = await promptForSecrets(bundle.name, manifest.requires_secrets);
  }

  await launchBundle(resolved, userArgs);
}
