import { select } from '@inquirer/prompts';
import type { BundleEntry } from './registry.js';

export async function showMenu(bundles: BundleEntry[]): Promise<string | null> {
  if (bundles.length === 0) {
    console.log('No bundles installed. Run: claude-bundle add <git-url>');
    return null;
  }

  const choices = [
    ...bundles.map((b) => ({
      name: `${b.name.padEnd(20)} ${b.description || ''}`,
      value: b.name,
    })),
    { name: '─'.repeat(40), value: '---', disabled: true },
    { name: '(none)    Plain Claude session', value: null },
  ];

  const result = await select({
    message: 'Which bundle?',
    choices,
  });

  return result;
}
