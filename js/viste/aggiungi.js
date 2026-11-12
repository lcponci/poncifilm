// Aggiungere un film: cerco il titolo, riconosco la locandina, tocco e scelgo.
// Si può scrivere anche il nome di un regista o di un attore: le persone trovate
// compaiono in cima e portano alla loro filmografia.

import { h, icona, avviso, apriFoglio } from '../ui.js';
import { locandina, nomeStato, descrizioneStato, datiPriorita, pulsantiPriorita, apriGiudizio, fotoPersona } from '../componenti.js';
import * as archivio from '../archivio.js';
import { cercaFilm, cercaPersone, haChiave, registiDi, nomeReparto } from '../tmdb.js';
import { completaFilm } from '../servizi.js';

// La ricerca resta lì quando torni indietro da una scheda.
const memoria = { testo: '', risultati: null, persone: [], errore: null };

export function preimpostaRicerca(testo) {
  memoria.testo = testo;
  memoria.risultati = null;
  memoria.persone = [];
  memoria.errore = null;
}

export function vistaAggiungi() {
  let timer = null;
  let controllo = null;

  const campo = h('input', {
    type: 'search', class: 'campo', placeholder: 'Titolo, regista o attore', value: memoria.testo,
    autocomplete: 'off', autocorrect: 'off', autocapitalize: 'off', spellcheck: 'false',
    enterkeyhint: 'search', 'aria-label': 'Titolo del film, regista o attore da cercare',
    oninput: () => {
      memoria.testo = campo.value;
      clearTimeout(timer);
      timer = setTimeout(cerca, 350);
    },
    onkeydown: e => {
      if (e.key === 'Enter') { e.preventDefault(); cerca(); campo.blur(); }
    },
  });
  const stato = h('p', { class: 'nota', 'aria-live': 'polite' });
  const elenco = h('div', { class: 'risultati' });
  const el = h('section', { class: 'vista' },
    h('header', { class: 'intestazione' }, h('h1', null, 'Aggiungi un film')),
    campo, stato, elenco);

  async function cerca() {
    clearTimeout(timer);
    const testo = campo.value.trim();
    controllo?.abort();
    if (testo.length < 2) {
      memoria.risultati = null;
      memoria.persone = [];
      memoria.errore = null;
      disegna();
      return;
    }
    const mio = new AbortController();
    controllo = mio;
    stato.textContent = 'Cerco…';
    // Film e persone insieme; se la ricerca delle persone non riesce, pazienza.
    const [film, persone] = await Promise.allSettled([cercaFilm(testo, mio.signal), cercaPersone(testo, mio.signal)]);
    if (mio.signal.aborted || controllo !== mio) return;
    if (film.status === 'fulfilled') {
      memoria.risultati = film.value;
      memoria.errore = null;
    } else {
      if (film.reason?.name === 'AbortError') return;
      memoria.risultati = null;
      memoria.errore = film.reason?.message || 'Ricerca non riuscita.';
    }
    memoria.persone = persone.status === 'fulfilled' ? persone.value : [];
    disegna();
  }

  function disegna() {
    stato.className = 'nota';
    if (!haChiave()) {
      stato.replaceChildren('Per cercare serve la chiave TMDb. ', h('a', { href: '#/impostazioni/tmdb' }, 'Inseriscila qui'));
      elenco.replaceChildren();
      return;
    }
    if (memoria.errore) {
      stato.className = 'nota errore';
      stato.textContent = memoria.errore;
      elenco.replaceChildren();
      return;
    }
    if (!memoria.risultati) {
      stato.textContent = 'Scrivi il titolo (anche solo una parte), oppure il nome di un regista o di un attore.';
      elenco.replaceChildren();
      return;
    }
    const persone = memoria.persone || [];
    stato.textContent = memoria.risultati.length || persone.length ? '' : 'Nessun film trovato su TMDb. Prova con il titolo originale.';
    elenco.replaceChildren(...[
      persone.length > 0 && personeTrovate(persone),
      persone.length > 0 && memoria.risultati.length > 0 && h('div', { class: 'etichetta' }, 'Film'),
      ...memoria.risultati.map((r, i) => rigaRisultato(r, i, controllo?.signal)),
    ].filter(Boolean));
  }

  disegna();
  const stacca = archivio.ascolta(disegna);
  if (memoria.testo && !memoria.risultati && !memoria.errore) cerca();

  return {
    el,
    ricordaScorrimento: true,
    smonta() { stacca(); clearTimeout(timer); controllo?.abort(); },
    // Chiamata subito dopo il tocco su "Aggiungi": così sull'iPhone si apre la tastiera.
    mettiAFuoco() { if (!memoria.risultati) campo.focus(); },
  };
}

// Registi e attori trovati: un tocco apre la loro filmografia.
function personeTrovate(persone) {
  return h('div', { class: 'persone-trovate' },
    h('div', { class: 'etichetta' }, 'Persone'),
    persone.map(p => h('a', { class: 'riga-persona', href: `#/persona/${p.id}` },
      fotoPersona(p, 'w185'),
      h('span', { class: 'riga-testo' },
        h('span', { class: 'riga-titolo' }, p.nome),
        h('span', { class: 'riga-sotto' }, [nomeReparto(p.reparto), 'vedi i film'].filter(Boolean).join(' · '))),
      icona('indietro', 'icona freccia'))));
}

// "1963 · Alfred Hitchcock · The Birds"
function sottotitolo(r) {
  const originale = r.titoloOriginale && r.titoloOriginale !== r.titolo ? r.titoloOriginale : null;
  return [r.anno ?? 'anno sconosciuto', r.registi?.join(', '), originale].filter(Boolean).join(' · ');
}

const RISULTATI_CON_REGISTA = 12;

function rigaRisultato(r, posizione, signal) {
  const presente = archivio.opera(archivio.idFilm(r.tmdbId));
  const sotto = h('div', { class: 'riga-sotto' }, sottotitolo(r));
  // Il regista arriva un attimo dopo: lo aggiungo appena c'è.
  if (!r.registi && posizione < RISULTATI_CON_REGISTA) {
    registiDi(r.tmdbId, signal)
      .then(registi => { r.registi = registi; sotto.textContent = sottotitolo(r); })
      .catch(() => { /* senza regista va bene lo stesso */ });
  }
  return h('button', { type: 'button', class: 'riga-risultato', onclick: () => apriAnteprima(r) },
    h('div', { class: 'riga-locandina' }, locandina(r.locandina, 'w154', '')),
    h('div', { class: 'riga-testo' },
      h('div', { class: 'riga-titolo' }, r.titolo),
      sotto,
      presente && h('span', { class: 'etichetta-stato' }, nomeStato(presente.stato))),
  );
}

// Pannello per aggiungere un film trovato su TMDb (dalla ricerca o dalla scheda di una persona).
export function apriAnteprima(r) {
  const presente = archivio.opera(archivio.idFilm(r.tmdbId));
  const sotto = h('p', { class: 'nota' }, sottotitolo(r));
  if (!r.registi) {
    registiDi(r.tmdbId)
      .then(registi => { r.registi = registi; sotto.textContent = sottotitolo(r); })
      .catch(() => { /* senza regista va bene lo stesso */ });
  }

  // Un tocco solo: "Da vedere" con la priorità scelta, oppure "Visto".
  function aggiungi(stato, priorita = null) {
    const o = archivio.aggiungiFilm(r, stato, priorita);
    foglio.chiudi();
    completaFilm(o.id);
    // Già visto: si passa subito al giudizio (voto, riconoscimenti, commento).
    if (stato === 'visto') {
      apriGiudizio(o.id, { titolo: 'Com\'era?', messaggio: `«${r.titolo}» aggiunto ai visti` });
      return;
    }
    avviso(`«${r.titolo}» da vedere · ${datiPriorita(priorita)?.nome}`,
      { azione: { testo: 'Apri', href: `#/film/${o.id}` } });
  }

  const azioni = presente
    ? h('div', { class: 'azioni' },
        h('p', { class: 'nota' }, `È già nel tuo archivio: ${descrizioneStato(presente).testo}.`),
        h('a', { class: 'pulsante largo', href: `#/film/${presente.id}` }, 'Apri la scheda'))
    : h('div', { class: 'azioni-aggiungi' },
        h('div', { class: 'etichetta' }, 'Da vedere · scegli la priorità'),
        pulsantiPriorita(null, p => aggiungi('da-vedere', p)),
        h('div', { class: 'etichetta' }, 'Oppure'),
        h('button', { type: 'button', class: 'pulsante largo', onclick: () => aggiungi('visto') },
          icona('spunta'), 'L\'ho già visto'));

  const foglio = apriFoglio(h('div', { class: 'anteprima' },
    h('div', { class: 'anteprima-testa' },
      h('div', { class: 'anteprima-locandina' }, locandina(r.locandina, 'w342', r.titolo)),
      h('div', null,
        h('h2', null, r.titolo),
        sotto,
        r.trama && h('p', { class: 'trama-breve' }, r.trama))),
    azioni,
  ));
}
