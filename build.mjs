import {mkdir,copyFile,readFile,writeFile} from 'node:fs/promises';
await mkdir('public',{recursive:true});
for (const file of ['index.html','community.js','_routes.json']) await copyFile(file,`public/${file}`);
// Build-time variable is a database UUID, never an API token.
const config = JSON.parse(await readFile('wrangler.jsonc','utf8'));
const databaseId = process.env.D1_DATABASE_ID?.trim();
if (databaseId) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(databaseId)) throw new Error('D1_DATABASE_ID must be a D1 database UUID');
  config.d1_databases = [{binding:'DB',database_name:'null-vector-community',database_id:databaseId}];
}
await writeFile('wrangler.deploy.json',JSON.stringify(config,null,2));
