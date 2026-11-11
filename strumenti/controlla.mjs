// Controlli prima di pubblicare una nuova versione.
// Avvio:  node strumenti/controlla.mjs
//  - la versione in sw.js e in js/versione.js coincide
//  - ogni file elencato in sw.js esiste, e ogni file js/css è elencato
//  - nessun file JavaScript contiene errori di scrittura

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const radice = join(dirname(fileURLToPath(import.meta.url)), '..');
const problemi = [];

const sw = readFileSync(join(radice, 'sw.js'), 'utf8');
const versioneSw = sw.match(/VERSIONE = 'poncifilm-([^']+)'/)?.[1];
const versioneApp = readFileSync(join(radice, 'js/versione.js'), 'utf8').match(/VERSIONE_APP = '([^']+)'/)?.[1];
if (!versioneSw || versioneSw !== versioneApp) {
  problemi.push(`Versioni diverse: sw.js=${versioneSw} js/versione.js=${versioneApp}`);
}

const elencati = new Set([...sw.matchAll(/^\s*'([^']+\.[a-z]+)',$/gm)].map(m => m[1]));
for (const file of elencati) {
  if (!existsSync(join(radice, file))) problemi.push(`sw.js elenca un file che non esiste: ${file}`);
}

function tuttiIFile(cartella) {
  return readdirSync(cartella).flatMap(nome => {
    const percorso = join(cartella, nome);
    return statSync(percorso).isDirectory() ? tuttiIFile(percorso) : [percorso];
  });
}

const daControllare = [...tuttiIFile(join(radice, 'js')), ...tuttiIFile(join(radice, 'css'))];
for (const percorso of daControllare) {
  const nome = relative(radice, percorso).replaceAll('\\', '/');
  if (!elencati.has(nome)) problemi.push(`Manca in sw.js (non funzionerebbe offline): ${nome}`);
  if (nome.endsWith('.js')) {
    const esito = spawnSync(process.execPath, ['--input-type=module', '--check'], {
      input: readFileSync(percorso, 'utf8'),
      encoding: 'utf8',
    });
    if (esito.status !== 0) problemi.push(`Errore di sintassi in ${nome}:\n${esito.stderr}`);
  }
}

if (problemi.length) {
  console.log('Problemi trovati:\n- ' + problemi.join('\n- '));
  process.exit(1);
}
console.log(`Tutto a posto: versione ${versioneApp}, ${daControllare.length} file controllati.`);
