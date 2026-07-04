import { test, expect, vi } from 'vitest';
import { cloneRepo, pullRepo } from '../../src/utils/git';

test('cloneRepo and pullRepo are exported', () => {
  expect(typeof cloneRepo).toBe('function');
  expect(typeof pullRepo).toBe('function');
});
