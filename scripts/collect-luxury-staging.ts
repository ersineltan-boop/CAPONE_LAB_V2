import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { collectLuxuryStaging, luxurySources, type LuxurySource } from '../src/onboarding/luxuryCollector';
const args = process.argv.slice(2);
const requested = args.find(a => a.startsWith('--source='))?.split('=')[1];
if (requested && !(requested in luxurySources)) throw new Error(`Unknown source: ${requested}`);
const sources = requested ? [requested as LuxurySource] : Object.keys(luxurySources) as LuxurySource[];
const limit = Number(args.find(a => a.startsWith('--limit='))?.split('=')[1] ?? 40);
if (!Number.isInteger(limit) || limit < 1) throw new Error('--limit must be a positive integer');
const dir = new URL('../data/onboarding/validated/', import.meta.url);
await mkdir(dir, { recursive: true });
await Promise.all(sources.map(async source => {
  const result = await collectLuxuryStaging(source, { limit, full: args.includes('--full') });
  const file = new URL(`luxury-${source}.json`, dir);
  let previousCount = 0;
  try { previousCount = JSON.parse(await readFile(file, 'utf8')).products?.length ?? 0; } catch { /* First collection. */ }
  if (result.products.length < previousCount) {
    await writeFile(new URL(`luxury-${source}-attempt.json`, dir), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify({ source, preservedPriorProducts: previousCount, attempt: result.coverage }));
  } else {
    await writeFile(file, JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify({ source, ...result.coverage }));
  }
  if (result.coverage.status === 'FAILED') process.exitCode = 1;
}));
