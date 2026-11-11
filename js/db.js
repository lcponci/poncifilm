// Memoria locale del browser (IndexedDB): conserva l'archivio sul dispositivo.

const NOME_DB = 'poncifilm';
const CONTENITORE = 'dati';

let connessione = null;

function apri() {
  if (!connessione) {
    connessione = new Promise((risolvi, rifiuta) => {
      const richiesta = indexedDB.open(NOME_DB, 1);
      richiesta.onupgradeneeded = () => richiesta.result.createObjectStore(CONTENITORE);
      richiesta.onsuccess = () => {
        const db = richiesta.result;
        db.onclose = () => { connessione = null; };
        db.onversionchange = () => { db.close(); connessione = null; };
        risolvi(db);
      };
      richiesta.onerror = () => { connessione = null; rifiuta(richiesta.error); };
    });
  }
  return connessione;
}

async function operazione(modo, azione) {
  const db = await apri();
  return new Promise((risolvi, rifiuta) => {
    const transazione = db.transaction(CONTENITORE, modo);
    const richiesta = azione(transazione.objectStore(CONTENITORE));
    transazione.oncomplete = () => risolvi(richiesta.result);
    transazione.onerror = transazione.onabort = () => rifiuta(transazione.error);
  });
}

export const leggi = chiave => operazione('readonly', s => s.get(chiave));
export const scrivi = (chiave, valore) => operazione('readwrite', s => s.put(valore, chiave));

// Chiede al browser di non cancellare mai i dati per liberare spazio.
export async function chiediSpazioPermanente() {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch { /* non supportato: pazienza */ }
  return false;
}
