import {readFile,writeFile,mkdir,appendFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {EXPANSION_REFRESH_IDS,expansionRefreshDecision} from '../src/onboarding/expansionRefresh';
const ids=[...EXPANSION_REFRESH_IDS];
const path=(id:string)=>`data/onboarding/validated/expansion-${id}.json`;
const before=new Map(await Promise.all(ids.map(async id=>[id,await readFile(path(id),'utf8')] as const)));
const run=(script:string,args:string[])=>spawnSync(process.execPath,['--import','tsx',script,...args],{stdio:'inherit',timeout:30*60*1000});
const collect=run('scripts/collect-brand-expansion.ts',ids);
const accepted:string[]=[];const preserved:{id:string;reason:string}[]=[];
for(const id of ids){
 let candidate:any;try{candidate=JSON.parse(await readFile(path(id),'utf8'));}catch{}
 const reason=collect.status!==0?'Collector process failed':expansionRefreshDecision(JSON.parse(before.get(id)!),candidate);
 if(reason){await writeFile(path(id),before.get(id)!);preserved.push({id,reason});}
 else accepted.push(id);
}
await mkdir('data/onboarding/staging/expansion-refresh',{recursive:true});
const report={generatedAt:new Date().toISOString(),accepted,preserved,coverage:'PARTIAL',note:'Approved feeds only; full women footwear totals remain unverified.'};
await writeFile('data/onboarding/staging/expansion-refresh/report.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(process.env.GITHUB_OUTPUT)await appendFile(process.env.GITHUB_OUTPUT,`data_changed=${accepted.length>0}\naccepted_sources=${accepted.join(',')}\npreserved_sources=${preserved.map(x=>x.id).join(',')}\n`);
if(!accepted.length)throw Error('NO_UPDATE: all last-good catalogs preserved');
const publish=run('scripts/publish-priority-brands.ts',accepted);
if(publish.status!==0)throw Error('Failed to prepare expansion delivery');
