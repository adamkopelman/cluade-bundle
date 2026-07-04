import { z } from 'zod';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { BundleManifest } from '../types/index.js';

const manifestSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  include_plugins: z.array(z.string()).default([]),
  mcp: z.string().optional(),
  memory: z.string().optional(),
  requires_secrets: z.array(z.string()).default([]),
});

export function parseManifest(json: unknown): BundleManifest {
  return manifestSchema.parse(json);
}

export function loadManifest(bundlePath: string): BundleManifest {
  const manifestPath = join(bundlePath, 'bundle.json');
  const content = readFileSync(manifestPath, 'utf-8');
  const parsed = JSON.parse(content);
  return parseManifest(parsed);
}
