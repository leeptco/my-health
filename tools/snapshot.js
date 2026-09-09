'use strict';
// Консистентный снимок базы при работающем сервере: node tools/snapshot.js <src.db> <dst.db>
const { DatabaseSync } = require('node:sqlite');
const [src, dst] = process.argv.slice(2);
if (!src || !dst) { console.error('usage: snapshot.js <src.db> <dst.db>'); process.exit(1); }
const db = new DatabaseSync(src, { readOnly: true });
db.exec(`VACUUM INTO '${dst.replace(/\\/g, '/').replace(/'/g, "''")}'`);
db.close();
console.log('snapshot ->', dst);
