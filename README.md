# PonciFilm

Archivio personale di film: pensato prima per iPhone, utilizzabile anche da Windows.
Le informazioni sui film arrivano da TMDb; i dati personali restano tuoi.

## Come è fatta

- **App web installabile** (PWA): sull'iPhone si apre l'indirizzo in Safari → Condividi → «Aggiungi alla schermata Home».
- **HTML, CSS e JavaScript semplici**, senza compilazione né framework: si modifica e si pubblica così com'è.
- **Indirizzo**: <https://lcponci.github.io/poncifilm/> (GitHub Pages, da questo repository pubblico).
- **Dati**: nel browser di ogni dispositivo (IndexedDB) e, una volta collegato da Impostazioni, nel file `poncifilm.json` di un **repository GitHub privato** separato (es. `poncifilm-dati`): ogni salvataggio è un commit, quindi ogni versione è recuperabile.
- **TMDb** per titoli, trame, locandine, cast, regia, compositore, saga e piattaforme in Italia (dati JustWatch).

## Decisioni prese

- Salvataggio online: l'app sincronizza da sola (all'avvio, al rientro nell'app, 5 secondi dopo ogni modifica, all'uscita, al ritorno della rete). Unione tra dispositivi: per ogni film vincono le scelte personali più recenti; informazioni TMDb e piattaforme automatiche dalla copia aggiornata più di recente; le eliminazioni restano, salvo modifiche successive; impostazioni: vince la versione più recente. Conflitti (due salvataggi insieme): si riscarica, si riunisce e si riprova. Il token (fine-grained, solo «Contents: Read and write» su quel repository) resta nel dispositivo; l'app rifiuta repository pubblici.
- Esportazione: copia completa (JSON) e tabella per Excel (CSV con punto e virgola e accenti corretti).
- Archiviazione: repository GitHub privato al posto di OneDrive (OneDrive obbligherebbe a riaccedere ogni 24 ore e richiede una registrazione Microsoft incerta). Possibile in futuro un pulsante per salvare una copia anche su OneDrive.
- Navigazione: barra con **Home**, **+** (grande, al centro) e **Visti**. La Home ha in alto **la Mensola** e sotto i film **Da vedere** (con quelli da rivedere, segnati con ↻), divisi per priorità; la ricerca nell'archivio si apre con la lente. Gli **abbandonati** si raggiungono da Impostazioni (o cercandoli).
- Mensola: i film «sempre belli, a prescindere da tutto», separati dal voto. Copertine in piedi su ripiani di legno (stile vecchia libreria di Apple Libri), 4 per ripiano sull'iPhone. Limite predefinito 16 (modificabile in Impostazioni, mai sotto il numero di film già presenti). Solo film visti o da rivedere; un tocco nella scheda per mettere/togliere, con «Annulla». «Riordina» mostra frecce e × su ogni copertina.
- Impostazioni: un menu come quello dell'iPhone (Riconoscimenti, Film abbandonati, Salvataggio online, Scarica una copia, Chiave TMDb), ognuno con il suo stato a destra e una pagina dedicata.
- Aggiunta: la priorità si sceglie subito, con un tocco, nel pannello del film. Anche i film da rivedere hanno una priorità.
- Scheda film: lo stato è un unico riquadro; toccandolo si apre un pannello con i tre stati (Da vedere, Da rivedere, Visto) e, solo per i primi due, la riga delle priorità. Tornando da vedere/da rivedere si riparte da «Prima o poi». «Abbandonato» è un link discreto in fondo. Tutti i pannelli si chiudono anche trascinandoli in basso. Ordine: trama, cast, regia e musica, dove vederlo, dettagli.
- Ricerca: ogni risultato mostra anno, regista (chiesto a TMDb subito dopo, per i primi 12) e titolo originale. «titolo anno» (es. «dune 1984») cerca la versione di quell'anno. I risultati sono ordinati per somiglianza al testo scritto (ignorando spazi, accenti e maiuscole) e notorietà; se nulla somiglia, l'app riprova da sola con varianti (spazi mancanti come «laland», ultima parola accorciata per gli errori di battitura).
- Rivisioni: si conservano tutte le date di visione (correggibili da «Modifica»); nella scheda si vede solo l'ultima, con il numero di visioni. Per i film visti il pulsante grande diventa «Rivisto» (o «Visto oggi» se la visione di oggi è già registrata). Voto e commento sono unici e aggiornabili.
- Recensione (stelle con frase, riconoscimenti, commento): nella scheda è in sola lettura; si cambia da «Modifica», in un pannello, per non toccarla per sbaglio. Dopo «Segna come visto» o «L'ho già visto» il pannello si apre da solo («Com'era?»). Toccare di nuovo la stella scelta toglie il voto.
- Riconoscimenti: menu a tendina a scelta multipla (si vedono solo quelli scelti). Si gestiscono in Impostazioni: rinominare mantiene i collegamenti ai film; eliminare li toglie anche dai film.
- Stato «Da vedere»; priorità: **Day one / Il prima possibile / Prima o poi**.
- Colonna sonora: solo il compositore.
- Persone: toccando regista, attori o compositore nella scheda del film si apre la loro scheda (foto, mestiere, nascita, biografia italiana o «EN») con la filmografia a locandine divisa in Regia / Cast / Musica, ordinabile per notorietà o per anno, con il filtro «Solo i tuoi». I film già nell'archivio hanno un bollino con lo stato; gli altri si aggiungono con un tocco. Esclusi i ruoli «sé stesso» e le immagini di repertorio. Le schede non vengono salvate nell'archivio: si scaricano da TMDb quando servono (e restano in memoria finché l'app è aperta).
- Ricerca per autore: in «Aggiungi» si può scrivere anche il nome di un regista o di un attore; le persone compaiono in cima (solo se il nome somiglia davvero e hanno fatto film conosciuti). Nella libreria la ricerca guarda anche regista, compositore e attori.
- Piattaforme: aggiornate quando si apre la scheda del film (al massimo una volta l'ora), con correzioni manuali che non vengono sovrascritte.
- Trama: italiana; se manca, quella inglese segnata «EN»; altrimenti vuota (mai dati inventati). Le trame lunghe si mostrano accorciate, con «Mostra di più».
- Film inseriti a mano (quando TMDb non lo conosce o non risponde): da «Non lo trovi? Inseriscilo a mano» in Aggiungi. Solo il titolo è obbligatorio; locandina dalle foto, ritagliata 2:3 e ridotta (360×540 JPEG) e salvata nell'archivio. Nessun numero TMDb (id `mano-…`), nessun aggiornamento automatico; si correggono da «Modifica i dati del film».

## Fasi

- [x] **0 – Preparazione**: progetto e Git.
- [x] **1 – Primo assaggio**: app installabile, ricerca TMDb, aggiunta a Da vedere/Visti, libreria a locandine, scheda film di base, funzionamento offline.
- [x] **2 – Gestione**: voto con frase, riconoscimenti, commento, correzione date, piattaforme manuali, gestione riconoscimenti.
- [x] **3 – Solidità**: sincronizzazione con il repository privato, esportazione CSV.
- [x] **4 – Persone**: schede di attori, registi e compositori; ricerca per autore.
- [x] **Mensola** (anticipata): nuova Home, ripiani, riordino, limite. Più film inseriti a mano e trama accorciata.
- [ ] **5 – Import da Notion** (CSV).
- [ ] Dopo: filtri e statistiche, serie TV, cortometraggi.

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
| `js/sincronizzazione.js` | Salvataggio online nel repository GitHub privato |
| `js/esporta.js` | Copie scaricabili (JSON e CSV) |
| `js/viste/` | Le schermate: libreria (Home, Visti), mensola, aggiungi, film, film a mano, persona, impostazioni |
| `strumenti/` | Generatore delle icone e controlli |
