<?php

namespace IlBronza\PageBuilder\Tests;

use IlBronza\PageBuilder\PageBuilderServiceProvider;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\{Gate, Schema};
use IlBronza\PageBuilder\Traits\HasPageContent;

class Product extends Model
{
    use HasPageContent;
    protected $table = 'products';
    protected $guarded = [];
    public function pageBuilderContext(): string { return 'product'; }
    public function pageBuilderAreas(): array {
        return ['main' => ['column' => 'page_content_id', 'kind' => 'page', 'label' => 'Pagina'], 'description' => ['column' => 'description_page_content_id', 'kind' => 'fragment', 'label' => 'Descrizione']];
    }
}
class Article extends Product { protected $table = 'articles'; }
class Actor extends \Illuminate\Foundation\Auth\User { protected $guarded = []; public bool $admin = true; }
class ProductContext implements \IlBronza\PageBuilder\Contracts\ContextProvider
{
    public function sources(): array {
        return [new \IlBronza\PageBuilder\Data\Source('product.name','Nome','text','one',fn ($record) => $record->name), new \IlBronza\PageBuilder\Data\Source('secret','Segreto','text','one',fn () => 'private',fn ($record, $actor) => $actor?->admin === true)];
    }
    public function areas(): array { return ['description']; }
}
abstract class TestCase extends \Orchestra\Testbench\TestCase
{
    public static function applicationBasePath(): string { return __DIR__.'/runtime'; }
    protected function getPackageProviders($app) { return [PageBuilderServiceProvider::class]; }
    protected function defineEnvironment($app) {
        $app['config']->set('database.default','sqlite');
        $app['config']->set('database.connections.sqlite',['driver'=>'sqlite','database'=>':memory:','prefix'=>'','foreign_key_constraints'=>true]);
        $app['config']->set('pagebuilder.middleware', ['web', 'auth']);
        $app['config']->set('pagebuilder.hosts',['products'=>['model'=>Product::class,'context'=>'product'],'articles'=>['model'=>Article::class,'context'=>'product']]);
        $app['config']->set('pagebuilder.contexts',['product'=>ProductContext::class]);
        $app['config']->set('app.key','base64:'.base64_encode(str_repeat('a',32)));
    }
    protected function setUp(): void {
        parent::setUp();
        (require __DIR__.'/../database/migrations/2026_09_17_000001_create_pagebuilder_tables.php')->up();
        foreach (['products','articles'] as $table) Schema::create($table,function (Blueprint $t) {
            $t->id();$t->string('name');$t->foreignId('page_content_id')->nullable()->constrained('pagebuilder_contents');$t->foreignId('description_page_content_id')->nullable()->constrained('pagebuilder_contents');$t->timestamps();
        });
        Gate::define('pagebuilder.view',fn (?Actor $actor, Model $record, string $area) => $actor?->admin === true || $area === 'main');
        Gate::define('pagebuilder.update',fn (?Actor $actor, Model $record, string $area) => $actor?->admin === true);
        Gate::define('pagebuilder.template',fn (?Actor $actor, string $action, string $context, $template = null) => $actor?->admin === true);
    }
    protected function actor(): Actor { return new Actor(['id'=>1]); }
    protected function doc(string $text = 'Hello', string $kind = 'page'): array {
        $el = ['id'=>'heading','type'=>'heading','props'=>['text'=>$text], 'styles'=>[], 'bindings'=>[]];
        $column = ['id'=>'column','type'=>'column','props'=>[], 'styles'=>[], 'bindings'=>[], 'children'=>[$el]];
        $row = ['id'=>'row','type'=>'row','props'=>['layout'=>['1-1']], 'styles'=>[], 'bindings'=>[], 'children'=>[$column]];
        $section = ['id'=>'section','type'=>'section','props'=>[], 'styles'=>[], 'bindings'=>[], 'children'=>[$row]];
        return ['version'=>1,'kind'=>$kind,'children'=>[$kind==='page'?$section:$row]];
    }
    protected function saveArea($model, $area, $document) {
        $manager = app(\IlBronza\PageBuilder\Services\ContentManager::class);
        return $manager->save($model,$area,array_merge($manager->load($model,$area,$this->actor()),['mode'=>'static','document'=>$document]),$this->actor());
    }
}
