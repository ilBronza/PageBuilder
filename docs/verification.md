# Verifiche e limiti

## Editor avanzato — 27 ottobre 2026

- **114 test Node**, tutti passati: validazione e parità PHP/JavaScript per stili, CSS controllato, responsive, metadati, rich text e quattro nuovi elementi; duplicazione, copia stili e importazione atomica.
- **26 test PHP, 156 asserzioni**, tutti passati su PHP 8.4.27: persistenza delle estensioni, controllo delle sorgenti nel rich text, conservazione delle mappe JSON vuote e degli array di stili nel catalogo, versionamento dei moduli importati e tutela delle variabili locali.
- **15 test browser** su Chrome: aggiunte prove di responsive reale e pagina pubblica, formattazione e incolli sanitizzati, variabili protette, classi/ID/disattivazione, copia stili, strumenti nell’anteprima, codice JSON e schermo intero, nuovi elementi ed editing delle tabelle.
- Prova manuale nell’app locale **GeG (Laravel 12)**: pubblicazione degli asset, importazione del template dimostrativo dedicato, salvataggio e anteprima PHP con un ordine. Gli override in `theme/variables.css` restano intatti. Le view personalizzate usano ora l’import map del package per evitare moduli obsoleti dalla cache.

I risultati delle sezioni successive descrivono gli incrementi precedenti.

## Variabili pubblicabili — 26 ottobre 2026

- **23 test PHP, 142 asserzioni**, tutti passati su PHP 8.4.23: pubblicazione dedicata `pagebuilder.variables`, funzionamento senza file locale, copia personalizzata conservata sia ripubblicando senza `--force` sia aggiornando `pagebuilder.assets --force`, URL versionato e caricamento nelle view e nelle opzioni del workspace.
- **11 test browser**, tutti passati: un file CSS locale con override parziali colora campioni, anteprima modificabile e anteprima isolata dei template collegati. I valori omessi restano quelli del package; il caricamento successivo del CSS pubblico non annulla gli override e i cambi di documento non duplicano il link nel documento dell’editor.
- **76 test Node**, tutti passati. Sintassi dei moduli JavaScript modificati e `git diff --check` verificati.
- La prova Laravel pubblica gli asset in una directory temporanea dedicata sotto `tests/runtime`, rimossa a fine test. Nessuna pubblicazione in applicazioni esterne.

## Palette colori — 26 ottobre 2026

- **10 test browser**, tutti passati su Chrome: nuova copertura dei colori effettivi di titoli, pulsanti e sfondi annidati, contrasto automatico, ripristino del tema, Annulla/Ripristina, persistenza e pagina pubblica.
- **76 test Node**, tutti passati: comprende parità PHP/JavaScript per ogni token di stile e tutte le varianti dei pulsanti, oltre ai test del motore e delle API.
- **22 test PHP, 124 asserzioni**, tutti passati con PHP 8.4.23 e il vendor condiviso `.ibtest`. Anche la prova WebAssembly PHP 8.5.8 completa le 124 asserzioni, segnalando due deprecazioni e un warning del comando di avvio; l’esecuzione nativa 8.4 è priva di warning.
- Schema JSON e fixture rigenerati dal catalogo. La palette CSS è condivisa da editor e contenuto pubblico; include un reset del contrasto per contenitori chiari dentro sezioni scure.

## Navigazione editor — 26 ottobre 2026

- **9 test browser**, tutti passati su Chrome: i cinque flussi precedenti più navigazione Builder/proprietà/schede, sincronizzazione con l’anteprima, catalogo ricercabile, inserimento nel punto scelto con un solo Annulla, trascinamento tra colonne, spostamento tramite destinazione, duplicazione e gestione dei frammenti/template.
- **15 test JavaScript e API del playground**, tutti passati (`core`, `inline`, `adapters`, `playground`).
- Verifica visuale del pannello sinistro nel browser a 1280 × 720: struttura e proprietà occupano schermate distinte, ritorno al Builder, schede e controlli di anteprima in basso.
- Controllo sintattico dei moduli JavaScript modificati e `git diff --check` completati.

Questa verifica riguarda l’editor frontend. Le suite PHP e di parità PHP/JavaScript non sono state rieseguite per questo incremento; i risultati del 4 ottobre sotto restano storici. Il formato dei documenti e i renderer non sono cambiati.

Aggiornamento: **4 ottobre 2026**. Esecuzione locale su macOS; nessuna installazione o modifica in progetti di produzione.

## Risultati eseguiti

- **22 test PHP, 124 asserzioni**, tutti passati: PHP 8.4.23, Laravel 11.51, PHPUnit 11.5.55, Testbench 9, SQLite in memoria. Lint di 33 file PHP completato.
- **60 test Node**, tutti passati: Node 20.19.5. Integrità dei documenti, storia locale, importazione atomica e annullabile, adapter, escaping, parità PHP/JS e API del playground.
- **5 test automatici nel browser**, tutti passati: Playwright 1.62.1 con Google Chrome 154.0.8037.95 in modalità headless. Server e dati temporanei isolati per ogni test.

I test browser percorrono:

1. Modifica, salvataggio e riapertura; importazione JSON e Annulla; rifiuto di importazione non valida senza perdere contenuto; selettore immagini; larghezza mobile effettiva di 390 px.
2. Salvataggio di un’area libera e modifica di un template condiviso; cambio del record d’anteprima senza perdere modifiche locali; propagazione del template a due record mantenendo distinte le aree.
3. Creazione, duplicazione, rinomina e assegnazione di template; recupero della pagina statica dalla cronologia.
4. Due finestre sulla stessa revisione: la seconda riceve un conflitto, conserva le modifiche e non sovrascrive la prima.
5. Errore di rete durante il cambio record: bozza, selezione e destinazione di salvataggio restano quelle originali.

Il test API del playground verifica anche importazione dei dati della demo precedente, scrittura atomica, rifiuto di origini esterne, persistenza dopo il riavvio e ripristino con revisione crescente.

I test Laravel aggiunti verificano il salvataggio HTTP dei frammenti come `static`, cronologia e ripristino, archiviazione di un documento preesistente prima della modifica, cambio statico/template, ripristino di template condivisi, permessi su record/area/template e recupero degli orfani tramite copia protetta da Gate dedicato. Le risposte conservano gli oggetti JSON vuoti nelle proprietà dei nodi.

## Esecuzione

```sh
npm test
composer test

# Browser, dopo aver installato le dipendenze di sviluppo:
npm install
npx playwright install chromium
npm run test:browser
```

I test Node richiedono PHP e le dipendenze Composer per verificare la parità dei renderer. Il test API apre un server temporaneo su localhost. Nell’ambiente condiviso locale il comando PHP usato è:

```sh
php ../.ibtest/vendor/phpunit/phpunit/phpunit -c phpunit.xml --no-coverage --do-not-cache-result
```

Il test browser può usare un browser già installato passando `PAGEBUILDER_BROWSER_EXECUTABLE`. `NODE_PATH` può indicare moduli Playwright già disponibili. I test non modificano `playground/.data`.

È incluso un workflow GitHub Actions per PHP 8.2/8.4, Node 20 e Chromium. **Il workflow è predisposto ma non è stato eseguito su GitHub in questa sessione**; i risultati sopra sono quelli locali.

## Limiti effettivi

- Laravel 11 e PHP 8.4 sono verificati dalla suite locale; GeG fornisce una prova manuale su Laravel 12. Le dipendenze Illuminate sono fornite dall’app ospitante; non è stata certificata l’intera compatibilità con Laravel 12/13 o altri PHP.
- Nessun test MySQL/PostgreSQL, stress concorrente multi-processo, audit accessibilità completo, browser diversi da Chromium o installazione pulita da Packagist in questa sessione.
- FileCabinet è testato con tipi locali reali `FormrowText`, `Formrow` e `Dossierrow`, ma caricamento del record simulato; non certifica una installazione completa. Nel playground i relativi valori sono dimostrativi.
- La gestione amministrativa è ora nel package. L’app continua a scegliere i record autorizzati, il perimetro/tenant, le sorgenti e le immagini pubbliche. Il package non espone automaticamente tutti i record e non contiene un nuovo archivio di upload media.
- La cronologia conserva gli stati salvati senza approvazioni editoriali o pubblicazione differita. Gli stati anteriori all’aggiornamento vengono inclusi dal primo salvataggio successivo; non si possono ricostruire versioni mai archiviate. La lista mostra le ultime 100 versioni.
- Il recupero copia documenti con ownership vuota, richiede un Gate dedicato e non elimina gli originali. Nessuna garbage collection automatica.
- Restano i limiti del formato v1: 500 nodi e 1 MB per documento, frammenti statici terminali, nessun HTML libero, ripetitore complesso o importazione YOOtheme.

La prima consegna del 17 settembre 2026 aveva 13 test PHP / 66 asserzioni e 55 test Node; i risultati attuali li sostituiscono.
