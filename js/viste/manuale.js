// Inserire a mano un film che TMDb non conosce (#/nuovo), o correggerne uno
// inserito a mano in precedenza (#/film/<id>/modifica).
// Solo il titolo è obbligatorio. La locandina si sceglie dalle foto del telefono:
// viene ritagliata in formato locandina e rimpicciolita, poi salvata nell'archivio.

import { h, icona, avviso } from '../ui.js';
import { intestazione, locandina, pulsantiPriorita, apriGiudizio, datiPriorita } from '../componenti.js';
import * as archivio from '../archivio.js';
import { ultimaRicerca } from './aggiungi.js';

const LARGHEZZA = 360;
const ALTEZZA = 540; // proporzioni di una locandina (2:3)

export function vistaFilmManuale(id = null) {
  const esistente = id ? archivio.opera(id) : null;
  if (id && !esistente?.manuale) {
    return { el: h('section', { class: 'vista' }, intestazione('Modifica film', { indietro: true }),
      h('p', { class: 'nota' }, 'Si possono modificare solo i film inseriti a mano.')) };
  }

  const info = esistente?.info ?? {};
  const nomi = elenco => (elenco || []).map(p => p.nome).join(', ');
  let copertina = info.locandina || null;
  let stato = 'da-vedere';
  let priorita = archivio.impostazioni().prioritaPredefinita;

  const campo = (etichetta, valore, attributi = {}) => {
    const input = h(attributi.multilinea ? 'textarea' : 'input', {
      class: 'campo' + (attributi.multilinea ? ' commento' : ''), value: valore ?? '', 'aria-label': etichetta,
      autocomplete: 'off', ...attributi, multilinea: null,
    });
    if (attributi.multilinea) input.value = valore ?? '';
    return { input, el: h('label', { class: 'campo-etichettato' }, h('span', { class: 'etichetta' }, etichetta), input) };
  };

  const titolo = campo('Titolo *', info.titolo ?? (id ? '' : ultimaRicerca()), { enterkeyhint: 'next' });
  const originale = campo('Titolo originale', info.titoloOriginale);
  const anno = campo('Anno', info.anno, { inputmode: 'numeric', maxlength: '4', placeholder: 'es. 1998' });
  const regia = campo('Regia', nomi(info.regia), { placeholder: 'Nomi separati da virgola' });
  const cast = campo('Attori principali', nomi(info.cast), { placeholder: 'Nomi separati da virgola' });
  const musica = campo('Musica', nomi(info.musica), { placeholder: 'Compositore' });
  const generi = campo('Generi', (info.generi || []).join(', '), { placeholder: 'es. Dramma, Commedia' });
  const durata = campo('Durata (minuti)', info.durata, { inputmode: 'numeric', maxlength: '3' });
  const trama = campo('Trama', info.trama, { multilinea: true, rows: '5' });

  // ---- locandina
  const sceltaFile = h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: caricaFoto });
  const riquadro = h('button', { type: 'button', class: 'scegli-locandina', onclick: () => sceltaFile.click() });
  const togliFoto = h('button', {
    type: 'button', class: 'pulsante-testo pericolo togli-locandina',
    onclick: () => { copertina = null; disegnaLocandina(); },
  }, 'Togli');

  function disegnaLocandina() {
    riquadro.replaceChildren(copertina
      ? locandina(copertina)
      : h('span', { class: 'invito-locandina' }, icona('foto'), 'Locandina'));
    riquadro.setAttribute('aria-label', copertina ? 'Cambia la locandina' : 'Scegli una locandina dalle foto');
    togliFoto.hidden = !copertina;
  }

  async function caricaFoto() {
    const file = sceltaFile.files?.[0];
    sceltaFile.value = '';
    if (!file) return;
    try {
      copertina = await riduciImmagine(file);
      disegnaLocandina();
    } catch (errore) {
      avviso(errore.message);
    }
  }
  disegnaLocandina();

  // ---- dove metterlo (solo per un film nuovo)
  const zonaStato = h('div', { class: 'zona-stato-manuale' });
  function disegnaStato() {
    const segmento = (valore, testo) => h('button', {
      type: 'button', class: stato === valore ? 'attivo' : '', 'aria-pressed': String(stato === valore),
      onclick: () => { stato = valore; disegnaStato(); },
    }, testo);
    zonaStato.replaceChildren(...[
      h('span', { class: 'etichetta' }, 'Dove lo metto?'),
      h('div', { class: 'segmenti larghi' }, segmento('da-vedere', 'Da vedere'), segmento('visto', 'L\'ho già visto')),
      stato === 'da-vedere' && h('div', { class: 'zona-priorita' },
        pulsantiPriorita(priorita, p => { priorita = p; disegnaStato(); })),
    ].filter(Boolean));
  }
  if (!esistente) disegnaStato();

  // ---- salvataggio
  const errore = h('p', { class: 'nota errore', 'aria-live': 'polite' });

  function dati() {
    return {
      titolo: titolo.input.value, titoloOriginale: originale.input.value, anno: anno.input.value,
      regia: regia.input.value, cast: cast.input.value, musica: musica.input.value,
      generi: generi.input.value, durata: durata.input.value, trama: trama.input.value, locandina: copertina,
    };
  }

  function salva() {
    const d = dati();
    if (!d.titolo.trim()) {
      errore.textContent = 'Scrivi almeno il titolo.';
      titolo.input.focus();
      return;
    }
    if (d.anno.trim() && !/^\d{4}$/.test(d.anno.trim())) {
      errore.textContent = 'L\'anno va scritto con 4 cifre (es. 1998).';
      anno.input.focus();
      return;
    }
    if (esistente) {
      archivio.modificaFilmManuale(esistente.id, d);
      avviso('Dati del film aggiornati');
      location.replace(`#/film/${esistente.id}`);
      return;
    }
    const o = archivio.aggiungiFilmManuale(d, stato, stato === 'da-vedere' ? priorita : null);
    location.replace(`#/film/${o.id}`);
    if (stato === 'visto') {
      setTimeout(() => apriGiudizio(o.id, { titolo: 'Com\'era?', messaggio: `«${o.info.titolo}» aggiunto ai visti` }), 50);
    } else {
      avviso(`«${o.info.titolo}» da vedere · ${datiPriorita(priorita)?.nome}`);
    }
  }

  const el = h('section', { class: 'vista manuale' },
    intestazione(esistente ? 'Modifica film' : 'Film a mano', { indietro: true }),
    !esistente && h('p', { class: 'nota' }, 'Per i film che TMDb non conosce: scrivi tu i dati. Solo il titolo è obbligatorio.'),
    h('div', { class: 'manuale-testa' },
      h('div', { class: 'manuale-locandina' }, riquadro, togliFoto, sceltaFile),
      h('div', { class: 'manuale-titoli' }, titolo.el, originale.el, anno.el)),
    regia.el, cast.el, musica.el, generi.el, durata.el, trama.el,
    !esistente && zonaStato,
    errore,
    h('button', { type: 'button', class: 'pulsante largo grande', onclick: salva },
      esistente ? 'Salva le modifiche' : 'Aggiungi il film'));

  return { el };
}

// Ritaglia la foto al centro in formato locandina e la rimpicciolisce (circa 50 KB).
async function riduciImmagine(file) {
  const indirizzo = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, ko) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => ko(new Error('Non riesco a leggere questa immagine.'));
      i.src = indirizzo;
    });
    const tela = document.createElement('canvas');
    tela.width = LARGHEZZA;
    tela.height = ALTEZZA;
    const scala = Math.max(LARGHEZZA / img.naturalWidth, ALTEZZA / img.naturalHeight);
    const w = img.naturalWidth * scala;
    const a = img.naturalHeight * scala;
    tela.getContext('2d').drawImage(img, (LARGHEZZA - w) / 2, (ALTEZZA - a) / 2, w, a);
    return tela.toDataURL('image/jpeg', 0.8);
  } finally {
    URL.revokeObjectURL(indirizzo);
  }
}
