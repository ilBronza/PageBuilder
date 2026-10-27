<?php

namespace IlBronza\PageBuilder\Services;

use IlBronza\PageBuilder\Documents\Registry;
use Illuminate\Support\Facades\Gate;

class WorkspaceOptions
{
    /** The host supplies its scoped records; never enumerate arbitrary models or relations. */
    public function forRecords(string $host, iterable $records, mixed $actor): array
    {
        $definition = config('pagebuilder.hosts')[$host] ?? null;
        if (!$definition) throw new \InvalidArgumentException('Unknown host');
        $context = $definition['context'];
        $items = [];
        foreach ($records as $record) {
            if (get_class($record) !== $definition['model'] || !$record->exists || $record->pageBuilderContext() !== $context) throw new \InvalidArgumentException('Incompatible record');
            $areas = [];
            foreach ($record->pageBuilderAreas() as $area => $description) {
                $gate = Gate::forUser($actor);
                if (!$gate->allows('pagebuilder.view', [$record, $area]) || !$gate->allows('pagebuilder.update', [$record, $area])) continue;
                $params = ['host' => $host, 'record' => $record->getKey(), 'area' => $area];
                $areas[] = [
                    'id' => $area, 'label' => $description['label'] ?? $area, 'kind' => $description['kind'],
                    'url' => route('pagebuilder.contents.show', $params),
                    'previewUrl' => route('pagebuilder.contents.preview', $params),
                    'templatePreviewUrl' => route('pagebuilder.templates.preview', ['template' => '__TEMPLATE__'] + $params),
                ];
            }
            if ($areas) $items[] = ['id' => (string) $record->getKey(), 'label' => (string) ($record->getAttribute('name') ?? $record->getAttribute('title') ?? $record->getKey()), 'areas' => $areas];
        }
        $contexts = app(Contexts::class);
        $registry = app(Registry::class);
        return [
            'context' => $context, 'records' => $items,
            'templatesUrl' => Gate::forUser($actor)->allows('pagebuilder.template', ['list', $context, null]) ? route('pagebuilder.templates.index') : null,
            'recoveryUrl' => Gate::forUser($actor)->allows('pagebuilder.recover', ['list', null]) ? route('pagebuilder.orphans.index') : null,
            'sources' => $contexts->descriptors($context), 'areas' => $contexts->provider($context)->areas(),
            'catalog' => $registry->elements, 'styles' => $registry->styles,
            'variablesUrl' => app(ThemeAssets::class)->variablesUrl(),
            'previewStyles' => app(ThemeAssets::class)->previewStyles(),
            'defaultVariablesUrl' => app(ThemeAssets::class)->assetUrl('css/variables.css'),
        ];
    }
}
