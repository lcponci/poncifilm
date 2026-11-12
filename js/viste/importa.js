// Importazione dal vecchio database Notion (#/importa).
//
// 1. Scegli il file CSV esportato da Notion → riepilogo.
// 2. Ogni titolo viene cercato su TMDb e abbinato da solo: "sicuro", "da controllare"
//    o "non trovato".
// 3. Revisione: per i casi dubbi "Giusto" oppure "Cambia" (altre proposte, nuova
//    ricerca, inserimento a mano, non importare).
// 4. Importa: (se scelto) cancella prima i film attuali su tutti i dispositivi,
//    poi aggiunge i film con stato, priorità, voto, riconoscimenti e commento.
//
// Il lavoro viene salvato man mano nel dispositivo: si può chiudere e riprendere.
// Le serie TV per ora non si importano (l'app gestisce solo film).

import { h, icona, apriFoglio } from '../ui.js';
import { intestazione, locandina } from '../componenti.js';
import * as archivio from '../archivio.js';
import { leggi, scrivi } from '../db.js';
import { interpretaCsv } from '../notion.js';
import { cercaFilm, somiglianzaCon, registiDi, haChiave } from '../tmdb.js';
import { completaInSospeso } from '../servizi.js';
import * as sincro from '../sincronizzazione.js';

const CHIAVE = 'importazione';
const IN_PARALLELO = 3;
const pausa = ms => new Promise(r => setTimeout(r, ms));

let sessione;                // undefined = non ancora letta; null = nessuna importazione in corso
let abbinamentoInCorso = null;
let mostraPronti = false;
let mostraEsclusi = false;
// La ricerca su TMDb continua anche se lasci la pagina: quando torni, aggiorna quella nuova.
let disegnaAttuale = () => {};

const salva = () => scrivi(CHIAVE, sessione).catch(errore => console.warn('Importazione non salvata', errore));

export function vistaImporta() {
  const el = h('section', { class: 'vista importa' });
  let attiva = true;

  const pagina = (...contenuto) => el.replaceChildren(intestazione('Importa da Notion', { indietro: true }), ...contenuto.flat().filter(Boolean));

  function disegna() {
    if (!attiva) return;
    if (sessione === undefined) return pagina(h('p', { class: 'nota' }, 'Un attimo…'));
    if (!sessione) return disegnaInizio();
    if (sessione.fase === 'scelto') return disegnaRiepilogo();
    if (sessione.fase === 'abbinamento') return disegnaAbbinamento();
    if (sessione.fase === 'revisione') return disegnaRevisione();
    return disegnaFatto();
  }

  // ---------------------------------------------------------- 1. scelta del file

  function disegnaInizio() {
    const esito = h('p', { class: 'nota errore', 'aria-live': 'polite' });
    const file = h('input', {
      type: 'file', accept: '.csv,text/csv', hidden: true,
      onchange: async () => {
        const scelto = file.files?.[0];
        if (!scelto) return;
        try {
          const righe = interpretaCsv(await scelto.text());
          sessione = {
            nomeFile: scelto.name,
            creataIl: new Date().toISOString(),
            fase: 'scelto',
            cancellaPrima: archivio.opere().length > 0,
            righe: righe.map(r => ({
              ...r,
              decisione: r.tipo === 'serie' ? 'salta' : 'importa',
              esito: r.tipo === 'serie' ? 'serie' : null,
              scelta: null,
              candidati: [],
              confermato: false,
            })),
          };
          salva();
          disegna();
        } catch (errore) {
          esito.textContent = errore.message;
        }
      },
    });
    pagina(
      h('section', { class: 'scheda-info' },
        h('p', null, 'Porta in PonciFilm i film del tuo vecchio database Notion.'),
        h('ol', { class: 'passi' },
          h('li', null, 'Scegli il file CSV esportato da Notion (si chiama «Film & Serie …csv»).'),
          h('li', null, 'Ogni titolo viene cercato su TMDb e abbinato da solo.'),
          h('li', null, 'Controlli solo i casi dubbi, poi tocchi «Importa».')),
        h('p', { class: 'nota' }, 'Vengono importati stato, priorità, voto, riconoscimenti e commento. Generi, cast e piattaforme arrivano puliti da TMDb. Le serie TV per ora restano fuori.'),
        !haChiave() && h('p', { class: 'nota errore' }, 'Serve la chiave TMDb: ', h('a', { href: '#/impostazioni/tmdb' }, 'inseriscila qui'), '.'),
        h('button', { type: 'button', class: 'pulsante largo', disabled: !haChiave(), onclick: () => file.click() }, 'Scegli il file CSV'),
        file,
        esito));
  }

  // ---------------------------------------------------------- riepilogo

  function disegnaRiepilogo() {
    const r = sessione.righe;
    const film = r.filter(x => x.tipo === 'film').length;
    const corti = r.filter(x => x.tipo === 'corto').length;
    const serie = r.filter(x => x.tipo === 'serie').length;
    const presenti = archivio.opere().length;
    const conta = stato => r.filter(x => x.tipo !== 'serie' && x.stato === stato).length;

    pagina(
      h('section', { class: 'scheda-info' },
        h('h2', null, sessione.nomeFile),
        h('ul', { class: 'passi' },
          h('li', null, h('strong', null, `${film} film`), corti ? ` e ${corti} corti (importati come film)` : ''),
          h('li', null, `Visti ${conta('visto')} · Da vedere ${conta('da-vedere')} · Da rivedere ${conta('da-rivedere')} · Abbandonati ${conta('abbandonato')}`),
          serie > 0 && h('li', null, `${serie} serie TV: per ora non si importano (l'app gestisce solo film). Restano nel file per quando arriveranno le serie.`)),
        presenti > 0 && h('label', { class: 'casella-riga' },
          h('input', {
            type: 'checkbox', checked: sessione.cancellaPrima,
            onchange: e => { sessione.cancellaPrima = e.target.checked; salva(); },
          }),
          h('span', null, `Prima cancella tutti i film che ci sono ora in PonciFilm (${presenti}), su tutti i dispositivi. La cancellazione avviene solo alla fine, quando tocchi «Importa».`)),
        h('button', {
          type: 'button', class: 'pulsante largo',
          onclick: () => { sessione.fase = 'abbinamento'; salva(); disegna(); },
        }, 'Cerca i film su TMDb'),
        h('button', { type: 'button', class: 'pulsante-testo cambia', onclick: ricomincia }, 'Scegli un altro file')));
  }

  function ricomincia() {
    if (sessione?.fase === 'revisione' && !confirm('Ricominciare da capo? Le scelte fatte finora andranno perse.')) return;
    abbinamentoInCorso = null;
    sessione = null;
    scrivi(CHIAVE, null);
    disegna();
  }

  // ---------------------------------------------------------- 2. abbinamento automatico

  function disegnaAbbinamento() {
    const daFare = sessione.righe.filter(r => r.decisione === 'importa' && !r.esito);
    const totale = sessione.righe.filter(r => r.tipo !== 'serie').length;
    const fatti = totale - daFare.length;
    pagina(
      h('section', { class: 'scheda-info' },
        h('h2', null, 'Cerco i film su TMDb…'),
        h('div', { class: 'barra-avanzamento' }, h('span', { style: { width: `${Math.round(100 * fatti / Math.max(1, totale))}%` } })),
        h('p', { class: 'nota' }, `${fatti} di ${totale}. Puoi lasciare questa pagina: riprende da dove era rimasto.`),
        sessione.erroreAbbinamento && [
          h('p', { class: 'nota errore' }, sessione.erroreAbbinamento),
          h('button', { type: 'button', class: 'pulsante', onclick: () => { sessione.erroreAbbinamento = null; disegna(); } }, 'Riprova'),
        ]));
    if (!sessione.erroreAbbinamento && !abbinamentoInCorso) abbinamentoInCorso = abbinaTutto().finally(() => { abbinamentoInCorso = null; });
  }

  async function abbinaTutto() {
    const mia = sessione; // se nel frattempo ricominci con un altro file, questo lavoro si ferma
    const coda = mia.righe.filter(r => r.decisione === 'importa' && !r.esito);
    let ultimoDisegno = 0;
    const lavoratore = async () => {
      while (coda.length && sessione === mia && mia.fase === 'abbinamento' && !mia.erroreAbbinamento) {
        const riga = coda.shift();
        try {
          Object.assign(riga, await abbina(riga));
        } catch (errore) {
          mia.erroreAbbinamento = `${errore.message} Riprova tra poco: riparte da dove si era fermato.`;
          return;
        }
        if (Date.now() - ultimoDisegno > 300) { ultimoDisegno = Date.now(); salva(); disegnaAttuale(); }
      }
    };
    await Promise.all(Array.from({ length: IN_PARALLELO }, lavoratore));
    if (sessione !== mia || mia.fase !== 'abbinamento') return;
    if (!mia.erroreAbbinamento && mia.righe.every(r => r.decisione !== 'importa' || r.esito)) {
      segnaDoppioni();
      mia.fase = 'revisione';
    }
    salva();
    disegnaAttuale();
  }

  // ---------------------------------------------------------- 3. revisione

  function disegnaRevisione() {
    const righe = sessione.righe;
    const daControllare = righe.filter(serveControllo);
    const pronti = righe.filter(r => !serveControllo(r) && (r.decisione === 'importa' || r.decisione === 'mano'));
    const esclusi = righe.filter(r => !serveControllo(r) && r.decisione === 'salta');
    const presenti = archivio.opere().length;

    const riga = r => rigaRevisione(r, () => { segnaDoppioni(); salva(); disegna(); });

    pagina(
      h('div', { class: 'pillole riepilogo-import' },
        h('span', { class: 'pillola' }, 'Da controllare', h('span', { class: 'quanti' }, String(daControllare.length))),
        h('span', { class: 'pillola' }, 'Pronti', h('span', { class: 'quanti' }, String(pronti.length))),
        h('span', { class: 'pillola' }, 'Non importati', h('span', { class: 'quanti' }, String(esclusi.length)))),

      h('section', { class: 'sezione-import' },
        h('h2', null, 'Da controllare'),
        daControllare.length
          ? [h('p', { class: 'nota' }, 'Per ognuno: «Giusto» se il film proposto è quello, altrimenti «Cambia».'), daControllare.map(riga)]
          : h('p', { class: 'nota' }, '✓ Tutto controllato.')),

      h('section', { class: 'sezione-import' },
        h('div', { class: 'testa-sezione' },
          h('h2', null, 'Pronti'),
          h('span', { class: 'conteggio' }, String(pronti.length)),
          h('button', { type: 'button', class: 'pulsante-testo cambia', onclick: () => { mostraPronti = !mostraPronti; disegna(); } },
            mostraPronti ? 'Nascondi' : 'Mostra')),
        h('p', { class: 'nota' }, 'Abbinamenti sicuri o già controllati. Puoi comunque cambiarli.'),
        mostraPronti && pronti.map(riga)),

      esclusi.length > 0 && h('section', { class: 'sezione-import' },
        h('div', { class: 'testa-sezione' },
          h('h2', null, 'Non importati'),
          h('span', { class: 'conteggio' }, String(esclusi.length)),
          h('button', { type: 'button', class: 'pulsante-testo cambia', onclick: () => { mostraEsclusi = !mostraEsclusi; disegna(); } },
            mostraEsclusi ? 'Nascondi' : 'Mostra')),
        mostraEsclusi && esclusi.map(riga)),

      h('section', { class: 'zona-importa' },
        daControllare.length > 0 && h('p', { class: 'nota' },
          `Ne restano ${daControllare.length} da controllare: se importi adesso, quelli con una proposta entrano con quella, quelli non trovati restano fuori.`),
        sessione.cancellaPrima && presenti > 0 && h('p', { class: 'nota errore' }, `Prima verranno cancellati tutti i film che ci sono ora in PonciFilm (${presenti}).`),
        h('button', { type: 'button', class: 'pulsante largo grande', onclick: importa }, `Importa ${quantiDaImportare()} film`),
        h('button', { type: 'button', class: 'pulsante-testo cambia', onclick: ricomincia }, 'Ricomincia da capo')));
  }

  // ---------------------------------------------------------- 4. importazione

  async function importa() {
    const voci = sessione.righe.filter(r => (r.decisione === 'importa' && r.scelta) || r.decisione === 'mano');
    const presenti = archivio.opere().length;
    const domanda = sessione.cancellaPrima && presenti
      ? `Cancello tutti i film attuali (${presenti}) su tutti i dispositivi e importo ${voci.length} film. Continuare?`
      : `Importo ${voci.length} film. Continuare?`;
    if (!confirm(domanda)) return;

    pagina(h('p', { class: 'nota' }, 'Importo…'));
    // Prima mi metto in pari con gli altri dispositivi, così la cancellazione
    // comprende anche i film aggiunti da poco altrove.
    await sincro.sincronizza().catch(() => {});
    if (sessione.cancellaPrima) archivio.svuotaArchivio();

    const aggiunti = archivio.importaFilm(voci.map(r => ({
      risultato: r.decisione === 'importa' ? r.scelta : null,
      manuale: r.decisione === 'mano' ? { titolo: r.titolo, anno: r.anno } : null,
      stato: r.stato,
      priorita: r.priorita,
      voto: r.voto,
      riconoscimenti: r.riconoscimenti.map(idRiconoscimento),
      commento: r.commento,
    })));

    sessione.fase = 'fatto';
    sessione.risultato = {
      aggiunti,
      il: new Date().toISOString(),
      esclusi: sessione.righe.filter(r => !voci.includes(r)).map(r => ({ titolo: r.titoloNotion, motivo: motivoEsclusione(r) })),
    };
    salva();
    completaInSospeso(); // scarica le informazioni complete, un film alla volta
    disegna();
  }

  function disegnaFatto() {
    const ris = sessione.risultato;
    const senzaInfo = archivio.opere().filter(o => !o.infoCompleta && o.tmdbId).length;
    const daRecensire = archivio.opere().filter(senzaRecensione).length;
    pagina(
      h('section', { class: 'scheda-info' },
        h('h2', null, `✓ Importati ${ris.aggiunti} film`),
        senzaInfo
          ? h('p', { class: 'nota' }, `Sto scaricando da TMDb le informazioni complete: ne mancano ${senzaInfo}. Puoi usare l'app intanto.`)
          : h('p', { class: 'nota' }, 'Informazioni complete scaricate per tutti i film.'),
        daRecensire > 0 && h('p', null, `${daRecensire} film visti non hanno ancora un voto.`),
        daRecensire > 0 && h('a', { class: 'pulsante largo', href: '#/recensioni' }, icona('matita'), 'Scrivi le recensioni mancanti'),
        h('a', { class: 'pulsante secondario largo', href: '#/' }, 'Vai alla Home')),
      ris.esclusi.length > 0 && h('section', { class: 'sezione-import' },
        h('h2', null, `Non importati (${ris.esclusi.length})`),
        h('ul', { class: 'elenco-esclusi' }, ris.esclusi.map(x => h('li', null, h('strong', null, x.titolo), ` · ${x.motivo}`)))),
      h('div', { class: 'centrato' },
        h('button', { type: 'button', class: 'pulsante-testo cambia', onclick: ricomincia }, 'Nuova importazione')));
  }

  disegnaAttuale = disegna;
  if (sessione !== undefined) disegna();
  else {
    pagina(h('p', { class: 'nota' }, 'Un attimo…'));
    leggi(CHIAVE).then(s => { if (sessione === undefined) sessione = s || null; disegna(); })
      .catch(() => { sessione = null; disegna(); });
  }

  // Durante "fatto" il numero di film senza informazioni scende man mano.
  let timer = null;
  const stacca = archivio.ascolta(() => {
    if (sessione?.fase !== 'fatto') return;
    clearTimeout(timer);
    timer = setTimeout(disegna, 400);
  });

  return {
    el,
    smonta() {
      attiva = false;
      if (disegnaAttuale === disegna) disegnaAttuale = () => {};
      stacca();
      clearTimeout(timer);
    },
  };
}

// ---------------------------------------------------------------- regole

const serveControllo = r => !r.confermato && ['controlla', 'nontrovato', 'doppione'].includes(r.esito);
const senzaRecensione = o => (o.stato === 'visto' || o.stato === 'da-rivedere') && !o.voto;
const quantiDaImportare = () => sessione.righe.filter(r => (r.decisione === 'importa' && r.scelta) || r.decisione === 'mano').length;

function motivoEsclusione(r) {
  if (r.esito === 'serie') return 'serie TV (per ora non gestite)';
  if (r.esito === 'doppione') return 'doppione';
  if (r.decisione === 'importa' && !r.scelta) return 'non trovato su TMDb';
  return 'scelto di non importarlo';
}

// Cerca su TMDb e decide se l'abbinamento è sicuro.
async function abbina(riga) {
  const testo = riga.annoSicuro ? `${riga.titolo} (${riga.anno})` : riga.titolo;
  let risultati = [];
  for (let tentativo = 0; ; tentativo++) {
    try {
      risultati = await cercaFilm(testo);
      break;
    } catch (errore) {
      if (errore.tipo === 'limite' && tentativo < 4) { await pausa(2500); continue; }
      throw errore;
    }
  }
  return valuta(riga, risultati.slice(0, 8));
}

// Sicuro = titolo praticamente identico e nessun altro film con lo stesso titolo
// che possa confondere (oppure l'anno combacia, o uno è molto più conosciuto).
function valuta(riga, risultati) {
  if (!risultati.length) return { scelta: null, candidati: [], esito: 'nontrovato' };
  const valutati = risultati.map((r, i) => {
    const s = somiglianzaCon(riga.titolo, r);
    const annoOk = Boolean(riga.anno && r.anno && Math.abs(r.anno - riga.anno) <= 1);
    return { r, s, annoOk, punti: s + (annoOk ? (r.anno === riga.anno ? 0.15 : 0.08) : 0) - i * 0.01 };
  }).sort((a, b) => b.punti - a.punti);
  const [migliore, ...altri] = valutati;
  const rivali = altri.filter(x => x.s >= 0.9);
  const netto = !rivali.length
    || (migliore.annoOk && !rivali.some(x => x.annoOk))
    || (migliore.r.voti >= 50 && migliore.r.voti >= 5 * Math.max(...rivali.map(x => x.r.voti)));
  return {
    scelta: migliore.r,
    candidati: valutati.map(x => x.r),
    esito: migliore.s >= 0.95 && netto ? 'sicuro' : 'controlla',
  };
}

// Due righe dello stesso film: si importa la prima, le altre vanno controllate.
function segnaDoppioni() {
  const primo = new Map();
  for (const r of sessione.righe) {
    if (r.decisione !== 'importa' || !r.scelta) continue;
    const id = r.scelta.tmdbId;
    if (primo.has(id)) {
      Object.assign(r, { decisione: 'salta', esito: 'doppione', doppioneDi: primo.get(id), confermato: false });
    } else primo.set(id, r.indice);
  }
}

// "Intrigante" → "intrigante"; "Cinepanettone made in italy" → "cinepanettone".
// Se non esiste, lo crea.
function idRiconoscimento(nome) {
  const s = archivio.slug(nome);
  const elenco = archivio.impostazioni().riconoscimenti;
  const trovato = elenco.find(r => r.id === s || archivio.slug(r.nome) === s)
    || elenco.find(r => s.startsWith(`${r.id}-`));
  if (trovato) return trovato.id;
  archivio.aggiungiRiconoscimento(nome);
  return archivio.impostazioni().riconoscimenti.find(r => r.nome.toLowerCase() === nome.trim().toLowerCase())?.id ?? s;
}

// ---------------------------------------------------------------- righe della revisione

function descriviNotion(r) {
  return [
    r.statoNotion || 'senza stato',
    r.stato === 'da-vedere' && r.prioritaNotion,
    r.voto && '★'.repeat(r.voto),
    r.riconoscimenti.length > 0 && r.riconoscimenti.join(', '),
    r.commento && 'con commento',
    r.tipo === 'corto' && 'corto',
  ].filter(Boolean).join(' · ');
}

function sottotitolo(film) {
  const sotto = h('div', { class: 'riga-sotto' }, String(film.anno ?? 'anno sconosciuto'));
  registiDi(film.tmdbId)
    .then(registi => { if (registi.length) sotto.textContent = `${film.anno ?? 'anno sconosciuto'} · ${registi.join(', ')}`; })
    .catch(() => {});
  return sotto;
}

function rigaRevisione(r, cambiato) {
  const titoloDoppione = r.esito === 'doppione' && sessione.righe.find(x => x.indice === r.doppioneDi)?.titoloNotion;

  let destinazione;
  if (r.decisione === 'mano') {
    destinazione = h('div', { class: 'import-esito' }, icona('matita'), `Lo inserisco a mano: «${r.titolo}»`);
  } else if (r.esito === 'serie') {
    destinazione = h('div', { class: 'import-esito' }, 'Serie TV: per ora non si importa');
  } else if (r.decisione === 'salta' && r.esito !== 'doppione') {
    destinazione = h('div', { class: 'import-esito' }, 'Non lo importo');
  } else if (r.scelta) {
    destinazione = h('div', { class: 'import-tmdb' },
      h('div', { class: 'riga-locandina' }, locandina(r.scelta.locandina, 'w154', '')),
      h('div', { class: 'riga-testo' },
        h('div', { class: 'riga-titolo' }, r.scelta.titolo),
        sottotitolo(r.scelta),
        r.esito === 'doppione' && h('div', { class: 'nota errore' }, `Doppione di «${titoloDoppione}»: ne importo uno solo.`)));
  } else {
    destinazione = h('div', { class: 'import-esito errore' }, 'Nessun film trovato su TMDb');
  }

  const conferma = () => { r.confermato = true; cambiato(); };
  const tieniQuesta = () => {
    const altra = sessione.righe.find(x => x.indice === r.doppioneDi);
    if (altra) Object.assign(altra, { decisione: 'salta', esito: 'doppione', doppioneDi: r.indice, confermato: true });
    Object.assign(r, { decisione: 'importa', esito: 'controlla', doppioneDi: null, confermato: true });
    cambiato();
  };
  const cambia = () => apriScelta(r, cambiato);

  let azioni;
  if (r.esito === 'serie') azioni = null;
  else if (serveControllo(r) && r.esito === 'doppione') {
    azioni = [h('button', { type: 'button', class: 'pulsante secondario', onclick: conferma }, 'Va bene'),
      h('button', { type: 'button', class: 'pulsante secondario', onclick: tieniQuesta }, 'Tieni questa')];
  } else if (serveControllo(r) && r.scelta) {
    azioni = [h('button', { type: 'button', class: 'pulsante', onclick: conferma }, icona('spunta'), 'Giusto'),
      h('button', { type: 'button', class: 'pulsante secondario', onclick: cambia }, 'Cambia')];
  } else if (serveControllo(r)) {
    azioni = [h('button', { type: 'button', class: 'pulsante', onclick: cambia }, icona('cerca'), 'Cerca'),
      h('button', { type: 'button', class: 'pulsante secondario', onclick: () => { Object.assign(r, { decisione: 'salta', confermato: true }); cambiato(); } }, 'Salta')];
  } else {
    azioni = [h('button', { type: 'button', class: 'pulsante-testo cambia', onclick: cambia }, 'Cambia')];
  }

  return h('div', { class: 'riga-import' + (serveControllo(r) ? ' da-controllare' : '') },
    h('div', { class: 'import-notion' },
      h('span', { class: 'etichetta' }, 'Notion'),
      h('span', { class: 'import-titolo' }, r.titoloNotion),
      h('span', { class: 'nota' }, descriviNotion(r))),
    destinazione,
    azioni && h('div', { class: 'import-azioni' }, azioni));
}

// Pannello "Cambia": altre proposte, nuova ricerca, a mano, non importare.
function apriScelta(r, cambiato) {
  const elenco = h('div', { class: 'risultati' });
  const stato = h('p', { class: 'nota', 'aria-live': 'polite' });
  const campo = h('input', {
    type: 'search', class: 'campo', value: r.titolo, 'aria-label': 'Cerca su TMDb',
    autocomplete: 'off', autocorrect: 'off', autocapitalize: 'off', spellcheck: 'false', enterkeyhint: 'search',
    onkeydown: e => { if (e.key === 'Enter') { e.preventDefault(); cerca(); campo.blur(); } },
  });

  const scegli = (cambi) => { Object.assign(r, { doppioneDi: null, confermato: true }, cambi); foglio.chiudi(); cambiato(); };

  function mostra(candidati) {
    elenco.replaceChildren(...candidati.map(c => h('button', {
      type: 'button', class: 'riga-risultato' + (r.decisione === 'importa' && r.scelta?.tmdbId === c.tmdbId ? ' attuale' : ''),
      onclick: () => scegli({ scelta: c, decisione: 'importa', esito: 'controlla', candidati: candidati }),
    },
    h('div', { class: 'riga-locandina' }, locandina(c.locandina, 'w154', '')),
    h('div', { class: 'riga-testo' },
      h('div', { class: 'riga-titolo' }, c.titolo),
      sottotitolo(c),
      c.titoloOriginale && c.titoloOriginale !== c.titolo && h('div', { class: 'riga-sotto' }, c.titoloOriginale)))));
    stato.textContent = candidati.length ? '' : 'Nessun risultato: prova a scrivere il titolo in un altro modo.';
  }

  async function cerca() {
    const testo = campo.value.trim();
    if (!testo) return;
    stato.textContent = 'Cerco…';
    try {
      mostra((await cercaFilm(testo)).slice(0, 10));
    } catch (errore) {
      stato.textContent = errore.message;
    }
  }

  mostra(r.candidati || []);
  const foglio = apriFoglio(h('div', { class: 'foglio-scelta-import' },
    h('h2', null, r.titoloNotion),
    h('p', { class: 'nota' }, descriviNotion(r)),
    h('div', { class: 'riga-aggiungi' }, campo, h('button', { type: 'button', class: 'pulsante', onclick: cerca }, 'Cerca')),
    stato,
    elenco,
    h('div', { class: 'azioni due' },
      h('button', { type: 'button', class: 'pulsante secondario', onclick: () => scegli({ decisione: 'mano' }) }, 'Inserisci a mano'),
      h('button', { type: 'button', class: 'pulsante secondario pericolo', onclick: () => scegli({ decisione: 'salta', esito: r.esito === 'doppione' ? 'scelto' : r.esito }) }, 'Non importare'))));
}
