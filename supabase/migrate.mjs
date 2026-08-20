import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DB_PASSWORD = 'Leger@2020L';
const PROJECT_REF = 'uudgiamuqutgljakelkb';

const CONNECTION_STRINGS = [
  `postgresql://postgres.${PROJECT_REF}:${encodeURIComponent(DB_PASSWORD)}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
  `postgresql://postgres:${encodeURIComponent(DB_PASSWORD)}@db.${PROJECT_REF}.supabase.co:5432/postgres`,
  `postgresql://postgres.${PROJECT_REF}:${encodeURIComponent(DB_PASSWORD)}@aws-0-eu-west-1.pooler.supabase.com:6543/postgres`,
  `postgresql://postgres:${encodeURIComponent(DB_PASSWORD)}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
];

async function run() {
  const sqlPath = path.join(__dirname, 'setup-complete.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');

  let client = null;

  for (const connStr of CONNECTION_STRINGS) {
    try {
      console.log(`Tentative de connexion: ${connStr.substring(0, 60)}...`);
      client = new pg.Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
      await client.connect();
      console.log('✅ Connecté à la base PostgreSQL !');
      break;
    } catch (err) {
      console.log(`❌ Échec: ${err.message.substring(0, 80)}`);
      if (client) { await client.end().catch(() => {}); client = null; }
    }
  }

  if (!client) {
    console.error('\n❌ Impossible de se connecter. Vérifie le mot de passe dans Settings > Database.');
    process.exit(1);
  }

  try {
    console.log('\nExécution du SQL...');
    await client.query(sql);
    console.log('✅ Toutes les tables ont été créées avec succès !');
  } catch (err) {
    console.error(`\n⚠️ Erreur SQL: ${err.message}`);
    if (err.message.includes('already exists')) {
      console.log('Certaines tables existent déjà, c\'est normal.');
    }
  } finally {
    await client.end();
  }
}

run();
