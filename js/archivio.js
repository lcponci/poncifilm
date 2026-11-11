// L'archivio: tutti i film, le impostazioni personali e le regole per modificarli.
//
// Struttura del file (versioneSchema 1):
// {
//   app, versioneSchema, creatoIl, modificatoIl,
//   impostazioni: { stati, priorita, prioritaPredefinita, voti, riconoscimenti, mensola },
//   opere:     { "film-603": { ...una scheda... } },
//   eliminati: { "film-123": "data eliminazione" }   // serve alla sincronizzazione
// }
//
// "modificatoIl" di un'opera cambia solo con le TUE modifiche (stato, voto, ...);
// gli aggiornamenti automatici da TMDb hanno date proprie (info.aggiornateIl,
// piattaforme.aggiornateIl). Così, sincronizzando più dispositivi, un
// aggiornamento automatico non cancella mai una tua scelta.

import { leggi, scrivi } from './db.js';

export const VERSIONE_SCHEMA = 1;
const CHIAVE_DB = 'archivio';

const RICONOSCIMENTI_INIZIALI = [
  'profondo', 'emozionante', 'classico', 'intrigante', 'ironico', 'indimenticabile',
  'agrodolce', "buona l'idea", 'cinepanettone', 'copione', 'milestone', 'originale',
];

export function slug(testo) {
  return testo.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function impostazioniPredefinite() {
  return {
    stati: [
      { id: 'da-vedere', nome: 'Da vedere', sezione: 'Da vedere' },
      { id: 'visto', nome: 'Visto', sezione: 'Visti' },
      { id: 'da-rivedere', nome: 'Da rivedere', sezione: 'Da rivedere' },
      { id: 'abbandonato', nome: 'Abbandonato', sezione: 'Abbandonati' },
    ],
    priorita: [
      { id: 'day-one', nome: 'Day one', colore: '#ff6464' },
      { id: 'presto', nome: 'Il prima possibile', colore: '#5aa9ff' },
      { id: 'prima-o-poi', nome: 'Prima o poi', colore: '#8a8f98' },
    ],
    prioritaPredefinita: 'prima-o-poi',
    voti: [
      { valore: 1, frase: 'Terribile' },
      { valore: 2, frase: 'Evitabile, scarso' },
      { valore: 3, frase: 'Nulla da commentare, ci sta' },
      { valore: 4, frase: 'Bello' },
      { valore: 5, frase: 'Capolavoro da rivedere' },
    ],
    riconoscimenti: RICONOSCIMENTI_INIZIALI.map(nome => ({ id: slug(nome), nome })),
    mensola: { limite: null },
  };
}

const adesso = () => new Date().toISOString();

// Data di oggi nel formato AAAA-MM-GG, secondo l'ora locale.
export function oggi() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function nuovoArchivio() {
  const ora = adesso();
  return {
    app: 'PonciFilm',
    versioneSchema: VERSIONE_SCHEMA,
    creatoIl: ora,
    modificatoIl: ora,
    impostazioni: impostazioniPredefinite(),
    opere: {},
    eliminati: {},
  };
}

// Porta un archivio vecchio alla struttura attuale (oggi c'è una sola versione).
function migra(dati) {
  const base = nuovoArchivio();
  const archivio = { ...base, ...dati };
  archivio.impostazioni = { ...base.impostazioni, ...dati.impostazioni };
  archivio.opere ??= {};
  archivio.eliminati ??= {};
  archivio.versioneSchema = VERSIONE_SCHEMA;
  return archivio;
}

// ---------------------------------------------------------------- stato interno

let archivio = null;
const ascoltatori = new Set();
let codaScrittura = Promise.resolve();

export async function carica() {
  const dati = await leggi(CHIAVE_DB);
  archivio = dati ? migra(dati) : nuovoArchivio();
  if (!dati) await persisti();
  return archivio;
}

function persisti() {
  archivio.modificatoIl = adesso();
  const daSalvare = archivio;
  codaScrittura = codaScrittura
    .then(() => scrivi(CHIAVE_DB, daSalvare))
    .catch(errore => console.error('Salvataggio non riuscito', errore));
  return codaScrittura;
}

// Avvisa le schermate aperte che qualcosa è cambiato.
function notifica(id) {
  persisti();
  for (const funzione of ascoltatori) funzione(id);
}

export function ascolta(funzione) {
  ascoltatori.add(funzione);
  return () => ascoltatori.delete(funzione);
}

// ---------------------------------------------------------------- lettura

export const archivioCorrente = () => archivio;
export const impostazioni = () => archivio.impostazioni;
export const opera = id => archivio.opere[id] ?? null;
export const opere = () => Object.values(archivio.opere);
export const idFilm = tmdbId => `film-${tmdbId}`;

export function prioritaDi(o) {
  const elenco = archivio.impostazioni.priorita;
  return elenco.some(p => p.id === o.priorita) ? o.priorita : archivio.impostazioni.prioritaPredefinita;
}

export function ultimaVisione(o) {
  return o.visioni.length ? o.visioni.reduce((a, b) => (a > b ? a : b)) : null;
}

// Piattaforme da mostrare: quelle automatiche, meno quelle che hai nascosto,
// più quelle che hai aggiunto a mano.
export function piattaformeVisibili(o) {
  const p = o.piattaforme;
  if (!p.auto && !p.aggiunte.length) return null;
  const nascoste = new Set(p.nascoste);
  const filtra = elenco => (elenco || []).filter(x => !nascoste.has(x.id));
  const abbonamento = filtra(p.auto?.abbonamento);
  for (const extra of p.aggiunte) {
    if (!abbonamento.some(x => x.id === extra.id)) abbonamento.push(extra);
  }
  return {
    abbonamento,
    gratis: filtra(p.auto?.gratis),
    noleggio: filtra(p.auto?.noleggio),
    acquisto: filtra(p.auto?.acquisto),
    link: p.auto?.link ?? null,
    aggiornateIl: p.aggiornateIl,
  };
}

// ---------------------------------------------------------------- modifiche personali

function tocca(o) {
  o.modificatoIl = adesso();
  notifica(o.id);
}

function aggiungiVisione(o, data) {
  if (!o.visioni.includes(data)) o.visioni.push(data);
}

// Aggiunge un film partendo da un risultato di ricerca TMDb.
// Le informazioni complete arrivano subito dopo (vedi servizi.js).
export function aggiungiFilm(risultato, stato, priorita = null) {
  const id = idFilm(risultato.tmdbId);
  if (archivio.opere[id]) return archivio.opere[id];
  const ora = adesso();
  const o = {
    id,
    tipo: 'film',
    tmdbId: risultato.tmdbId,
    info: {
      titolo: risultato.titolo,
      titoloOriginale: risultato.titoloOriginale,
      anno: risultato.anno,
      dataUscita: risultato.dataUscita,
      locandina: risultato.locandina,
      sfondo: risultato.sfondo,
      trama: risultato.trama,
      tramaLingua: risultato.trama ? 'it' : null,
    },
    infoCompleta: false,
    piattaforme: { auto: null, aggiornateIl: null, aggiunte: [], nascoste: [] },
    stato,
    priorita: priorita || archivio.impostazioni.prioritaPredefinita,
    voto: null,
    riconoscimenti: [],
    commento: '',
    visioni: stato === 'visto' ? [oggi()] : [],
    mensola: { presente: false, posizione: null },
    aggiuntoIl: ora,
    modificatoIl: ora,
  };
  archivio.opere[id] = o;
  delete archivio.eliminati[id];
  notifica(id);
  return o;
}

export function modifica(id, cambi) {
  const o = opera(id);
  if (!o) return;
  Object.assign(o, cambi);
  tocca(o);
}

// Cambia stato ed eventualmente priorità (che vale per "Da vedere" e "Da rivedere").
// Passare a "Visto" registra da solo la data di oggi.
export function impostaStato(id, stato, priorita = null) {
  const o = opera(id);
  if (!o) return;
  const nuovoStato = o.stato !== stato;
  const nuovaPriorita = Boolean(priorita) && o.priorita !== priorita;
  if (!nuovoStato && !nuovaPriorita) return;
  if (nuovoStato && stato === 'visto') aggiungiVisione(o, oggi());
  o.stato = stato;
  if (priorita) o.priorita = priorita;
  tocca(o);
}

// "Segna come visto" e "L'ho rivisto oggi".
export function segnaVisto(id, data = oggi()) {
  const o = opera(id);
  if (!o) return;
  aggiungiVisione(o, data);
  o.stato = 'visto';
  tocca(o);
}

// Correzione delle date di visione (formato AAAA-MM-GG, senza doppioni).
export function impostaVisioni(id, date) {
  const o = opera(id);
  if (!o) return;
  o.visioni = [...new Set(date.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort();
  tocca(o);
}

// Accende o spegne un riconoscimento ("profondo", "ironico", ...) su un film.
export function alternaRiconoscimento(id, idRiconoscimento) {
  const o = opera(id);
  if (!o) return;
  o.riconoscimenti = o.riconoscimenti.includes(idRiconoscimento)
    ? o.riconoscimenti.filter(r => r !== idRiconoscimento)
    : [...o.riconoscimenti, idRiconoscimento];
  tocca(o);
}

// Correzioni manuali delle piattaforme: non vengono mai toccate dagli aggiornamenti.
export function nascondiPiattaforma(id, idPiattaforma, nascosta) {
  const o = opera(id);
  if (!o) return;
  const elenco = o.piattaforme.nascoste.filter(x => x !== idPiattaforma);
  if (nascosta) elenco.push(idPiattaforma);
  o.piattaforme.nascoste = elenco;
  tocca(o);
}

export function aggiungiPiattaforma(id, piattaforma) {
  const o = opera(id);
  if (!o) return;
  const { id: idP, nome, logo = null } = piattaforma;
  o.piattaforme.aggiunte = [...o.piattaforme.aggiunte.filter(x => x.id !== idP), { id: idP, nome, logo }];
  o.piattaforme.nascoste = o.piattaforme.nascoste.filter(x => x !== idP);
  tocca(o);
}

export function togliPiattaformaAggiunta(id, idPiattaforma) {
  const o = opera(id);
  if (!o) return;
  o.piattaforme.aggiunte = o.piattaforme.aggiunte.filter(x => x.id !== idPiattaforma);
  tocca(o);
}

export function rimuovi(id) {
  if (!archivio.opere[id]) return;
  delete archivio.opere[id];
  archivio.eliminati[id] = adesso();
  notifica(id);
}

// ---------------------------------------------------------------- impostazioni personali

function toccaImpostazioni() {
  archivio.impostazioni.modificateIl = adesso();
  notifica(null);
}

// Restituisce un messaggio d'errore, oppure null se è andato tutto bene.
export function aggiungiRiconoscimento(nome) {
  const pulito = (nome || '').trim();
  if (!pulito) return 'Scrivi un nome.';
  const id = slug(pulito) || `r-${Date.now()}`;
  const elenco = archivio.impostazioni.riconoscimenti;
  if (elenco.some(r => r.id === id || r.nome.toLowerCase() === pulito.toLowerCase())) return 'Esiste già.';
  archivio.impostazioni.riconoscimenti = [...elenco, { id, nome: pulito }];
  toccaImpostazioni();
  return null;
}

// Rinominare cambia solo il nome: i film collegati restano collegati.
export function rinominaRiconoscimento(id, nome) {
  const pulito = (nome || '').trim();
  if (!pulito) return 'Scrivi un nome.';
  const elenco = archivio.impostazioni.riconoscimenti;
  if (elenco.some(r => r.id !== id && r.nome.toLowerCase() === pulito.toLowerCase())) return 'Esiste già.';
  archivio.impostazioni.riconoscimenti = elenco.map(r => (r.id === id ? { ...r, nome: pulito } : r));
  toccaImpostazioni();
  return null;
}

export const filmConRiconoscimento = id => opere().filter(o => o.riconoscimenti.includes(id));

// Elimina il riconoscimento dall'elenco e da tutti i film che lo avevano.
export function eliminaRiconoscimento(id) {
  const ora = adesso();
  for (const o of filmConRiconoscimento(id)) {
    o.riconoscimenti = o.riconoscimenti.filter(r => r !== id);
    o.modificatoIl = ora;
  }
  archivio.impostazioni.riconoscimenti = archivio.impostazioni.riconoscimenti.filter(r => r.id !== id);
  toccaImpostazioni();
}

// ---------------------------------------------------------------- aggiornamenti automatici

export function completaInfo(id, info) {
  const o = opera(id);
  if (!o) return;
  o.info = info;
  o.infoCompleta = true;
  notifica(id);
}

export function impostaPiattaforme(id, auto) {
  const o = opera(id);
  if (!o) return;
  o.piattaforme.auto = auto;
  o.piattaforme.aggiornateIl = adesso();
  notifica(id);
}
