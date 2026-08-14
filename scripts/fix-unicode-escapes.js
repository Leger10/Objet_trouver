import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

// Mapping des échappements Unicode → caractères réels
const UNICODE_MAP = {
  '\\u00e0': 'à', '\\u00e1': 'á', '\\u00e2': 'â', '\\u00e3': 'ã', '\\u00e4': 'ä',
  '\\u00e5': 'å', '\\u00e7': 'ç', '\\u00e8': 'è', '\\u00e9': 'é', '\\u00ea': 'ê',
  '\\u00eb': 'ë', '\\u00ec': 'ì', '\\u00ed': 'í', '\\u00ee': 'î', '\\u00ef': 'ï',
  '\\u00f1': 'ñ', '\\u00f2': 'ò', '\\u00f3': 'ó', '\\u00f4': 'ô', '\\u00f5': 'õ',
  '\\u00f6': 'ö', '\\u00f9': 'ù', '\\u00fa': 'ú', '\\u00fb': 'û', '\\u00fc': 'ü',
  '\\u00fd': 'ý', '\\u00ff': 'ÿ',
  
  '\\u00c0': 'À', '\\u00c1': 'Á', '\\u00c2': 'Â', '\\u00c3': 'Ã', '\\u00c4': 'Ä',
  '\\u00c5': 'Å', '\\u00c7': 'Ç', '\\u00c8': 'È', '\\u00c9': 'É', '\\u00ca': 'Ê',
  '\\u00cb': 'Ë', '\\u00cc': 'Ì', '\\u00cd': 'Í', '\\u00ce': 'Î', '\\u00cf': 'Ï',
  '\\u00d1': 'Ñ', '\\u00d2': 'Ò', '\\u00d3': 'Ó', '\\u00d4': 'Ô', '\\u00d5': 'Õ',
  '\\u00d6': 'Ö', '\\u00d9': 'Ù', '\\u00da': 'Ú', '\\u00db': 'Û', '\\u00dc': 'Ü',
  '\\u00dd': 'Ý',
  
  '\\u0152': 'Œ', '\\u0153': 'œ', '\\u00e6': 'æ', '\\u00c6': 'Æ',
  
  '\\u2018': "'", '\\u2019': "'", '\\u201C': '"', '\\u201D': '"', '\\u201E': '"',
  '\\u2026': '…', '\\u2013': '–', '\\u2014': '—', '\\u200B': '', '\\u00a0': ' ',
  
  '\\u20AC': '€', '\\u00A3': '£', '\\u00A5': '¥', '\\u00A9': '©',
  '\\u00AE': '®', '\\u2122': '™', '\\u00B0': '°', '\\u00B1': '±',
  '\\u00F7': '÷', '\\u00D7': '×',
};

const EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.mdx'];

function scanDirectory(dir, files = []) {
  const entries = readdirSync(dir);
  
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    
    if (stats.isDirectory()) {
      if (!['node_modules', '.git', 'dist', 'build', '.next', 'out', 'coverage'].includes(entry)) {
        scanDirectory(fullPath, files);
      }
    } else if (stats.isFile()) {
      const ext = extname(entry);
      if (EXTENSIONS.includes(ext)) {
        files.push(fullPath);
      }
    }
  }
  
  return files;
}

function fixFile(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8');
    let modified = content;
    let changes = 0;
    
    for (const [escape, char] of Object.entries(UNICODE_MAP)) {
      const regex = new RegExp(escape, 'g');
      if (regex.test(modified)) {
        const matches = modified.match(regex);
        changes += matches ? matches.length : 0;
        modified = modified.replace(regex, char);
      }
    }
    
    if (changes > 0) {
      writeFileSync(filePath, modified, 'utf8');
      console.log(`✅ ${filePath} - ${changes} remplacement(s)`);
      return { filePath, changes };
    }
    
    return null;
  } catch (error) {
    console.error(`❌ Erreur sur ${filePath}:`, error.message);
    return null;
  }
}

function main() {
  const srcDir = join(process.cwd(), 'src');
  console.log('📁 Recherche des fichiers dans:', srcDir);
  
  if (!statSync(srcDir).isDirectory()) {
    console.error('❌ Le dossier src/ n\'existe pas');
    process.exit(1);
  }
  
  const files = scanDirectory(srcDir);
  console.log(`📄 ${files.length} fichiers trouvés`);
  
  let totalChanges = 0;
  let fixedFiles = 0;
  
  for (const file of files) {
    const result = fixFile(file);
    if (result) {
      fixedFiles++;
      totalChanges += result.changes;
    }
  }
  
  console.log('\n📊 Résumé:');
  console.log(`   - ${fixedFiles} fichiers corrigés`);
  console.log(`   - ${totalChanges} remplacements effectués`);
  
  if (totalChanges === 0) {
    console.log('✨ Aucun échappement Unicode trouvé !');
  }
}

main();