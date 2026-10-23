import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildOpenApiSpec } from '../src/server.js';

test('committed docs/api/openapi.json matches buildOpenApiSpec() (run: npm run openapi)', () => {
  const committed = JSON.parse(readFileSync(new URL('../docs/api/openapi.json', import.meta.url), 'utf8'));
  assert.deepEqual(committed, buildOpenApiSpec());
});
