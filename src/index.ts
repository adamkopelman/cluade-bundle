#!/usr/bin/env node
import { dispatch } from './cli.js';

dispatch(process.argv.slice(2)).catch((err) => {
  console.error(err.message);
  process.exit(1);
});
