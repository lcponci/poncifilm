// "Service worker": conserva una copia dei file dell'app sul dispositivo,
// così PonciFilm si apre all'istante e anche senza connessione.
// IMPORTANTE: a ogni nuova versione cambiare VERSIONE (e js/versione.js),
// altrimenti i dispositivi continuano a usare la copia vecchia.

const VERSIONE = 'poncifilm-0.4.1';

const FILE_APP = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js',
  'js/versione.js',
  'js/db.js',
  'js/archivio.js',
  'js/tmdb.js',
  'js/servizi.js',
  'js/sincronizzazione.js',
  'js/esporta.js',
  'js/ui.js',
  'js/componenti.js',
  'js/viste/libreria.js',
  'js/viste/aggiungi.js',
  'js/viste/film.js',
  'js/viste/impostazioni.js',
  'icone/icona-180.png',
  'icone/icona-192.png',
  'icone/icona-512.png',
];

self.addEventListener('install', evento => {
  evento.waitUntil(
    caches.open(VERSIONE)
      .then(cache => cache.addAll(FILE_APP))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', evento => {
  evento.waitUntil(
    caches.keys()
      .then(nomi => Promise.all(nomi.filter(n => n !== VERSIONE).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', evento => {
  const richiesta = evento.request;
  if (richiesta.method !== 'GET') return;
  const url = new URL(richiesta.url);
  // Solo i file dell'app: TMDb, immagini e OneDrive passano direttamente dalla rete.
  if (url.origin !== self.location.origin) return;

  evento.respondWith(
    caches.match(richiesta, { ignoreSearch: true }).then(copia =>
      copia || fetch(richiesta).catch(() =>
        richiesta.mode === 'navigate' ? caches.match('index.html') : Response.error()
      )
    )
  );
});
