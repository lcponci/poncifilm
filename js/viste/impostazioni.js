// Impostazioni: chiave TMDb, copia dei dati, informazioni sull'app.

import { h, avviso } from '../ui.js';
import * as archivio from '../archivio.js';
import { chiaveAttuale, impostaChiave, verificaChiave } from '../tmdb.js';
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

  const el = h('section', { class: 'vista impostazioni' },
    h('header', { class: 'intestazione' }, h('h1', null, 'Impostazioni')),

    h('section', { class: 'scheda-info' },
      h('h2', null, 'Chiave TMDb'),
      h('p', { class: 'nota' }, 'Serve per cercare i film e scaricarne le informazioni. È gratuita:'),
      h('ol', { class: 'passi' },
        h('li', null, 'Crea un account su ', h('a', { href: 'https://www.themoviedb.org/signup', target: '_blank', rel: 'noopener' }, 'themoviedb.org'), '.'),
        h('li', null, 'Apri ', h('a', { href: 'https://www.themoviedb.org/settings/api', target: '_blank', rel: 'noopener' }, 'Impostazioni → API'), ' e richiedi una chiave per uso personale.'),
        h('li', null, 'Copia la «Chiave API» (oppure il «Token di accesso in lettura») e incollala qui sotto.')),
      campoChiave,
      h('button', { type: 'button', class: 'pulsante largo', onclick: salvaChiave }, 'Salva e verifica'),
      esito),

    h('section', { class: 'scheda-info' },
      h('h2', null, 'I tuoi dati'),
      h('p', null, numero === 1 ? 'Nel tuo archivio c\'è 1 film.' : `Nel tuo archivio ci sono ${numero} film.`),
      h('p', { class: 'nota' }, 'Per ora i dati sono salvati solo su questo dispositivo. La sincronizzazione con OneDrive arriverà in una delle prossime versioni.'),
      h('button', { type: 'button', class: 'pulsante secondario largo', onclick: esportaJson }, 'Scarica una copia dei dati')),

    h('section', { class: 'scheda-info' },
      h('h2', null, 'Informazioni'),
      h('p', { class: 'nota' }, `PonciFilm, versione ${VERSIONE_APP}.`),
      h('p', { class: 'nota' }, 'Questo prodotto usa l\'API di ',
        h('a', { href: 'https://www.themoviedb.org', target: '_blank', rel: 'noopener' }, 'TMDb'),
        ' ma non è approvato né certificato da TMDb. Le piattaforme di streaming sono fornite da ',
        h('a', { href: 'https://www.justwatch.com', target: '_blank', rel: 'noopener' }, 'JustWatch'), '.')),
  );

  return { el };
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
