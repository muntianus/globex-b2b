// Writes docs/api/openapi.json from buildOpenApiSpec(): the code is the source
// of truth, the committed file is what reviewers and clients read.
//   node scripts/export-openapi.js          # rewrite the committed spec
//   node scripts/export-openapi.js --check  # exit 1 if it is stale
import { readFileSync, writeFileSync } from 'node:fs';
import { buildOpenApiSpec } from '../src/server.js';

const target = new URL('../docs/api/openapi.json', import.meta.url);
const rendered = `${JSON.stringify(buildOpenApiSpec(), null, 2)}\n`;

if (process.argv.includes('--check')) {
  let current = '';
  try {
    current = readFileSync(target, 'utf8');
  } catch {
    // missing file is stale too
  }
  if (current !== rendered) {
    console.error('docs/api/openapi.json is stale — run: npm run openapi');
    process.exit(1);
  }
} else {
  writeFileSync(target, rendered);
  console.log('wrote docs/api/openapi.json');
}
