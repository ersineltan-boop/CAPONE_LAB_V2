import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const jobs = ['collect-massimo-staging.ts', 'collect-luxury-staging.ts', 'collect-24s-staging.ts'];
const results = await Promise.allSettled(jobs.map(file => new Promise<void>((resolve, reject) => {
  const child = spawn(process.execPath, ['--import', 'tsx', fileURLToPath(new URL(file, import.meta.url))], {stdio:'inherit'});
  child.on('error', reject);
  child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${file}: exit ${code}`)));
})));
results.forEach((result,index) => console.log(`${jobs[index]}: ${result.status}`));
if (results.some(result => result.status === 'rejected')) process.exitCode = 1;
