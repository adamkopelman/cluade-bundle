import { test, expect } from 'vitest';
import { launchBundle } from '../../src/core/launcher';

test('launchBundle is exported', () => {
  expect(typeof launchBundle).toBe('function');
});
