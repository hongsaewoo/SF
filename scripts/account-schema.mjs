// Adopt both untouched and manually migrated databases without re-adding columns.
export function prepareAccountSchema(sql, columnResults) {
  if (!Array.isArray(columnResults) || columnResults.length !== 2 || columnResults.some(result => result.success !== true || !Array.isArray(result.results))) {
    throw new Error('Could not inspect the posts/comments schema. Deployment stopped.');
  }
  const tables = new Map(['posts','comments'].map((table,index)=>[table,columnResults[index].results]));
  for (const [table,columns] of tables) {
    if (!columns.some(column=>column.name==='id')) throw new Error(`Missing ${table} table. Deployment stopped.`);
    const userColumn=columns.find(column=>column.name==='user_id');
    if (userColumn && userColumn.type.toUpperCase()!=='TEXT') throw new Error(`Unexpected ${table}.user_id type. Deployment stopped.`);
  }
  return sql.replace(/ALTER TABLE (posts|comments) ADD COLUMN user_id TEXT REFERENCES users\(id\);/g,(statement,table)=>tables.get(table).some(column=>column.name==='user_id')?'':statement);
}
