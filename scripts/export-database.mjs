// Exporte la base MySQL dans backups/ sous forme de dump SQL.
// Usage :  npm run db:export            (utilise DATABASE_URL du .env)
//          npm run db:export prod       (utilise DATABASE_URL_PROD si définie, sinon throw)
// Le dump est horodaté et conservé dans le dossier backups/.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function loadEnv() {
  const envPath = join(root, '.env');
  if (!existsSync(envPath)) return {};
  const out = {};
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    let value = m[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[m[1]] = value;
  }
  return out;
}

function parseDatabaseUrl(url) {
  const m = url.match(/^mysql:\/\/([^:]*):([^@]*)@([^:]+):(\d+)\/([^?]+)/);
  if (!m) throw new Error(`DATABASE_URL invalide: ${url}`);
  return {
    user: decodeURIComponent(m[1] || 'root'),
    pass: m[2] ? decodeURIComponent(m[2]) : '',
    host: m[3],
    port: m[4],
    db: m[5].replace(/[^a-zA-Z0-9_]/g, ''),
  };
}

function findMysqldump() {
  const candidates = [
    'mysqldump',
    'C:\\xampp\\mysql\\bin\\mysqldump.exe',
    'C:\\wamp64\\bin\\mysql\\mysql8.0.30\\bin\\mysqldump.exe',
    'C:\\wamp64\\bin\\mysql\\mysql5.7.42\\bin\\mysqldump.exe',
    'C:\\laragon\\bin\\mysql\\mysql-8.0.30-win64\\bin\\mysqldump.exe',
    '/usr/bin/mysqldump',
    '/usr/local/bin/mysqldump',
  ];
  for (const c of candidates) {
    if (c === 'mysqldump') {
      try {
        execFileSync('mysqldump', ['--version'], { stdio: 'ignore' });
        return c;
      } catch { continue; }
    } else if (existsSync(c)) {
      return c;
    }
  }
  return null;
}

const env = loadEnv();
const isProd = process.argv[2] === 'prod';

const url = isProd ? (process.env.DATABASE_URL_PROD || env.DATABASE_URL_PROD) : (process.env.DATABASE_URL || env.DATABASE_URL);
if (!url) throw new Error('DATABASE_URL manquante (fichier .env ou variable d\'environnement).');

const { user, pass, host, port, db } = parseDatabaseUrl(url);
const mysqldump = findMysqldump();
if (!mysqldump) {
  console.error('mysqldump introuvable. Installez MySQL Server ou précisez le chemin dans scripts/export-database.mjs.');
  process.exit(1);
}

const backupDir = join(root, 'backups');
mkdirSync(backupDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const target = join(backupDir, `${isProd ? 'retrouvemoi_PROD_' : 'retrouvemoi_'}_${stamp}.sql`);

console.log(`Export de la base "${db}" (${isProd ? 'PROD' : 'local'}) vers backups/…`);

const args = ['--user=' + user, '--host=' + host, '--port=' + port, '--single-transaction', '--routines', '--triggers', db];
if (pass) {
  // MDP via variable d'environnement pour ne pas l'afficher dans la ligne de commande
  process.env.MYSQL_PWD = pass;
}

let sql;
try {
  sql = execFileSync(mysqldump, args, { maxBuffer: 512 * 1024 * 1024, encoding: 'utf8' });
} finally {
  if (pass) delete process.env.MYSQL_PWD;
}

writeFileSync(target, sql, 'utf8');
console.log(`✔ Dump créé : ${target} (${(sql.length / 1024).toFixed(1)} Ko)`);

// Note de confidentialité : pour une vente / démo, préférez un dump
// anonymisé (voir INSTALLATION.md — section « Préparation pour la vente »).