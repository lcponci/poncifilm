// Le pagine elenco: "Da vedere" (con i film da rivedere), "Visti" e "Abbandonati".

import { h, vuoto, normalizza } from '../ui.js';
import { griglia, intestazione } from '../componenti.js';
import * as archivio from '../archivio.js';
import { haChiave } from '../tmdb.js';
import { preimpostaRicerca } from './aggiungi.js';

export const PAGINE = {
  'da-vedere': {
    titolo: 'Da vedere',
    stati: ['da-vedere', 'da-rivedere'],
    vuoto: 'Nessun film da vedere. Tocca + per aggiungerne uno.',
  },
  visti: {
    titolo: 'Visti',
    stati: ['visto'],
    vuoto: 'Non hai ancora segnato nessun film come visto.',
  },
  abbandonati: {
    titolo: 'Abbandonati',
    stati: ['abbandonato'],
    vuoto: 'Nessun film abbandonato.',
    secondaria: true, // raggiungibile solo dalle Impostazioni
  },
};

// Testo cercato in ogni pagina (resta quando torni indietro da una scheda).
const ricerche = {};

const perAggiunta = (a, b) => (b.aggiuntoIl || '').localeCompare(a.aggiuntoIl || '');
const perModifica = (a, b) => (b.modificatoIl || '').localeCompare(a.modificatoIl || '');
const perTitolo = (a, b) => a.info.titolo.localeCompare(b.info.titolo, 'it');
const perVisione = (a, b) =>
  (archivio.ultimaVisione(b) || '').localeCompare(archivio.ultimaVisione(a) || '') || perAggiunta(a, b);

// Cerca nel titolo (italiano e originale) e nei nomi di regista, compositore e attori.
function corrisponde(o, testo) {
  const i = o.info;
  const persone = [...(i.regia || []), ...(i.musica || []), ...(i.cast || [])].map(p => p.nome);
  return [i.titolo, i.titoloOriginale, ...persone].some(t => normalizza(t).includes(testo));
}

export function vistaElenco(pagina) {
  const conf = PAGINE[pagina] ?? PAGINE['da-vedere'];
  ricerche[pagina] ??= '';

  const campo = h('input', {
    type: 'search', class: 'campo', placeholder: 'Cerca titolo, regista, attore', value: ricerche[pagina],
    autocomplete: 'off', enterkeyhint: 'search', 'aria-label': 'Cerca nel tuo archivio',
    oninput: e => { ricerche[pagina] = e.target.value; disegna(); },
    onkeydown: e => { if (e.key === 'Enter') e.target.blur(); },
  });
  const riepilogo = h('p', { class: 'riepilogo' });
  const contenuto = h('div', { class: 'contenuto' });
  const el = h('section', { class: 'vista' },
    intestazione(conf.titolo, conf.secondaria ? { indietro: true } : { impostazioni: true }),
    riepilogo, campo, contenuto);

  function benvenuto() {
    if (!haChiave()) {
      return h('div', { class: 'scheda-info' },
        h('h2', null, 'Benvenuto in PonciFilm'),
        h('p', null, 'Per cercare i film serve una chiave gratuita di TMDb, l\'archivio online da cui arrivano locandine, cast e piattaforme.'),
        h('a', { class: 'pulsante', href: '#/impostazioni/tmdb' }, 'Inserisci la chiave'));
    }
    return h('div', { class: 'scheda-info' },
      h('h2', null, 'L\'archivio è vuoto'),
      h('p', null, 'Tocca + in basso e cerca il primo film.'),
      h('a', { class: 'pulsante', href: '#/aggiungi' }, 'Aggiungi un film'));
  }

  function aggiornaRiepilogo(elenco) {
    const rivedere = elenco.filter(o => o.stato === 'da-rivedere').length;
    riepilogo.textContent = [
      elenco.length === 1 ? '1 film' : `${elenco.length} film`,
      rivedere ? `${rivedere} da rivedere` : null,
    ].filter(Boolean).join(' · ');
  }

  function disegna() {
    const tutte = archivio.opere();
    const elenco = tutte.filter(o => conf.stati.includes(o.stato));
    aggiornaRiepilogo(elenco);
    const testo = normalizza(ricerche[pagina].trim());

    if (!tutte.length && !conf.secondaria) {
      contenuto.replaceChildren(benvenuto());
      return;
    }

    // La ricerca guarda in tutto l'archivio, anche fuori da questa pagina.
    if (testo) {
      const trovate = tutte.filter(o => corrisponde(o, testo)).sort(perTitolo);
      contenuto.replaceChildren(
        trovate.length
          ? griglia(trovate, { mostraStato: true })
          : vuoto(h('p', null, 'Nessun film trovato nel tuo archivio.')),
        h('div', { class: 'centrato' }, h('a', {
          class: 'pulsante secondario', href: '#/aggiungi',
          onclick: () => preimpostaRicerca(ricerche[pagina].trim()),
        }, `Cerca «${ricerche[pagina].trim()}» su TMDb`)),
      );
      return;
    }

    if (!elenco.length) {
      contenuto.replaceChildren(vuoto(h('p', null, conf.vuoto)));
      return;
    }

    if (pagina === 'da-vedere') {
      // Divisi per priorità: aiuta a scegliere cosa guardare stasera.
      contenuto.replaceChildren(...archivio.impostazioni().priorita.map(p => {
        const gruppo = elenco.filter(o => archivio.prioritaDi(o) === p.id).sort(perAggiunta);
        if (!gruppo.length) return null;
        return h('div', { class: 'gruppo' },
          h('h2', { class: 'titolo-gruppo' },
            h('span', { class: 'pallino', style: { background: p.colore } }),
            p.nome,
            h('span', { class: 'conteggio' }, gruppo.length)),
          griglia(gruppo, { mostraPiattaforme: true }));
      }).filter(Boolean));
      return;
    }

    contenuto.replaceChildren(griglia(elenco.sort(pagina === 'visti' ? perVisione : perModifica), {}));
  }

  disegna();
  const stacca = archivio.ascolta(disegna);
  return { el, smonta: stacca, ricordaScorrimento: true };
}
