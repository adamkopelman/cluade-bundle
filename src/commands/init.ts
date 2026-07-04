import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const DEFAULT_BUNDLE_JSON = {
  name: 'my-bundle',
  description: 'My custom Claude Code bundle',
  include_plugins: [],
  requires_secrets: [],
};

const DEFAULT_README = `# My Bundle

Description of what this bundle provides.

## Commands

- \`/my-command\` - Description

## Secrets Required

None
`;

export async function initCommand(args: string[]): Promise<void> {
  const [name = 'my-bundle'] = args;
  const cwd = process.cwd();
  const bundleDir = join(cwd, name);

  mkdirSync(bundleDir, { recursive: true });
  mkdirSync(join(bundleDir, 'plugin'), { recursive: true });
  mkdirSync(join(bundleDir, 'memory'), { recursive: true });

  const bundleJson = { ...DEFAULT_BUNDLE_JSON, name };
  writeFileSync(join(bundleDir, 'bundle.json'), JSON.stringify(bundleJson, null, 2) + '\n');
  writeFileSync(join(bundleDir, 'README.md'), DEFAULT_README);
  writeFileSync(join(bundleDir, 'mcp.json'), JSON.stringify({ mcpServers: {} }, null, 2) + '\n');

  console.log(`Created bundle "${name}" at ${bundleDir}`);
  console.log('Next steps:');
  console.log(`  cd ${name}`);
  console.log('  git init && git add . && git commit -m "initial"');
  console.log('  claude-bundle add <this-repo-url>');
}
