// La Mensola: i film "sempre belli", in piedi su ripiani di legno come in una
// libreria vera. Solo le copertine; un tocco apre la scheda del film.
// Con "Riordina" ogni copertina mostra le frecce per spostarla e la × per toglierla.

import { h, icona, avviso } from '../ui.js';
import { locandina } from '../componenti.js';
import * as archivio from '../archivio.js';

let inRiordino = false; // resta così anche quando la pagina si ridisegna

// Quante copertine per ripiano, secondo la larghezza dello schermo.
export function colonneMensola() {
  const larghezza = Math.min(window.innerWidth, 960);
  return larghezza < 520 ? 4 : larghezza < 760 ? 6 : 8;
}

export function sezioneMensola(ridisegna) {
  const film = archivio.filmSullaMensola();
  const limite = archivio.limiteMensola();
  const colonne = colonneMensola();
  if (film.length < 2) inRiordino = false;

  const testa = h('div', { class: 'testa-sezione' },
    h('h2', null, 'La Mensola'),
    h('span', { class: 'conteggio' }, `${film.length} di ${limite}`),
    film.length > 1 && h('button', {
      type: 'button', class: 'pulsante-testo cambia',
      onclick: () => { inRiordino = !inRiordino; ridisegna(); },
    }, inRiordino ? 'Fine' : 'Riordina'));

  if (!film.length) {
    return h('section', { class: 'sezione-mensola' }, testa,
      h('div', { class: 'mensola vuota' },
        ripiano([h('p', { class: 'mensola-invito' },
          'Qui vanno i film che per te sono sempre belli. Apri un film che hai visto e tocca «Metti sulla Mensola».')], colonne)));
  }

  // Copertine divise per ripiano; l'ultimo si completa con posti liberi (se ce ne sono).
  const posti = film.map((o, i) => copertina(o, i, film.length));
  const liberi = Math.min(limite - film.length, (colonne - (film.length % colonne)) % colonne);
  for (let i = 0; i < liberi; i++) posti.push(h('div', { class: 'libro libero', 'aria-hidden': 'true' }));
  const ripiani = [];
  for (let i = 0; i < posti.length; i += colonne) ripiani.push(ripiano(posti.slice(i, i + colonne), colonne));

  return h('section', { class: 'sezione-mensola' + (inRiordino ? ' in-riordino' : '') }, testa,
    h('div', { class: 'mensola' }, ripiani));
}

function ripiano(contenuto, colonne) {
  return h('div', { class: 'ripiano' },
    h('div', { class: 'ripiano-libri', style: { gridTemplateColumns: `repeat(${colonne}, 1fr)` } }, contenuto),
    h('div', { class: 'ripiano-asse', 'aria-hidden': 'true' }));
}

function copertina(o, posizione, totale) {
  const immagine = locandina(o.info.locandina, 'w342', o.info.titolo);
  if (!inRiordino) {
    return h('a', { class: 'libro', href: `#/film/${o.id}`, 'aria-label': o.info.titolo, title: o.info.titolo }, immagine);
  }
  const comando = (nome, etichetta, azione, disattivo = false) => h('button', {
    type: 'button', class: 'comando-libro', 'aria-label': etichetta, disabled: disattivo, onclick: azione,
  }, icona(nome));
  return h('div', { class: 'libro' }, immagine,
    h('div', { class: 'comandi-libro' },
      comando('indietro', `Sposta «${o.info.titolo}» a sinistra`, () => archivio.spostaSullaMensola(o.id, -1), posizione === 0),
      comando('chiudi', `Togli «${o.info.titolo}» dalla Mensola`, () => {
        const posto = o.mensola.posizione;
        archivio.togliDallaMensola(o.id);
        avviso('Tolto dalla Mensola', { azione: { testo: 'Annulla', fai: () => archivio.mettiSullaMensola(o.id, posto) } });
      }),
      comando('avanti', `Sposta «${o.info.titolo}» a destra`, () => archivio.spostaSullaMensola(o.id, 1), posizione === totale - 1)));
}
