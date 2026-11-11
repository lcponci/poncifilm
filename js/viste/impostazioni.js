// Impostazioni: salvataggio online, riconoscimenti, copie dei dati, chiave TMDb, informazioni.

import { h, icona, avviso, apriFoglio, formattaData } from '../ui.js';
import { intestazione } from '../componenti.js';
import * as archivio from '../archivio.js';
import { chiaveAttuale, impostaChiave, verificaChiave, haChiave } from '../tmdb.js';
import { completaInSospeso } from '../servizi.js';
import * as sincro from '../sincronizzazione.js';
import { esportaJson, esportaCsv } from '../esporta.js';
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
      h('p', { class: 'nota' }, 'Puoi scaricare una copia in qualsiasi momento: completa, con tutti i dettagli (JSON), oppure come tabella da aprire con Excel (CSV).'),
      h('div', { class: 'azioni due' },
        h('button', { type: 'button', class: 'pulsante secondario', onclick: esportaJson }, 'Copia completa'),
        h('button', { type: 'button', class: 'pulsante secondario', onclick: esportaCsv }, 'Tabella Excel')),
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
  // Il salvataggio online sta in alto finché non è collegato.
  const salvataggio = schedaSalvataggio();
  const schede = !haChiave()
    ? [schedaChiave, salvataggio.el, schedaRiconoscimenti(), schedaDati, schedaInformazioni]
    : sincro.configurata()
      ? [schedaRiconoscimenti(), salvataggio.el, schedaDati, schedaChiave, schedaInformazioni]
      : [salvataggio.el, schedaRiconoscimenti(), schedaDati, schedaChiave, schedaInformazioni];
  const el = h('section', { class: 'vista impostazioni' }, intestazione('Impostazioni', { indietro: true }), schede);

  return { el, smonta: salvataggio.smonta };
}

// ---------------------------------------------------------------- salvataggio online

const LINK_NUOVO_REPO = 'https://github.com/new';
const LINK_NUOVO_TOKEN = 'https://github.com/settings/personal-access-tokens/new';

function descriviStato(st) {
  if (st.fase === 'in-corso') return { testo: 'Salvataggio in corso…' };
  if (st.fase === 'in-attesa') return { testo: 'Modifiche in attesa: le salvo tra pochi secondi.' };
  if (st.fase === 'offline') return { testo: 'Sei offline: salverò appena torna la connessione.' };
  if (st.fase === 'errore') return { testo: st.errore, errore: true };
  if (st.ultima) {
    const quando = new Date(st.ultima);
    const ora = quando.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    const giorno = quando.toDateString() === new Date().toDateString() ? 'oggi' : `il ${formattaData(st.ultima)}`;
    return { testo: `✓ Tutto salvato · ultimo controllo ${giorno} alle ${ora}` };
  }
  return { testo: 'Non ancora sincronizzato.' };
}

function schedaSalvataggio() {
  const scheda = h('section', { class: 'scheda-info' });
  let stacca = null;

  function disegna() {
    stacca?.();
    stacca = null;
    if (sincro.configurata()) disegnaCollegato();
    else disegnaDaCollegare();
  }

  function disegnaCollegato() {
    const stato = h('p', { class: 'nota', 'aria-live': 'polite' });
    const aggiorna = st => {
      const d = descriviStato(st);
      stato.className = d.errore ? 'nota errore' : 'nota';
      stato.textContent = d.testo;
    };
    aggiorna(sincro.statoAttuale());
    stacca = sincro.ascoltaStato(aggiorna);

    scheda.replaceChildren(
      h('h2', null, 'Salvataggio online'),
      h('p', null, 'Collegato a ', h('strong', null, sincro.repositoryCollegato()), ' (privato).'),
      stato,
      h('button', { type: 'button', class: 'pulsante largo', onclick: () => sincro.sincronizza() }, icona('ripeti'), 'Sincronizza ora'),
      h('a', { class: 'riga-link', href: sincro.indirizzoVersioni(), target: '_blank', rel: 'noopener' },
        h('span', null, 'Versioni salvate su GitHub'),
        h('span', { class: 'riga-link-valore' }, icona('indietro', 'icona freccia'))),
      h('button', {
        type: 'button', class: 'pulsante-testo pericolo scollega',
        onclick: () => {
          if (!confirm('Scollegare questo dispositivo dal salvataggio online? I dati restano qui e su GitHub; per ricollegarlo servirà di nuovo il token.')) return;
          sincro.scollega();
          avviso('Dispositivo scollegato');
          disegna();
        },
      }, 'Scollega questo dispositivo'));
  }

  function disegnaDaCollegare() {
    const campoRepo = h('input', {
      type: 'text', class: 'campo', placeholder: 'utente/nome, es. lcponci/poncifilm-dati', 'aria-label': 'Repository GitHub',
      autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false',
    });
    const campoToken = h('input', {
      type: 'password', class: 'campo', placeholder: 'github_pat_…', 'aria-label': 'Token GitHub',
      autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false',
    });
    const esito = h('p', { class: 'nota', 'aria-live': 'polite' });
    const pulsante = h('button', { type: 'button', class: 'pulsante largo', onclick: collega }, 'Collega');

    async function collega() {
      esito.className = 'nota';
      esito.textContent = 'Controllo il collegamento e unisco i dati…';
      pulsante.disabled = true;
      try {
        await sincro.collega(campoRepo.value, campoToken.value);
        avviso('Salvataggio online attivo');
        disegna();
      } catch (errore) {
        esito.className = 'nota errore';
        esito.textContent = errore.message;
        if (sincro.configurata()) disegna(); // collegato, ma il primo salvataggio non è riuscito
      } finally {
        pulsante.disabled = false;
      }
    }

    const link = (href, testo) => h('a', { href, target: '_blank', rel: 'noopener' }, testo);
    scheda.replaceChildren(
      h('h2', null, 'Salvataggio online'),
      h('p', { class: 'nota' }, 'Per ora i dati sono solo su questo dispositivo. Collegando un tuo repository GitHub privato, ogni modifica viene salvata online (con tutte le versioni precedenti) e iPhone e computer restano allineati.'),
      h('ol', { class: 'passi' },
        h('li', null, link(LINK_NUOVO_REPO, 'Crea un repository'), ' chiamato ', h('strong', null, 'poncifilm-dati'),
          ', scegli ', h('strong', null, 'Private'), ' e spunta «Add a README file».'),
        h('li', null, link(LINK_NUOVO_TOKEN, 'Crea un token'), ': nome «PonciFilm», scadenza «No expiration», ',
          '«Only select repositories» → poncifilm-dati, e in «Repository permissions» → ',
          h('strong', null, 'Contents: Read and write'), '.'),
        h('li', null, 'Copia il token (inizia con «github_pat_») e incollalo qui sotto, con il nome del repository.')),
      campoRepo,
      campoToken,
      pulsante,
      esito,
      h('p', { class: 'nota piccola' }, 'Il token resta solo su questo dispositivo e apre soltanto quel repository. Sul secondo dispositivo (es. il computer) ripeti solo il passo 3.'));
  }

  disegna();
  return { el: scheda, smonta: () => stacca?.() };
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
