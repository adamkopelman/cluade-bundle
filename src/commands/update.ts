import { listBundles } from '../core/registry.js';
import { pullRepo } from '../utils/git.js';

export async function updateCommand(args: string[]): Promise<void> {
  const [name] = args;

  if (name) {
    // Update specific bundle
    const bundles = listBundles();
    const bundle = bundles.find((b) => b.name === name);
    if (!bundle) {
      console.error(`Bundle "${name}" not found`);
      process.exit(1);
    }
    console.log(`Updating ${name}...`);
    await pullRepo(bundle.path);
    console.log('Updated successfully');
  } else {
    // Update all bundles
    const bundles = listBundles();
    for (const bundle of bundles) {
      console.log(`Updating ${bundle.name}...`);
      await pullRepo(bundle.path);
    }
    console.log('All bundles updated');
  }
}
