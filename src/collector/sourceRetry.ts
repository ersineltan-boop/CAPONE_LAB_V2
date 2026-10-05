import {mkdir, readFile, rename, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
interface Pause {reason: string; checkedAt: string; retryAt: string;}
const allowed = new Set(['farfetch','free-people','level-shoes']);
const pathFor = (directory: string, sourceId: string) => {
  if (!allowed.has(sourceId)) throw new Error('Unsupported retry source'); return join(directory, `${sourceId}-retry.json`);
};
export async function sourceRetryPause(directory: string, sourceId: string, now = Date.now()): Promise<Pause | null> {
  try {
    const state = JSON.parse(await readFile(pathFor(directory, sourceId), 'utf8')) as Pause;
    const retry = Date.parse(state.retryAt), checked = Date.parse(state.checkedAt);
    return typeof state.reason === 'string' && Number.isFinite(retry) && Number.isFinite(checked) &&
      checked <= now && retry - checked <= 7 * 86400_000 && retry > now ? state : null;
  } catch (error) {if ((error as NodeJS.ErrnoException).code === 'ENOENT' || error instanceof SyntaxError) return null; throw error;}
}
export async function recordSourceRetry(directory: string, sourceId: string, errors: readonly string[], now = Date.now()) {
  const reason = errors.find(error => /HTTP\s*403\b/.test(error)) ?? errors.find(error => /HTTP\s*429\b/.test(error)) ?? null;
  // HTTP 403 requires access work; 429 is temporary throttling. Do not classify
  // schema/pagination failures or ordinary timeouts as permanent access blocks.
  const delay = reason ? (/HTTP\s*403\b/.test(reason) ? 7 * 86400_000 : 3600_000) : 0;
  const state: Pause = {reason: reason ?? '', checkedAt:new Date(now).toISOString(), retryAt:new Date(now + delay).toISOString()};
  await mkdir(directory,{recursive:true}); const path=pathFor(directory,sourceId);
  await writeFile(path+'.tmp',JSON.stringify(state)); await rename(path+'.tmp',path);
  return state;
}
