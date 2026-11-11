// Schermata principale: la libreria a locandine, divisa per stato.

import { h, vuoto, normalizza } from '../ui.js';
import { griglia } from '../componenti.js';
import * as archivio from '../archivio.js';
import { haChiave } from '../tmdb.js';
import { preimpostaRicerca } from './aggiungi.js';

const memoria = { testo: '' };

const MESSAGGI_VUOTI = {
  'da-vedere': 'Nessun film da vedere. Tocca «Aggiungi» per riempire la Watchlist.',
  visto: 'Non hai ancora segnato nessun film come visto.',
  'da-rivedere': 'Nessun film da rivedere.',
  abbandonato: 'Nessun film abbandonato. Bene così!',
};

const perAggiunta = (a, b) => (b.aggiuntoIl || '').localeCompare(a.aggiuntoIl || '');
const perModifica = (a, b) => (b.modificatoIl || '').localeCompare(a.modificatoIl || '');
const perTitolo = (a, b) => a.info.titolo.localeCompare(b.info.titolo, 'it');
const perVisione = (a, b) =>
  (archivio.ultimaVisione(b) || '').localeCompare(archivio.ultimaVisione(a) || '') || perAggiunta(a, b);

function corrisponde(o, testo) {
  return normalizza(o.info.titolo).includes(testo) || normalizza(o.info.titoloOriginale).includes(testo);
}

export function vistaLibreria(sezioneRichiesta) {
  const imp = archivio.impostazioni();
  const sezione = imp.stati.some(s => s.id === sezioneRichiesta) ? sezioneRichiesta : imp.stati[0].id;

  const campo = h('input', {
    type: 'search', class: 'campo', placeholder: 'Cerca nel tuo archivio', value: memoria.testo,
    autocomplete: 'off', enterkeyhint: 'search', 'aria-label': 'Cerca nel tuo archivio',
    oninput: e => { memoria.testo = e.target.value; disegnaContenuto(); },
    onkeydown: e => { if (e.key === 'Enter') e.target.blur(); },
  });
  const schede = h('div', { class: 'schede', role: 'tablist' });
  const contenuto = h('div', { class: 'contenuto' });
  const el = h('section', { class: 'vista' },
    h('header', { class: 'intestazione' }, h('h1', null, 'PonciFilm')),
    campo, schede, contenuto);

  function disegnaSchede() {
    const conteggi = {};
    for (const o of archivio.opere()) conteggi[o.stato] = (conteggi[o.stato] || 0) + 1;
    schede.replaceChildren(...imp.stati.map(s => h('a', {
      href: `#/libreria/${s.id}`,
      class: 'scheda' + (s.id === sezione ? ' attiva' : ''),
      role: 'tab',
      'aria-selected': String(s.id === sezione),
      // Cambiare scheda non aggiunge passi alla cronologia del "torna indietro".
      onclick: e => { e.preventDefault(); location.replace(`#/libreria/${s.id}`); },
    }, s.sezione, h('span', { class: 'conteggio' }, conteggi[s.id] || 0))));
  }

  function benvenuto() {
    if (!haChiave()) {
      return h('div', { class: 'scheda-info' },
        h('h2', null, 'Benvenuto in PonciFilm'),
        h('p', null, 'Per cercare i film serve una chiave gratuita di TMDb, l\'archivio online da cui arrivano locandine, cast e piattaforme.'),
        h('a', { class: 'pulsante', href: '#/impostazioni' }, 'Inserisci la chiave'));
    }
    return h('div', { class: 'scheda-info' },
      h('h2', null, 'L\'archivio è vuoto'),
      h('p', null, 'Tocca «Aggiungi» in basso e cerca il primo film.'),
      h('a', { class: 'pulsante', href: '#/aggiungi' }, 'Aggiungi un film'));
  }

  function disegnaContenuto() {
    const tutte = archivio.opere();
    const testo = normalizza(memoria.testo.trim());
    schede.hidden = Boolean(testo);

    if (!tutte.length) {
      contenuto.replaceChildren(benvenuto());
      return;
    }

    if (testo) {
      const trovate = tutte.filter(o => corrisponde(o, testo)).sort(perTitolo);
      contenuto.replaceChildren(
        trovate.length
          ? griglia(trovate, { mostraStato: true })
          : vuoto(h('p', null, 'Nessun film con questo titolo nel tuo archivio.')),
        h('div', { class: 'centrato' }, h('a', {
          class: 'pulsante secondario', href: '#/aggiungi',
          onclick: () => preimpostaRicerca(memoria.testo.trim()),
        }, `Cerca «${memoria.testo.trim()}» su TMDb`)),
      );
      return;
    }

    const elenco = tutte.filter(o => o.stato === sezione);
    if (!elenco.length) {
      contenuto.replaceChildren(vuoto(h('p', null, MESSAGGI_VUOTI[sezione] || 'Nessun film in questa sezione.')));
      return;
    }

    if (sezione === 'da-vedere') {
      // Watchlist divisa per priorità: aiuta a scegliere cosa guardare stasera.
      contenuto.replaceChildren(...imp.priorita.map(p => {
        const gruppo = elenco.filter(o => archivio.prioritaDi(o) === p.id).sort(perAggiunta);
        if (!gruppo.length) return null;
        return h('div', { class: 'gruppo' },
          h('h2', { class: 'titolo-gruppo' },
            h('span', { class: 'pallino', style: { background: p.colore } }),
            p.nome,
            h('span', { class: 'conteggio' }, gruppo.length)),
          griglia(gruppo, { mostraPriorita: true, mostraPiattaforme: true }));
      }).filter(Boolean));
      return;
    }

    const ordinati = sezione === 'visto' ? elenco.sort(perVisione) : elenco.sort(perModifica);
    contenuto.replaceChildren(griglia(ordinati, {}));
  }

  disegnaSchede();
  disegnaContenuto();
  const stacca = archivio.ascolta(() => { disegnaSchede(); disegnaContenuto(); });
  return { el, smonta: stacca, ricordaScorrimento: true };
}
