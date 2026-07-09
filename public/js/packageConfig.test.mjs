import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const packageJson = JSON.parse(await readFile('package.json', 'utf8'));

assert.equal(packageJson.engines.node, '24.x', 'Vercel Node runtime should be pinned to a major version');
