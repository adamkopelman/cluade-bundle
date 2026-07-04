import { listBundles } from '../core/registry.js';
import { loadSecrets } from '../core/secrets.js';
import { loadManifest } from '../core/manifest.js';

export async function listCommand(): Promise<void> {
  const bundles = listBundles();

  if (bundles.length === 0) {
    console.log('No bundles installed.');
    console.log('Run: claude-bundle add <git-url>');
    return;
  }

  console.log('\nInstalled bundles:\n');
  for (const bundle of bundles) {
    const manifest = loadManifest(bundle.path);
    const secrets = loadSecrets(bundle.name);
    const secretsStatus = manifest.requires_secrets
      ? `${Object.keys(secrets).length}/${manifest.requires_secrets.length} secrets set`
      : 'no secrets required';

    console.log(`  ${bundle.name.padEnd(20)} ${(bundle.description ?? '').slice(0, 40)}`);
    console.log(`                       ${secretsStatus}`);
  }
  console.log();
}
