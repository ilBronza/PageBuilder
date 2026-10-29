<?php

namespace IlBronza\PageBuilder\Tests\Feature;

use IlBronza\PageBuilder\Integrations\Spatie\MediaLibrary;
use IlBronza\PageBuilder\Services\MediaOptions;
use IlBronza\PageBuilder\Tests\TestCase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\{Event, Gate, Storage};
use Spatie\MediaLibrary\MediaLibraryServiceProvider;

class MediaTest extends TestCase
{
    protected function getPackageProviders($app)
    {
        return [...parent::getPackageProviders($app), MediaLibraryServiceProvider::class];
    }

    protected function defineEnvironment($app)
    {
        parent::defineEnvironment($app);
        $app['config']->set('pagebuilder.media.libraries', ['documents'=>['disk'=>'public', 'label'=>'Immagini documenti'], 'other'=>['disk'=>'public']]);
        $app['config']->set('filesystems.disks.public', ['driver'=>'local', 'root'=>__DIR__.'/../runtime/storage/media-tests', 'url'=>'http://localhost/storage', 'visibility'=>'public']);
        $app['config']->set('media-library.image_driver', 'gd');
    }

    protected function setUp(): void
    {
        parent::setUp();
        (require __DIR__.'/../../database/migrations/2026_10_27_000003_create_pagebuilder_media_libraries_table.php')->up();
        $vendor = dirname((new \ReflectionClass(MediaLibraryServiceProvider::class))->getFileName(), 2);
        (require $vendor.'/database/migrations/create_media_table.php.stub')->up();
        Storage::fake('public');
        Gate::define('pagebuilder.media', fn ($actor, $action, $library) => $actor->admin && $library === 'documents');
    }

    protected function tearDown(): void
    {
        Storage::disk('public')->deleteDirectory('/');
        parent::tearDown();
    }

    private function upload(array $attributes = [])
    {
        return $this->post('/pagebuilder/media/documents', $attributes + [
            'file'=>UploadedFile::fake()->image('unsafe.php.png', 120, 80), 'name'=>'Logo GeG', 'folder'=>'Loghi', 'alt'=>'Logo di prova',
        ], ['Accept'=>'application/json']);
    }

    public function test_upload_search_metadata_and_scope_use_real_spatie_storage(): void
    {
        $actor=$this->actor();$this->actingAs($actor);
        $this->getJson('/pagebuilder/media/documents')->assertOk()->assertJsonPath('data', []);
        $upload=$this->upload()->assertCreated()->assertJsonPath('width',120)->assertJsonPath('height',80)->assertJsonPath('alt','Logo di prova');
        $media=MediaLibrary::where('key','documents')->firstOrFail()->media()->firstOrFail();
        $this->assertStringEndsWith('.png', $media->file_name);
        $this->assertStringNotContainsString('unsafe', $media->file_name);
        $this->assertFileExists($media->getPath());
        $this->assertTrue($media->hasGeneratedConversion('pagebuilder-thumb'));
        $this->assertFileExists($media->getPath('pagebuilder-thumb'));
        $this->assertSame('public',$media->disk);
        $this->getJson('/pagebuilder/media/documents?q=Logo&folder=Loghi')->assertOk()->assertJsonPath('total',1)->assertJsonPath('folders.0','Loghi');
        $this->getJson('/pagebuilder/media/documents?q=missing')->assertOk()->assertJsonPath('total',0);
        $this->patchJson('/pagebuilder/media/documents/'.$media->id,['name'=>'Logo aggiornato','alt'=>'Nuovo testo','folder'=>'Brand'])->assertOk()->assertJsonPath('alt','Nuovo testo');
        $this->getJson('/pagebuilder/media/documents?folder=Brand')->assertJsonPath('data.0.name','Logo aggiornato');
        $other=MediaLibrary::create(['key'=>'other'])->addMedia(UploadedFile::fake()->image('other.png'))->toMediaCollection('pagebuilder-images','public');
        $this->patchJson('/pagebuilder/media/documents/'.$other->id,['name'=>'Forbidden'])->assertNotFound();
        $this->getJson('/pagebuilder/media/other')->assertForbidden();
        $this->getJson('/pagebuilder/media/unknown')->assertNotFound();
        $this->assertNotNull(app(MediaOptions::class)->forLibrary('documents',$actor));
        $this->assertNull(app(MediaOptions::class)->forLibrary('other',$actor));
    }

    public function test_upload_validation_and_permissions_cannot_be_bypassed(): void
    {
        $actor=$this->actor();$actor->admin=false;$this->actingAs($actor);
        $this->getJson('/pagebuilder/media/documents')->assertForbidden();
        $this->upload()->assertForbidden();
        $actor->admin=true;
        foreach ([UploadedFile::fake()->createWithContent('evil.svg','<svg onload="alert(1)"></svg>'), UploadedFile::fake()->createWithContent('fake.png','<?php echo "not an image";')] as $file) {
            $this->upload(['file'=>$file])->assertStatus(422);
        }
        config(['pagebuilder.media.max_kb'=>1]);
        $this->upload(['file'=>UploadedFile::fake()->image('huge.png')->size(2)])->assertStatus(422);
        config(['pagebuilder.media.max_kb'=>10240,'pagebuilder.media.max_pixels'=>500]);
        $this->upload()->assertStatus(422);
        $this->assertSame(0,MediaLibrary::count());
        config(['pagebuilder.media.max_pixels'=>40000000,'filesystems.disks.public.visibility'=>'private']);
        $this->upload()->assertStatus(503);
    }

    public function test_read_only_library_does_not_allow_upload_or_update(): void
    {
        $this->actingAs($this->actor());
        Gate::define('pagebuilder.media',fn ($actor,$action,$library)=>$library==='documents' && $action==='view');
        $this->getJson('/pagebuilder/media/documents')->assertOk();
        $this->upload()->assertForbidden();
        $this->patchJson('/pagebuilder/media/documents/1',['name'=>'No'])->assertForbidden();
        $options=app(MediaOptions::class)->forLibrary('documents',$this->actor());
        $this->assertFalse($options['canUpload']);$this->assertFalse($options['canUpdate']);
    }

    public function test_failed_conversion_removes_only_the_new_upload(): void
    {
        $this->actingAs($this->actor());
        $this->upload()->assertCreated();
        $files=Storage::disk('public')->allFiles();
        Event::listen(\Spatie\MediaLibrary\Conversions\Events\ConversionWillStartEvent::class, function () {
            throw new \RuntimeException('Simulated conversion failure');
        });
        $this->upload(['name'=>'Broken upload'])->assertStatus(422);
        $this->assertSame($files,Storage::disk('public')->allFiles());
        $this->getJson('/pagebuilder/media/documents')->assertJsonPath('total',1)->assertJsonPath('data.0.name','Logo GeG');
    }
}
