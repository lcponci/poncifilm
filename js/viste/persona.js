// Scheda di una persona (regista, attore o attrice, compositore): chi è e i suoi
// film. Quelli già nel tuo archivio hanno un bollino con lo stato; gli altri si
// aggiungono con un tocco.

import { h, icona, formattaData, vuoto, stelle } from '../ui.js';
import { intestazione, locandina, nomeStato, iniziali } from '../componenti.js';
import * as archivio from '../archivio.js';
import { dettagliPersona, personaGiaScaricata, immagine, nomeReparto } from '../tmdb.js';
import { apriAnteprima } from './aggiungi.js';

const CATEGORIE = [
  ['regia', 'Regia'],
  ['cast', 'Cast'],
  ['musica', 'Musica'],
];
const CATEGORIA_DEL_REPARTO = { Directing: 'regia', Acting: 'cast', Sound: 'musica' };
const QUANTI_SUBITO = 48; // le filmografie lunghe si mostrano un pezzo alla volta
const BIOGRAFIA_LUNGA = 420;

const ICONA_STATO = { visto: 'spunta', 'da-vedere': 'segnalibro', 'da-rivedere': 'ripeti', abbandonato: 'chiudi' };

// Le scelte fatte in ogni scheda (categoria, ordine, …), ritrovate tornando indietro.
const scelte = new Map();

export function vistaPersona(id) {
  const el = h('section', { class: 'vista persona-pagina' });
  let dati = personaGiaScaricata(id);
  let attiva = true;
  if (!scelte.has(id)) scelte.set(id, { ordini: {}, quanti: QUANTI_SUBITO });
  const scelta = scelte.get(id);

  async function carica() {
    el.replaceChildren(intestazione('', { indietro: true }), h('p', { class: 'nota' }, 'Carico la scheda…'));
    try {
      dati = await dettagliPersona(id);
      if (attiva) disegna();
    } catch (errore) {
      if (!attiva) return;
      el.replaceChildren(intestazione('', { indietro: true }), vuoto(
        h('p', null, errore.message),
        h('button', { type: 'button', class: 'pulsante', onclick: carica }, 'Riprova')));
    }
  }

  function disegna() {
    if (!dati) return;
    el.replaceChildren(intestazione(dati.nome, { indietro: true }), ...contenuto(dati, scelta, disegna));
  }

  if (dati) disegna();
  else carica();

  // Un film aggiunto da qui (o cambiato altrove): aggiorno i bollini.
  const stacca = archivio.ascolta(() => disegna());
  return {
    el,
    ricordaScorrimento: true,
    smonta() { attiva = false; stacca(); },
  };
}

function contenuto(p, scelta, ridisegna) {
  const f = p.filmografia;
  const disponibili = CATEGORIE.filter(([c]) => f[c].length);
  if (!scelta.categoria || !f[scelta.categoria]?.length) {
    const preferita = CATEGORIA_DEL_REPARTO[p.reparto];
    scelta.categoria = f[preferita]?.length ? preferita
      : [...disponibili].sort((a, b) => f[b[0]].length - f[a[0]].length)[0]?.[0] ?? null;
  }

  // I suoi film già nel tuo archivio (contati una volta sola, anche se con più ruoli).
  const tuoi = new Map();
  for (const r of [...f.regia, ...f.cast, ...f.musica]) {
    const o = archivio.opera(archivio.idFilm(r.tmdbId));
    if (o) tuoi.set(o.id, o);
  }
  const visti = [...tuoi.values()].filter(o => o.stato === 'visto' || o.stato === 'da-rivedere').length;

  return [
    testa(p, tuoi.size, visti),
    p.biografia && biografia(p, scelta, ridisegna),
    h('section', { class: 'sezione' },
      h('h2', null, 'Filmografia'),
      disponibili.length === 0
        ? h('p', { class: 'nota' }, 'TMDb non conosce nessun suo film.')
        : filmografia(f, disponibili, scelta, tuoi.size > 0, ridisegna)),
  ];
}

function testa(p, quantiTuoi, visti) {
  const righe = [
    ['Nascita', [formattaData(p.nascita), !p.morte && eta(p.nascita) && `(${eta(p.nascita)} anni)`, p.luogoNascita && `· ${p.luogoNascita}`]],
    ['Morte', p.morte && [formattaData(p.morte), eta(p.nascita, p.morte) && `(a ${eta(p.nascita, p.morte)} anni)`]],
  ].map(([nome, parti]) => [nome, (parti || []).filter(Boolean).join(' ')]).filter(([, testo]) => testo);

  return h('header', { class: 'persona-testa' },
    h('div', { class: 'persona-foto' }, p.foto
      ? h('img', { src: immagine(p.foto, 'w342'), alt: '', decoding: 'async' })
      : h('span', null, iniziali(p.nome))),
    h('div', { class: 'persona-dati' },
      p.reparto && h('p', { class: 'persona-mestiere' }, nomeReparto(p.reparto)),
      righe.length > 0 && h('dl', { class: 'dettagli piccoli' },
        righe.flatMap(([nome, testo]) => [h('dt', null, nome), h('dd', null, testo)])),
      h('p', { class: 'persona-tuoi' }, quantiTuoi
        ? [h('strong', null, quantiTuoi === 1 ? '1 suo film' : `${quantiTuoi} suoi film`), ' nel tuo archivio',
          visti ? ` · ${visti === 1 ? '1 visto' : `${visti} visti`}` : '']
        : 'Nessun suo film nel tuo archivio')));
}

// Anni compiuti tra la nascita e oggi (o la morte).
function eta(nascita, fine = null) {
  if (!nascita || !/^\d{4}-\d{2}-\d{2}$/.test(nascita)) return null;
  const a = new Date(nascita + 'T12:00:00');
  const b = fine ? new Date(fine + 'T12:00:00') : new Date();
  let anni = b.getFullYear() - a.getFullYear();
  if (b.getMonth() < a.getMonth() || (b.getMonth() === a.getMonth() && b.getDate() < a.getDate())) anni--;
  return anni >= 0 && anni < 130 ? anni : null;
}

function biografia(p, scelta, ridisegna) {
  const lunga = p.biografia.length > BIOGRAFIA_LUNGA;
  const aperta = !lunga || scelta.bioAperta;
  return h('section', { class: 'sezione' },
    h('h2', null, 'Biografia'),
    h('p', { class: 'biografia' + (aperta ? '' : ' chiusa') },
      p.biografiaLingua === 'en' && h('span', { class: 'lingua', title: 'Biografia disponibile solo in inglese' }, 'EN'),
      p.biografia),
    lunga && h('button', {
      type: 'button', class: 'pulsante-testo cambia',
      onclick: () => { scelta.bioAperta = !aperta; ridisegna(); },
    }, aperta ? 'Mostra meno' : 'Leggi tutto'));
}

const perAnno = (a, b) => (b.dataUscita || '9999').localeCompare(a.dataUscita || '9999'); // i prossimi in cima
const perNotorieta = (a, b) => b.voti - a.voti || perAnno(a, b);

function filmografia(f, disponibili, scelta, haiQualcosa, ridisegna) {
  const categoria = scelta.categoria;
  // Per chi recita conviene partire dai film più noti; per regia e musica, in ordine di uscita.
  const ordine = scelta.ordini[categoria] ?? (categoria === 'cast' ? 'noti' : 'anno');
  const soloTuoi = haiQualcosa && scelta.soloTuoi;

  let elenco = [...f[categoria]];
  if (soloTuoi) elenco = elenco.filter(r => archivio.opera(archivio.idFilm(r.tmdbId)));
  elenco.sort(ordine === 'anno' ? perAnno : perNotorieta);
  const mostrati = elenco.slice(0, scelta.quanti);

  const cambia = modifica => () => { modifica(); ridisegna(); };
  const segmento = (valore, testo) => h('button', {
    type: 'button', class: ordine === valore ? 'attivo' : '', 'aria-pressed': String(ordine === valore),
    onclick: cambia(() => { scelta.ordini[categoria] = valore; }),
  }, testo);

  return [
    disponibili.length > 1 && h('div', { class: 'pillole categorie' }, disponibili.map(([c, nome]) =>
      h('button', {
        type: 'button', class: 'pillola' + (c === categoria ? ' attiva' : ''), 'aria-pressed': String(c === categoria),
        onclick: cambia(() => { scelta.categoria = c; scelta.quanti = QUANTI_SUBITO; }),
      }, nome, h('span', { class: 'quanti' }, String(f[c].length))))),
    h('div', { class: 'filtri-filmografia' },
      h('div', { class: 'segmenti', role: 'group', 'aria-label': 'Ordine' },
        segmento('noti', 'Più noti'), segmento('anno', 'Per anno')),
      haiQualcosa && h('button', {
        type: 'button', class: 'pillola' + (soloTuoi ? ' attiva' : ''), 'aria-pressed': String(Boolean(soloTuoi)),
        onclick: cambia(() => { scelta.soloTuoi = !soloTuoi; }),
      }, 'Solo i tuoi')),
    mostrati.length
      ? h('div', { class: 'griglia' }, mostrati.map(r => cardTmdb(r, categoria)))
      : h('p', { class: 'nota' }, 'Nessun film del tuo archivio in questa categoria.'),
    elenco.length > mostrati.length && h('div', { class: 'centrato' },
      h('button', {
        type: 'button', class: 'pulsante secondario',
        onclick: cambia(() => { scelta.quanti = Infinity; }),
      }, `Mostra tutti (${elenco.length})`)),
  ];
}

// Locandina di un film della filmografia. Se è nel tuo archivio porta alla sua
// scheda e mostra lo stato; altrimenti apre il pannello per aggiungerlo.
function cardTmdb(r, categoria) {
  const o = archivio.opera(archivio.idFilm(r.tmdbId));
  const sotto = [r.anno ?? 'In arrivo', o && nomeStato(o.stato)].filter(Boolean).join(' · ');
  const parti = [
    h('div', { class: 'card-locandina' },
      locandina(r.locandina, 'w342', r.titolo),
      o && h('span', { class: 'badge-stato', title: nomeStato(o.stato) }, icona(ICONA_STATO[o.stato] || 'spunta'))),
    h('div', { class: 'card-titolo' }, r.titolo),
    h('div', { class: 'card-sotto' }, sotto, o?.voto ? stelle(o.voto, 'stelle piccole') : null),
    categoria === 'cast' && r.ruolo && h('div', { class: 'card-ruolo' }, r.ruolo),
  ];
  return o
    ? h('a', { class: 'card nel-archivio', href: `#/film/${o.id}` }, ...parti)
    : h('button', { type: 'button', class: 'card', onclick: () => apriAnteprima(r) }, ...parti);
}
