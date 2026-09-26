# Guida rapida a PageBuilder

Questa guida mostra una prima integrazione completa in un'app Laravel. L'esempio usa `Product`, ma lo stesso schema vale per articoli, pagine, servizi o qualunque modello Eloquent.

## Cosa gestisce il package

Il contenuto appartiene sempre a un record dell'app. Ogni record espone una o più **aree**; un'area può contenere una pagina completa oppure un frammento da inserire in un template.

| Oggetto | Esempio | Funzione |
| --- | --- | --- |
| Record proprietario | `Product` | Fornisce i dati e identifica il contenuto. |
| Area `page` | `main` | Pagina completa, statica oppure collegata a un template. |
| Area `fragment` | `description` | Contenuto locale che un template può includere. |
| Template | `Scheda prodotto` | Layout condiviso tra più record con lo stesso contesto. |
| Sorgente | `product.name` | Dato del record che il template può leggere. |

Un documento locale è esclusivo di una singola area di un singolo record. I template, invece, sono condivisi: quando un template viene aggiornato, il nuovo layout viene visualizzato su tutti i record collegati.

## 1. Installa e pubblica le risorse

```sh
composer require ilbronza/pagebuilder

php artisan vendor:publish --tag=pagebuilder.config
php artisan vendor:publish --tag=pagebuilder.assets
php artisan migrate
```

Il provider viene rilevato automaticamente. Il comando `migrate` crea le tabelle `pagebuilder_templates` e `pagebuilder_contents`; la migration dell'app deve poi aggiungere i riferimenti alle tabelle dei modelli proprietari.

## 2. Aggiungi le colonne al modello proprietario

Crea una migration per ogni area che vuoi rendere modificabile. Anche se `products.id` è un UUID, gli ID di PageBuilder restano `unsigned BIGINT`.

```php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->foreignId('page_content_id')
                ->nullable()
                ->constrained('pagebuilder_contents')
                ->restrictOnDelete();

            $table->foreignId('description_page_content_id')
                ->nullable()
                ->constrained('pagebuilder_contents')
                ->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropConstrainedForeignId('page_content_id');
            $table->dropConstrainedForeignId('description_page_content_id');
        });
    }
};
```

Esegui poi la migration:

```sh
php artisan migrate
```

## 3. Dichiara aree e contesto sul modello

Inserisci il trait nel modello e assegna a ogni area una chiave stabile, una colonna, un tipo e un'etichetta.

```php
namespace App\Models;

use IlBronza\PageBuilder\Traits\HasPageContent;
use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    use HasPageContent;

    public function pageBuilderContext(): string
    {
        return 'product';
    }

    public function pageBuilderAreas(): array
    {
        return [
            'main' => [
                'column' => 'page_content_id',
                'kind' => 'page',
                'label' => 'Scheda prodotto',
            ],
            'description' => [
                'column' => 'description_page_content_id',
                'kind' => 'fragment',
                'label' => 'Descrizione libera',
            ],
        ];
    }
}
```

Usa `page` per un layout completo. Un'area `fragment` contiene solo un frammento e può essere richiamata da un template. Le chiavi `main` e `description` sono identità tecniche: puoi cambiare l'etichetta senza perdere i collegamenti già salvati.

## 4. Registra il modello e il provider dei dati

Nel file pubblicato `config/pagebuilder.php`, registra un alias pubblico per il modello e il provider che descrive i dati disponibili nei template.

```php
return [
    'routes' => true,
    'prefix' => 'pagebuilder',
    'middleware' => ['web', 'auth'],

    'hosts' => [
        'products' => [
            'model' => App\Models\Product::class,
            'context' => 'product',
        ],
    ],

    'contexts' => [
        'product' => App\PageBuilder\ProductContext::class,
    ],
];
```

L'alias `products` appare negli URL dell'editor. Non passare mai all'editor nomi di classi, relazioni o metodi da risolvere lato server.

Crea il provider `app/PageBuilder/ProductContext.php`:

```php
namespace App\PageBuilder;

use IlBronza\PageBuilder\Contracts\ContextProvider;
use IlBronza\PageBuilder\Data\Source;

class ProductContext implements ContextProvider
{
    public function areas(): array
    {
        return ['description'];
    }

    public function sources(): array
    {
        return [
            new Source(
                'product.name',
                'Nome prodotto',
                'text',
                'one',
                fn ($product) => $product->name,
            ),
            new Source(
                'product.category',
                'Categoria',
                'text',
                'one',
                fn ($product) => $product->category?->name,
            ),
            new Source(
                'product.tags',
                'Etichette',
                'text',
                'many',
                fn ($product) => $product->tags->pluck('name'),
            ),
        ];
    }
}
```

Ogni `Source` dichiara esattamente un dato che il template può leggere: ID, etichetta, tipo (`text`, `number`, `date`, `boolean`, `url`, `image`), cardinalità (`one` o `many`) e callback di lettura. Non vengono esposti automaticamente attributi o relazioni del modello.

## 5. Definisci le autorizzazioni

Il package nega ogni accesso finché l'app non definisce i tre Gate richiesti. Per una prima integrazione, puoi inserirli nel metodo `boot()` di `AppServiceProvider`.

```php
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Gate;

Gate::define('pagebuilder.view', function (?User $user, Model $record, string $area) {
    return $user?->can('view', $record) === true;
});

Gate::define('pagebuilder.update', function (User $user, Model $record, string $area) {
    return $user->can('update', $record);
});

Gate::define('pagebuilder.template', function (User $user, string $action, string $context, $template = null) {
    return $user->can('manage-page-templates');
});
```

`pagebuilder.view` viene usato anche dal renderer. Se un'area deve essere pubblica, il Gate deve autorizzare esplicitamente l'utente anonimo e verificare che il record sia pubblicato.

## 6. Mostra l'editor per una pagina statica

Crea una pagina dell'area amministrativa che carica un record già salvato. La view deve essere protetta dalla stessa policy dell'app; il package controlla di nuovo il Gate sul singolo salvataggio.

```blade
@include('pagebuilder::editor', ['options' => [
    'title' => 'Scheda prodotto',
    'mode' => 'static',
    'kind' => 'page',
    'url' => route('pagebuilder.contents.show', [
        'host' => 'products',
        'record' => $product->getKey(),
        'area' => 'main',
    ]),
    'previewUrl' => route('pagebuilder.contents.preview', [
        'host' => 'products',
        'record' => $product->getKey(),
        'area' => 'main',
    ]),
]])
```

La view pubblica l'editor JavaScript, il suo CSS e un adapter HTTP con token CSRF. L'editor carica l'area, conserva `id` e `revision`, e li rimanda al salvataggio. Se un'altra persona salva prima, il server restituisce `409` e l'editor mantiene le modifiche locali per consentire l'esportazione o il ricaricamento.

Per modificare un frammento locale, usa lo stesso schema con l'area `description`, `kind => 'fragment'` e `mode => 'static'`.

## 7. Renderizza il contenuto nel sito

Nella view che presenta il prodotto, includi il renderer:

```blade
@include('pagebuilder::content', [
    'record' => $product,
    'area' => 'main',
])
```

Oppure, se il CSS degli asset è già incluso nel layout:

```blade
{!! $product->renderPageArea('main', auth()->user()) !!}
```

Per usare il tuo CSS UIkit al posto di quello pubblicato dal package:

```blade
@include('pagebuilder::content', [
    'record' => $product,
    'area' => 'main',
    'loadUikit' => false,
])
```

Se un documento non è valido, non è autorizzato o contiene una sorgente non disponibile, il renderer restituisce una stringa vuota e registra l'errore nel log di Laravel. Il documento salvato non viene alterato.

## 8. Usa un template condiviso

Un template ha un contesto, un nome e un documento di tipo `page`. Puoi crearlo lato server tramite `TemplateManager`:

```php
use IlBronza\PageBuilder\Services\TemplateManager;

$template = app(TemplateManager::class)->save(null, [
    'name' => 'Scheda prodotto standard',
    'context' => 'product',
    'revision' => 0,
    'document' => $templateDocument,
], $user);
```

Collega poi il template all'area principale di un prodotto tramite `ContentManager`:

```php
use IlBronza\PageBuilder\Services\ContentManager;

$manager = app(ContentManager::class);
$current = $manager->load($product, 'main', $user);

$manager->save($product, 'main', [
    'id' => $current['id'],
    'revision' => $current['revision'],
    'mode' => 'template',
    'template_id' => $template->id,
    'document' => null,
], $user);
```

Un'area principale collegata a un template non mantiene una seconda copia del layout. Il renderer usa sempre l'ultima versione salvata del template e sostituisce i binding, ad esempio `product.name`, con i dati del record corrente.

Per modificare un template esistente, usa la view `examples/template-editor.blade.php` come base. Passa un record reale solo per l'anteprima: i valori del record non vengono salvati dentro il template.

## Limiti e regole da ricordare

- Un template può includere solo aree `fragment` dichiarate dal suo `ContextProvider`.
- Le aree `fragment` sono sempre documenti locali statici; non possono a loro volta usare un template.
- Usa `ContentManager` per collegare, sostituire o scollegare un contenuto. Non assegnare manualmente `page_content_id`, perché il package verifica l'esclusività del documento.
- Per immagini e URL, esponi solo risorse pubbliche e autorizzate dall'app. Il package non offre un archivio media.
- FileCabinet è opzionale. Se il modello usa già FileCabinet, puoi esporre un suo campo dichiarato con `FileCabinetSource::field()`; non usare la sorgente per allegati privati o metodi arbitrari.

## Quando qualcosa non funziona

| Risposta o sintomo | Causa più comune | Cosa controllare |
| --- | --- | --- |
| `403` | Gate mancante o policy dell'app negativa | I tre Gate `pagebuilder.*` e l'utente corrente. |
| `404` | Host, record o area non riconosciuti | Alias in `pagebuilder.hosts`, modello registrato e chiave dell'area. |
| `409` al salvataggio | Il documento è stato salvato altrove | Ricarica l'area oppure esporta il JSON prima di ricaricare. |
| `422` | Documento o template incompatibile | `kind`, sorgenti dichiarate, aree consentite e struttura JSON. |
| Output vuoto nel sito | Area assente o non autorizzata | Collegamento del contenuto e Gate `pagebuilder.view`. |

Per i dettagli del formato dei documenti, della proprietà dei contenuti e della pulizia degli orfani, vedi [architecture.md](architecture.md). Per copiare una integrazione più completa, consulta la cartella [`examples`](../examples).
