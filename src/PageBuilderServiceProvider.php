<?php

namespace IlBronza\PageBuilder;

use IlBronza\PageBuilder\Documents\{Registry, Validator, Renderer};
use IlBronza\PageBuilder\Http\BuilderController;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;

class PageBuilderServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom(__DIR__.'/../config/pagebuilder.php', 'pagebuilder');
        $this->app->singleton(Registry::class);
        $this->app->singleton(Validator::class);
        $this->app->singleton(Renderer::class);
    }

    public function boot(): void
    {
        $this->loadViewsFrom(__DIR__.'/../resources/views', 'pagebuilder');
        $this->loadMigrationsFrom(__DIR__.'/../database/migrations');
        $this->publishes([__DIR__.'/../config/pagebuilder.php' => config_path('pagebuilder.php')], 'pagebuilder.config');
        $this->publishes([
            __DIR__.'/../resources/js' => public_path('vendor/pagebuilder/js'),
            __DIR__.'/../resources/css' => public_path('vendor/pagebuilder/css'),
            __DIR__.'/../resources/schema' => public_path('vendor/pagebuilder/schema'),
            __DIR__.'/../resources/vendor' => public_path('vendor/pagebuilder/vendor'),
        ], 'pagebuilder.assets');
        if (!config('pagebuilder.routes')) return;
        Route::prefix(config('pagebuilder.prefix'))->middleware(config('pagebuilder.middleware'))->name('pagebuilder.')->group(function () {
            Route::get('records/{host}/{record}/areas/{area}', [BuilderController::class, 'show'])->name('contents.show');
            Route::put('records/{host}/{record}/areas/{area}', [BuilderController::class, 'save'])->name('contents.save');
            Route::post('records/{host}/{record}/areas/{area}/preview', [BuilderController::class, 'preview'])->name('contents.preview');
            Route::get('templates', [BuilderController::class, 'indexTemplates'])->name('templates.index');
            Route::post('templates', [BuilderController::class, 'storeTemplate'])->name('templates.store');
            Route::get('templates/{template}', [BuilderController::class, 'showTemplate'])->name('templates.show');
            Route::put('templates/{template}', [BuilderController::class, 'saveTemplate'])->name('templates.save');
            Route::post('templates/{template}/preview/{host}/{record}/{area}', [BuilderController::class, 'previewTemplate'])->name('templates.preview');
        });
    }
}
