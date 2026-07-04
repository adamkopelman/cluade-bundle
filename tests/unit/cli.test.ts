import { test, expect } from 'vitest';
import { showHelp, dispatch } from '../../src/cli';

test('showHelp is exported', () => {
  expect(typeof showHelp).toBe('function');
});

test('dispatch is exported', () => {
  expect(typeof dispatch).toBe('function');
});
