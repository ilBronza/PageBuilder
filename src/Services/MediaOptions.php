<?php

namespace IlBronza\PageBuilder\Services;

use Illuminate\Support\Facades\Gate;

class MediaOptions
{
    public function forLibrary(string $library, mixed $actor): ?array
    {
        $definition = config('pagebuilder.media.libraries', [])[$library] ?? null;
        if (!$definition || !interface_exists(\Spatie\MediaLibrary\HasMedia::class)
            || !Gate::forUser($actor)->allows('pagebuilder.media', ['view', $library])) return null;

        return [
            'url' => route('pagebuilder.media.index', ['library'=>$library]),
            'label' => $definition['label'] ?? 'Immagini del builder',
            'canUpload' => Gate::forUser($actor)->allows('pagebuilder.media', ['upload', $library]),
            'canUpdate' => Gate::forUser($actor)->allows('pagebuilder.media', ['update', $library]),
            'maxBytes' => (int) config('pagebuilder.media.max_kb', 10240) * 1024,
        ];
    }
}
