// Avvio dell'app e passaggio da una schermata all'altra.

import { carica } from './archivio.js';
import { chiediSpazioPermanente } from './db.js';
import { completaInSospeso } from './servizi.js';
import { icona } from './ui.js';
import { vistaLibreria } from './viste/libreria.js';
import { vistaAggiungi } from './viste/aggiungi.js';
import { vistaFilm } from './viste/film.js';
import { vistaImpostazioni } from './viste/impostazioni.js';

const contenitore = document.getElementById('vista');

// Indirizzo (dopo il #) → schermata da mostrare e voce della barra in basso da evidenziare.
const ROTTE = [
  [/^#?\/?$/, () => vistaLibreria('da-vedere'), 'libreria'],
  [/^#\/libreria\/([\w-]+)$/, m => vistaLibreria(m[1]), 'libreria'],
  [/^#\/aggiungi$/, () => vistaAggiungi(), 'aggiungi'],
  [/^#\/film\/([\w-]+)$/, m => vistaFilm(m[1]), 'libreria'],
  [/^#\/impostazioni$/, () => vistaImpostazioni(), 'impostazioni'],
];

let vistaAttuale = null;
let indirizzoAttuale = null;
const scorrimenti = new Map();

function mostra() {
  const indirizzo = location.hash || '#/';
  const rotta = ROTTE.map(([schema, crea, voce]) => ({ m: indirizzo.match(schema), crea, voce })).find(r => r.m);
  if (!rotta) {
    location.replace('#/');
    return;
  }

  if (vistaAttuale?.ricordaScorrimento) scorrimenti.set(indirizzoAttuale, window.scrollY);
  vistaAttuale?.smonta?.();

  vistaAttuale = rotta.crea(rotta.m);
  indirizzoAttuale = indirizzo;
  contenitore.replaceChildren(vistaAttuale.el);
  window.scrollTo(0, vistaAttuale.ricordaScorrimento ? scorrimenti.get(indirizzo) ?? 0 : 0);

  for (const link of document.querySelectorAll('.barra a')) {
    link.classList.toggle('attivo', link.dataset.sezione === rotta.voce);
  }
  vistaAttuale.montata?.();
}

function preparaBarra() {
  for (const segnaposto of document.querySelectorAll('[data-icona]')) {
    segnaposto.append(icona(segnaposto.dataset.icona));
  }
  // "Aggiungi" apre la schermata subito, dentro il tocco: così sull'iPhone
  // la tastiera compare da sola, pronta per scrivere il titolo.
  document.querySelector('.barra-aggiungi').addEventListener('click', evento => {
    if (location.hash === '#/aggiungi') {
      evento.preventDefault();
      vistaAttuale?.mettiAFuoco?.();
      return;
    }
    evento.preventDefault();
    history.pushState(null, '', '#/aggiungi');
    mostra();
    vistaAttuale?.mettiAFuoco?.();
  });
}

function registraServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  // Sul computer di sviluppo niente copia offline, così si vedono subito le modifiche.
  if (['localhost', '127.0.0.1'].includes(location.hostname)) {
    navigator.serviceWorker.getRegistrations().then(elenco => elenco.forEach(r => r.unregister()));
    return;
  }
  const avevaVersione = Boolean(navigator.serviceWorker.controller);
  let ricaricato = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // È arrivata una nuova versione dell'app: ricarico una volta per usarla.
    if (!avevaVersione || ricaricato) return;
    ricaricato = true;
    location.reload();
  });
  navigator.serviceWorker.register('sw.js').catch(errore => console.warn('Service worker non registrato', errore));
}

async function avvia() {
  preparaBarra();
  try {
    await carica();
  } catch (errore) {
    contenitore.textContent = `Non riesco a leggere i dati salvati: ${errore.message}`;
    return;
  }
  window.addEventListener('hashchange', mostra);
  mostra();

  chiediSpazioPermanente();
  registraServiceWorker();
  // Film aggiunti senza connessione: completo le informazioni appena possibile.
  setTimeout(completaInSospeso, 1500);
  window.addEventListener('online', completaInSospeso);
}

avvia();
