// Scheda di un film del tuo archivio.

import { h, icona, avviso, apriFoglio, formattaData, formattaDurata, nomePaese, normalizza, stelle } from '../ui.js';
import {
  locandina, logoPiattaforma, descrizioneStato, segnoStato, apriSceltaStato, apriGiudizio,
} from '../componenti.js';
import * as archivio from '../archivio.js';
import { immagine, haChiave, elencoPiattaforme } from '../tmdb.js';
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
    o.stato !== 'da-vedere' && sezioneRecensione(o),
    i.trama && sezione('Trama', h('p', { class: 'trama' },
      i.tramaLingua === 'en' && h('span', { class: 'lingua', title: 'Trama disponibile solo in inglese' }, 'EN'),
      i.trama)),
    i.cast?.length > 0 && sezione('Cast', elencoPersone(i.cast.map(p => ({ ...p, ruolo: p.personaggio })))),
    (regia.length > 0 || musica.length > 0) && sezione('Regia e musica', elencoPersone([
      ...regia.map(p => ({ ...p, ruolo: 'Regia' })),
      ...musica.map(p => ({ ...p, ruolo: 'Musica' })),
    ])),
    sezionePiattaforme(o),
    sezioneDettagli(i),
    h('div', { class: 'zona-rimozione' },
      h('button', { type: 'button', class: 'pulsante-testo pericolo', onclick: () => chiediRimozione(o) },
        'Rimuovi dall\'archivio')),
  ];
}

function pannelloAzioni(o) {
  const parti = [];

  // Lo stato occupa un solo spazio: toccandolo si sceglie stato e priorità.
  const descrizione = descrizioneStato(o);
  parti.push(h('button', { type: 'button', class: 'pulsante-stato', onclick: () => apriSceltaStato(o) },
    segnoStato(descrizione),
    h('span', { class: 'pulsante-stato-testo' },
      h('span', { class: 'etichetta-piccola' }, 'Stato'),
      h('span', null, descrizione.testo)),
    h('span', { class: 'cambia' }, 'Cambia')));

  // Pulsante grande: "Segna come visto" finché non l'hai visto, poi "Rivisto".
  if (o.stato === 'da-vedere' || o.stato === 'da-rivedere') {
    parti.push(h('button', {
      type: 'button', class: 'pulsante largo grande',
      onclick: () => {
        archivio.segnaVisto(o.id);
        apriGiudizio(o.id, { titolo: 'Com\'era?', messaggio: `Segnato come visto oggi: «${o.info.titolo}»` });
      },
    }, icona('spunta'), 'Segna come visto'));
  } else if (o.stato === 'visto') {
    const giaOggi = o.visioni.includes(archivio.oggi());
    parti.push(h('button', {
      type: 'button', class: 'pulsante largo grande', disabled: giaOggi,
      onclick: () => {
        archivio.segnaVisto(o.id);
        avviso(`Visione registrata: è la ${archivio.opera(o.id).visioni.length}ª`);
      },
    }, icona(giaOggi ? 'spunta' : 'ripeti'), giaOggi ? 'Rivisto oggi' : 'Rivisto'));
  }

  // Solo l'ultima visione, con il numero totale; "Modifica" le mostra tutte.
  if (o.visioni.length || o.stato === 'visto') {
    const ultima = archivio.ultimaVisione(o);
    const quante = o.visioni.length;
    parti.push(h('div', { class: 'riga-visioni' },
      h('p', { class: 'visioni' }, !ultima ? 'Nessuna data di visione' : [
        quante === 1 ? 'Visto il ' : 'Ultima visione: ', h('strong', null, formattaData(ultima)),
        quante > 1 && h('span', { class: 'contatore' }, `${quante} visioni`),
      ]),
      h('button', { type: 'button', class: 'pulsante-testo cambia', onclick: () => apriDate(o.id) },
        ultima ? 'Modifica' : 'Aggiungi')));
  }

  return h('section', { class: 'pannello-azioni' }, ...parti);
}

// La recensione si legge e basta: per cambiarla si tocca "Modifica"
// (così non si modifica per sbaglio scorrendo la pagina).
function sezioneRecensione(o) {
  const imp = archivio.impostazioni();
  const frase = o.voto ? imp.voti.find(v => v.valore === o.voto)?.frase : null;
  const riconoscimenti = imp.riconoscimenti.filter(r => o.riconoscimenti.includes(r.id));
  const vuota = !o.voto && !riconoscimenti.length && !o.commento;
  const modifica = () => apriGiudizio(o.id);

  return h('section', { class: 'sezione' },
    h('div', { class: 'titolo-sezione' },
      h('h2', null, 'Recensione'),
      !vuota && h('button', { type: 'button', class: 'pulsante-testo cambia', onclick: modifica }, 'Modifica')),
    vuota
      ? h('button', { type: 'button', class: 'pulsante secondario largo', onclick: modifica }, icona('matita'), 'Scrivi la recensione')
      : h('div', { class: 'recensione' },
          o.voto && h('div', { class: 'recensione-voto' },
            h('span', { class: 'stelle grandi', 'aria-label': `${o.voto} stelle su 5` }, '★'.repeat(o.voto) + '☆'.repeat(5 - o.voto)),
            frase && h('span', { class: 'recensione-frase' }, frase)),
          riconoscimenti.length > 0 && h('div', { class: 'pillole' },
            riconoscimenti.map(r => h('span', { class: 'pillola attiva' }, r.nome))),
          o.commento && h('p', { class: 'recensione-commento' }, o.commento)));
}

function sezionePiattaforme(o) {
  const p = archivio.piattaformeVisibili(o);
  const correggi = h('button', { type: 'button', class: 'pulsante-testo cambia correggi', onclick: () => apriPiattaforme(o.id) },
    icona('matita'), 'Correggi');
  if (!p) {
    const messaggio = !haChiave() ? 'Serve la chiave TMDb per sapere dove vederlo.'
      : navigator.onLine === false ? 'Piattaforme non ancora disponibili: sei offline.'
        : 'Sto cercando le piattaforme…';
    return sezione('Dove vederlo', h('p', { class: 'nota' }, messaggio), correggi);
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
    correggi,
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

// ---------------------------------------------------------------- correzione date

function apriDate(id) {
  const date = [...(archivio.opera(id)?.visioni || [])].sort().reverse();
  const oggi = archivio.oggi();
  const elenco = h('div', { class: 'elenco-date' });
  const salva = () => archivio.impostaVisioni(id, date);

  function disegna() {
    elenco.replaceChildren(...date.map((data, i) => h('div', { class: 'riga-data' },
      h('input', {
        type: 'date', class: 'campo', value: data, max: oggi, 'aria-label': 'Data di visione',
        onchange: e => { date[i] = e.target.value; salva(); },
      }),
      h('button', {
        type: 'button', class: 'pulsante-icona', 'aria-label': 'Togli questa data',
        onclick: () => { date.splice(i, 1); salva(); disegna(); },
      }, icona('chiudi')))));
    if (!date.length) elenco.append(h('p', { class: 'nota' }, 'Nessuna data registrata.'));
  }

  function aggiungi() {
    // Prima proposta: oggi. Se oggi c'è già, una riga vuota da compilare.
    date.unshift(date.includes(oggi) ? '' : oggi);
    salva();
    disegna();
    const primo = elenco.querySelector('input');
    if (primo && !primo.value) {
      primo.focus();
      try { primo.showPicker?.(); } catch { /* non tutti i browser lo permettono */ }
    }
  }

  disegna();
  const foglio = apriFoglio(h('div', { class: 'foglio-date' },
    h('h2', null, 'Date di visione'),
    h('p', { class: 'nota' }, 'Tocca una data per correggerla.'),
    elenco,
    h('div', { class: 'azioni due' },
      h('button', { type: 'button', class: 'pulsante secondario', onclick: aggiungi }, icona('aggiungi'), 'Aggiungi'),
      h('button', { type: 'button', class: 'pulsante', onclick: () => foglio.chiudi() }, 'Fatto'))));
}

// ---------------------------------------------------------------- correzione piattaforme

const CATEGORIE = ['abbonamento', 'gratis', 'noleggio', 'acquisto'];

function apriPiattaforme(id) {
  const attuali = h('div', { class: 'elenco-piattaforme' });
  const catalogo = h('div', { class: 'elenco-piattaforme' });
  const stato = h('p', { class: 'nota' }, 'Carico l\'elenco delle piattaforme…');
  let tutte = null;
  let filtro = '';

  const campo = h('input', {
    type: 'search', class: 'campo', placeholder: 'Cerca una piattaforma', 'aria-label': 'Cerca una piattaforma',
    autocomplete: 'off', autocorrect: 'off', autocapitalize: 'off', spellcheck: 'false',
    oninput: () => { filtro = normalizza(campo.value.trim()); disegnaCatalogo(); },
  });

  function riga(p, dettaglio, pulsante, spenta = false) {
    return h('div', { class: 'riga-piattaforma' + (spenta ? ' spenta' : '') },
      logoPiattaforma(p),
      h('span', { class: 'riga-piattaforma-nome' }, h('span', null, p.nome), dettaglio && h('small', null, dettaglio)),
      pulsante);
  }
  const pulsantino = (testo, azione) =>
    h('button', { type: 'button', class: 'pulsante secondario piccolo', onclick: azione }, testo);

  // Piattaforme trovate in automatico (si possono nascondere) e quelle aggiunte da te.
  function disegnaAttuali() {
    const o = archivio.opera(id);
    if (!o) return;
    const { auto, aggiunte, nascoste } = o.piattaforme;
    const trovate = new Map();
    for (const categoria of CATEGORIE) {
      for (const p of auto?.[categoria] || []) {
        if (!trovate.has(p.id)) trovate.set(p.id, { ...p, categorie: [] });
        trovate.get(p.id).categorie.push(categoria);
      }
    }
    const righe = [
      ...[...trovate.values()].map(p => {
        const nascosta = nascoste.includes(p.id);
        return riga(p, p.categorie.join(', ') + (nascosta ? ' · nascosta' : ''),
          pulsantino(nascosta ? 'Mostra' : 'Nascondi', () => { archivio.nascondiPiattaforma(id, p.id, !nascosta); aggiorna(); }),
          nascosta);
      }),
      ...aggiunte.filter(p => !trovate.has(p.id)).map(p => riga(p, 'aggiunta da te',
        pulsantino('Togli', () => { archivio.togliPiattaformaAggiunta(id, p.id); aggiorna(); }))),
    ];
    attuali.replaceChildren(...(righe.length ? righe : [h('p', { class: 'nota' }, 'Nessuna piattaforma per ora.')]));
  }

  function disegnaCatalogo() {
    if (!tutte) return;
    const o = archivio.opera(id);
    const presenti = new Set([
      ...CATEGORIE.flatMap(categoria => (o.piattaforme.auto?.[categoria] || []).map(p => p.id)),
      ...o.piattaforme.aggiunte.map(p => p.id),
    ]);
    const scelte = tutte.filter(p => !presenti.has(p.id) && (!filtro || normalizza(p.nome).includes(filtro)));
    catalogo.replaceChildren(...scelte.slice(0, filtro ? 30 : 12).map(p => riga(p, null,
      pulsantino('Aggiungi', () => {
        archivio.aggiungiPiattaforma(id, p);
        aggiorna(); // la piattaforma compare subito nell'elenco "Su questo film"
      }))));
    if (!scelte.length) catalogo.append(h('p', { class: 'nota' }, 'Nessuna piattaforma trovata.'));
  }

  function aggiorna() { disegnaAttuali(); disegnaCatalogo(); }

  disegnaAttuali();
  elencoPiattaforme()
    .then(elenco => { tutte = elenco; stato.hidden = true; disegnaCatalogo(); })
    .catch(errore => { stato.className = 'nota errore'; stato.textContent = errore.message; });

  const foglio = apriFoglio(h('div', { class: 'foglio-piattaforme' },
    h('h2', null, 'Correggi le piattaforme'),
    h('p', { class: 'nota' }, 'Le tue correzioni restano anche quando i dati vengono aggiornati.'),
    h('div', { class: 'etichetta' }, 'Su questo film'),
    attuali,
    h('div', { class: 'etichetta' }, 'Aggiungi un abbonamento'),
    campo,
    stato,
    catalogo,
    h('button', { type: 'button', class: 'pulsante largo', onclick: () => foglio.chiudi() }, 'Fatto')));
}
