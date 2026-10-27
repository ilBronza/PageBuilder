# Evoluzione dell’editor

## Navigazione del pannello sinistro — 26 ottobre 2026

Il riferimento di interazione è il builder YOOtheme: struttura visuale della pagina, apertura del singolo elemento in un pannello dedicato, schede delle proprietà e ritorno esplicito al Builder. L’osservazione del riferimento è avvenuta senza salvare modifiche sul sito remoto.

Il primo incremento introduce:

- Vista Layout con colonne proporzionate alla griglia, elementi trascinabili e comandi contestuali; vista Albero alternativa con rami comprimibili.
- Una sola schermata laterale alla volta. L’apertura di un elemento sostituisce la struttura con le proprietà; «← Builder» ripristina la struttura e porta il focus sull’elemento selezionato.
- Contenuto, Impostazioni e Avanzate, mostrando soltanto le schede pertinenti. Le strutture aprono direttamente le Impostazioni; testi, immagini e altri elementi aprono il Contenuto.
- Selezione dalla pagina d’anteprima e percorso per risalire a colonna, riga e sezione.
- Catalogo con ricerca, descrizioni e destinazione visibile. Gli elementi personalizzati registrati dal progetto restano disponibili; le aree libere compaiono solo nella modalità template.
- Inserimento dopo un elemento, riga o sezione con una sola operazione annullabile. Duplicazione, spostamento, salvataggio e riapertura continuano a utilizzare il motore esistente.
- Controlli di anteprima e comando per nascondere il pannello nel piè di pagina della sidebar.

La selezione, la schermata aperta, la ricerca e i rami compressi sono stato dell’interfaccia: non vengono scritti nel documento. Non sono necessarie migration o conversioni dei documenti salvati. Le integrazioni Laravel devono ripubblicare gli asset, incluso il nuovo modulo `composition.js`.

## Strumenti di editing — 27 ottobre 2026

Implementati i punti 1, 2, 4, 6 e 7 della proposta:

- Gruppi di impostazioni, tipografia, bordi, ombre, misure, spaziature per lato e sfondi immagine, con valori predefiniti dal file di variabili pubblicabile.
- Testo formattato strutturato, collegamenti, elenchi, variabili protette e conversione in testo semplice. HTML incollato normalizzato prima di entrare nel modello.
- Override di stili, misure, colonne e visibilità per Tablet/Mobile, con identica resa PHP/JavaScript e anteprime dimensionate a 1280/820/390 px.
- Nomi dei blocchi, disattivazione, copia/incolla stili, evidenziazione tra struttura e anteprima, comandi direttamente sul blocco, toolbar persistente e schermo intero.
- Card, icona vettoriale, tabella con celle modificabili e immagine affiancata al testo.
- Campi Avanzate per ID, classi e dichiarazioni CSS controllate. HTML dell’anteprima consultabile/copiabile; JSON modificabile con validazione atomica e annulla/ripristina.

Restano futuri la libreria di sezioni (punto 3) e i ripetitori/condizioni dinamiche (punto 5), non inclusi nella selezione dell’utente. Gallerie, accordion e slider sono ulteriori estensioni del catalogo. L’HTML generato resta derivato dal documento strutturato: non viene reimportato come struttura visuale.
