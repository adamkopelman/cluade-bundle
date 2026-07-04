import { addBundle } from '../core/registry.js';

export async function addCommand(args: string[]): Promise<void> {
  const [url] = args;
  if (!url) {
    console.error('Usage: claude-bundle add <git-url>');
    process.exit(1);
  }

  console.log(`Adding bundle from ${url}...`);
  await addBundle(url);
  console.log('Bundle added successfully');
}
