# Architettura e contratti

## Separazione

- `resources/js/core.js`: documento, validazione, comandi atomici, storia e checkpoint di salvataggio. Nessun accesso DOM, HTTP o Laravel.
- `resources/js/editor.js`: interfaccia incorporabile, accesso ai dati tramite adapter e selezione media tramite callback.
- `resources/js/render.js` / `src/Documents/Renderer.php`: resa UIkit. I casi in `tests/fixtures/parity.json` verificano lo stesso HTML per i due renderer. L’editor Laravel può usare l’endpoint PHP per un percorso unico, incluso il tema dell’app tramite `previewStyles`.
- `src/Services`: autorizzazioni, transazioni, revisioni, contesti e collegamenti.
- `src/Integrations/FileCabinetSource.php`: lettura circoscritta di tipi FileCabinet. Nessuna dipendenza FileCabinet nel nucleo frontend o nel renderer.

## Documento v1

```json
{
  "version": 1,
  "kind": "fragment",
  "children": [{
    "id": "row_1", "type": "row", "props": {"layout": ["1-1"]},
    "styles": {}, "bindings": {}, "children": [{
      "id": "column_1", "type": "column", "props": {},
      "styles": {}, "bindings": {}, "children": [{
        "id": "title_1", "type": "heading",
        "props": {"text": "Ciao", "tag": "h2", "size": "small"},
        "styles": {"color": "primary"}, "bindings": {}
      }]
    }]
  }]
}
```

La radice `page` contiene sezioni; la radice `fragment` contiene righe. Sezione → righe → colonne → elementi. `area` si inserisce in una colonna di un template pagina e risolve solo frammenti statici dichiarati: non può inserire un documento completo. I frammenti non ammettono `area` né binding e non possono applicare un template. Questa restrizione della v1 rende il grafo delle inclusioni aciclico. Esiste anche un controllo esplicito contro il riferimento all’area principale.

I tre oggetti `props`, `styles`, `bindings` sono separati, obbligatori e possono essere vuoti. `DocumentCast` e `Codec` mantengono `{}` nella serializzazione PHP, senza trasformarlo in `[]`. Gli ID dei nodi sono univoci nel documento. Duplicare un ramo rigenera tutti gli ID; spostarlo li conserva. La storia mantiene al massimo 100 comandi in memoria e non viene persistita.

`catalog.json` definisce proprietà, valori predefiniti, tipi di controlli e compatibilità con sorgenti; `styles.json` definisce token grafici ammessi. `document.schema.json` è uno schema JSON Schema 2020-12 generato da `node bin/generate-schema.mjs`. I validator PHP/JS applicano inoltre modalità, ID univoci, cardinalità delle sorgenti, conteggio totale (500 nodi), dimensione (1 MB), profondità e vincoli delle griglie. Lo schema JSON da solo non sostituisce questi controlli.

Larghezze: intera, metà, terzi, quarti e combinazioni 1/3–2/3 e 1/4–3/4, anche inverse. Le colonne si impilano sotto il breakpoint UIkit `s` (640 px). Lo stile del titolo è indipendente dal tag h1–h6. Le griglie funzionano con CSS, senza inizializzare JavaScript UIkit.

La riduzione del numero delle colonne concatena gli elementi rimossi nell’ultima colonna superstite, in ordine da sinistra a destra. Le impostazioni delle colonne eliminate vengono recuperate con Annulla: non vengono trasferite agli elementi o unite a quelle della colonna di destinazione. Aumentare le colonne ne aggiunge di vuote a destra.

## Esclusività, sostituzioni e orfani

Le associazioni usano foreign key dirette sul modello ospitante. Non c’è una relazione polimorfica. `ownership_key` è un hash SHA-256 di connessione, tabella, chiave del record e identità dell’area; è un vincolo opaco, non un modo per risalire al proprietario. La sua unicità protegge l’esclusività tra aree e tabelle diverse. Il contesto del record resta sempre esplicito.

Il servizio blocca il record e il contenuto in una transazione, confronta identità e revisione ricevute e crea/aggiorna esclusivamente il documento di quell’area. Record e contenuti devono essere sulla stessa connessione database. Il trait rifiuta l’assegnazione diretta di un contenuto con un’altra ownership, anche quando una normale foreign key sarebbe valida. Il rendering verifica nuovamente l’ownership e non mostra un documento associato abusivamente via query SQL.

- **Aggiornamento normale:** stesso documento e stesso riferimento, revisione incrementata.
- **Cambio statico/template:** sostituzione esplicita della fonte del layout dell’area; l’eventuale vecchio layout statico non è un backup. Le altre aree rimangono indipendenti.
- **Detach:** `ContentManager::detach()` annulla il riferimento e libera la ownership nella transazione; conserva il contenuto.
- **Sostituzione con un nuovo documento:** detach esplicito, quindi nuovo caricamento/salvataggio dell’area vuota. Per l’atomicità dell’intera operazione racchiudi le due chiamate nella stessa transazione. Nessun API accetta un ID arbitrario da associare; per recuperare un orfano, l’app autorizza il recupero e copia il suo documento in un nuovo contenuto.
- **Eliminazione Eloquent del proprietario:** libera le ownership e conserva i documenti. Il soft delete mantiene i riferimenti per consentire il ripristino. Le eliminazioni via query massiva/SQL e le cascade del database non invocano gli eventi Eloquent: possono lasciare ownership residue.
- **Eliminazione template:** il vincolo database la impedisce finché il template è referenziato. La v1 non espone un endpoint di eliminazione.

Non c’è garbage collection automatica. `PageContent::whereNull('ownership_key')` segnala candidati orfani, **non** autorizza da sola a eliminarli. La manutenzione dell’app deve cercare i riferimenti in tutte le tabelle note, incluse quelle fuori dal registro, considerare soft delete ed eventuali operazioni SQL, applicare una conservazione e richiedere una cancellazione esplicita. Non usare un listener di cancellazione per eliminare ciecamente i documenti.

Tutte le scritture del builder devono passare dai servizi. Operazioni SQL dirette, `saveQuietly()` e modifiche manuali delle ownership aggirano gli eventi: sono responsabilità del codice fidato dell’app. Clonare un record richiede annullare le FK del clone e copiare i documenti con il servizio, senza condividere i vecchi riferimenti.

## Sicurezza e dati

Gli elementi standard non accettano HTML, CSS libero, tag arbitrari o JavaScript. Testi e attributi vengono escapati. URL ammessi: http/https, percorso assoluto locale, ancora, mailto/tel; niente data URL, protocol-relative, backslash o caratteri di controllo. L’iframe dell’editor è sandboxed senza script, con CSP, e intercetta i link per selezionare il contenuto.

L’app sceglie dati, visibilità e sorgenti. Il server non interpreta percorsi o metodi ricevuti dal frontend. Una `Source` è configurata da codice fidato e può includere un predicato di autorizzazione; le collezioni vengono normalizzate a scalari (massimo 200). Valori di sorgenti mancanti o negati diventano vuoti, senza modificare il documento salvato. Cambiare lo schema delle sorgenti può rendere un vecchio binding non valido per un successivo salvataggio: va riparato o ricollegato esplicitamente.

La revisione è un controllo ottimistico su una singola entità, non un sistema editoriale. Un salvataggio riuscito aggiorna il checkpoint dello snapshot inviato; nuove modifiche durante il salvataggio restano dirty. Nessun salvataggio automatico e nessuna propagazione del template prima del commit.

## Estensioni

Registra un elemento con `Registry::register($type, $definition, $renderer)` nel provider dell’app, dopo la registrazione del package. L’elemento deve essere una foglia con ID tipo stabile, `label`, `icon`, `props` (con `kind` e `default`), `styles`, eventuale `templateOnly`. Il package aggiunge il tipo fra i figli ammessi di una colonna.

Fornisci all’editor lo stesso catalogo serializzato con `Codec::wire()` e un renderer JS in `renderers[type]`, oppure usa l’anteprima HTTP PHP. Le definizioni estese vanno aggiunte ai fixture di parità. I renderer personalizzati sono codice fidato: devono escapare i propri valori e possono influire sulla sicurezza dell’output.

Gli adapter browser implementano `load()` e `save(document)`, opzionalmente `preview(document, {signal})`. Un adapter esterno deve proteggere l’accesso e verificare una revisione o ETag. `httpAdapter` implementa GET/PUT, cookie same-origin, token CSRF, controllo degli errori e anteprima cancellabile per le route Laravel. L’app può passare un callback `pickImage()` che restituisce `{url, alt}` senza introdurre un archivio media nel builder.

Riferimenti UIkit: [griglie](https://getuikit.com/docs/grid), [larghezze responsive](https://getuikit.com/docs/width). UIkit è incluso con versione fissata; non si dipende da una CDN in esecuzione.
