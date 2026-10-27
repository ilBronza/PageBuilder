<?php

namespace IlBronza\PageBuilder\Tests\Feature;

use IlBronza\PageBuilder\Services\{ThemeAssets, WorkspaceOptions};
use IlBronza\PageBuilder\Tests\{TestCase, Product};
use Illuminate\Support\Facades\File;

class ThemeAssetsTest extends TestCase
{
    private string $publicDirectory;

    protected function defineEnvironment($app)
    {
        parent::defineEnvironment($app);
        $this->publicDirectory = __DIR__.'/../runtime/theme-'.bin2hex(random_bytes(6));
        $app->usePublicPath($this->publicDirectory);
    }

    protected function tearDown(): void
    {
        File::deleteDirectory($this->publicDirectory);
        parent::tearDown();
    }

    public function test_local_variables_are_optional_and_survive_forced_asset_updates(): void
    {
        $theme = app(ThemeAssets::class);
        $record = Product::create(['name' => 'Arco']);
        $this->saveArea($record, 'main', $this->doc());
        $this->assertNull($theme->variablesUrl());
        $this->assertNull(app(WorkspaceOptions::class)->forRecords('products', [$record], $this->actor())['variablesUrl']);
        $this->assertStringNotContainsString('/theme/variables.css', view('pagebuilder::content', ['record' => $record->fresh(), 'area' => 'main'])->render());

        $this->artisan('vendor:publish', ['--tag' => 'pagebuilder.variables'])->assertExitCode(0);
        $file = public_path(ThemeAssets::VARIABLES_PATH);
        $this->assertFileEquals(__DIR__.'/../../resources/css/variables.css', $file);
        $originalUrl = $theme->variablesUrl();
        $custom = ':root { --pb-palette-primary: #6844b5; --my-extra-variable: 24px; }';
        file_put_contents($file, $custom);
        $customUrl = $theme->variablesUrl();
        $this->assertNotSame($originalUrl, $customUrl);

        $this->artisan('vendor:publish', ['--tag' => 'pagebuilder.variables'])->assertExitCode(0);
        $this->artisan('vendor:publish', ['--tag' => 'pagebuilder.assets', '--force' => true])->assertExitCode(0);
        $this->assertSame($custom, file_get_contents($file));
        $this->assertFileExists(public_path('vendor/pagebuilder/css/variables.css'));

        $map = $theme->importMap();
        $this->assertArrayHasKey(asset('vendor/pagebuilder/js/core.js'), (array) $map['imports']);
        $beforeCore = ((array) $map['imports'])[asset('vendor/pagebuilder/js/core.js')];
        file_put_contents(public_path('vendor/pagebuilder/js/core.js'), "\n// new build", FILE_APPEND);
        $this->assertNotSame($beforeCore, ((array) $theme->importMap()['imports'])[asset('vendor/pagebuilder/js/core.js')]);
        $this->assertCount(3, $theme->previewStyles());
        $this->assertStringContainsString('type="importmap"', view('pagebuilder::assets')->render());
        $this->assertStringContainsString('layer(pagebuilder-defaults)', view('pagebuilder::assets')->render());

        $options = app(WorkspaceOptions::class)->forRecords('products', [$record], $this->actor());
        $this->assertSame($customUrl, $options['variablesUrl']);
        $this->assertSame($theme->assetUrl('css/variables.css'), $options['defaultVariablesUrl']);
        foreach (['editor', 'workspace'] as $view) {
            $html = view('pagebuilder::'.$view, ['options' => []])->render();
            $this->assertStringContainsString('variablesUrl', $html);
            $this->assertStringContainsString($customUrl, str_replace('\\', '', $html));
        }
        $html = view('pagebuilder::content', ['record' => $record->fresh(), 'area' => 'main'])->render();
        $this->assertStringContainsString('href="'.$customUrl.'"', $html);
    }
}
