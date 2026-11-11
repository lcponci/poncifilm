// Scheda di un film del tuo archivio.

import { h, icona, avviso, formattaData, formattaDurata, nomePaese, stelle } from '../ui.js';
import { locandina, logoPiattaforma } from '../componenti.js';
import * as archivio from '../archivio.js';
import { immagine, haChiave } from '../tmdb.js';
import { completaFilm, aggiornaPiattaformeFilm } from '../servizi.js';

function tornaIndietro() {
  if (history.length > 1) history.back();
  else location.replace('#/');
}

const pulsanteIndietro = () =>
  h('button', { type: 'button', class: 'indietro', 'aria-label': 'Indietro', onclick: tornaIndietro }, icona('indietro'));

function sezione(titolo, ...contenuto) {
  return h('section', { class: 'sezione' }, h('h2', null, titolo), ...contenuto);
}

export function vistaFilm(id) {
  const el = h('article', { class: 'vista film' });

  function disegna() {
    const o = archivio.opera(id);
    if (!o) {
      el.replaceChildren(pulsanteIndietro(), h('div', { class: 'vuoto' },
        h('p', null, 'Questo film non è nel tuo archivio.'),
        h('a', { class: 'pulsante', href: '#/' }, 'Torna alla libreria')));
      return;
    }
    // Le parti vuote (false/null) non vanno mostrate.
    el.replaceChildren(...contenuto(o).filter(parte => parte instanceof Node));
  }

  disegna();
  const stacca = archivio.ascolta(cambiato => { if (cambiato === id) disegna(); });
  return {
    el,
    smonta: stacca,
    montata() {
      const o = archivio.opera(id);
      if (!o) return;
      // Informazioni mancanti? Le scarico. Altrimenti aggiorno solo le piattaforme.
      if (!o.infoCompleta) completaFilm(id);
      else aggiornaPiattaformeFilm(id);
    },
  };
}

function contenuto(o) {
  const i = o.info;
  const regia = i.regia || [];
  const musica = i.musica || [];
  const meta = [i.anno, formattaDurata(i.durata), (i.generi || []).slice(0, 3).join(', ')].filter(Boolean).join(' · ');

  return [
    pulsanteIndietro(),
    h('div', {
      class: 'film-sfondo' + (i.sfondo ? '' : ' senza-immagine'),
      style: i.sfondo ? { backgroundImage: `url("${immagine(i.sfondo, 'w780')}")` } : null,
    }),
    h('header', { class: 'film-testa' },
      h('div', { class: 'film-locandina' }, locandina(i.locandina, 'w342', i.titolo)),
      h('div', { class: 'film-titoli' },
        h('h1', null, i.titolo),
        i.titoloOriginale && i.titoloOriginale !== i.titolo && h('p', { class: 'titolo-originale' }, i.titoloOriginale),
        meta && h('p', { class: 'meta' }, meta),
        regia.length > 0 && h('p', { class: 'meta' }, 'Regia di ', regia.map(p => p.nome).join(', ')),
        o.voto ? stelle(o.voto) : null)),
    !o.infoCompleta && h('p', { class: 'nota' }, haChiave()
      ? 'Sto recuperando le informazioni da TMDb…'
      : 'Inserisci la chiave TMDb nelle Impostazioni per completare le informazioni.'),
    pannelloAzioni(o),
    i.trama && sezione('Trama', h('p', { class: 'trama' },
      i.tramaLingua === 'en' && h('span', { class: 'lingua', title: 'Trama disponibile solo in inglese' }, 'EN'),
      i.trama)),
    sezionePiattaforme(o),
    i.cast?.length > 0 && sezione('Cast', elencoPersone(i.cast.map(p => ({ ...p, ruolo: p.personaggio })))),
    (regia.length > 0 || musica.length > 0) && sezione('Regia e musica', elencoPersone([
      ...regia.map(p => ({ ...p, ruolo: 'Regia' })),
      ...musica.map(p => ({ ...p, ruolo: 'Musica' })),
    ])),
    sezioneDettagli(i),
    h('div', { class: 'zona-rimozione' },
      h('button', { type: 'button', class: 'pulsante-testo pericolo', onclick: () => chiediRimozione(o) },
        'Rimuovi dall\'archivio')),
  ];
}

function pannelloAzioni(o) {
  const imp = archivio.impostazioni();
  const parti = [];

  parti.push(h('div', { class: 'chips', role: 'group', 'aria-label': 'Stato' }, imp.stati.map(s =>
    h('button', {
      type: 'button',
      class: 'chip' + (o.stato === s.id ? ' attivo' : ''),
      'aria-pressed': String(o.stato === s.id),
      onclick: () => archivio.cambiaStato(o.id, s.id),
    }, s.nome))));

  if (o.stato === 'da-vedere') {
    parti.push(h('button', {
      type: 'button', class: 'pulsante largo grande',
      onclick: () => { archivio.segnaVisto(o.id); avviso('Segnato come visto oggi'); },
    }, icona('spunta'), 'Segna come visto'));

    const attuale = archivio.prioritaDi(o);
    parti.push(h('div', { class: 'blocco' },
      h('div', { class: 'etichetta' }, 'Priorità'),
      h('div', { class: 'chips', role: 'group', 'aria-label': 'Priorità' }, imp.priorita.map(p =>
        h('button', {
          type: 'button',
          class: 'chip' + (attuale === p.id ? ' attivo' : ''),
          'aria-pressed': String(attuale === p.id),
          onclick: () => archivio.modifica(o.id, { priorita: p.id }),
        }, h('span', { class: 'pallino', style: { background: p.colore } }), p.nome)))));
  }

  if (o.visioni.length) {
    const date = [...o.visioni].sort().reverse().map(formattaData);
    parti.push(h('p', { class: 'visioni' }, o.visioni.length === 1 ? 'Visto il ' : 'Visioni: ', date.join(' · ')));
  }

  if (o.stato === 'visto' || o.stato === 'da-rivedere') {
    const giaOggi = o.visioni.includes(archivio.oggi());
    parti.push(h('button', {
      type: 'button', class: 'pulsante secondario largo', disabled: giaOggi,
      onclick: () => { archivio.segnaVisto(o.id); avviso('Nuova visione registrata'); },
    }, icona(giaOggi ? 'spunta' : 'ripeti'), giaOggi ? 'Visto oggi' : 'L\'ho rivisto oggi'));
  }

  return h('section', { class: 'pannello-azioni' }, ...parti);
}

function sezionePiattaforme(o) {
  const p = archivio.piattaformeVisibili(o);
  if (!p) {
    const messaggio = !haChiave() ? 'Serve la chiave TMDb per sapere dove vederlo.'
      : navigator.onLine === false ? 'Piattaforme non ancora disponibili: sei offline.'
        : 'Sto cercando le piattaforme…';
    return sezione('Dove vederlo', h('p', { class: 'nota' }, messaggio));
  }
  const gruppi = [
    ['Abbonamento', p.abbonamento],
    ['Gratis', p.gratis],
    ['Noleggio', p.noleggio],
    ['Acquisto', p.acquisto],
  ].filter(([, elenco]) => elenco.length);

  return sezione('Dove vederlo',
    gruppi.length
      ? gruppi.map(([nome, elenco]) => h('div', { class: 'gruppo-piattaforme' },
          h('div', { class: 'etichetta' }, nome),
          h('div', { class: 'piattaforme' }, elenco.map(x => logoPiattaforma(x, { conNome: true })))))
      : h('p', { class: 'nota' }, 'Al momento non risulta disponibile in Italia.'),
    h('p', { class: 'fonte' },
      'Dati JustWatch',
      p.aggiornateIl && ` · aggiornati il ${formattaData(p.aggiornateIl)}`,
      p.link && [' · ', h('a', { href: p.link, target: '_blank', rel: 'noopener' }, 'dettagli')]),
  );
}

function elencoPersone(persone) {
  return h('div', { class: 'persone' }, persone.map(p =>
    h('div', { class: 'persona' },
      h('div', { class: 'foto' }, p.foto
        ? h('img', { src: immagine(p.foto, 'w185'), alt: '', loading: 'lazy', decoding: 'async' })
        : h('span', null, iniziali(p.nome))),
      h('div', { class: 'persona-nome' }, p.nome),
      p.ruolo && h('div', { class: 'persona-ruolo' }, p.ruolo))));
}

function iniziali(nome) {
  return (nome || '?').split(/\s+/).slice(0, 2).map(parola => parola[0]).join('').toUpperCase();
}

function sezioneDettagli(i) {
  const righe = [
    ['Titolo originale', i.titoloOriginale && i.titoloOriginale !== i.titolo ? i.titoloOriginale : null],
    ['Uscita', formattaData(i.dataUscita) || i.anno],
    ['Durata', formattaDurata(i.durata)],
    ['Generi', (i.generi || []).join(', ')],
    ['Paese', (i.paesi || []).map(nomePaese).join(', ')],
    ['Saga', i.collezione?.nome],
  ].filter(([, valore]) => valore);
  if (!righe.length) return null;
  return sezione('Dettagli', h('dl', { class: 'dettagli' },
    righe.flatMap(([nome, valore]) => [h('dt', null, nome), h('dd', null, valore)])));
}

function chiediRimozione(o) {
  if (!confirm(`Rimuovere «${o.info.titolo}» dall'archivio?`)) return;
  archivio.rimuovi(o.id);
  avviso('Film rimosso dall\'archivio');
  tornaIndietro();
}
