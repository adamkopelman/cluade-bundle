import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync } from 'fs';
import { join } from 'path';
import { input } from '@inquirer/prompts';
import { getSecretsDir } from './paths.js';
import type { SecretStore } from '../types/index.js';

export function getSecretsPath(bundleName: string): string {
  return join(getSecretsDir(), `${bundleName}.env`);
}

export function loadSecrets(bundleName: string): SecretStore {
  const secretsPath = getSecretsPath(bundleName);
  if (!existsSync(secretsPath)) {
    return {};
  }

  const content = readFileSync(secretsPath, 'utf-8');
  const secrets: SecretStore = {};

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...valueParts] = trimmed.split('=');
    if (key && valueParts.length > 0) {
      secrets[key] = valueParts.join('=').replace(/^["']|["']$/g, '');
    }
  }

  return secrets;
}

export function saveSecrets(bundleName: string, secrets: SecretStore): void {
  const secretsDir = getSecretsDir();
  mkdirSync(secretsDir, { recursive: true });

  const secretsPath = getSecretsPath(bundleName);
  const lines = Object.entries(secrets).map(([key, value]) => `${key}=${value}`);
  writeFileSync(secretsPath, lines.join('\n') + '\n');
  chmodSync(secretsPath, 0o600);
}

export async function promptForSecrets(bundleName: string, required: string[]): Promise<SecretStore> {
  const existing = loadSecrets(bundleName);
  const secrets: SecretStore = { ...existing };

  for (const key of required) {
    if (!secrets[key]) {
      const value = await input({
        message: `Enter ${key} for bundle "${bundleName}":`,
      });
      secrets[key] = value;
    }
  }

  saveSecrets(bundleName, secrets);
  return secrets;
}
