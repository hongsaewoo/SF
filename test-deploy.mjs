import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {deploy} from './deploy.mjs';
const dir=await mkdtemp(join(tmpdir(),'sf-deploy-test-'));
const configPath=join(dir,'config.json');
const schema1=readFileSync('migrations/0001_community.sql','utf8');
const schema2=readFileSync('migrations/0002_accounts.sql','utf8');
try {
  await writeFile(configPath,JSON.stringify({d1_databases:[{binding:'DB',database_id:'00000000-0000-0000-0000-000000000001'}]}));
  for (const state of ['new','old','partial','manual']) {
    const db=new DatabaseSync(':memory:');let deployments=0;
    if(state!=='new')db.exec(schema1);
    if(state==='partial'){db.exec(schema2.split('ALTER TABLE comments')[0]);}
    if(state==='manual'){db.exec(schema2);db.prepare("INSERT INTO users(id,username,nickname,password_hash,salt,iterations,created_at) VALUES ('member','existing_user','Existing','hash','salt',100000,'2026-11-18')").run();}
    if(state!=='new')db.prepare("INSERT INTO posts(id,title,body,author,category,created_at) VALUES ('legacy','Legacy','Body','Guest','THOUGHT','2026-11-18')").run();
    const run=args=>{
      if(args[0]==='deploy'){deployments++;return '';}
      assert.ok(args.includes('--remote'));
      if(args.includes('--file')){db.exec(readFileSync(args[args.indexOf('--file')+1],'utf8'));return '';}
      return JSON.stringify(['posts','comments'].map(table=>({success:true,results:db.prepare(`PRAGMA table_info(${table})`).all()})));
    };
    await deploy({run,configPath,branch:'main'});
    await deploy({run,configPath,branch:'main'});
    assert.equal(deployments,2);
    for(const table of ['posts','comments'])assert.ok(db.prepare(`PRAGMA table_info(${table})`).all().some(c=>c.name==='user_id'));
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM users").get().n,state==='manual'?1:0);
    if(state!=='new')assert.equal(db.prepare('SELECT title FROM posts WHERE id=?').get('legacy').title,'Legacy');
    let calls=0;
    await assert.rejects(deploy({configPath,branch:'feature',run(){calls++;}}),/production/);assert.equal(calls,0);
    await assert.rejects(deploy({configPath,branch:'main',run(args){if(args[0]==='deploy')throw new Error('MUST NOT DEPLOY');throw new Error('D1 permission denied');}}),/D1 permission denied/);
    db.close();
  }
  await writeFile(configPath,'{}');let calls=0;
  await assert.rejects(deploy({configPath,run(){calls++;}}),/D1_DATABASE_ID/);assert.equal(calls,0);
  console.log('PASS: new, legacy, partially migrated, manually migrated and repeat deployments; data preserved; failures and preview branches block deployment.');
} finally {await rm(dir,{recursive:true,force:true});}
