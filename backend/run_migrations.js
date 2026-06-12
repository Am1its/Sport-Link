// Run all migrations against the configured database (safe to re-run — all use IF NOT EXISTS).
// Usage:
//   node run_migrations.js
//   DATABASE_URL="mysql://user:pass@host:port/db" node run_migrations.js
require('dotenv').config();
const mysql = require('mysql2/promise');
const fs    = require('fs');
const path  = require('path');

function parseConnectionUrl(url) {
  const u = new URL(url);
  return {
    host:     u.hostname,
    port:     u.port ? parseInt(u.port) : 3306,
    user:     decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ''),
  };
}

async function main() {
  const raw = process.env.DATABASE_URL || process.env.MYSQL_URL || process.env.MYSQL_PUBLIC_URL;
  const base = raw ? parseConnectionUrl(raw) : {
    host:     process.env.DB_HOST     || 'localhost',
    port:     process.env.DB_PORT     ? parseInt(process.env.DB_PORT) : 3306,
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'sportlink',
  };

  console.log(`Connecting to ${base.host}:${base.port}/${base.database} as ${base.user}`);

  const conn = await mysql.createConnection({ ...base, multipleStatements: true });

  const dir   = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();

  let ok = 0, failed = 0;
  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf-8').trim();
    if (!sql) continue;
    try {
      await conn.query(sql);
      console.log(`✅  ${file}`);
      ok++;
    } catch (err) {
      console.error(`❌  ${file}: ${err.message}`);
      failed++;
    }
  }

  await conn.end();
  console.log(`\nDone — ${ok} passed, ${failed} failed.`);
}

main().catch(err => { console.error(err); process.exit(1); });
