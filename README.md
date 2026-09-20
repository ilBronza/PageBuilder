# IlBronza PageBuilder

Package Laravel con editor visuale incorporabile e renderer UIkit. Include pagine statiche, template condivisi, sorgenti dichiarate e documenti locali per le aree di un record. L’editor è JavaScript ESM senza dipendenze da Laravel, React, Vue o compilazione. Nessun progetto esterno viene modificato o installato dal playground.

## Provalo

```sh
cd pageBuilder
npm run playground
```

Apri **http://127.0.0.1:4173**. Serve Node 20+. Non serve `npm install`. Il server ascolta solo su localhost. Cambia un titolo, scegli una griglia, salva, premi **Riapri** e apri **pagina salvata**. I dati sono file JSON in `playground/.data/`, scritti con sostituzione atomica e revisione controllata. Riavviando il server rimangono disponibili.

Il selettore offre pagina statica, template condiviso e area libera. I record dimostrativi Arco e Tratto hanno dati e aree diversi: modificare e salvare il template modifica entrambi, cambiare il record d’anteprima non salva i suoi valori nel layout. I valori indicati come FileCabinet nel playground sono dati dimostrativi; il vero adattatore PHP è separato e testato sul tipo locale `FormrowText`.

## Compatibilità e test

Verificato su **PHP 8.4.22, Laravel 11.51.0, PHPUnit 11.5.55, Testbench 9, SQLite in memoria, Node 20.19.5**. `composer.json` richiede PHP ^8.2 e Illuminate ^11. Non dichiara Laravel 12/13: vari progetti locali li usano, ma richiedono una suite con Testbench corrispondente prima di ampliare la compatibilità. Nessuna verifica su MySQL/PostgreSQL o PHP 8.2/8.3 in questa consegna.

```sh
npm test
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

Le tabelle sono `pagebuilder_templates` e `pagebuilder_contents`; gli ID sono unsigned BIGINT. Le migration dell’app aggiungono le proprie foreign key nullable verso `pagebuilder_contents`, anche se la chiave primaria del modello è un UUID. Vedi [migration d’esempio](examples/add_product_areas.php).

I package Crud, Form, FormField, UikitTemplate e FileCabinet **non sono dipendenze obbligatorie**. Il renderer usa CSS UIkit 3.21.16 MIT, incluso localmente per il playground; nel sito puoi usare il tuo tema UIkit. Il contenuto pubblico non richiede JavaScript UIkit né il codice dell’editor. Pubblica di nuovo gli asset dopo un aggiornamento del package.

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

Un contenuto statico ha il proprio documento; uno collegato al template ha `document = null`. Passare da una modalità all’altra è una sostituzione esplicita del layout dell’area: esporta prima il layout statico se serve conservarlo. Le altre aree non vengono toccate. Gli aggiornamenti del template diventano visibili dopo il commit del salvataggio. Non ci sono copie del layout, revisioni bloccate o cache del template nel modello proprietario.

[ProductContext.php](examples/ProductContext.php) espone attributo, relazione singola, collezione di stringhe e campo FileCabinet. Ogni `Source` ha ID, etichetta, tipo, cardinalità e callback di lettura server. Le callback definiscono esattamente quali dati possono essere letti. Tipi: `text`, `number`, `date`, `boolean`, `url`, `image`; cardinalità `one` e `many`. Le collezioni di scalari alimentano l’elenco; non esistono ripetitori di layout, query o filtri generici. Non vengono serializzati modelli interi.

Un titolo collegato salva `bindings: {"text": "product.name"}`. L’editor tiene i valori del record di esempio in uno stato separato dal documento. Le sorgenti mancanti producono testo vuoto o elenco vuoto; non ripiegano su valori d’anteprima salvati. Fonti non dichiarate/incompatibili vengono rifiutate al salvataggio del template.

Usa [template-editor.blade.php](examples/template-editor.blade.php) per modificare un template su un record autorizzato. L’app seleziona il record di esempio e passa il suo URL di anteprima: questo evita un endpoint che esponga indiscriminatamente tutti i record. L’archivio non impone una UI amministrativa all’app ospitante; il playground offre il selettore dimostrativo.

### FileCabinet

`FileCabinetSource::field(id, label, formName, fieldName, type, authorize)` legge il campo dichiarato tramite `getDossierRowByNames()`, quindi usa direttamente il row reader. Evita `Dossierrow::getValue()`, che può convertire un TypeError in testo visibile. Il primo dossier e la prima riga sono quelli selezionati dall’API locale di FileCabinet (dossier più recente).

Supportati: testo, textarea, interi, decimali, booleani, date/datetime non multipli e non ripetibili. File, allegati privati, selettori, JSON e metodi arbitrari sono esclusi. Gli attributi e le relazioni del modello si espongono con `Source` esplicite. Per immagini pubbliche usa una `Source` di tipo `image` con callback autorizzata oppure `pickImage()` nel frontend; non trasformare URL di allegati privati in risorse di presentazione.

## API e incorporamento autonomo

| Metodo | Percorso relativo al prefisso `pagebuilder` | Funzione |
| --- | --- | --- |
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

Carica `editor.css`; la libreria carica i descrittori JSON e il CSS di anteprima dal percorso relativo agli asset. Puoi fornire `catalog`, `styles`, `previewStyles`, `sources`, `areas`, `areaLabels`, `values`, `areaDocuments` e `renderers`. Un adapter di persistenza deve salvare lo snapshot passato senza trasformarlo e restituire un errore in caso di conflitto; il salvataggio non è automatico. Errori di caricamento impediscono di salvare sopra un documento non compreso. L’export permette di recuperare il JSON.

## Integrità e gestione del ciclo di vita

Vedi [architettura e schema](docs/architecture.md) per esclusività, documenti orfani, frammenti, estensioni e formato JSON. Le colonne sono gestite dalla griglia: riducendole, gli elementi delle colonne rimosse vengono aggiunti in ordine all’ultima rimasta. Gli ID degli elementi si conservano. Le impostazioni delle colonne rimosse sono recuperabili con Annulla, non vengono fuse in modo ambiguo.

Il package non offre pubblicazione editoriale, import YOOtheme, rich text HTML, revisioni editoriali, ripetitori complessi, collaborazione simultanea o gestione completa del tema/media. Il campo testo è testo semplice con a capo; tutto viene escapato. Il controllo `revision` serve a rilevare conflitti, non costituisce un archivio delle versioni.
