// Impostazioni: riconoscimenti, copia dei dati, chiave TMDb, informazioni sull'app.

import { h, icona, avviso, apriFoglio } from '../ui.js';
import { intestazione } from '../componenti.js';
import * as archivio from '../archivio.js';
import { chiaveAttuale, impostaChiave, verificaChiave, haChiave } from '../tmdb.js';
import { completaInSospeso } from '../servizi.js';
import { VERSIONE_APP } from '../versione.js';

export function vistaImpostazioni() {
  const campoChiave = h('input', {
    type: 'text', class: 'campo', value: chiaveAttuale(), placeholder: 'Incolla qui la chiave',
    autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false',
    'aria-label': 'Chiave TMDb',
  });
  const esito = h('p', { class: 'nota', 'aria-live': 'polite' });

  async function salvaChiave() {
    const nuova = campoChiave.value.trim();
    esito.className = 'nota';
    if (!nuova) {
      impostaChiave('');
      esito.textContent = 'Chiave rimossa.';
      return;
    }
    esito.textContent = 'Verifico la chiave…';
    try {
      await verificaChiave(nuova);
      impostaChiave(nuova);
      esito.textContent = '✓ Chiave valida e salvata.';
      avviso('Chiave TMDb salvata');
      completaInSospeso();
    } catch (errore) {
      esito.className = 'nota errore';
      esito.textContent = errore.message;
    }
  }

  const numero = archivio.opere().length;
  const abbandonati = archivio.opere().filter(o => o.stato === 'abbandonato').length;

  const schedaChiave = h('section', { class: 'scheda-info' },
      h('h2', null, 'Chiave TMDb'),
      h('p', { class: 'nota' }, 'Serve per cercare i film e scaricarne le informazioni. È gratuita:'),
      h('ol', { class: 'passi' },
        h('li', null, 'Crea un account su ', h('a', { href: 'https://www.themoviedb.org/signup', target: '_blank', rel: 'noopener' }, 'themoviedb.org'), '.'),
        h('li', null, 'Apri ', h('a', { href: 'https://www.themoviedb.org/settings/api', target: '_blank', rel: 'noopener' }, 'Impostazioni → API'), ' e richiedi una chiave per uso personale.'),
        h('li', null, 'Copia la «Chiave API» (oppure il «Token di accesso in lettura») e incollala qui sotto.')),
      campoChiave,
      h('button', { type: 'button', class: 'pulsante largo', onclick: salvaChiave }, 'Salva e verifica'),
      esito);

  const schedaDati = h('section', { class: 'scheda-info' },
      h('h2', null, 'I tuoi dati'),
      h('p', null, numero === 1 ? 'Nel tuo archivio c\'è 1 film.' : `Nel tuo archivio ci sono ${numero} film.`),
      h('p', { class: 'nota' }, 'Per ora i dati sono salvati solo su questo dispositivo. La sincronizzazione online (con salvataggio di ogni versione) arriverà in una delle prossime versioni.'),
      h('button', { type: 'button', class: 'pulsante secondario largo', onclick: esportaJson }, 'Scarica una copia dei dati'),
      h('a', { class: 'riga-link', href: '#/abbandonati' },
        h('span', null, 'Film abbandonati'),
        h('span', { class: 'riga-link-valore' }, String(abbandonati), icona('indietro', 'icona freccia'))));

  const schedaInformazioni = h('section', { class: 'scheda-info' },
      h('h2', null, 'Informazioni'),
      h('p', { class: 'nota' }, `PonciFilm, versione ${VERSIONE_APP}.`),
      h('p', { class: 'nota' }, 'Questo prodotto usa l\'API di ',
        h('a', { href: 'https://www.themoviedb.org', target: '_blank', rel: 'noopener' }, 'TMDb'),
        ' ma non è approvato né certificato da TMDb. Le piattaforme di streaming sono fornite da ',
        h('a', { href: 'https://www.justwatch.com', target: '_blank', rel: 'noopener' }, 'JustWatch'), '.'));

  // Finché manca la chiave TMDb è la cosa più importante; dopo scende in basso.
  const schede = haChiave()
    ? [schedaRiconoscimenti(), schedaDati, schedaChiave, schedaInformazioni]
    : [schedaChiave, schedaRiconoscimenti(), schedaDati, schedaInformazioni];
  const el = h('section', { class: 'vista impostazioni' }, intestazione('Impostazioni', { indietro: true }), schede);

  return { el };
}

// ---------------------------------------------------------------- riconoscimenti

function schedaRiconoscimenti() {
  const pillole = h('div', { class: 'pillole' });
  const esito = h('p', { class: 'nota', 'aria-live': 'polite' });
  const campo = h('input', {
    type: 'text', class: 'campo', placeholder: 'Nuovo riconoscimento', 'aria-label': 'Nuovo riconoscimento',
    autocomplete: 'off', enterkeyhint: 'done',
    onkeydown: e => { if (e.key === 'Enter') { e.preventDefault(); aggiungi(); } },
  });

  function disegna() {
    pillole.replaceChildren(...archivio.impostazioni().riconoscimenti.map(r => {
      const quanti = archivio.filmConRiconoscimento(r.id).length;
      return h('button', { type: 'button', class: 'pillola', onclick: () => modificaRiconoscimento(r, disegna) },
        r.nome, quanti > 0 && h('span', { class: 'quanti' }, String(quanti)));
    }));
  }

  function aggiungi() {
    const errore = archivio.aggiungiRiconoscimento(campo.value);
    esito.className = errore ? 'nota errore' : 'nota';
    esito.textContent = errore || '';
    if (errore) return;
    avviso(`«${campo.value.trim()}» aggiunto`);
    campo.value = '';
    disegna();
  }

  disegna();
  return h('section', { class: 'scheda-info' },
    h('h2', null, 'Riconoscimenti'),
    h('p', { class: 'nota' }, 'Tocca un riconoscimento per rinominarlo o eliminarlo. Il numero indica in quanti film lo hai usato.'),
    pillole,
    h('div', { class: 'riga-aggiungi' },
      campo,
      h('button', { type: 'button', class: 'pulsante', onclick: aggiungi }, 'Aggiungi')),
    esito);
}

function modificaRiconoscimento(r, dopo) {
  const quanti = archivio.filmConRiconoscimento(r.id).length;
  const esito = h('p', { class: 'nota errore', 'aria-live': 'polite' });
  const campo = h('input', {
    type: 'text', class: 'campo', value: r.nome, 'aria-label': 'Nome del riconoscimento', autocomplete: 'off',
    enterkeyhint: 'done', onkeydown: e => { if (e.key === 'Enter') { e.preventDefault(); salva(); } },
  });

  function salva() {
    const errore = archivio.rinominaRiconoscimento(r.id, campo.value);
    if (errore) { esito.textContent = errore; return; }
    foglio.chiudi();
    dopo();
  }

  function elimina() {
    const domanda = quanti
      ? `Eliminare «${r.nome}»? Verrà tolto anche da ${quanti === 1 ? '1 film' : `${quanti} film`}.`
      : `Eliminare «${r.nome}»?`;
    if (!confirm(domanda)) return;
    archivio.eliminaRiconoscimento(r.id);
    foglio.chiudi();
    avviso(`«${r.nome}» eliminato`);
    dopo();
  }

  const foglio = apriFoglio(h('div', { class: 'foglio-riconoscimento' },
    h('h2', null, 'Riconoscimento'),
    h('p', { class: 'nota' }, quanti
      ? `Usato in ${quanti === 1 ? '1 film' : `${quanti} film`}. Se lo rinomini, resta su tutti.`
      : 'Non è ancora usato in nessun film.'),
    campo,
    esito,
    h('div', { class: 'azioni due' },
      h('button', { type: 'button', class: 'pulsante secondario pericolo', onclick: elimina }, 'Elimina'),
      h('button', { type: 'button', class: 'pulsante', onclick: salva }, 'Salva'))));
}

// Scarica l'intero archivio in un file JSON (sull'iPhone apre il menu "Condividi").
async function esportaJson() {
  const nome = `poncifilm-${archivio.oggi()}.json`;
  const file = new File([JSON.stringify(archivio.archivioCorrente(), null, 2)], nome, { type: 'application/json' });
  const suIphone = navigator.standalone !== undefined;
  if (suIphone && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: nome });
      return;
    } catch (errore) {
      if (errore.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(file);
  const link = h('a', { href: url, download: nome });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
