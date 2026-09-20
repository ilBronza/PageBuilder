# Verifica della prima consegna

Data: 17 settembre 2026. Ambiente macOS locale. Nessun progetto di produzione o sito 80-20 modificato.

## Verificato

Risultato finale: **13 test PHP, 66 asserzioni; 55 test Node, tutti passati**. Lint di 28 file PHP e controllo sintattico JavaScript completati; manifest Composer valido.

- PHP 8.4.22 nativo, Laravel 11.51.0, Testbench 9 e PHPUnit 11.5.55 dalle dipendenze condivise `.ibtest`; database SQLite in memoria. Scheletro e cache di test confinati in questo package.
- Suite PHP: persistenza Eloquent e HTTP, autorizzazioni, due modelli con due aree, ownership tra tabelle, detach/cancellazione senza perdita dei documenti, aggiornamento condiviso del template, rimozione/reinserimento area, gestione documenti invalidi, sorgenti e escaping, view Blade.
- Suite Node: comandi atomici, storia e stato dirty, riordino, duplicazione e ID, conservazione dei contenuti nelle griglie, adapter HTTP e conflitti. Fixture condivise verificano l’uguaglianza byte per byte del rendering PHP e JS, tutti gli elementi standard e i token grafici.
- FileCabinet: lettura del tipo reale locale `FormrowText` attraverso `BaseRow::getDossierrowValue`, con `Formrow`/`Dossierrow` reali e caricamento del record simulato, verificando che non avvenga alcun salvataggio. È una prova circoscritta dell’adattatore, non un test della persistenza FileCabinet completa.
- Browser Codex/Chromium: caricamento playground, modifica titolo, salvataggio, riapertura, scelta griglia 1/4 + 3/4, annullamento, duplicazione/eliminazione, anteprima mobile, template su due record, salvataggio di un’area libera e recupero dentro il template.
- Conflitto reale nel browser: due finestre caricano la stessa revisione; la prima salva, la seconda riceve 409 e mantiene il documento modificato. Il file precedente non viene sovrascritto.

## Limiti dichiarati

- La distribuzione richiede Illuminate 11. Esistono app locali Laravel 12/13, ma la suite condivisa ha Testbench 9 e dichiara un conflitto con Laravel 12: non è stata forzata una combinazione incompatibile per affermare un supporto non verificato.
- Non eseguiti test MySQL/PostgreSQL, stress di concorrenza, audit accessibilità completo, browser diversi da Chromium o installazione Composer pulita da Packagist. Composer non ha installato o modificato dipendenze.
- La UI amministrativa dell’archivio e la selezione dei record reali appartengono all’app ospitante: il package fornisce modelli, servizi, endpoint, descrittori e view editor; il playground mostra due record fissi. Creazione/rinomina di template sono disponibili tramite servizio/API.
- L’adattatore FileCabinet copre solo i tipi scalari dichiarati. Niente scrittura di dossier, metodi del modello, allegati privati, collezioni FileCabinet o selettori avanzati.
- Frammenti statici terminali, massimo 500 nodi e 1 MB per documento, niente rich text/HTML arbitrario o importazione YOOtheme. La riduzione delle colonne conserva gli elementi, mentre le impostazioni delle colonne rimosse sono recuperabili con Annulla.
- Nessuna pubblicazione web automatica, nessun repository remoto creato, nessuna installazione del package in un progetto dell’utente.
