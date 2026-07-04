import { test, expect } from 'vitest';
import { resolveBundle } from '../../src/core/resolver';
import type { BundleManifest } from '../../src/types/index.js';

test('resolveBundle is exported', () => {
  expect(typeof resolveBundle).toBe('function');
});
