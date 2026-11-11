// Pezzi di interfaccia specifici di PonciFilm, usati da più schermate.

import { h, icona, stelle, apriFoglio, avviso } from './ui.js';
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

// Come descrivere a parole lo stato di un film: "Da vedere · Day one", "Visto", ...
export function descrizioneStato(o) {
  const p = datiPriorita(archivio.prioritaDi(o));
  switch (o.stato) {
    case 'da-vedere': return { testo: `Da vedere · ${p.nome}`, colore: p.colore };
    case 'da-rivedere': return { testo: `Da rivedere · ${p.nome}`, colore: p.colore };
    case 'abbandonato': return { testo: 'Abbandonato', icona: 'chiudi' };
    default: return { testo: nomeStato(o.stato), icona: 'spunta' };
  }
}

export function segnoStato(descrizione) {
  return descrizione.colore
    ? h('span', { class: 'pallino', style: { background: descrizione.colore } })
    : icona(descrizione.icona);
}

export function logoPiattaforma(p, { conNome = false } = {}) {
  const logo = p.logo
    ? h('img', { class: 'logo', src: immagine(p.logo, 'w92'), alt: conNome ? '' : p.nome, title: p.nome, loading: 'lazy' })
    : h('span', { class: 'logo logo-testo', title: p.nome }, p.nome.slice(0, 2));
  return conNome ? h('span', { class: 'piattaforma' }, logo, h('span', null, p.nome)) : logo;
}

// I tre pulsanti delle priorità (Day one / Il prima possibile / Prima o poi).
export function pulsantiPriorita(attiva, scegli) {
  return h('div', { class: 'priorita-scelta' }, archivio.impostazioni().priorita.map(p =>
    h('button', {
      type: 'button',
      class: 'opzione' + (p.id === attiva ? ' attiva' : ''),
      'aria-pressed': String(p.id === attiva),
      onclick: () => scegli(p.id),
    }, h('span', { class: 'pallino', style: { background: p.colore } }), h('span', null, p.nome))));
}

// Pannello per cambiare stato e priorità con un solo tocco.
export function apriSceltaStato(o) {
  const prioritaAttuale = archivio.prioritaDi(o);
  let foglio = null;

  function scegli(stato, priorita = null) {
    archivio.impostaStato(o.id, stato, priorita);
    foglio.chiudi();
    avviso(descrizioneStato(o).testo);
  }

  const opzioneSemplice = (stato, nomeIcona, testo) => h('button', {
    type: 'button',
    class: 'opzione riga' + (o.stato === stato ? ' attiva' : ''),
    'aria-pressed': String(o.stato === stato),
    onclick: () => scegli(stato),
  }, icona(nomeIcona), testo);

  foglio = apriFoglio(h('div', { class: 'scelta-stato' },
    h('h2', null, o.info.titolo),
    h('div', { class: 'etichetta' }, 'Da vedere'),
    pulsantiPriorita(o.stato === 'da-vedere' ? prioritaAttuale : null, p => scegli('da-vedere', p)),
    h('div', { class: 'etichetta' }, 'Da rivedere'),
    pulsantiPriorita(o.stato === 'da-rivedere' ? prioritaAttuale : null, p => scegli('da-rivedere', p)),
    h('div', { class: 'etichetta' }, 'Altro'),
    h('div', { class: 'azioni due' },
      opzioneSemplice('visto', 'spunta', 'Visto'),
      opzioneSemplice('abbandonato', 'chiudi', 'Abbandonato')),
  ));
}

// Il tuo giudizio su un film: stelle con la frase, riconoscimenti, commento.
// Ogni tocco viene salvato subito; il commento mentre scrivi (e quando chiudi).
// Restituisce { el, salva }: "salva" registra il commento ancora in sospeso.
export function editorGiudizio(id) {
  const imp = archivio.impostazioni();
  const attuale = () => archivio.opera(id);

  const frase = h('p', { class: 'frase-voto', 'aria-live': 'polite' });
  const bottoniStelle = imp.voti.map(v => h('button', {
    type: 'button', class: 'stella', 'aria-label': `${v.valore} su 5: ${v.frase}`,
    onclick: () => {
      // Toccare di nuovo la stella già scelta toglie il voto.
      archivio.modifica(id, { voto: attuale()?.voto === v.valore ? null : v.valore });
      aggiornaStelle();
    },
  }, '★'));
  function aggiornaStelle() {
    const voto = attuale()?.voto || 0;
    bottoniStelle.forEach((b, i) => {
      b.classList.toggle('piena', i < voto);
      b.setAttribute('aria-pressed', String(i + 1 === voto));
    });
    frase.textContent = voto ? imp.voti.find(v => v.valore === voto)?.frase ?? '' : 'Tocca le stelle per dare un voto';
    frase.classList.toggle('vuota', !voto);
  }

  const pillole = imp.riconoscimenti.map(r => h('button', {
    type: 'button', class: 'pillola', 'data-id': r.id,
    onclick: () => { archivio.alternaRiconoscimento(id, r.id); aggiornaPillole(); },
  }, r.nome));
  function aggiornaPillole() {
    const scelti = attuale()?.riconoscimenti || [];
    for (const b of pillole) {
      const acceso = scelti.includes(b.dataset.id);
      b.classList.toggle('attiva', acceso);
      b.setAttribute('aria-pressed', String(acceso));
    }
  }

  // Salva solo se hai scritto qui: così due riquadri aperti sullo stesso film
  // (scheda e pannello "Com'era?") non si cancellano il commento a vicenda.
  let timer = null;
  let scritto = false;
  const commento = h('textarea', {
    class: 'campo commento', rows: '3', placeholder: 'Un commento, se ti va…', 'aria-label': 'Commento',
    oninput: () => { scritto = true; clearTimeout(timer); timer = setTimeout(salva, 600); },
    onblur: () => salva(),
  });
  commento.value = attuale()?.commento || '';
  function salva() {
    clearTimeout(timer);
    if (!scritto) return;
    scritto = false;
    const testo = commento.value.trim();
    if (attuale() && testo !== (attuale().commento || '')) archivio.modifica(id, { commento: testo });
  }

  aggiornaStelle();
  aggiornaPillole();
  const el = h('div', { class: 'giudizio' },
    h('div', { class: 'stelle-voto', role: 'group', 'aria-label': 'Voto' }, bottoniStelle),
    frase,
    h('div', { class: 'etichetta' }, 'Riconoscimenti'),
    h('div', { class: 'pillole' }, pillole),
    h('div', { class: 'etichetta' }, 'Commento'),
    commento);
  return { el, salva };
}

// Pannello "Com'era?" che compare appena segni un film come visto.
export function apriGiudizio(id, { messaggio = null } = {}) {
  const o = archivio.opera(id);
  if (!o) return;
  const editor = editorGiudizio(id);
  const foglio = apriFoglio(h('div', { class: 'foglio-giudizio' },
    h('h2', null, 'Com\'era?'),
    h('p', { class: 'nota' }, messaggio || o.info.titolo),
    editor.el,
    h('button', { type: 'button', class: 'pulsante largo', onclick: () => foglio.chiudi() }, 'Fatto')),
  { alChiudere: editor.salva });
}

// Card a locandina per le griglie.
export function cardFilm(o, { mostraPriorita = false, mostraPiattaforme = false, mostraStato = false } = {}) {
  const i = o.info;
  const priorita = mostraPriorita ? datiPriorita(archivio.prioritaDi(o)) : null;
  const piattaforme = mostraPiattaforme ? archivio.piattaformeVisibili(o)?.abbonamento ?? [] : [];
  const sotto = [i.anno, mostraStato ? nomeStato(o.stato) : null].filter(Boolean).join(' · ');

  return h('a', { class: 'card', href: `#/film/${o.id}` },
    h('div', { class: 'card-locandina' },
      locandina(i.locandina, 'w342', i.titolo),
      priorita && h('span', { class: 'pallino-card', style: { background: priorita.colore }, title: priorita.nome }),
      o.stato === 'da-rivedere' && h('span', { class: 'badge-rivedere', title: 'Da rivedere' }, icona('ripeti')),
      piattaforme.length > 0 && h('div', { class: 'card-loghi' }, piattaforme.slice(0, 3).map(p => logoPiattaforma(p))),
    ),
    h('div', { class: 'card-titolo' }, i.titolo),
    h('div', { class: 'card-sotto' }, sotto, o.voto ? stelle(o.voto, 'stelle piccole') : null),
  );
}

export function griglia(elenco, opzioni) {
  return h('div', { class: 'griglia' }, elenco.map(o => cardFilm(o, opzioni)));
}

// Intestazione delle pagine: titolo + (a destra) impostazioni, oppure "indietro" a sinistra.
// indietro: un indirizzo fisso ('#/impostazioni') oppure true = torna alla pagina precedente.
export function intestazione(titolo, { indietro = null, impostazioni = false } = {}) {
  const tornaIndietro = () => (history.length > 1 ? history.back() : location.replace('#/'));
  return h('header', { class: 'intestazione' },
    typeof indietro === 'string' && h('a', { class: 'pulsante-icona', href: indietro, 'aria-label': 'Indietro' }, icona('indietro')),
    indietro === true && h('button', { type: 'button', class: 'pulsante-icona', 'aria-label': 'Indietro', onclick: tornaIndietro }, icona('indietro')),
    h('h1', null, titolo),
    impostazioni && h('a', { class: 'pulsante-icona', href: '#/impostazioni', 'aria-label': 'Impostazioni' }, icona('impostazioni')));
}
