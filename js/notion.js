// Lettura dell'esportazione CSV del vecchio database Notion e traduzione di ogni
// riga nei dati di PonciFilm. Qui non si parla con TMDb: solo testo → dati.
//
// Colonne usate: Status, Titolo, Tipo, Uscita (solo per l'anno), Priorità, Voto,
// Riconoscimento, Commento. Le altre (generi, piattaforme, attori, …) erano
// incomplete o disordinate: quelle informazioni arrivano pulite da TMDb.

// CSV → elenco di oggetti { colonna: valore }. Gestisce virgolette, "" e a capo dentro i campi.
export function leggiCsv(testo) {
  const righe = [];
  let riga = [];
  let campo = '';
  let traVirgolette = false;
  const t = testo.replace(/^﻿/, '');
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (traVirgolette) {
      if (c === '"' && t[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') traVirgolette = false;
      else campo += c;
    } else if (c === '"') traVirgolette = true;
    else if (c === ',') { riga.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      riga.push(campo); righe.push(riga);
      riga = []; campo = '';
    } else campo += c;
  }
  if (campo || riga.length) { riga.push(campo); righe.push(riga); }

  const piene = righe.filter(r => r.some(x => x.trim()));
  if (!piene.length) return [];
  const nomi = piene[0].map(chiaveColonna);
  return piene.slice(1).map(r => Object.fromEntries(nomi.map((n, i) => [n, (r[i] ?? '').trim()])));
}

// "Priorità " → "priorita", " Regista" → "regista", "🎶 MUSICA" → "musica".
function chiaveColonna(nome) {
  return nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

const semplice = testo => chiaveColonna(testo || '');

const STATI = {
  visto: 'visto',
  'da guardare': 'da-vedere',
  'da vedere': 'da-vedere',
  'da rivedere': 'da-rivedere',
  'in corso': 'da-vedere',
  annulato: 'abbandonato',
  annullato: 'abbandonato',
  abbandonato: 'abbandonato',
};

const PRIORITA = {
  'day one': 'day-one',
  'il prima possibile': 'presto',
  'prima o poi': 'prima-o-poi',
  'da vedere': 'prima-o-poi',
};

const TIPI = { film: 'film', corto: 'corto', 'serie tv': 'serie', serie: 'serie' };

// "Il gatto col cappello  + rewatch" → "Il gatto col cappello"; ’ → '
export function pulisciTitolo(titolo) {
  return (titolo || '')
    .replace(/[’‘`]/g, '\'')
    .replace(/\s*\+\s*rewatch\b/gi, '')
    .replace(/\s+S\d+\b/g, '')        // "S8" (stagione) nelle serie
    .replace(/\s+/g, ' ')
    .trim();
}

// Una riga di Notion → una proposta di importazione (ancora senza abbinamento TMDb).
export function interpretaRiga(r, indice) {
  const originale = (r.titolo || '').trim();
  let titolo = pulisciTitolo(originale);

  // Anno: tra parentesi nel titolo ("La vita è meravigliosa (1946)") è affidabile;
  // quello della colonna "Uscita" spesso no (a volte è la data di arrivo in streaming).
  let anno = null;
  let annoSicuro = false;
  const tra = titolo.match(/^(.*\S)\s*\((\d{4})\)$/);
  if (tra) { titolo = tra[1]; anno = Number(tra[2]); annoSicuro = true; }
  const uscita = (r.uscita || '').match(/(\d{4})$/);
  if (!anno && uscita) anno = Number(uscita[1]);

  const statoNotion = r.status || '';
  const prioritaNotion = r.priorita || '';
  const votoNotion = r.voto || '';
  const stelle = [...votoNotion].filter(c => c === '⭐').length;

  return {
    indice,
    titoloNotion: originale,
    titolo,
    anno,
    annoSicuro,
    tipo: TIPI[semplice(r.tipo)] || 'film',
    stato: STATI[semplice(statoNotion)] || 'da-vedere',
    statoNotion,
    priorita: PRIORITA[semplice(prioritaNotion)] || 'prima-o-poi',
    prioritaNotion,
    voto: stelle >= 1 && stelle <= 5 ? stelle : null,
    votoNotion,
    riconoscimenti: (r.riconoscimento || '').split(',').map(x => x.trim()).filter(Boolean),
    commento: (r.commento || '').trim(),
  };
}

export function interpretaCsv(testo) {
  const righe = leggiCsv(testo);
  if (!righe.length || !('titolo' in righe[0])) {
    throw new Error('Questo file non sembra l\'esportazione di Notion: manca la colonna «Titolo».');
  }
  return righe.map(interpretaRiga).filter(r => r.titolo);
}
