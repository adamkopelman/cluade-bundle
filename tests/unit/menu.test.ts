import { test, expect } from 'vitest';
import { showMenu } from '../../src/core/menu';

test('showMenu is exported', () => {
  expect(typeof showMenu).toBe('function');
});
