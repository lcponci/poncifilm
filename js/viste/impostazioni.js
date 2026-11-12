// Impostazioni, organizzate come quelle dell'iPhone: una pagina principale con
// poche righe raggruppate (ognuna mostra a destra come stanno le cose) e una
// pagina dedicata per ciascuna voce che ha bisogno di spazio.
//   #/impostazioni                 → menu principale
//   #/impostazioni/salvataggio     → salvataggio online su GitHub
//   #/impostazioni/riconoscimenti  → aggiungi, rinomina, elimina riconoscimenti
//   #/impostazioni/tmdb            → chiave TMDb

import { h, icona, avviso, apriFoglio, formattaData } from '../ui.js';
import { intestazione } from '../componenti.js';
import * as archivio from '../archivio.js';
import { chiaveAttuale, impostaChiave, verificaChiave, haChiave } from '../tmdb.js';
import { completaInSospeso } from '../servizi.js';
import * as sincro from '../sincronizzazione.js';
import { esportaJson, esportaCsv } from '../esporta.js';
import { VERSIONE_APP } from '../versione.js';
import { senzaRecensione } from './recensioni.js';

export function vistaImpostazioni(sezione = null) {
  if (sezione === 'salvataggio') return paginaSalvataggio();
  if (sezione === 'riconoscimenti') return paginaRiconoscimenti();
  if (sezione === 'tmdb') return paginaTmdb();
  return paginaPrincipale();
}

const pagina = (titolo, ...contenuto) =>
  h('section', { class: 'vista impostazioni' }, intestazione(titolo, { indietro: true }), ...contenuto);

// ---------------------------------------------------------------- menu principale

// Una riga del menu: icona colorata, titolo, valore a destra e freccia.
function voce({ simbolo, colore, titolo, valore = null, href = null, onclick = null }) {
  const parti = [
    h('span', { class: 'voce-icona', style: { background: colore } }, icona(simbolo)),
    h('span', { class: 'voce-titolo' }, titolo),
    valore,
    icona('indietro', 'icona freccia'),
  ];
  return href
    ? h('a', { class: 'voce', href }, ...parti)
    : h('button', { type: 'button', class: 'voce', onclick }, ...parti);
}

const valore = testo => h('span', { class: 'voce-valore' }, testo);

const gruppo = (titolo, ...voci) =>
  h('div', { class: 'gruppo-menu' }, h('h2', { class: 'etichetta' }, titolo), h('div', { class: 'gruppo-voci' }, ...voci));

// Lo stato del salvataggio in due parole, per la riga del menu.
function statoBreve(st) {
  if (!sincro.configurata()) return { testo: 'Non attivo' };
  if (st.fase === 'in-corso') return { testo: 'Salvo…' };
  if (st.fase === 'in-attesa') return { testo: 'In attesa' };
  if (st.fase === 'offline') return { testo: 'Offline' };
  if (st.fase === 'errore') return { testo: 'Problema', errore: true };
  return st.ultima ? { testo: '✓ Salvato' } : { testo: 'Collegato' };
}

function paginaPrincipale() {
  const opere = archivio.opere();
  const abbandonati = opere.filter(o => o.stato === 'abbandonato').length;
  const riconoscimenti = archivio.impostazioni().riconoscimenti.length;
  const daRecensire = opere.filter(senzaRecensione).length;

  const valoreSalvataggio = valore('');
  const aggiornaSalvataggio = st => {
    const d = statoBreve(st);
    valoreSalvataggio.textContent = d.testo;
    valoreSalvataggio.classList.toggle('errore', Boolean(d.errore));
  };
  aggiornaSalvataggio(sincro.statoAttuale());
  const stacca = sincro.ascoltaStato(aggiornaSalvataggio);

  // Senza chiave TMDb non si può cercare nulla: è la prima cosa da fare.
  const perIniziare = !haChiave() && h('section', { class: 'scheda-info' },
    h('h2', null, 'Per iniziare'),
    h('p', { class: 'nota' }, 'Per cercare i film e scaricarne le informazioni serve una chiave TMDb. È gratuita e la inserisci una volta per dispositivo.'),
    h('a', { class: 'pulsante largo', href: '#/impostazioni/tmdb' }, 'Inserisci la chiave'));

  const valoreMensola = valore('');
  const aggiornaMensola = () => {
    valoreMensola.textContent = `${archivio.filmSullaMensola().length} di ${archivio.limiteMensola()}`;
  };
  aggiornaMensola();

  const el = pagina('Impostazioni',
    perIniziare,
    gruppo('La tua cineteca',
      voce({ simbolo: 'mensola', colore: '#8a5a3c', titolo: 'Mensola', valore: valoreMensola, onclick: () => apriLimiteMensola(aggiornaMensola) }),
      voce({ simbolo: 'medaglia', colore: '#d9822b', titolo: 'Riconoscimenti', valore: valore(String(riconoscimenti)), href: '#/impostazioni/riconoscimenti' }),
      voce({ simbolo: 'chiudi', colore: '#5b6069', titolo: 'Film abbandonati', valore: valore(String(abbandonati)), href: '#/abbandonati' }),
      daRecensire > 0 && voce({ simbolo: 'matita', colore: '#c0504d', titolo: 'Recensioni da scrivere', valore: valore(String(daRecensire)), href: '#/recensioni' })),
    gruppo('I tuoi dati',
      voce({ simbolo: 'nuvola', colore: '#3478f6', titolo: 'Salvataggio online', valore: valoreSalvataggio, href: '#/impostazioni/salvataggio' }),
      voce({ simbolo: 'scarica', colore: '#30a14e', titolo: 'Scarica una copia', onclick: apriScaricaCopia }),
      voce({ simbolo: 'importa', colore: '#6b6f78', titolo: 'Importa da Notion', href: '#/importa' })),
    gruppo('Servizi',
      voce({ simbolo: 'chiave', colore: '#0d8fb8', titolo: 'Chiave TMDb', valore: valore(haChiave() ? 'Attiva' : 'Da inserire'), href: '#/impostazioni/tmdb' })),
    h('footer', { class: 'piede-impostazioni' },
      h('p', null, `PonciFilm ${VERSIONE_APP} · ${opere.length === 1 ? '1 film' : `${opere.length} film`} nell'archivio`),
      h('p', null, 'Questo prodotto usa l\'API di ',
        h('a', { href: 'https://www.themoviedb.org', target: '_blank', rel: 'noopener' }, 'TMDb'),
        ' ma non è approvato né certificato da TMDb. Le piattaforme di streaming sono fornite da ',
        h('a', { href: 'https://www.justwatch.com', target: '_blank', rel: 'noopener' }, 'JustWatch'), '.')));

  return { el, smonta: stacca };
}

// Quanti film può tenere la Mensola: pochi, perché resti una selezione speciale.
function apriLimiteMensola(dopo) {
  const numero = h('strong', { class: 'contatore-grande' });
  const meno = h('button', { type: 'button', class: 'pulsante-icona grande', 'aria-label': 'Un posto in meno', onclick: () => cambia(-1) }, '−');
  const piu = h('button', { type: 'button', class: 'pulsante-icona grande', 'aria-label': 'Un posto in più', onclick: () => cambia(1) }, '+');
  const nota = h('p', { class: 'nota centrata' });

  function disegna() {
    const limite = archivio.limiteMensola();
    const sopra = archivio.filmSullaMensola().length;
    numero.textContent = String(limite);
    meno.disabled = limite <= Math.max(1, sopra);
    piu.disabled = limite >= 60;
    nota.textContent = sopra >= limite
      ? `È piena: ci sono ${sopra} film. Per scendere sotto questo numero, prima togline qualcuno.`
      : `Ci sono ${sopra} film: restano ${limite - sopra} posti liberi.`;
    dopo();
  }

  function cambia(passo) {
    archivio.impostaLimiteMensola(archivio.limiteMensola() + passo);
    disegna();
  }

  disegna();
  apriFoglio(h('div', null,
    h('h2', null, 'Mensola'),
    h('p', { class: 'nota' }, 'Quanti film può tenere. Pochi, così resta una vetrina dei tuoi preferiti di sempre. Sull\'iPhone ogni ripiano ne contiene 4.'),
    h('div', { class: 'regola-numero' }, meno, numero, piu),
    nota));
}

function apriScaricaCopia() {
  const scegli = esporta => () => { esporta(); foglio.chiudi(); };
  const foglio = apriFoglio(h('div', null,
    h('h2', null, 'Scarica una copia'),
    h('p', { class: 'nota' }, 'Una copia di tutto il tuo archivio, da conservare dove vuoi.'),
    h('button', { type: 'button', class: 'opzione riga scelta-copia', onclick: scegli(esportaCsv) },
      h('span', null, h('strong', null, 'Tabella Excel'), h('span', { class: 'nota' }, 'Un film per riga, da aprire con Excel o Numbers.'))),
    h('button', { type: 'button', class: 'opzione riga scelta-copia', onclick: scegli(esportaJson) },
      h('span', null, h('strong', null, 'Copia completa'), h('span', { class: 'nota' }, 'Con tutti i dettagli, nel formato di PonciFilm (JSON).')))));
}

// ---------------------------------------------------------------- chiave TMDb

function paginaTmdb() {
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

  const istruzioni = haChiave()
    ? h('p', { class: 'nota' }, '✓ La chiave è attiva su questo dispositivo. Serve per cercare i film e aggiornarne le informazioni. Se vuoi cambiarla, incolla la nuova qui sotto.')
    : [
      h('p', { class: 'nota' }, 'Serve per cercare i film e scaricarne le informazioni. È gratuita:'),
      h('ol', { class: 'passi' },
        h('li', null, 'Crea un account su ', h('a', { href: 'https://www.themoviedb.org/signup', target: '_blank', rel: 'noopener' }, 'themoviedb.org'), '.'),
        h('li', null, 'Apri ', h('a', { href: 'https://www.themoviedb.org/settings/api', target: '_blank', rel: 'noopener' }, 'Impostazioni → API'), ' e richiedi una chiave per uso personale.'),
        h('li', null, 'Copia la «Chiave API» (oppure il «Token di accesso in lettura») e incollala qui sotto.')),
    ];

  const el = pagina('Chiave TMDb',
    h('section', { class: 'scheda-info' },
      istruzioni,
      campoChiave,
      h('button', { type: 'button', class: 'pulsante largo', onclick: salvaChiave }, 'Salva e verifica'),
      esito,
      h('p', { class: 'nota piccola' }, 'La chiave resta solo su questo dispositivo: sul computer va inserita a parte.')));
  return { el };
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

function paginaSalvataggio() {
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
  return { el: pagina('Salvataggio online', scheda), smonta: () => stacca?.() };
}

// ---------------------------------------------------------------- riconoscimenti

function paginaRiconoscimenti() {
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

  // Se arrivano riconoscimenti nuovi da un altro dispositivo, li mostro subito.
  const stacca = archivio.ascolta(cambiato => { if (cambiato === null) disegna(); });

  disegna();
  const el = pagina('Riconoscimenti',
    h('section', { class: 'scheda-info' },
      h('p', { class: 'nota' }, 'Tocca un riconoscimento per rinominarlo o eliminarlo. Il numero indica in quanti film lo hai usato.'),
      pillole,
      h('div', { class: 'riga-aggiungi' },
        campo,
        h('button', { type: 'button', class: 'pulsante', onclick: aggiungi }, 'Aggiungi')),
      esito));
  return { el, smonta: stacca };
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
