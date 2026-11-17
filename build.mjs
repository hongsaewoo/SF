import {mkdir,copyFile} from 'node:fs/promises';
await mkdir('public',{recursive:true});
for (const file of ['index.html','community.js','_routes.json']) await copyFile(file,`public/${file}`);
