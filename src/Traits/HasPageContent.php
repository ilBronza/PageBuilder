<?php

namespace IlBronza\PageBuilder\Traits;

use IlBronza\PageBuilder\Models\PageContent;
use IlBronza\PageBuilder\Services\ContentManager;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

trait HasPageContent
{
    /** Stable area ID => ['column' => '...', 'label' => '...', 'kind' => 'page'|'fragment']. */
    abstract public function pageBuilderAreas(): array;
    abstract public function pageBuilderContext(): string;

    public function pageBuilderArea(string $area): array
    {
        $definition = $this->pageBuilderAreas()[$area] ?? null;
        if (!$definition || !in_array($definition['kind'] ?? '', ['page','fragment'], true)) throw new \InvalidArgumentException('Unknown content area');
        return $definition;
    }

    public function pageContentRelation(string $area): BelongsTo
    {
        return $this->belongsTo(PageContent::class, $this->pageBuilderArea($area)['column']);
    }

    public function pageContent(string $area): ?PageContent { return $this->pageContentRelation($area)->first(); }

    public function pageBuilderOwnershipKey(string $area): string
    {
        if (!$this->exists || $this->getKey() === null) throw new \LogicException('Save the owner before assigning page content');
        return $this->pageBuilderIdentityKey($area);
    }

    private function pageBuilderIdentityKey(string $area): string
    {
        return hash('sha256', json_encode([$this->getConnection()->getName(), $this->getTable(), (string) $this->getKey(), $area], JSON_THROW_ON_ERROR));
    }

    public function renderPageArea(string $area, mixed $actor = null): string
    {
        return app(ContentManager::class)->render($this, $area, $actor);
    }

    public static function bootHasPageContent(): void
    {
        static::saving(function ($record) {
            foreach ($record->pageBuilderAreas() as $area => $definition) {
                $id = $record->getAttribute($definition['column']);
                if ($id === null) continue;
                $content = PageContent::find($id);
                if (!$content || $content->ownership_key !== $record->pageBuilderOwnershipKey($area)) throw new \LogicException('Content must be assigned exclusively through ContentManager');
            }
        });
        static::saved(function ($record) {
            foreach ($record->pageBuilderAreas() as $area => $definition) {
                $column = $definition['column'];
                if ($record->wasChanged($column) && ($old = $record->getRawOriginal($column)) && $old != $record->getAttribute($column)) {
                    PageContent::whereKey($old)->where('ownership_key', $record->pageBuilderOwnershipKey($area))->update(['ownership_key' => null]);
                }
            }
        });
        static::deleted(function ($record) {
            if (method_exists($record, 'isForceDeleting') && !$record->isForceDeleting()) return;
            foreach (array_keys($record->pageBuilderAreas()) as $area) {
                // The deleted model retains its identity; no owner lookup or state mutation.
                $key = $record->pageBuilderIdentityKey($area);
                PageContent::where('ownership_key', $key)->update(['ownership_key' => null]);
            }
        });
    }
}
