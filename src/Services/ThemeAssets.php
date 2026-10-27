<?php

namespace IlBronza\PageBuilder\Services;

class ThemeAssets
{
    // Outside css/: publishing package assets with --force must preserve local overrides.
    public const VARIABLES_PATH = 'vendor/pagebuilder/theme/variables.css';

    public function assetUrl(string $relative): string
    {
        $path = 'vendor/pagebuilder/'.$relative;
        $file = public_path($path);
        return asset($path).(is_file($file) ? '?v='.substr(hash_file('sha256', $file), 0, 12) : '');
    }

    /** Version every transitive ES module, not just the entry point. */
    public function importMap(): array
    {
        $imports = [];
        foreach (glob(public_path('vendor/pagebuilder/js/*.js')) ?: [] as $file) {
            $relative = 'js/'.basename($file);
            $imports[asset('vendor/pagebuilder/'.$relative)] = $this->assetUrl($relative);
        }
        return ['imports'=>(object) $imports];
    }

    public function previewStyles(): array
    {
        return [$this->assetUrl('vendor/uikit.min.css'), $this->assetUrl('css/content.css'), $this->assetUrl('css/palette.css')];
    }

    public function variablesUrl(): ?string
    {
        $file = public_path(self::VARIABLES_PATH);
        if (!is_file($file)) return null;

        return asset(self::VARIABLES_PATH).'?v='.substr(hash_file('sha256', $file), 0, 12);
    }
}
