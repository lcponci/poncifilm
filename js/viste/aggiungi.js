// Aggiungere un film: cerco il titolo, riconosco la locandina, tocco e scelgo.

import { h, icona, avviso, apriFoglio } from '../ui.js';
import { locandina, nomeStato, descrizioneStato, datiPriorita, pulsantiPriorita, apriGiudizio } from '../componenti.js';
import * as archivio from '../archivio.js';
import { cercaFilm, haChiave } from '../tmdb.js';
import { completaFilm } from '../servizi.js';

// La ricerca resta lì quando torni indietro da una scheda.
const memoria = { testo: '', risultati: null, errore: null };

export function preimpostaRicerca(testo) {
  memoria.testo = testo;
  memoria.risultati = null;
  memoria.errore = null;
}

export function vistaAggiungi() {
  let timer = null;
  let controllo = null;

  const campo = h('input', {
    type: 'search', class: 'campo', placeholder: 'Titolo del film', value: memoria.testo,
    autocomplete: 'off', autocorrect: 'off', autocapitalize: 'off', spellcheck: 'false',
    enterkeyhint: 'search', 'aria-label': 'Titolo del film da cercare',
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
      memoria.errore = null;
      disegna();
      return;
    }
    const mio = new AbortController();
    controllo = mio;
    stato.textContent = 'Cerco…';
    try {
      memoria.risultati = await cercaFilm(testo, mio.signal);
      memoria.errore = null;
    } catch (errore) {
      if (errore.name === 'AbortError') return;
      memoria.risultati = null;
      memoria.errore = errore.message;
    }
    if (controllo === mio) disegna();
  }

  function disegna() {
    stato.className = 'nota';
    if (!haChiave()) {
      stato.replaceChildren('Per cercare serve la chiave TMDb. ', h('a', { href: '#/impostazioni' }, 'Inseriscila qui'));
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
      stato.textContent = 'Scrivi il titolo, anche solo una parte.';
      elenco.replaceChildren();
      return;
    }
    stato.textContent = memoria.risultati.length ? '' : 'Nessun film trovato su TMDb. Prova con il titolo originale.';
    elenco.replaceChildren(...memoria.risultati.map(rigaRisultato));
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

function sottotitolo(r) {
  const originale = r.titoloOriginale && r.titoloOriginale !== r.titolo ? r.titoloOriginale : null;
  return [r.anno ?? 'anno sconosciuto', originale].filter(Boolean).join(' · ');
}

function rigaRisultato(r) {
  const presente = archivio.opera(archivio.idFilm(r.tmdbId));
  return h('button', { type: 'button', class: 'riga-risultato', onclick: () => apriAnteprima(r) },
    h('div', { class: 'riga-locandina' }, locandina(r.locandina, 'w154', '')),
    h('div', { class: 'riga-testo' },
      h('div', { class: 'riga-titolo' }, r.titolo),
      h('div', { class: 'riga-sotto' }, sottotitolo(r)),
      presente && h('span', { class: 'etichetta-stato' }, nomeStato(presente.stato))),
  );
}

function apriAnteprima(r) {
  const presente = archivio.opera(archivio.idFilm(r.tmdbId));

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
        h('p', { class: 'nota' }, sottotitolo(r)),
        r.trama && h('p', { class: 'trama-breve' }, r.trama))),
    azioni,
  ));
}
