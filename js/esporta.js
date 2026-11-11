// Copie dei dati da scaricare: completa (JSON) o tabella per Excel (CSV).

import * as archivio from './archivio.js';
import { h, nomePaese } from './ui.js';

// Sull'iPhone apre il menu "Condividi" (Salva in File, AirDrop, ...);
// altrove scarica il file direttamente.
async function scaricaFile(nome, contenuto, tipo) {
  const file = new File([contenuto], nome, { type: tipo });
  const suIphone = navigator.standalone !== undefined;
  if (suIphone && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: nome });
      return;
    } catch (errore) {
      if (errore.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(file);
  const link = h('a', { href: url, download: nome });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function esportaJson() {
  return scaricaFile(`poncifilm-${archivio.oggi()}.json`,
    archivio.testoOrdinato(archivio.archivioCorrente(), 2), 'application/json');
}

// ---------------------------------------------------------------- CSV

const COLONNE = [
  ['Titolo', o => o.info.titolo],
  ['Titolo originale', o => o.info.titoloOriginale],
  ['Anno', o => o.info.anno],
  ['Stato', (o, c) => c.stati.get(o.stato) ?? o.stato],
  ['Priorità', (o, c) => (o.stato === 'da-vedere' || o.stato === 'da-rivedere' ? c.priorita.get(archivio.prioritaDi(o)) : '')],
  ['Voto', o => o.voto],
  ['Giudizio', (o, c) => (o.voto ? c.voti.get(o.voto) : '')],
  ['Riconoscimenti', (o, c) => o.riconoscimenti.map(id => c.riconoscimenti.get(id) ?? id).join(', ')],
  ['Commento', o => o.commento],
  ['Visioni', o => o.visioni.length || ''],
  ['Ultima visione', o => archivio.ultimaVisione(o)],
  ['Tutte le visioni', o => [...o.visioni].sort().join(', ')],
  ['Regia', o => (o.info.regia || []).map(p => p.nome).join(', ')],
  ['Musica', o => (o.info.musica || []).map(p => p.nome).join(', ')],
  ['Cast', o => (o.info.cast || []).slice(0, 5).map(p => p.nome).join(', ')],
  ['Generi', o => (o.info.generi || []).join(', ')],
  ['Durata (min)', o => o.info.durata],
  ['Paese', o => (o.info.paesi || []).map(nomePaese).join(', ')],
  ['Saga', o => o.info.collezione?.nome],
  ['Piattaforme', o => (archivio.piattaformeVisibili(o)?.abbonamento || []).map(p => p.nome).join(', ')],
  ['Aggiunto il', o => o.aggiuntoIl?.slice(0, 10)],
  ['TMDb', o => o.tmdbId],
  ['IMDb', o => o.info.imdbId],
];

// Ogni valore tra virgolette se contiene separatore, virgolette o a capo.
function cella(valore) {
  const testo = valore == null ? '' : String(valore);
  return /[;"\n\r]/.test(testo) ? `"${testo.replace(/"/g, '""')}"` : testo;
}

export function testoCsv() {
  const imp = archivio.impostazioni();
  const c = {
    stati: new Map(imp.stati.map(s => [s.id, s.nome])),
    priorita: new Map(imp.priorita.map(p => [p.id, p.nome])),
    voti: new Map(imp.voti.map(v => [v.valore, v.frase])),
    riconoscimenti: new Map(imp.riconoscimenti.map(r => [r.id, r.nome])),
  };
  const opere = archivio.opere().sort((a, b) => a.info.titolo.localeCompare(b.info.titolo, 'it'));
  const righe = [
    COLONNE.map(([nome]) => nome),
    ...opere.map(o => COLONNE.map(([, valore]) => valore(o, c))),
  ];
  // Punto e virgola e "BOM" iniziale: così Excel in italiano apre colonne e accenti giusti.
  return '﻿' + righe.map(riga => riga.map(cella).join(';')).join('\r\n') + '\r\n';
}

export function esportaCsv() {
  return scaricaFile(`poncifilm-${archivio.oggi()}.csv`, testoCsv(), 'text/csv');
}
