// Pezzi di interfaccia specifici di PonciFilm, usati da più schermate.

import { h, stelle } from './ui.js';
import { immagine } from './tmdb.js';
import * as archivio from './archivio.js';

export function locandina(percorso, misura = 'w342', titolo = '') {
  return percorso
    ? h('img', { src: immagine(percorso, misura), alt: '', loading: 'lazy', decoding: 'async' })
    : h('div', { class: 'segnaposto' }, titolo);
}

export function nomeStato(id) {
  return archivio.impostazioni().stati.find(s => s.id === id)?.nome ?? id;
}

export function datiPriorita(id) {
  return archivio.impostazioni().priorita.find(p => p.id === id) ?? null;
}

export function logoPiattaforma(p, { conNome = false } = {}) {
  const logo = p.logo
    ? h('img', { class: 'logo', src: immagine(p.logo, 'w92'), alt: conNome ? '' : p.nome, title: p.nome, loading: 'lazy' })
    : h('span', { class: 'logo logo-testo', title: p.nome }, p.nome.slice(0, 2));
  return conNome ? h('span', { class: 'piattaforma' }, logo, h('span', null, p.nome)) : logo;
}

// Card a locandina per le griglie della libreria.
export function cardFilm(o, { mostraPriorita = false, mostraPiattaforme = false, mostraStato = false } = {}) {
  const i = o.info;
  const priorita = mostraPriorita ? datiPriorita(archivio.prioritaDi(o)) : null;
  const piattaforme = mostraPiattaforme ? archivio.piattaformeVisibili(o)?.abbonamento ?? [] : [];
  const sotto = [i.anno, mostraStato ? nomeStato(o.stato) : null].filter(Boolean).join(' · ');

  return h('a', { class: 'card', href: `#/film/${o.id}` },
    h('div', { class: 'card-locandina' },
      locandina(i.locandina, 'w342', i.titolo),
      priorita && h('span', { class: 'pallino-card', style: { background: priorita.colore }, title: priorita.nome }),
      piattaforme.length > 0 && h('div', { class: 'card-loghi' }, piattaforme.slice(0, 3).map(p => logoPiattaforma(p))),
    ),
    h('div', { class: 'card-titolo' }, i.titolo),
    h('div', { class: 'card-sotto' }, sotto, o.voto ? stelle(o.voto, 'stelle piccole') : null),
  );
}

export function griglia(elenco, opzioni) {
  return h('div', { class: 'griglia' }, elenco.map(o => cardFilm(o, opzioni)));
}
