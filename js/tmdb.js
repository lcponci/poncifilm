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
  return percorso ? `${IMMAGINI}${misura}${percorso}` : null;
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

export async function cercaFilm(testo, signal) {
  const dati = await chiama('/search/movie', { query: testo, language: 'it-IT', include_adult: 'false' }, { signal });
  return (dati.results || []).map(r => ({
    tmdbId: r.id,
    titolo: r.title || r.original_title || 'Senza titolo',
    titoloOriginale: r.original_title || null,
    anno: annoDa(r.release_date),
    dataUscita: r.release_date || null,
    locandina: r.poster_path || null,
    sfondo: r.backdrop_path || null,
    trama: (r.overview || '').trim() || null,
  }));
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

const persona = p => ({ id: p.id, nome: p.name, foto: p.profile_path || null });

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
