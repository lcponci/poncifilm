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
- Scheda film: lo stato è un unico riquadro; toccandolo si apre un pannello con i tre stati (Da vedere, Da rivedere, Visto) e, solo per i primi due, la riga delle priorità. Tornando da vedere/da rivedere si riparte da «Prima o poi». «Abbandonato» è un link discreto in fondo. Tutti i pannelli si chiudono anche trascinandoli in basso. Ordine: trama, cast, regia e musica, dove vederlo, dettagli.
- Ricerca: ogni risultato mostra anno, regista (chiesto a TMDb subito dopo, per i primi 12) e titolo originale. «titolo anno» (es. «dune 1984») cerca la versione di quell'anno. I risultati sono ordinati per somiglianza al testo scritto (ignorando spazi, accenti e maiuscole) e notorietà; se nulla somiglia, l'app riprova da sola con varianti (spazi mancanti come «laland», ultima parola accorciata per gli errori di battitura).
- Rivisioni: si conservano tutte le date di visione (correggibili da «Modifica»); nella scheda si vede solo l'ultima, con il numero di visioni. Per i film visti il pulsante grande diventa «Rivisto» (o «Visto oggi» se la visione di oggi è già registrata). Voto e commento sono unici e aggiornabili.
- Recensione (stelle con frase, riconoscimenti, commento): nella scheda è in sola lettura; si cambia da «Modifica», in un pannello, per non toccarla per sbaglio. Dopo «Segna come visto» o «L'ho già visto» il pannello si apre da solo («Com'era?»). Toccare di nuovo la stella scelta toglie il voto.
- Riconoscimenti: menu a tendina a scelta multipla (si vedono solo quelli scelti). Si gestiscono in Impostazioni: rinominare mantiene i collegamenti ai film; eliminare li toglie anche dai film.
- Stato «Da vedere»; priorità: **Day one / Il prima possibile / Prima o poi**.
- Colonna sonora: solo il compositore.
- Piattaforme: aggiornate quando si apre la scheda del film (al massimo una volta l'ora), con correzioni manuali che non vengono sovrascritte.
- Trama: italiana; se manca, quella inglese segnata «EN»; altrimenti vuota (mai dati inventati).

## Fasi

- [x] **0 – Preparazione**: progetto e Git.
- [x] **1 – Primo assaggio**: app installabile, ricerca TMDb, aggiunta a Da vedere/Visti, libreria a locandine, scheda film di base, funzionamento offline.
- [x] **2 – Gestione**: voto con frase, riconoscimenti, commento, correzione date, piattaforme manuali, gestione riconoscimenti.
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
