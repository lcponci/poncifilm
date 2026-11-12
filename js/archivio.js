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
export function migra(dati) {
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
  return nuovaOpera(id, {
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
  }, stato, priorita);
}

function nuovaOpera(id, { tmdbId, info, infoCompleta, manuale = false }, stato, priorita) {
  const ora = adesso();
  const o = {
    id,
    tipo: 'film',
    tmdbId,
    ...(manuale ? { manuale: true } : {}),
    info,
    infoCompleta,
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

// ---------------------------------------------------------------- film inseriti a mano
//
// Per i film che TMDb non conosce. Non hanno un numero TMDb: le informazioni
// sono solo quelle scritte da te, e la locandina (se c'è) è una tua foto,
// salvata dentro l'archivio come immagine piccola.

const elencoNomi = testo => (testo || '').split(',').map(n => n.trim()).filter(Boolean);
const personaManuale = nome => ({ id: null, nome, foto: null });

function infoManuale(d) {
  const trama = (d.trama || '').trim() || null;
  const anno = Number(d.anno) || null;
  return {
    titolo: d.titolo.trim(),
    titoloOriginale: (d.titoloOriginale || '').trim() || null,
    linguaOriginale: null,
    dataUscita: null,
    anno,
    generi: elencoNomi(d.generi),
    durata: Number(d.durata) || null,
    paesi: [],
    trama,
    tramaLingua: trama ? 'it' : null,
    locandina: d.locandina || null,
    sfondo: null,
    regia: elencoNomi(d.regia).map(personaManuale),
    cast: elencoNomi(d.cast).map(nome => ({ ...personaManuale(nome), personaggio: null })),
    musica: elencoNomi(d.musica).map(personaManuale),
    collezione: null,
    imdbId: null,
    aggiornateIl: adesso(),
  };
}

export function aggiungiFilmManuale(dati, stato, priorita = null) {
  const id = `mano-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return nuovaOpera(id, { tmdbId: null, info: infoManuale(dati), infoCompleta: true, manuale: true }, stato, priorita);
}

export function modificaFilmManuale(id, dati) {
  const o = opera(id);
  if (!o?.manuale) return;
  o.info = infoManuale(dati);
  tocca(o);
}

// ---------------------------------------------------------------- la Mensola
//
// I film "sempre belli, a prescindere da tutto". Pochi, in un ordine scelto da te.

export const LIMITE_MENSOLA = 16;
export const limiteMensola = () => archivio.impostazioni.mensola?.limite || LIMITE_MENSOLA;
export const sullaMensola = o => Boolean(o?.mensola?.presente);

export function filmSullaMensola() {
  return opere().filter(sullaMensola).sort((a, b) =>
    (a.mensola.posizione ?? Infinity) - (b.mensola.posizione ?? Infinity) || a.info.titolo.localeCompare(b.info.titolo, 'it'));
}

// Restituisce 'piena' se non c'è più posto, altrimenti null.
// posizione: per rimetterlo dov'era (con "Annulla"); di solito va in fondo.
export function mettiSullaMensola(id, posizione = null) {
  const o = opera(id);
  if (!o || sullaMensola(o)) return null;
  const sopra = filmSullaMensola();
  if (sopra.length >= limiteMensola()) return 'piena';
  const ultima = sopra.reduce((max, x) => Math.max(max, x.mensola.posizione ?? 0), 0);
  o.mensola = { presente: true, posizione: posizione ?? ultima + 1 };
  tocca(o);
  return null;
}

export function togliDallaMensola(id) {
  const o = opera(id);
  if (!o || !sullaMensola(o)) return;
  o.mensola = { presente: false, posizione: null };
  tocca(o);
}

// Sposta un film di un posto a sinistra (-1) o a destra (+1).
export function spostaSullaMensola(id, verso) {
  const elenco = filmSullaMensola();
  const da = elenco.findIndex(o => o.id === id);
  const a = da + verso;
  if (da < 0 || a < 0 || a >= elenco.length) return;
  [elenco[da], elenco[a]] = [elenco[a], elenco[da]];
  const ora = adesso();
  elenco.forEach((o, posizione) => {
    if (o.mensola.posizione === posizione + 1) return;
    o.mensola = { presente: true, posizione: posizione + 1 };
    o.modificatoIl = ora;
  });
  notifica(null);
}

export function impostaLimiteMensola(limite) {
  const minimo = Math.max(1, filmSullaMensola().length);
  archivio.impostazioni.mensola = { ...archivio.impostazioni.mensola, limite: Math.max(minimo, Math.min(60, Math.round(limite))) };
  toccaImpostazioni();
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

// ---------------------------------------------------------------- unione tra dispositivi
//
// Quando iPhone e computer hanno modificato l'archivio ognuno per conto suo, le due
// copie si uniscono così:
// - per ogni film vincono le TUE scelte più recenti (modificatoIl);
// - le informazioni da TMDb e le piattaforme automatiche: vince la copia aggiornata più di recente;
// - un film eliminato resta eliminato, a meno che tu non lo abbia modificato dopo;
// - impostazioni (riconoscimenti, ...): vince la versione modificata più di recente.

const piuRecente = (a, b) => (a || '') > (b || '');

function infoMigliore(x, y) {
  if (x.infoCompleta !== y.infoCompleta) return x.infoCompleta;
  return piuRecente(x.info?.aggiornateIl, y.info?.aggiornateIl);
}

function unisciOpera(a, b) {
  const base = piuRecente(b.modificatoIl, a.modificatoIl) ? b : a;
  const altra = base === a ? b : a;
  const o = structuredClone(base);
  if (infoMigliore(altra, base)) {
    o.info = structuredClone(altra.info);
    o.infoCompleta = altra.infoCompleta;
  }
  if (piuRecente(altra.piattaforme?.aggiornateIl, base.piattaforme?.aggiornateIl)) {
    o.piattaforme.auto = structuredClone(altra.piattaforme.auto);
    o.piattaforme.aggiornateIl = altra.piattaforme.aggiornateIl;
  }
  return o;
}

export function unisci(a, b) {
  const eliminati = { ...a.eliminati };
  for (const [id, data] of Object.entries(b.eliminati || {})) {
    if (piuRecente(data, eliminati[id])) eliminati[id] = data;
  }
  const opereUnite = {};
  for (const id of new Set([...Object.keys(a.opere), ...Object.keys(b.opere || {})])) {
    const oa = a.opere[id];
    const ob = b.opere?.[id];
    const o = oa && ob ? unisciOpera(oa, ob) : structuredClone(oa || ob);
    const eliminatoIl = eliminati[id];
    if (eliminatoIl && !piuRecente(o.modificatoIl, eliminatoIl)) continue; // eliminato dopo l'ultima modifica
    delete eliminati[id]; // modificato (o riaggiunto) dopo l'eliminazione: resta
    opereUnite[id] = o;
  }
  const impostazioniB = b.impostazioni || {};
  return {
    ...a,
    creatoIl: [a.creatoIl, b.creatoIl].filter(Boolean).sort()[0] || a.creatoIl,
    modificatoIl: [a.modificatoIl, b.modificatoIl].filter(Boolean).sort().pop() || a.modificatoIl,
    impostazioni: structuredClone(piuRecente(impostazioniB.modificateIl, a.impostazioni.modificateIl)
      ? { ...a.impostazioni, ...impostazioniB } : a.impostazioni),
    opere: opereUnite,
    eliminati,
  };
}

// Testo dell'archivio con le chiavi sempre nello stesso ordine: così due copie
// uguali danno lo stesso testo, e su GitHub le differenze tra versioni sono leggibili.
export function testoOrdinato(valore, rientro = 1) {
  const ordina = v => {
    if (Array.isArray(v)) return v.map(ordina);
    if (v && typeof v === 'object') {
      return Object.fromEntries(Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => [k, ordina(v[k])]));
    }
    return v;
  };
  return JSON.stringify(ordina(valore), null, rientro);
}

// "Firma" del contenuto: uguale se due archivi contengono gli stessi dati
// (la data dell'ultimo salvataggio non conta).
export const firma = dati => testoOrdinato({ ...dati, modificatoIl: undefined }, 0);

// Unisce nell'archivio di questo dispositivo una copia arrivata da fuori (GitHub).
// Restituisce true se qualcosa è cambiato qui.
export function unisciCopia(altra) {
  const prima = firma(archivio);
  const unito = unisci(archivio, migra(altra));
  if (firma(unito) === prima) return false;
  archivio = unito;
  notifica(null);
  return true;
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
