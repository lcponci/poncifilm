# PonciFilm

Archivio personale di film: pensato prima per iPhone, utilizzabile anche da Windows.
Le informazioni sui film arrivano da TMDb; i dati personali restano tuoi.

## Come è fatta

- **App web installabile** (PWA): sull'iPhone si apre l'indirizzo in Safari → Condividi → «Aggiungi alla schermata Home».
- **HTML, CSS e JavaScript semplici**, senza compilazione né framework: si modifica e si pubblica così com'è.
- **Indirizzo**: <https://lcponci.github.io/poncifilm/> (GitHub Pages, da questo repository pubblico).
- **Dati**: per ora nel browser del dispositivo (IndexedDB). Dalla fase 3 in un file JSON dentro un **repository GitHub privato** separato: ogni salvataggio diventa una versione recuperabile.
- **TMDb** per titoli, trame, locandine, cast, regia, compositore, saga e piattaforme in Italia (dati JustWatch).

## Decisioni prese

- Archiviazione: repository GitHub privato al posto di OneDrive (OneDrive obbligherebbe a riaccedere ogni 24 ore e richiede una registrazione Microsoft incerta). Possibile in futuro un pulsante per salvare una copia anche su OneDrive.
- Navigazione: due pagine, **Da vedere** (comprende i film da rivedere, segnati con ↻) e **Visti**. Gli **abbandonati** si raggiungono solo da Impostazioni (o cercandoli per titolo).
- Aggiunta: la priorità si sceglie subito, con un tocco, nel pannello del film. Anche i film da rivedere hanno una priorità.
- Scheda film: lo stato è un unico riquadro; toccandolo si scelgono stato e priorità. Ordine: trama, cast, regia e musica, dove vederlo, dettagli.
- Ricerca: «titolo anno» (es. «dune 1984») cerca la versione di quell'anno.
- Rivisioni: si conservano tutte le date di visione; voto e commento sono unici e aggiornabili.
- Stato «Da vedere»; priorità: **Day one / Il prima possibile / Prima o poi**.
- Colonna sonora: solo il compositore.
- Piattaforme: aggiornate quando si apre la scheda del film (al massimo una volta l'ora), con correzioni manuali che non vengono sovrascritte.
- Trama: italiana; se manca, quella inglese segnata «EN»; altrimenti vuota (mai dati inventati).

## Fasi

- [x] **0 – Preparazione**: progetto e Git.
- [x] **1 – Primo assaggio**: app installabile, ricerca TMDb, aggiunta a Da vedere/Visti, libreria a locandine, scheda film di base, funzionamento offline.
- [ ] **2 – Gestione**: voto con frase, riconoscimenti, commento, correzione date, piattaforme manuali, gestione riconoscimenti.
- [ ] **3 – Solidità**: sincronizzazione con il repository privato, esportazione CSV.
- [ ] **4 – Persone**: schede di attori, registi e compositori.
- [ ] **5 – Import da Notion** (CSV).
- [ ] Dopo: la Mensola, filtri e statistiche, serie TV, cortometraggi.

## Provare sul computer

```
python -m http.server 8000
```
poi aprire <http://localhost:8000> nel browser. Sul computer locale la copia offline è disattivata, così ogni modifica si vede subito.

## Prima di pubblicare una nuova versione

1. Aumentare la versione in `js/versione.js` **e** in `sw.js` (devono coincidere).
2. Se si aggiunge un file JS o CSS, elencarlo in `FILE_APP` dentro `sw.js`.
3. Eseguire i controlli: `node strumenti/controlla.mjs`

## Struttura

| Percorso | Contenuto |
|---|---|
| `index.html`, `manifest.webmanifest`, `sw.js` | Pagina, dati per l'installazione, copia offline |
| `css/app.css` | Aspetto grafico |
| `js/archivio.js` | Struttura dei dati e regole per modificarli |
| `js/tmdb.js`, `js/servizi.js` | Collegamento a TMDb e aggiornamenti automatici |
| `js/viste/` | Le schermate: libreria, aggiungi, film, impostazioni |
| `strumenti/` | Generatore delle icone e controlli |
