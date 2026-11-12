// Collegamento a TMDb (The Movie Database): ricerca e informazioni sui film.
// Accetta sia la "Chiave API" sia il "Token di accesso in lettura" di TMDb.

const API = 'https://api.themoviedb.org/3';
const IMMAGINI = 'https://image.tmdb.org/t/p/';
const CHIAVE_LOCALE = 'poncifilm.tmdb';

export class ErroreTmdb extends Error {
  constructor(tipo, messaggio) {
    super(messaggio);
    this.tipo = tipo;
  }
}

function leggiChiaveSalvata() {
  try { return localStorage.getItem(CHIAVE_LOCALE) || ''; } catch { return ''; }
}

let chiave = leggiChiaveSalvata();

export const haChiave = () => Boolean(chiave);
export const chiaveAttuale = () => chiave;

export function impostaChiave(nuova) {
  chiave = (nuova || '').trim();
  try {
    if (chiave) localStorage.setItem(CHIAVE_LOCALE, chiave);
    else localStorage.removeItem(CHIAVE_LOCALE);
  } catch { /* memoria non disponibile: la chiave vale finché l'app resta aperta */ }
}

export function immagine(percorso, misura = 'w342') {
  if (!percorso) return null;
  // Locandina caricata a mano: è già un'immagine completa, salvata nell'archivio.
  if (percorso.startsWith('data:')) return percorso;
  return `${IMMAGINI}${misura}${percorso}`;
}

async function chiama(percorso, parametri = {}, { signal, chiaveDaUsare = chiave } = {}) {
  if (!chiaveDaUsare) throw new ErroreTmdb('chiave', 'Manca la chiave TMDb: inseriscila nelle Impostazioni.');
  if (navigator.onLine === false) throw new ErroreTmdb('offline', 'Sei offline: per questa operazione serve internet.');

  const url = new URL(API + percorso);
  for (const [nome, valore] of Object.entries(parametri)) {
    if (valore != null) url.searchParams.set(nome, valore);
  }
  const intestazioni = { accept: 'application/json' };
  if (chiaveDaUsare.startsWith('eyJ')) intestazioni.Authorization = `Bearer ${chiaveDaUsare}`;
  else url.searchParams.set('api_key', chiaveDaUsare);

  let risposta;
  try {
    risposta = await fetch(url, { headers: intestazioni, signal });
  } catch (errore) {
    if (errore.name === 'AbortError') throw errore;
    throw new ErroreTmdb('rete', 'Non riesco a contattare TMDb. Controlla la connessione.');
  }
  if (risposta.status === 401) throw new ErroreTmdb('chiave', 'La chiave TMDb non è valida. Controllala nelle Impostazioni.');
  if (risposta.status === 404) throw new ErroreTmdb('assente', 'Questo film non si trova su TMDb.');
  if (risposta.status === 429) throw new ErroreTmdb('limite', 'Troppe richieste a TMDb: riprova tra qualche secondo.');
  if (!risposta.ok) throw new ErroreTmdb('rete', `TMDb ha risposto con un errore (${risposta.status}).`);
  return risposta.json();
}

export async function verificaChiave(chiaveDaProvare) {
  await chiama('/configuration', {}, { chiaveDaUsare: (chiaveDaProvare || '').trim() });
  return true;
}

const annoDa = data => (data && /^\d{4}/.test(data) ? Number(data.slice(0, 4)) : null);

// ---------------------------------------------------------------- ricerca
//
// TMDb trova solo parole scritte giuste e separate. Per essere più "furbi":
// 1. i risultati vengono rimessi in ordine: prima i titoli più simili a quello
//    scritto (ignorando spazi, accenti e maiuscole), poi i film più conosciuti;
// 2. se nessun risultato somiglia davvero, si riprova con alcune varianti:
//    spazi inseriti ("laland" → "la land") e ultima parola accorciata
//    ("interstelar" → "interstel", che TMDb completa da solo).
// "dune 1984" o "dune (1984)" cerca la versione di quell'anno; se non trova nulla
// riprova con il testo intero (così "Blade Runner 2049" funziona comunque).

export async function cercaFilm(testo, signal) {
  const conAnno = testo.match(/^(.*\S)\s+\(?((?:18|19|20)\d{2})\)?$/);
  if (conAnno && Number(conAnno[2]) <= new Date().getFullYear() + 5) {
    const risultati = await cercaFurbo(conAnno[1], signal, conAnno[2]);
    if (risultati.length) return risultati;
  }
  return cercaFurbo(testo, signal);
}

const SOGLIA_BUONA = 0.8;   // somiglianza oltre la quale un risultato "è quello giusto"
const SOGLIA_VARIANTI = 0.6; // i risultati delle varianti devono somigliare almeno così

async function cercaFurbo(testo, signal, anno = null) {
  const scritto = compatto(testo);
  const principali = await cerca(testo, signal, anno);
  const valutati = principali.map((r, posizione) => ({ r, somiglianza: somiglianza(scritto, r), posizione }));

  // Le varianti servono se nessun titolo somiglia, oppure se i risultati sono
  // pochi e nessuno è identico (es. "laland" trova solo un film sconosciuto).
  const trovatoBene = valutati.some(v => v.somiglianza >= SOGLIA_BUONA);
  const identico = valutati.some(v => v.somiglianza === 1);
  if ((!trovatoBene || (!identico && valutati.length < 5)) && scritto.length >= 4) {
    const extra = await Promise.allSettled(varianti(testo).map(v => cerca(v, signal, anno)));
    if (signal?.aborted) throw new DOMException('Ricerca annullata', 'AbortError');
    const giaPresenti = new Set(principali.map(r => r.tmdbId));
    for (const esito of extra) {
      if (esito.status !== 'fulfilled') continue;
      for (const r of esito.value) {
        if (giaPresenti.has(r.tmdbId)) continue;
        const s = somiglianza(scritto, r);
        if (s < SOGLIA_VARIANTI) continue;
        giaPresenti.add(r.tmdbId);
        valutati.push({ r, somiglianza: s, posizione: 20 });
      }
    }
  }

  return valutati
    .map(v => ({ ...v, punti: punteggio(v) }))
    .sort((a, b) => b.punti - a.punti)
    .slice(0, 20)
    .map(v => v.r);
}

// Somiglianza conta più di tutto; poi quanto è conosciuto il film (numero di voti
// su TMDb); infine, di poco, l'ordine proposto da TMDb.
function punteggio({ r, somiglianza: s, posizione }) {
  const notorieta = Math.min(1, Math.log10(1 + (r.voti || 0)) / 4);
  return s + 0.3 * notorieta + 0.1 * Math.max(0, 1 - posizione / 20);
}

// Minuscole, senza accenti, spazi né punteggiatura: "La La Land" → "lalaland".
function compatto(testo) {
  return (testo || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Quanto un risultato somiglia al testo scritto (da 0 a 1): serve all'importazione
// per capire se un abbinamento è sicuro.
export const somiglianzaCon = (testo, r) => somiglianza(compatto(testo), r);

// Da 0 (niente a che vedere) a 1 (identico), confrontando sia il titolo
// italiano sia quello originale.
function somiglianza(scritto, r) {
  return Math.max(somiglianzaTitolo(scritto, r.titolo), somiglianzaTitolo(scritto, r.titoloOriginale));
}

function somiglianzaTitolo(scritto, titolo) {
  const t = compatto(titolo);
  if (!scritto || !t) return 0;
  if (t === scritto) return 1;
  if (t.startsWith(scritto)) return 0.95;
  if (t.includes(scritto)) return 0.85;
  // Errori di battitura: confronto con il titolo intero e con il suo inizio
  // (spesso si scrive solo la prima parte del titolo).
  const intero = 1 - distanza(scritto, t) / Math.max(scritto.length, t.length);
  const inizio = 1 - distanza(scritto, t.slice(0, scritto.length)) / scritto.length;
  return Math.max(0, intero, inizio * 0.9);
}

// Quante lettere bisogna cambiare, aggiungere o togliere per passare da a a b.
function distanza(a, b) {
  let riga = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const nuova = [i];
    for (let j = 1; j <= b.length; j++) {
      nuova[j] = Math.min(riga[j] + 1, nuova[j - 1] + 1, riga[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    riga = nuova;
  }
  return riga[b.length];
}

// Altri modi di scrivere lo stesso titolo, da provare quando il primo tentativo va male.
function varianti(testo) {
  const parole = testo.trim().split(/\s+/);
  const risultato = new Set();

  // Spazi dimenticati: spezzo in due la parola più lunga in ogni punto possibile.
  const lunga = parole.reduce((a, b) => (b.length > a.length ? b : a), '');
  const indice = parole.indexOf(lunga);
  if (lunga.length >= 5) {
    for (let i = 2; i <= Math.min(lunga.length - 2, 13); i++) {
      const spezzate = [...parole];
      spezzate[indice] = `${lunga.slice(0, i)} ${lunga.slice(i)}`;
      risultato.add(spezzate.join(' '));
    }
  }

  // Ultima parola sbagliata in fondo: la accorcio, TMDb completa le parole iniziate.
  const ultima = parole[parole.length - 1];
  for (const togli of [1, 2]) {
    if (ultima.length - togli >= 3) {
      risultato.add([...parole.slice(0, -1), ultima.slice(0, -togli)].join(' '));
    }
  }

  risultato.delete(testo.trim());
  return [...risultato];
}

async function cerca(testo, signal, anno = null) {
  const dati = await chiama('/search/movie', {
    query: testo, language: 'it-IT', include_adult: 'false', primary_release_year: anno,
  }, { signal });
  return (dati.results || []).map(risultatoFilm);
}

// Un film come arriva da TMDb (ricerca o filmografia) → nel formato di PonciFilm.
function risultatoFilm(r) {
  return {
    tmdbId: r.id,
    titolo: r.title || r.original_title || 'Senza titolo',
    titoloOriginale: r.original_title || null,
    anno: annoDa(r.release_date),
    dataUscita: r.release_date || null,
    locandina: r.poster_path || null,
    sfondo: r.backdrop_path || null,
    trama: (r.overview || '').trim() || null,
    voti: r.vote_count || 0,
  };
}

// Tutto quello che serve per la scheda del film, con una sola richiesta.
export async function dettagliFilm(tmdbId) {
  const d = await chiama(`/movie/${tmdbId}`, {
    language: 'it-IT',
    append_to_response: 'credits,watch/providers,translations',
  });
  return { info: infoDaDettagli(d), piattaforme: piattaformeItalia(d['watch/providers']) };
}

export async function piattaformeFilm(tmdbId) {
  return piattaformeItalia(await chiama(`/movie/${tmdbId}/watch/providers`));
}

// Tutte le piattaforme disponibili in Italia (per aggiungerne una a mano).
// Scaricato una volta sola finché l'app resta aperta.
let catalogoPiattaforme = null;
export function elencoPiattaforme() {
  catalogoPiattaforme ??= chiama('/watch/providers/movie', { watch_region: 'IT', language: 'it-IT' })
    .then(dati => (dati.results || [])
      .map(p => ({ id: p.provider_id, nome: p.provider_name, logo: p.logo_path || null, ordine: p.display_priorities?.IT ?? p.display_priority ?? 999 }))
      .sort((a, b) => a.ordine - b.ordine)
      .map(({ ordine, ...p }) => p))
    .catch(errore => { catalogoPiattaforme = null; throw errore; });
  return catalogoPiattaforme;
}

const persona = p => ({ id: p.id, nome: p.name, foto: p.profile_path || null });

// Regista di un film (per i risultati di ricerca: "Gli uccelli · Alfred Hitchcock").
// TMDb non lo dà insieme ai risultati, quindi lo chiedo a parte e lo ricordo.
const registiInMemoria = new Map();
export function registiDi(tmdbId, signal) {
  if (!registiInMemoria.has(tmdbId)) {
    const richiesta = chiama(`/movie/${tmdbId}/credits`, {}, { signal })
      .then(d => senzaDoppioni((d.crew || []).filter(p => p.job === 'Director')).map(p => p.name))
      .catch(errore => { registiInMemoria.delete(tmdbId); throw errore; });
    registiInMemoria.set(tmdbId, richiesta);
  }
  return registiInMemoria.get(tmdbId);
}

function senzaDoppioni(elenco) {
  const visti = new Set();
  return elenco.filter(p => (visti.has(p.id) ? false : visti.add(p.id)));
}

function infoDaDettagli(d) {
  const troupe = d.credits?.crew || [];
  let musica = troupe.filter(p => p.job === 'Original Music Composer');
  if (!musica.length) musica = troupe.filter(p => p.job === 'Music' && p.department === 'Sound');

  // Trama: in italiano; se manca, quella inglese (segnalata con "EN"); altrimenti vuota.
  let trama = (d.overview || '').trim() || null;
  let tramaLingua = trama ? 'it' : null;
  if (!trama) {
    const inglese = d.translations?.translations?.find(t => t.iso_639_1 === 'en');
    const testo = (inglese?.data?.overview || '').trim();
    if (testo) { trama = testo; tramaLingua = 'en'; }
  }

  return {
    titolo: d.title || d.original_title || 'Senza titolo',
    titoloOriginale: d.original_title || null,
    linguaOriginale: d.original_language || null,
    dataUscita: d.release_date || null,
    anno: annoDa(d.release_date),
    generi: (d.genres || []).map(g => g.name),
    durata: d.runtime || null,
    paesi: (d.production_countries || []).map(p => p.iso_3166_1),
    trama,
    tramaLingua,
    locandina: d.poster_path || null,
    sfondo: d.backdrop_path || null,
    regia: senzaDoppioni(troupe.filter(p => p.job === 'Director')).map(persona),
    cast: senzaDoppioni(d.credits?.cast || []).slice(0, 15)
      .map(p => ({ ...persona(p), personaggio: p.character || null })),
    musica: senzaDoppioni(musica).map(persona),
    collezione: d.belongs_to_collection
      ? { id: d.belongs_to_collection.id, nome: d.belongs_to_collection.name }
      : null,
    imdbId: d.imdb_id || null,
    aggiornateIl: new Date().toISOString(),
  };
}

// Piattaforme in Italia (dati JustWatch forniti da TMDb).
function piattaformeItalia(dati) {
  const it = dati?.results?.IT;
  const converti = elenco => [...(elenco || [])]
    .sort((a, b) => (a.display_priority ?? 99) - (b.display_priority ?? 99))
    .map(p => ({ id: p.provider_id, nome: p.provider_name, logo: p.logo_path || null }));
  return {
    link: it?.link || null,
    abbonamento: converti(it?.flatrate),
    gratis: senzaDoppioni([...converti(it?.free), ...converti(it?.ads)]),
    noleggio: converti(it?.rent),
    acquisto: converti(it?.buy),
  };
}

// ---------------------------------------------------------------- persone
//
// Registi, attori e compositori: chi sono e in quali film hanno lavorato.

const REPARTI = {
  Directing: 'Regia', Acting: 'Recitazione', Sound: 'Musica', Writing: 'Sceneggiatura',
  Production: 'Produzione', Camera: 'Fotografia', Editing: 'Montaggio', Art: 'Scenografia',
  'Costume & Make-Up': 'Costumi e trucco', 'Visual Effects': 'Effetti visivi', Lighting: 'Luci', Crew: 'Troupe',
};
export const nomeReparto = reparto => REPARTI[reparto] || reparto || null;

const LAVORI_MUSICA = new Set(['Original Music Composer', 'Music', 'Composer', 'Musical Score']);
// Comparse "nel ruolo di sé stesso" e immagini di repertorio: non sono interpretazioni.
const NON_UN_RUOLO = /\b(self|himself|herself|themselves)\b|archive footage|sé stess|se stess|repertorio/i;

// Persone trovate per nome (per la ricerca in "Aggiungi"). Tengo solo quelle il cui
// nome somiglia davvero a quanto scritto e che hanno fatto film conosciuti, così
// scrivendo un titolo non spuntano omonimi sconosciuti.
const SOGLIA_FAMA = 300; // voti su TMDb del suo film più conosciuto

export async function cercaPersone(testo, signal) {
  const scritto = compatto(testo);
  if (scritto.length < 4) return [];
  const dati = await chiama('/search/person', { query: testo, language: 'it-IT', include_adult: 'false' }, { signal });
  return (dati.results || [])
    .filter(p => somiglianzaTitolo(scritto, p.name) >= SOGLIA_BUONA)
    .filter(p => Math.max(0, ...(p.known_for || []).map(f => f.vote_count || 0)) >= SOGLIA_FAMA)
    .slice(0, 3)
    .map(p => ({ id: p.id, nome: p.name, foto: p.profile_path || null, reparto: p.known_for_department || null }));
}

// La scheda completa di una persona, con una sola richiesta. Resta in memoria
// finché l'app è aperta: tornando indietro si riapre all'istante.
const personeScaricate = new Map();
const personeInArrivo = new Map();

export const personaGiaScaricata = id => personeScaricate.get(Number(id)) ?? null;

export function dettagliPersona(id) {
  const numero = Number(id);
  if (!personeInArrivo.has(numero)) {
    const richiesta = scaricaPersona(numero)
      .then(p => { personeScaricate.set(numero, p); return p; })
      .catch(errore => { personeInArrivo.delete(numero); throw errore; });
    personeInArrivo.set(numero, richiesta);
  }
  return personeInArrivo.get(numero);
}

async function scaricaPersona(id) {
  let d;
  try {
    d = await chiama(`/person/${id}`, { language: 'it-IT', append_to_response: 'movie_credits,translations' });
  } catch (errore) {
    if (errore.tipo === 'assente') throw new ErroreTmdb('assente', 'Questa persona non si trova su TMDb.');
    throw errore;
  }

  // Biografia: in italiano; se manca, quella inglese (segnalata con "EN").
  const traduzioni = d.translations?.translations || [];
  const bio = lingua => (traduzioni.find(t => t.iso_639_1 === lingua)?.data?.biography || '').trim();
  let biografia = bio('it');
  let biografiaLingua = biografia ? 'it' : null;
  if (!biografia && bio('en')) { biografia = bio('en'); biografiaLingua = 'en'; }
  if (!biografia && (d.biography || '').trim()) { biografia = d.biography.trim(); biografiaLingua = null; }

  const crediti = d.movie_credits || {};
  const troupe = crediti.crew || [];
  return {
    id: d.id,
    nome: d.name,
    foto: d.profile_path || null,
    reparto: d.known_for_department || null,
    nascita: d.birthday || null,
    morte: d.deathday || null,
    luogoNascita: d.place_of_birth || null,
    biografia: biografia || null,
    biografiaLingua,
    filmografia: {
      regia: raccogliFilm(troupe.filter(c => c.job === 'Director'), () => null),
      cast: raccogliFilm((crediti.cast || []).filter(c => !NON_UN_RUOLO.test(c.character || '')),
        c => (c.character || '').trim() || null),
      musica: raccogliFilm(troupe.filter(c => LAVORI_MUSICA.has(c.job)), () => null),
    },
  };
}

// Un film per riga (anche se la persona vi ha avuto più ruoli), senza gli
// annunci vuoti (niente data, niente locandina, nessun voto).
function raccogliFilm(elenco, ruoloDi) {
  const perFilm = new Map();
  for (const c of elenco) {
    if (!c.release_date && !c.poster_path && !c.vote_count) continue;
    const ruolo = ruoloDi(c);
    const gia = perFilm.get(c.id);
    if (gia) {
      if (ruolo && !(gia.ruolo || '').includes(ruolo)) gia.ruolo = [gia.ruolo, ruolo].filter(Boolean).join(' / ');
      continue;
    }
    perFilm.set(c.id, { ...risultatoFilm(c), ruolo });
  }
  return [...perFilm.values()];
}
