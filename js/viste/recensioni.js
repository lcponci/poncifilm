// "Recensioni da scrivere" (#/recensioni): i film visti senza voto, uno alla volta.
// Per ognuno: stelle, riconoscimenti, commento; poi "Avanti". Oppure "Salta",
// o "Non l'ho visto davvero" (torna tra i da vedere).

import { h, icona, avviso, vuoto } from '../ui.js';
import { intestazione, locandina, editorGiudizio } from '../componenti.js';
import * as archivio from '../archivio.js';

export const senzaRecensione = o => (o.stato === 'visto' || o.stato === 'da-rivedere') && !o.voto;

// La coda resta la stessa finché la pagina viene riaperta durante il giro
// (per esempio dopo aver aperto la scheda di un film).
let coda = null;
let posizione = 0;
let fatte = 0;

function nuovaCoda() {
  coda = archivio.opere().filter(senzaRecensione)
    .sort((a, b) => a.info.titolo.localeCompare(b.info.titolo, 'it'))
    .map(o => o.id);
  posizione = 0;
  fatte = 0;
}

export function vistaRecensioni() {
  if (!coda || posizione >= coda.length) nuovaCoda();
  const el = h('section', { class: 'vista recensioni' });
  let editor = null;

  function vai(passo) {
    editor?.salva();
    posizione += passo;
    // Salto i film nel frattempo cancellati o già recensiti altrove.
    while (posizione < coda.length && !archivio.opera(coda[posizione])) posizione++;
    disegna();
    window.scrollTo(0, 0);
  }

  function disegna() {
    const testa = intestazione('Recensioni da scrivere', { indietro: true });
    if (!coda.length) {
      el.replaceChildren(testa, vuoto(h('p', null, 'Tutti i film visti hanno un voto. ✓'), h('a', { class: 'pulsante', href: '#/' }, 'Vai alla Home')));
      return;
    }
    if (posizione >= coda.length) {
      el.replaceChildren(testa, vuoto(
        h('p', null, fatte ? `Finito! Hai dato il voto a ${fatte === 1 ? '1 film' : `${fatte} film`}.` : 'Finito il giro.'),
        h('a', { class: 'pulsante', href: '#/' }, 'Vai alla Home')));
      coda = null;
      return;
    }

    const o = archivio.opera(coda[posizione]);
    const i = o.info;
    editor = editorGiudizio(o.id);
    const regia = (i.regia || []).map(p => p.nome).join(', ');

    el.replaceChildren(testa,
      h('div', { class: 'avanzamento-recensioni' },
        h('span', { class: 'nota' }, `${posizione + 1} di ${coda.length}`),
        h('div', { class: 'barra-avanzamento' }, h('span', { style: { width: `${Math.round(100 * posizione / coda.length)}%` } }))),
      h('header', { class: 'recensione-testa' },
        h('a', { class: 'film-locandina', href: `#/film/${o.id}` }, locandina(i.locandina, 'w342', i.titolo)),
        h('div', null,
          h('h2', null, i.titolo),
          h('p', { class: 'meta' }, [i.anno, regia && `Regia di ${regia}`].filter(Boolean).join(' · ')),
          h('a', { class: 'pulsante-testo cambia', href: `#/film/${o.id}` }, 'Apri la scheda'))),
      h('div', { class: 'scheda-info' }, editor.el),
      h('div', { class: 'azioni due' },
        h('button', { type: 'button', class: 'pulsante secondario', onclick: () => vai(1) }, 'Salta'),
        h('button', {
          type: 'button', class: 'pulsante',
          onclick: () => { if (archivio.opera(o.id)?.voto) fatte++; vai(1); },
        }, 'Avanti', icona('avanti'))),
      h('div', { class: 'centrato' },
        h('button', {
          type: 'button', class: 'pulsante-testo abbandona',
          onclick: () => {
            archivio.impostaStato(o.id, 'da-vedere', archivio.impostazioni().prioritaPredefinita);
            avviso(`«${i.titolo}» spostato tra i da vedere`);
            vai(1);
          },
        }, 'Non l\'ho visto davvero: spostalo tra i da vedere')));
  }

  disegna();
  return { el, smonta: () => editor?.salva() };
}
