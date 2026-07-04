import { removeBundle } from '../core/registry.js';

export async function removeCommand(args: string[]): Promise<void> {
  const [name, ...rest] = args;
  if (!name) {
    console.error('Usage: claude-bundle remove <name> [--delete-files]');
    process.exit(1);
  }

  const deleteFiles = rest.includes('--delete-files');
  removeBundle(name, deleteFiles);
  console.log(`Bundle "${name}" removed`);
}
