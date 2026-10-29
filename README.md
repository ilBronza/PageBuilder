# IlBronza PageBuilder

Package Laravel con editor visuale incorporabile e renderer UIkit. Include pagine statiche, template condivisi, sorgenti dichiarate e documenti locali per le aree di un record. L’editor è JavaScript ESM senza dipendenze da Laravel, React, Vue o compilazione. Nessun progetto esterno viene modificato o installato dal playground.

## Provalo

```sh
cd pageBuilder
npm run playground
```

Apri **http://127.0.0.1:4173**. Serve Node 20+. Non serve `npm install`. Il server ascolta solo su localhost. Cambia un titolo, scegli una griglia, salva, premi **Riapri** e apri **pagina salvata**. I dati e la cronologia sono in `playground/.data/workspace.json`, scritto con sostituzione atomica e revisione controllata. Al primo salvataggio vengono inclusi i precedenti file `page.json`, `template.json` e `area-*.json`, che restano intatti. Riavviando il server rimangono disponibili.

La barra di gestione permette di scegliere record e area, creare, duplicare e rinominare template, applicarli al record, importare/esportare JSON e ripristinare una versione dalla cronologia. Il selettore «Modifica» alterna contenuto del record e template condivisi. I record dimostrativi Arco e Tratto hanno dati e aree diversi: modificare e salvare il template modifica entrambi, cambiare il record d’anteprima non salva i suoi valori nel layout. I valori indicati come FileCabinet nel playground sono dati dimostrativi; il vero adattatore PHP è separato e testato sul tipo locale `FormrowText`.

Il pannello sinistro segue il percorso **Builder → elemento → Builder**. La vista Layout rappresenta sezioni, righe e colonne; la vista Albero offre una struttura comprimibile. Selezionare un elemento nel layout o nell’anteprima apre le sue proprietà a tutta altezza: **Contenuto** per testi, immagini e collegamenti, **Impostazioni** per griglia e aspetto, **Avanzate** per spostamento e gestione. «← Builder» torna alla struttura conservando le modifiche. Le schede mostrate dipendono dal tipo di elemento.

Il pulsante + in una colonna apre il catalogo ricercabile; il + tra gli elementi inserisce nel punto scelto. Anche la barra dell’elemento sopra l’anteprima permette di aggiungere subito dopo la selezione. Ogni inserimento si annulla con una sola operazione. I controlli desktop/tablet/mobile e il comando per nascondere il pannello sono fissi in basso a sinistra. Vedi [evoluzione dell’editor](docs/evoluzione-editor.md) per il percorso di sviluppo.

In **Impostazioni**, i campioni colore permettono di scegliere **Primary, Secondary, Successo, Avviso e Pericolo**, oltre a sfondi neutri e colori del testo (tenue, enfasi, bianco). Gli sfondi si applicano a sezioni, colonne, titoli, testi ed elenchi; i pulsanti hanno le stesse varianti semantiche. «Tema globale» rimuove la scelta locale. Lo sfondo imposta automaticamente un testo leggibile; il colore esplicito del testo ha precedenza. Le modifiche sono annullabili e vengono mantenute nel salvataggio.

La palette legge i valori da [`resources/css/variables.css`](resources/css/variables.css), separato dalle regole di stile. Il file contiene Primary, Secondary, Successo, Avviso, Pericolo, toni neutri e colori di contrasto. Per personalizzarlo nell’app Laravel:

```sh
php artisan vendor:publish --tag=pagebuilder.assets --force
php artisan vendor:publish --tag=pagebuilder.variables
```

Modifica **`public/vendor/pagebuilder/theme/variables.css`** nel progetto ospitante. Puoi mantenere solo le variabili che vuoi cambiare; quelle omesse ereditano i valori del package. Per esempio:

```css
:root {
  --pb-palette-primary: #6844b5;
  --pb-palette-primary-contrast: #fff;
  --pb-palette-secondary: #164c70;
  --pb-palette-secondary-contrast: #fff;
}
```

Le view Laravel e `WorkspaceOptions` rilevano automaticamente il file pubblicato: lo stesso URL viene usato per campioni, anteprima dell’editor, anteprima dei template collegati e contenuto pubblico. Non serve configurare gli iframe separatamente. L’URL include una versione basata sul contenuto; dopo aver modificato il file basta ricaricare la pagina. Senza copia locale viene usata la palette del package, senza richieste a file mancanti.

**`pagebuilder.assets --force` non sovrascrive la copia in `theme/`.** Anche ripetere `pagebuilder.variables` senza `--force` la conserva. Usa `--tag=pagebuilder.variables --force` soltanto per ripristinare intenzionalmente i valori originali. Aggiungi la copia locale al controllo versione dell’app. I valori predefiniti sono in un layer CSS con priorità inferiore agli override, anche se il CSS del contenuto viene caricato più tardi.

Per un’integrazione JavaScript diretta passa `variablesUrl` a `mountEditor` o `mountWorkspace`: viene caricato nel documento dell’editor e aggiunto anche a `previewStyles` personalizzati. Nella pagina pubblica senza la view `pagebuilder::content`, includi lo stesso URL dopo `content.css`; in Laravel puoi ottenerlo con `app(\IlBronza\PageBuilder\Services\ThemeAssets::class)->variablesUrl()`. Puoi aggiungere altre variabili CSS al file; per renderle nuovi token selezionabili occorre anche estendere catalogo e schema.

Le view del package versionano CSS e moduli JavaScript in base al contenuto pubblicato. Nelle integrazioni Blade personalizzate includi `@include('pagebuilder::assets')` **prima** degli script `type="module"`: l’import map aggiorna anche le dipendenze del modulo principale. Passa inoltre `previewStyles => $theme->previewStyles()` e `defaultVariablesUrl => $theme->assetUrl('css/variables.css')` nelle opzioni dell’editor, con `$theme = app(\IlBronza\PageBuilder\Services\ThemeAssets::class)`. I default restano in un layer CSS inferiore agli override locali. Dopo `vendor:publish --tag=pagebuilder.assets --force` basta ricaricare la pagina per usare i nuovi file.

## Compatibilità e test

Verificato su **PHP 8.4.23, Laravel 11.51.0, PHPUnit 11.5.55, Testbench 9, SQLite in memoria, Node 20.19.5**. `composer.json` richiede PHP ^8.2; le dipendenze Illuminate sono fornite dall’app Laravel ospitante. La suite è stata verificata con Laravel 11. Nessuna verifica su MySQL/PostgreSQL o PHP 8.2/8.3 in questa consegna.

```sh
npm test
# Test automatici nel browser (dipendenza di sviluppo opzionale):
npm install
npx playwright install chromium
npm run test:browser
# Dopo aver installato le dipendenze Composer nel checkout:
composer test
# Ambiente condiviso esistente su questo Mac:
php ../.ibtest/vendor/phpunit/phpunit/phpunit -c phpunit.xml --no-coverage
```

`tests/bootstrap.php` usa il vendor del package oppure, nello sviluppo nel monorepo IlBronza, `../.ibtest/vendor`; `PAGEBUILDER_TEST_VENDOR` può indicare un altro vendor compatibile. Copia lo scheletro Testbench in `tests/runtime`, senza scrivere nel vendor condiviso. Non usa `RefreshDatabase`.

I test coprono integrità, storia, griglie, duplicazione, errori HTTP, parità PHP/JS, Eloquent su due modelli, aree multiple, template condivisi, accessi negati, escaping, perdita di riferimenti e contenuti orfani. Il test opzionale FileCabinet usa i tipi reali locali `FormrowText`, `Formrow` e `Dossierrow` con il caricamento del record simulato: non certifica una installazione completa di FileCabinet. Vedi [verifiche e limiti](docs/verification.md).

## Installazione Laravel

Il nome Composer è `ilbronza/pagebuilder`, namespace `IlBronza\PageBuilder`. Il package è disponibile su Packagist:

```sh
composer require ilbronza/pagebuilder
```

Per lo sviluppo locale puoi usare invece un repository Composer `path` nell’app ospitante, con URL della cartella.

```json
{"repositories":[{"type":"path","url":"../pageBuilder","options":{"symlink":true}}]}
```

Il provider viene scoperto automaticamente. I suoi asset sono pronti da pubblicare e le migration vengono caricate automaticamente:

```sh
php artisan vendor:publish --tag=pagebuilder.config
php artisan vendor:publish --tag=pagebuilder.assets
php artisan migrate
```

Le tabelle sono `pagebuilder_templates`, `pagebuilder_contents` e `pagebuilder_revisions`; gli ID sono unsigned BIGINT. Le migration dell’app aggiungono le proprie foreign key nullable verso `pagebuilder_contents`, anche se la chiave primaria del modello è un UUID. Vedi [migration d’esempio](examples/add_product_areas.php).

I package Crud, Form, FormField, UikitTemplate e FileCabinet **non sono dipendenze obbligatorie**. Il renderer usa CSS UIkit 3.21.16 MIT, incluso localmente per il playground; nel sito puoi usare il tuo tema UIkit. Il contenuto pubblico non richiede JavaScript UIkit né il codice dell’editor. Dopo questo aggiornamento esegui `php artisan migrate` per la cronologia e pubblica di nuovo gli asset con `php artisan vendor:publish --tag=pagebuilder.assets --force`.

## Modelli, aree e autorizzazioni

Applica `HasPageContent` e implementa `pageBuilderContext()` e `pageBuilderAreas()`. [Product.php](examples/Product.php) dichiara due aree: `main` (pagina completa) e `description` (frammento). Le chiavi sono identità stabili: cambiare l’etichetta non cambia i collegamenti. Il medesimo trait funziona su modelli diversi.

Registra classi e contesti in `config/pagebuilder.php`:

```php
'hosts' => ['products' => ['model' => App\Models\Product::class, 'context' => 'product']],
'contexts' => ['product' => App\PageBuilder\ProductContext::class],
```

Le route accettano esclusivamente alias configurati, mai nomi di classi o percorsi di relazioni inviati dall’editor. Le route sono abilitate con middleware `web` e `auth`; si possono disabilitare con `routes => false` e usare i servizi nelle proprie route. L’integrazione deve definire tre Gate. Senza Gate il package nega l’accesso:

```php
Gate::define('pagebuilder.view', function (?User $user, Model $record, string $area) {
    return $user?->can('view', $record) === true;
    // Per il sito pubblico consenti esplicitamente solo record pubblicati e aree pubbliche.
});
Gate::define('pagebuilder.update', function (User $user, Model $record, string $area) {
    return $user->can('update', $record); // aggiungi qui le regole specifiche dell’area
});
Gate::define('pagebuilder.template', function (User $user, string $action, string $context, $template = null) {
    return $user->can('manage-page-templates');
});
```

Le azioni template sono `list`, `view`, `create`, `update`, `use`. Il contesto e il template consentono policy più fini. Il renderer pubblico usa `pagebuilder.view` sul record e su ogni area inclusa. Per visitatori anonimi, il Gate deve accettare `?User` e autorizzare esplicitamente la visibilità pubblica. Le sorgenti possono avere un ulteriore predicato di autorizzazione.

## Schermata di gestione pronta

Dopo aver registrato modello, contesto e Gate, apri la route autenticata:

```php
route('pagebuilder.workspace', ['host' => 'products', 'record' => $product->getKey()])
// /pagebuilder/records/products/123/edit
```

Per avere il selettore di più record nel tuo layout, passa una collezione già filtrata dall’app (ad esempio per tenant) a `WorkspaceOptions`. Il servizio include soltanto record e aree autorizzati sia in lettura sia in modifica:

```blade
@php
    $options = app(\IlBronza\PageBuilder\Services\WorkspaceOptions::class)
        ->forRecords('products', $products, auth()->user());
    $options['media'] = [
        ['url' => '/media/prodotto.jpg', 'alt' => 'Vista frontale del prodotto', 'label' => 'Foto principale'],
    ];
@endphp
@include('pagebuilder::workspace', ['options' => $options])
```

Non esiste un endpoint che enumeri tutti i record dell’app. Ogni record delle opzioni può avere un `publicUrl` per area, impostato dall’integrazione. Per le immagini puoi usare la lista pubblica `media`, il media manager Spatie descritto sotto oppure un callback `pickImage()` personalizzato. Vedi [esempio completo](examples/workspace.blade.php).

**Importa JSON** valida struttura, tipo, sorgenti e limite di 1 MB prima di cambiare il documento. L’importazione resta locale fino a Salva ed è annullabile. **Cronologia** mostra le ultime 100 versioni salvate dell’area o del template; il ripristino usa le stesse autorizzazioni, validazioni e revisioni del salvataggio normale. Un conflitto lascia intatte le modifiche locali.

Le versioni sono conservate senza cancellazione automatica. Per contenuti precedenti all’aggiornamento, il primo salvataggio archivia anche lo stato precedente. Ripristinare il collegamento di un’area a un template continua a usare l’ultima versione di quel template; per recuperare un suo layout precedente, usa la cronologia del template. Le modifiche condivise diventano visibili immediatamente dopo il salvataggio riuscito.

Il pulsante **Recupera documento** è opzionale e richiede un Gate aggiuntivo, negato per default:

```php
Gate::define('pagebuilder.recover', function (User $user, string $action, $content = null) {
    // Verifica anche il perimetro/tenant del documento nella tua applicazione.
    return $user->can('recover-page-content');
});
```

Le azioni sono `list` e `view`. La lista contiene al massimo 100 candidati con ownership vuota, filtrati dal Gate sul singolo documento. Il recupero **copia** il contenuto nell’area selezionata, preserva l’originale e ricontrolla i permessi del record di destinazione. Il package non elimina né ricollega automaticamente gli orfani.

## Salvataggio e rendering

Salva prima il modello proprietario. Il servizio carica il contenuto con la sua identità e revisione, da ripassare al salvataggio:

```php
$manager = app(\IlBronza\PageBuilder\Services\ContentManager::class);
$state = $manager->load($product, 'main', $user);
$state['document'] = $document; // {version:1, kind:'page', children:[...]}
$manager->save($product, 'main', $state, $user);

// Stesso editor, documento fragment e area description.
$local = $manager->load($product, 'description', $user);
$local['document'] = $fragment;
$manager->save($product, 'description', $local, $user);
```

Per incorporare l’editor usa [l’esempio Blade](examples/editor.blade.php). La view si include in una pagina autorizzata dell’app; non viene imposto un layout amministrativo o il routing del progetto. Per `description`, passa `mode => 'area'`, `kind => 'fragment'` e l’URL dell’area. L’anteprima HTTP riusa il renderer PHP pubblico.

Nel frontend:

```blade
@include('pagebuilder::content', ['record' => $product, 'area' => 'main'])
```

Se carichi già il tuo CSS UIkit passa `loadUikit => false`. Puoi usare direttamente `{!! $product->renderPageArea('main', auth()->user()) !!}` includendo `content.css` nel layout. Errori strutturali o dati non disponibili non espongono dettagli tecnici al visitatore: il renderer restituisce vuoto e segnala l’errore al logger Laravel. Non riscrive il documento danneggiato.

## Media manager con Spatie

Il selettore integrato consente di caricare immagini, cercarle, filtrarle per cartella, modificarne nome e testo alternativo, quindi inserirle nei blocchi o negli sfondi. È opzionale: il builder continua a funzionare senza Spatie quando `mediaLibrary` non è configurata.

L’app ospitante deve avere `spatie/laravel-medialibrary` v11, la sua tabella `media` e GD o Imagick configurato. Esegui le migrazioni del package per creare `pagebuilder_media_libraries`, poi ripubblica gli asset:

```sh
php artisan migrate
php artisan vendor:publish --tag=pagebuilder.assets --force
```

In `config/pagebuilder.php` dichiara gli archivi consentiti e un disco Laravel pubblico:

```php
'media' => [
    'libraries' => [
        'documents' => ['label' => 'Immagini documenti', 'disk' => 'builder_media'],
    ],
    'max_kb' => 10240,
    'max_pixels' => 40000000,
],
```

Il disco deve dichiarare `visibility => public` e fornire URL raggiungibili dal browser. Per un disco locale puoi usare una directory e un collegamento pubblico dedicati, evitando di esporre gli altri allegati dell’app. Il manager elenca solo la propria collezione `pagebuilder-images`; gli allegati Spatie già presenti su altri modelli non vengono importati automaticamente.

L’app autorizza separatamente lettura, upload e modifica dei metadati tramite il Gate `pagebuilder.media`. L’alias identifica l’intero archivio: verifica qui anche il tenant quando necessario.

```php
Gate::define('pagebuilder.media', fn ($user, string $action, string $library) =>
    $library === 'documents'
    && in_array($action, ['view', 'upload', 'update'], true)
    && Gate::forUser($user)->allows('document-templates.manage'));

$options['mediaLibrary'] = app(\IlBronza\PageBuilder\Services\MediaOptions::class)
    ->forLibrary('documents', auth()->user());
```

Passa queste opzioni a `pagebuilder::editor`, `pagebuilder::workspace` oppure a `mountEditor`/`mountWorkspace`. Le view Blade includono il token CSRF; se monti direttamente da JavaScript passa anche `csrfToken`. Le route della libreria sono protette dai middleware del package e dal Gate. Senza autorizzazione di lettura, `forLibrary()` restituisce `null`.

La precedenza è: callback `pickImage` personalizzato, libreria `mediaLibrary`, lista statica `media` del workspace. Il callback riceve `{target: 'image' | 'background'}` e restituisce `{url, alt}` oppure `null`.

- Formati caricabili: JPEG, PNG, WebP e GIF; massimo 10 MB per file con la configurazione predefinita, 10.000 pixel per lato e 40 megapixel. Il server controlla il contenuto del file e assegna un nome UUID.
- Fino a 10 file per selezione, caricati in sequenza; 36 immagini per pagina e massimo 30 richieste di upload al minuto. Le cartelle sono etichette organizzative.
- La miniatura WebP viene generata durante il caricamento. Se la conversione fallisce, viene rimosso solo il nuovo upload fallito.
- Upload e modifiche ai dettagli sono salvati subito nella libreria. L’inserimento nel documento diventa persistente con **Salva** ed è annullabile con una sola operazione Undo, inclusi URL e testo alternativo.
- Gli sfondi rispettano il dispositivo selezionato nell’editor. Sono decorativi e non hanno testo alternativo.
- Il documento conserva URL e testo alternativo, senza duplicare il file. Modificare i metadati della libreria non riscrive i blocchi già salvati.

Questa versione non include eliminazione, ritaglio, sostituzione dei file o upload SVG.

## Template e sorgenti

L’archivio è disponibile via modello `PageTemplate`, servizio `TemplateManager` e API. Crea un template con contesto dichiarato e documento `page` in modalità template:

```php
$template = app(\IlBronza\PageBuilder\Services\TemplateManager::class)->save(null, [
    'name' => 'Scheda prodotto', 'context' => 'product', 'revision' => 0,
    'document' => $templateDocument,
], $user);

$state = $manager->load($product, 'main', $user);
$manager->save($product, 'main', [
    'id' => $state['id'], 'revision' => $state['revision'],
    'mode' => 'template', 'template_id' => $template->id, 'document' => null,
], $user);
```

Un contenuto statico ha il proprio documento; uno collegato al template ha `document = null`. Passare da una modalità all’altra è una sostituzione esplicita del layout dell’area: la cronologia conserva lo stato precedente e consente di ripristinarlo. Le altre aree non vengono toccate. Gli aggiornamenti del template diventano visibili dopo il commit del salvataggio. Non ci sono copie del layout, revisioni bloccate o cache del template nel modello proprietario.

[ProductContext.php](examples/ProductContext.php) espone attributo, relazione singola, collezione di stringhe e campo FileCabinet. Ogni `Source` ha ID, etichetta, tipo, cardinalità e callback di lettura server. Le callback definiscono esattamente quali dati possono essere letti. Tipi: `text`, `number`, `date`, `boolean`, `url`, `image`; cardinalità `one` e `many`. Le collezioni di scalari alimentano l’elenco; non esistono ripetitori di layout, query o filtri generici. Non vengono serializzati modelli interi.

Un titolo collegato salva `bindings: {"text": "product.name"}`. L’editor tiene i valori del record di esempio in uno stato separato dal documento. Le sorgenti mancanti producono testo vuoto o elenco vuoto; non ripiegano su valori d’anteprima salvati. Fonti non dichiarate/incompatibili vengono rifiutate al salvataggio del template.

Usa [template-editor.blade.php](examples/template-editor.blade.php) per modificare un template su un record autorizzato. L’app seleziona il record di esempio e passa il suo URL di anteprima: questo evita un endpoint che esponga indiscriminatamente tutti i record. La view `pagebuilder::workspace` offre la gestione amministrativa incorporabile; l’editor singolo resta disponibile per integrazioni personalizzate.

### FileCabinet

`FileCabinetSource::field(id, label, formName, fieldName, type, authorize)` legge il campo dichiarato tramite `getDossierRowByNames()`, quindi usa direttamente il row reader. Evita `Dossierrow::getValue()`, che può convertire un TypeError in testo visibile. Il primo dossier e la prima riga sono quelli selezionati dall’API locale di FileCabinet (dossier più recente).

Supportati: testo, textarea, interi, decimali, booleani, date/datetime non multipli e non ripetibili. File, allegati privati, selettori, JSON e metodi arbitrari sono esclusi. Gli attributi e le relazioni del modello si espongono con `Source` esplicite. Per immagini pubbliche usa una `Source` di tipo `image` con callback autorizzata oppure `pickImage()` nel frontend; non trasformare URL di allegati privati in risorse di presentazione.

## API e incorporamento autonomo

| Metodo | Percorso relativo al prefisso `pagebuilder` | Funzione |
| --- | --- | --- |
| GET | `records/{host}/{record}/edit` | Schermata di gestione del record |
| GET | `records/{host}/{record}/areas/{area}/history/{revision?}` | Cronologia e singola versione dell’area |
| GET | `templates/{template}/history/{revision?}` | Cronologia e singola versione del template |
| GET | `contents/orphans` / `contents/orphans/{content}` | Recupero opzionale protetto da Gate dedicato |
| GET / PUT | `records/{host}/{record}/areas/{area}` | Carica / salva un’area |
| POST | `records/{host}/{record}/areas/{area}/preview` | Anteprima statica PHP |
| GET / POST | `templates?context=product` / `templates` | Elenco e descrittori / creazione |
| GET / PUT | `templates/{template}` | Carica / aggiorna un template |
| POST | `templates/{template}/preview/{host}/{record}/{area}` | Anteprima template sul record |

Il salvataggio statico accetta `id`, `revision`, `mode`, `document`; il collegamento al template accetta `template_id` e documento nullo. ID nullo e revisione 0 identificano un’area vuota. Template: `name`, `context` alla creazione, `revision`, `document`. Una revisione obsoleta restituisce 409; documenti invalidi 422; accessi negati 403. Si applicano autenticazione, CSRF e limiti HTTP dell’app. Imposta un limite al corpo della richiesta nel web server oltre al limite del documento di 1 MB.

```js
import {mountEditor} from '/vendor/pagebuilder/js/editor.js';
const editor = await mountEditor(document.querySelector('#builder'), {
  mode: 'static', title: 'La mia pagina',
  adapter: {
    async load() { return await myStore.load(); },
    async save(document) { await myStore.save(document); },
    // Facoltativo: async preview(document, {signal}) { return html; }
  },
  // Facoltativo: async pickImage() { return {url: '/media/public.jpg', alt: '...'}; }
});
// editor.engine, editor.reload(), editor.setPreview(values, areaDocuments), editor.destroy()
```

Carica `editor.css`; la libreria carica i descrittori JSON e il CSS di anteprima dal percorso relativo agli asset. Puoi fornire `catalog`, `styles`, `variablesUrl`, `previewStyles`, `sources`, `areas`, `areaLabels`, `values`, `areaDocuments` e `renderers`. Un adapter di persistenza deve salvare lo snapshot passato senza trasformarlo e restituire un errore in caso di conflitto; il salvataggio non è automatico. Errori di caricamento impediscono di salvare sopra un documento non compreso. L’export permette di recuperare il JSON.

## Stili, responsive e codice

Il pannello **Impostazioni** raggruppa layout, tipografia, sfondo, spaziature, bordi e ombre. I preset usano le variabili pubblicabili di `variables.css`, ora estese a misure, font, bordi e ombre. Nei gruppi personalizzati puoi indicare misure come `24px`, `1.5rem` o `var(--pb-space-small)`, anche separatamente per ciascun lato, e un’immagine di sfondo pubblica. Per un font locale imposta una variabile (es. `--brand-font`) nel tema e usa `var(--brand-font)`.

**Base** vale per tutti i dispositivi; **Tablet** applica override fino a 1199 px; **Mobile** fino a 639 px ed eredita anche Tablet. Le selezioni di colore/stile senza valore ereditano. Il controllo visibilità ha Eredita/Mostra/Nascondi. Le righe possono avere larghezze responsive senza cambiare numero o contenuto delle colonne. Se cambi la struttura di base, vengono eliminate solo le larghezze responsive non più compatibili. Le anteprime usano viewport reali da 1280/820/390 px, ridotte visivamente quando lo spazio è insufficiente.

In **Avanzate** trovi nome nel builder, disattivazione, ID HTML univoco e classi CSS del progetto (nomi alfanumerici con trattini/underscore, separati da spazi). Copia/incolla stili include i valori responsive, preservando contenuti e identità. La duplicazione genera nuovi ID interni e rimuove gli ID HTML per evitare duplicati. I comandi sull’anteprima e l’evidenziazione al passaggio del mouse sono strumenti dell’editor e non entrano nell’HTML pubblico.

Il campo **CSS controllato** modifica le stesse proprietà dei controlli visuali per il dispositivo selezionato. Sono accettate solo le proprietà in `resources/schema/design.json`: non consente selettori, JavaScript o dichiarazioni arbitrarie. Le classi possono usare gli stili definiti nel tema locale.

**Codice** mostra l’HTML effettivo dell’anteprima, copiabile e in sola lettura. La scheda **Documento JSON** è modificabile: Applica valida struttura, sorgenti, stili e collegamenti prima di sostituire il documento; l’operazione è annullabile e richiede poi Salva. Per modificare il markup dei componenti usa un elemento personalizzato registrato nel package/progetto.

Nel blocco Testo, **Testo formattato** attiva grassetto, corsivo, link ed elenchi. Le variabili sono etichette non modificabili al loro interno. Il contenuto incollato viene convertito in una struttura di paragrafi e segmenti, scartando HTML e attributi non supportati. Puoi tornare al testo semplice. Il catalogo include anche Card, Icona, Tabella (con editor di righe/colonne) e Immagine e testo. Sono elementi statici o con campi dinamici singoli; non introducono ripetitori di record.

Il formato resta versione 1 con campi aggiuntivi opzionali `meta`, `design`, `responsive` e `props.richText`. I documenti precedenti sono leggibili senza conversione; aggiorna package PHP e tutti gli asset insieme prima di salvare nuovi documenti. Le versioni precedenti del package non leggono i nuovi campi. Nessuna migration aggiuntiva.

## Integrità e gestione del ciclo di vita

Vedi [architettura e schema](docs/architecture.md) per esclusività, documenti orfani, frammenti, estensioni e formato JSON. Le colonne sono gestite dalla griglia: riducendole, gli elementi delle colonne rimosse vengono aggiunti in ordine all’ultima rimasta. Gli ID degli elementi si conservano. Le impostazioni delle colonne rimosse sono recuperabili con Annulla, non vengono fuse in modo ambiguo.

Il package non offre pubblicazione editoriale, import YOOtheme, HTML libero, approvazioni editoriali, ripetitori complessi o collaborazione simultanea. Il media manager opzionale gestisce upload, selezione e metadati; non include ritaglio, sostituzione o eliminazione dei file. Il blocco Testo supporta testo semplice e formattazione strutturata (grassetto, corsivo, link ed elenchi); contenuti e valori dinamici vengono escapati. Il controllo `revision` rileva i conflitti; la tabella separata `pagebuilder_revisions` conserva le versioni salvate. Non esiste un flusso editoriale di approvazione o pubblicazione differita.
