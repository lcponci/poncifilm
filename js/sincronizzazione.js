// Salvataggio online in un repository GitHub PRIVATO.
//
// Il file "poncifilm.json" nel repository è la copia comune a tutti i dispositivi.
// Ogni salvataggio è un "commit": GitHub conserva tutte le versioni precedenti.
//
// Come funziona una sincronizzazione:
// 1. scarico il file da GitHub (se c'è);
// 2. lo unisco ai dati di questo dispositivo (regole in archivio.js → unisci);
// 3. se il risultato è diverso da quello che c'è su GitHub, lo carico.
// Se nel frattempo un altro dispositivo ha salvato, GitHub rifiuta (conflitto):
// ricomincio dal punto 1.
//
// Quando: all'avvio, quando torni nell'app, qualche secondo dopo ogni modifica,
// quando esci dall'app e quando torna la connessione.
//
// Il token resta solo su questo dispositivo (memoria del browser), mai nel file.

import * as archivio from './archivio.js';

const API = 'https://api.github.com';
const FILE = 'poncifilm.json';
const CHIAVE_CONFIG = 'poncifilm.github';
const CHIAVE_STATO = 'poncifilm.sincro';
const ATTESA_DOPO_MODIFICA = 5000;

// ---------------------------------------------------------------- configurazione

function leggiLocale(chiave) {
  try { return JSON.parse(localStorage.getItem(chiave) || 'null'); } catch { return null; }
}
function scriviLocale(chiave, valore) {
  try {
    if (valore == null) localStorage.removeItem(chiave);
    else localStorage.setItem(chiave, JSON.stringify(valore));
  } catch { /* memoria non disponibile */ }
}

let config = leggiLocale(CHIAVE_CONFIG); // { proprietario, repository, token }

export const configurata = () => Boolean(config?.token && config?.proprietario && config?.repository);
export const repositoryCollegato = () => (configurata() ? `${config.proprietario}/${config.repository}` : null);
export const indirizzoVersioni = () =>
  (configurata() ? `https://github.com/${config.proprietario}/${config.repository}/commits` : null);

export class ErroreGithub extends Error {
  constructor(messaggio, { conflitto = false } = {}) {
    super(messaggio);
    this.conflitto = conflitto;
  }
}

// "lcponci/poncifilm-dati" oppure "https://github.com/lcponci/poncifilm-dati"
export function leggiNomeRepository(testo) {
  const pulito = (testo || '').trim().replace(/^https?:\/\/(www\.)?github\.com\//, '').replace(/\.git$/, '').replace(/\/+$/, '');
  const m = pulito.match(/^([\w.-]+)\/([\w.-]+)$/);
  return m ? { proprietario: m[1], repository: m[2] } : null;
}

// ---------------------------------------------------------------- stato (per le Impostazioni)

let stato = { fase: 'ferma', errore: null, ...(leggiLocale(CHIAVE_STATO) || {}) }; // + ultima, sha
const ascoltatori = new Set();

export const statoAttuale = () => ({ ...stato, configurata: configurata() });
export function ascoltaStato(funzione) {
  ascoltatori.add(funzione);
  return () => ascoltatori.delete(funzione);
}
function aggiornaStato(cambi) {
  stato = { ...stato, ...cambi };
  scriviLocale(CHIAVE_STATO, { ultima: stato.ultima ?? null, sha: stato.sha ?? null });
  for (const funzione of ascoltatori) funzione(statoAttuale());
}

// ---------------------------------------------------------------- GitHub

async function github(percorso, { metodo = 'GET', corpo, token = config?.token } = {}) {
  let risposta;
  try {
    risposta = await fetch(API + percorso, {
      method: metodo,
      cache: 'no-store', // sempre la versione vera, mai una copia vecchia
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        ...(corpo ? { 'Content-Type': 'application/json' } : {}),
      },
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
  } catch {
    throw new ErroreGithub('Non riesco a contattare GitHub. Controlla la connessione.');
  }
  if (risposta.ok) return risposta.json();
  if (risposta.status === 404) return null;
  if (risposta.status === 401) throw new ErroreGithub('GitHub non accetta il token: forse è scaduto o è stato cancellato.');
  if (risposta.status === 409 || risposta.status === 422) {
    throw new ErroreGithub('Un altro dispositivo ha appena salvato.', { conflitto: true });
  }
  if (risposta.status === 403 || risposta.status === 429) {
    const limite = risposta.headers.get('x-ratelimit-remaining') === '0' || risposta.status === 429;
    throw new ErroreGithub(limite
      ? 'GitHub chiede di rallentare: riprovo tra poco.'
      : 'Il token non ha il permesso di scrivere nel repository (serve «Contents: Read and write»).');
  }
  throw new ErroreGithub(`GitHub ha risposto con un errore (${risposta.status}).`);
}

// Testo ↔ base64 (il formato con cui GitHub scambia i file), accenti compresi.
function inBase64(testo) {
  const byte = new TextEncoder().encode(testo);
  let binario = '';
  for (let i = 0; i < byte.length; i += 0x8000) binario += String.fromCharCode(...byte.subarray(i, i + 0x8000));
  return btoa(binario);
}
function daBase64(base64) {
  const binario = atob(base64.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(binario, c => c.charCodeAt(0)));
}

const percorsoRepo = () => `/repos/${encodeURIComponent(config.proprietario)}/${encodeURIComponent(config.repository)}`;

async function leggiRemoto() {
  const meta = await github(`${percorsoRepo()}/contents/${FILE}`);
  if (!meta) return null; // il file non c'è ancora: primo salvataggio
  // Oltre 1 MB GitHub non include il contenuto: lo chiedo a parte.
  let base64 = meta.encoding === 'base64' ? meta.content : null;
  if (!base64) base64 = (await github(`${percorsoRepo()}/git/blobs/${meta.sha}`))?.content;
  let dati;
  try {
    dati = JSON.parse(daBase64(base64 || ''));
  } catch {
    throw new ErroreGithub(`Il file ${FILE} su GitHub è danneggiato: non lo tocco. Puoi recuperarne una versione precedente su GitHub.`);
  }
  if (dati?.app !== 'PonciFilm' || typeof dati.opere !== 'object') {
    throw new ErroreGithub(`Il file ${FILE} su GitHub non sembra un archivio PonciFilm: non lo tocco.`);
  }
  return { sha: meta.sha, dati };
}

function nomeDispositivo() {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'iPad';
  if (/Android/.test(ua)) return 'Android';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Macintosh/.test(ua)) return 'Mac';
  return 'browser';
}

async function scriviRemoto(dati, sha) {
  const testo = archivio.testoOrdinato({ ...dati, modificatoIl: new Date().toISOString() }) + '\n';
  const risposta = await github(`${percorsoRepo()}/contents/${FILE}`, {
    metodo: 'PUT',
    corpo: {
      message: `Salvataggio da ${nomeDispositivo()} · ${Object.keys(dati.opere).length} film`,
      content: inBase64(testo),
      ...(sha ? { sha } : {}),
    },
  });
  if (!risposta) throw new ErroreGithub('Repository non trovato: forse è stato rinominato o il token non vi ha più accesso.');
  return risposta.content.sha;
}

// ---------------------------------------------------------------- sincronizzazione

let inCorso = null;
let ancora = false;
let timer = null;
let unendo = false;

export function sincronizza() {
  if (!configurata()) return Promise.resolve();
  if (inCorso) { ancora = true; return inCorso; }
  inCorso = esegui().finally(() => {
    inCorso = null;
    if (ancora) { ancora = false; programma(1000); }
  });
  return inCorso;
}

async function esegui() {
  clearTimeout(timer);
  timer = null;
  if (navigator.onLine === false) {
    aggiornaStato({ fase: 'offline', errore: null });
    return;
  }
  aggiornaStato({ fase: 'in-corso', errore: null });
  try {
    for (let tentativo = 0; tentativo < 4; tentativo++) {
      const remoto = await leggiRemoto();
      if (remoto) {
        unendo = true; // le novità arrivate da GitHub non vanno rimandate a GitHub
        try { archivio.unisciCopia(remoto.dati); } finally { unendo = false; }
      }
      const attuale = archivio.archivioCorrente();
      if (remoto && archivio.firma(attuale) === archivio.firma(remoto.dati)) {
        aggiornaStato({ fase: 'ferma', ultima: new Date().toISOString(), sha: remoto.sha });
        return;
      }
      try {
        const sha = await scriviRemoto(attuale, remoto?.sha);
        aggiornaStato({ fase: 'ferma', ultima: new Date().toISOString(), sha });
        return;
      } catch (errore) {
        if (!errore.conflitto) throw errore;
        // Un altro dispositivo ha salvato nel frattempo: riscarico e riunisco.
      }
    }
    throw new ErroreGithub('Troppi salvataggi contemporanei: riprovo tra poco.');
  } catch (errore) {
    console.warn('Sincronizzazione non riuscita', errore);
    aggiornaStato({ fase: 'errore', errore: errore.message });
  }
}

function programma(ritardo = ATTESA_DOPO_MODIFICA) {
  if (!configurata()) return;
  clearTimeout(timer);
  timer = setTimeout(sincronizza, ritardo);
}

// Da chiamare una volta all'avvio dell'app.
export function avviaSincronizzazione() {
  archivio.ascolta(() => {
    if (unendo || !configurata()) return;
    aggiornaStato({ fase: stato.fase === 'in-corso' ? 'in-corso' : 'in-attesa' });
    programma();
  });
  document.addEventListener('visibilitychange', () => {
    if (!configurata()) return;
    if (document.hidden) {
      // Esci dall'app: salvo subito quello che è in attesa.
      if (timer) sincronizza();
    } else {
      programma(500); // rientri: scarico le novità dell'altro dispositivo
    }
  });
  window.addEventListener('online', () => programma(500));
  programma(800);
}

// ---------------------------------------------------------------- collegamento

// Controlla repository e token, li salva su questo dispositivo e fa la prima sincronizzazione.
export async function collega(testoRepository, token) {
  const nome = leggiNomeRepository(testoRepository);
  if (!nome) throw new ErroreGithub('Scrivi il repository nella forma «utente/nome», per esempio lcponci/poncifilm-dati.');
  const pulito = (token || '').trim();
  if (!pulito) throw new ErroreGithub('Incolla il token.');
  if (navigator.onLine === false) throw new ErroreGithub('Sei offline: per collegarti serve internet.');

  const repo = await github(`/repos/${encodeURIComponent(nome.proprietario)}/${encodeURIComponent(nome.repository)}`, { token: pulito });
  if (!repo) throw new ErroreGithub('Non trovo il repository: controlla il nome e che il token possa accedervi.');
  if (!repo.private) {
    throw new ErroreGithub('Questo repository è PUBBLICO: i tuoi dati sarebbero visibili a tutti. Rendilo privato (Settings → Danger Zone → Change visibility) e riprova.');
  }

  config = { ...nome, token: pulito };
  scriviLocale(CHIAVE_CONFIG, config);
  aggiornaStato({ fase: 'ferma', errore: null, ultima: null, sha: null });
  await sincronizza();
  if (stato.fase === 'errore') throw new ErroreGithub(stato.errore);
}

// Scollega solo questo dispositivo: i dati restano qui e su GitHub.
export function scollega() {
  clearTimeout(timer);
  config = null;
  scriviLocale(CHIAVE_CONFIG, null);
  aggiornaStato({ fase: 'ferma', errore: null, ultima: null, sha: null });
}
