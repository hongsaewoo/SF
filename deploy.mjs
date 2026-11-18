import {execFileSync} from 'node:child_process';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {prepareAccountSchema} from './scripts/account-schema.mjs';

const root=fileURLToPath(new URL('.',import.meta.url));
function wrangler(args) {
  return execFileSync('npx',['--yes','wrangler',...args],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','inherit'],maxBuffer:8*1024*1024});
}
export async function deploy({run=wrangler,configPath=join(root,'wrangler.deploy.json'),branch=process.env.WORKERS_CI_BRANCH}={}) {
  if (branch && branch!=='main') throw new Error('This command targets production. Use the separate preview command for other branches.');
  const config=JSON.parse(await readFile(configPath,'utf8'));
  const db=config.d1_databases?.find(binding=>binding.binding==='DB');
  if (!db || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(db.database_id||'')) {
    throw new Error('Set the D1_DATABASE_ID build variable and run node build.mjs before deployment.');
  }
  const base=['d1','execute','DB','--remote','--config',configPath,'--yes'];
  console.log('Ensuring community tables exist…');
  run([...base,'--file',join(root,'migrations/0001_community.sql')]);
  const columns=JSON.parse(run([...base,'--command','PRAGMA table_info(posts); PRAGMA table_info(comments);','--json']));
  const sql=prepareAccountSchema(await readFile(join(root,'migrations/0002_accounts.sql'),'utf8'),columns);
  const dir=await mkdtemp(join(tmpdir(),'sf-schema-'));
  try {
    const filename=join(dir,'accounts.sql');
    await writeFile(filename,sql);
    console.log('Ensuring account tables and author columns exist…');
    run([...base,'--file',filename]);
  } finally {
    await rm(dir,{recursive:true,force:true});
  }
  // A schema or permission error throws above, so incompatible code is never deployed.
  console.log('Database ready. Deploying Worker and assets…');
  const output=run(['deploy','--config',configPath]);
  if (output) console.log(output);
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href===import.meta.url) {
  await deploy();
}
