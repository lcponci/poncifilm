// Operazioni "in sottofondo" che collegano TMDb e l'archivio.

import * as tmdb from './tmdb.js';
import * as archivio from './archivio.js';

const inCorso = new Map();
const UN_ORA = 60 * 60 * 1000;

// Scarica le informazioni complete di un film appena aggiunto
// (o rimasto incompleto perché aggiunto senza connessione).
export function completaFilm(id) {
  const o = archivio.opera(id);
  if (!o?.tmdbId || !tmdb.haChiave()) return Promise.resolve(); // i film inseriti a mano non sono su TMDb
  if (inCorso.has(id)) return inCorso.get(id);

  const lavoro = tmdb.dettagliFilm(o.tmdbId)
    .then(({ info, piattaforme }) => {
      archivio.completaInfo(id, info);
      archivio.impostaPiattaforme(id, piattaforme);
    })
    .catch(errore => console.warn('Informazioni non scaricate per', id, errore.message))
    .finally(() => inCorso.delete(id));
  inCorso.set(id, lavoro);
  return lavoro;
}

// Completa, uno alla volta, tutti i film rimasti senza informazioni complete.
export async function completaInSospeso() {
  for (const o of archivio.opere().filter(x => !x.infoCompleta)) {
    await completaFilm(o.id);
  }
}

// Aggiorna le piattaforme quando apri la scheda (al massimo una volta l'ora).
export async function aggiornaPiattaformeFilm(id) {
  const o = archivio.opera(id);
  if (!o?.tmdbId || !tmdb.haChiave()) return;
  const ultima = Date.parse(o.piattaforme.aggiornateIl || 0) || 0;
  if (Date.now() - ultima < UN_ORA) return;
  try {
    archivio.impostaPiattaforme(id, await tmdb.piattaformeFilm(o.tmdbId));
  } catch (errore) {
    console.warn('Piattaforme non aggiornate per', id, errore.message);
  }
}
