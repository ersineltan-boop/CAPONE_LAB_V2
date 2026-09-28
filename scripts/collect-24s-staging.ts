import { mkdir, writeFile } from 'node:fs/promises';
import { collect24S } from '../src/collector/twentyFourS';
const result = await collect24S();
const dir = new URL('../data/onboarding/staging/marketplaces/24s/', import.meta.url);
await mkdir(dir, {recursive: true});
await writeFile(new URL('catalog.json', dir), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result.coverage, null, 2));
if (result.coverage.status !== 'FULL') process.exitCode = 1;
