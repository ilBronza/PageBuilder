<?php

namespace IlBronza\PageBuilder\Services;

use IlBronza\PageBuilder\Documents\{Renderer, Validator};
use IlBronza\PageBuilder\Models\{PageContent, PageTemplate};
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class ContentManager
{
    public function __construct(private Validator $validator, private Renderer $renderer, private Contexts $contexts) {}

    public function authorize(Model $owner, string $area, mixed $actor, string $action = 'view'): void
    {
        $owner->pageBuilderArea($area);
        Gate::forUser($actor)->authorize('pagebuilder.'.$action, [$owner, $area]);
    }

    private function exclusive(Model $owner, string $area, ?PageContent $content): void
    {
        if ($content && $content->ownership_key !== $owner->pageBuilderOwnershipKey($area)) throw new \LogicException('Content ownership mismatch');
    }

    public function load(Model $owner, string $area, mixed $actor): array
    {
        $this->authorize($owner, $area, $actor);
        $content = $owner->pageContent($area);
        $this->exclusive($owner, $area, $content);
        $kind = $owner->pageBuilderArea($area)['kind'];
        return [
            'id' => $content?->id,
            'revision' => $content?->revision ?? 0,
            'mode' => $content?->mode ?? 'static',
            'template_id' => $content?->template_id,
            'document' => $content ? $content->document : ['version' => 1, 'kind' => $kind, 'children' => []],
            'kind' => $kind,
        ];
    }

    /** Null expectedId means the area was empty when loaded. Both identity and revision are checked. */
    public function save(Model $owner, string $area, array $input, mixed $actor): array
    {
        $this->authorize($owner, $area, $actor, 'update');
        if ($owner->getConnection()->getName() !== (new PageContent)->getConnection()->getName()) throw new \LogicException('Content and owner must use the same database connection');
        return $owner->getConnection()->transaction(function () use ($owner, $area, $input, $actor) {
            $locked = $owner->newQuery()->whereKey($owner->getKey())->lockForUpdate()->firstOrFail();
            $this->authorize($locked, $area, $actor, 'update');
            $definition = $locked->pageBuilderArea($area);
            $content = $locked->pageContentRelation($area)->lockForUpdate()->first();
            $this->exclusive($locked, $area, $content);
            if (($input['id'] ?? null) !== $content?->id || ($input['revision'] ?? null) !== ($content?->revision ?? 0)) throw new ConflictHttpException('Content changed. Reload before saving.');
            $mode = $input['mode'] ?? 'static';
            if ($mode === 'static') {
                if (!is_array($input['document'] ?? null)) throw new \InvalidArgumentException('Document must be an object');
                $document = $this->validator->validate($input['document'], 'static', $definition['kind']);
                $templateId = null;
            } elseif ($mode === 'template') {
                if (($input['document'] ?? null) !== null) throw new \InvalidArgumentException('A template-backed content cannot store a second layout');
                $template = PageTemplate::findOrFail($input['template_id'] ?? null);
                Gate::forUser($actor)->authorize('pagebuilder.template', ['use', $template->context, $template]);
                if ($template->context !== $locked->pageBuilderContext() || $template->kind !== $definition['kind']) throw new \InvalidArgumentException('Incompatible template');
                // Fragments are static only: area -> fragment is a terminal edge, so cycles are impossible.
                if ($definition['kind'] === 'fragment') throw new \InvalidArgumentException('Fragment areas must be local static documents');
                $templateId = $template->id;
                $document = null;
            } else throw new \InvalidArgumentException('Invalid content mode');
            $content ??= new PageContent;
            $content->fill(['mode' => $mode, 'kind' => $definition['kind'], 'document' => $document, 'template_id' => $templateId, 'ownership_key' => $locked->pageBuilderOwnershipKey($area), 'revision' => ($content->revision ?? 0) + 1]);
            $content->save();
            $locked->setAttribute($definition['column'], $content->id);
            $locked->save();
            $owner->setAttribute($definition['column'], $content->id);
            return $this->load($locked, $area, $actor);
        });
    }

    /** Explicit detach keeps the document. Reuse requires a copy, never a shared local pointer. */
    public function detach(Model $owner, string $area, mixed $actor): void
    {
        $this->authorize($owner, $area, $actor, 'update');
        $owner->getConnection()->transaction(function () use ($owner, $area, $actor) {
            $locked = $owner->newQuery()->whereKey($owner->getKey())->lockForUpdate()->firstOrFail();
            $this->authorize($locked, $area, $actor, 'update');
            $content = $locked->pageContentRelation($area)->lockForUpdate()->first();
            $this->exclusive($locked, $area, $content);
            if ($content) { $content->ownership_key = null; $content->save(); }
            $column = $locked->pageBuilderArea($area)['column'];
            $locked->setAttribute($column, null);
            $locked->save();
            $owner->setAttribute($column, null);
        });
    }

    public function render(Model $owner, string $area, mixed $actor = null): string
    {
        try {
            $this->authorize($owner, $area, $actor);
            $content = $owner->pageContent($area);
            $this->exclusive($owner, $area, $content);
            if (!$content) return '';
            if ($content->mode === 'static') {
                $this->validator->validate($content->document, 'static', $owner->pageBuilderArea($area)['kind']);
                return $this->renderer->render($content->document);
            }
            $template = $content->template()->first(); // Always resolve latest saved layout.
            if (!$template || $template->context !== $owner->pageBuilderContext()) return '';
            return $this->renderTemplate($template->document, $owner, $area, $actor);
        } catch (\Throwable $error) { report($error); return ''; }
    }

    public function renderTemplate(array $document, Model $owner, string $mainArea, mixed $actor): string
    {
        $this->authorize($owner, $mainArea, $actor);
        $allowed = $this->contexts->provider($owner->pageBuilderContext())->areas();
        $values = $this->contexts->values($owner->pageBuilderContext(), $owner, $actor);
        return $this->renderer->render($document, $values, function ($area) use ($owner, $actor, $allowed, $mainArea) {
            if ($area === $mainArea || !in_array($area, $allowed, true)) return '';
            $definition = $owner->pageBuilderArea($area);
            if ($definition['kind'] !== 'fragment') return '';
            try {
                $this->authorize($owner, $area, $actor);
                $content = $owner->pageContent($area);
                $this->exclusive($owner, $area, $content);
                if (!$content || $content->mode !== 'static' || $content->kind !== 'fragment') return '';
                $this->validator->validate($content->document, 'area', 'fragment');
                return $this->renderer->render($content->document, [], null, 'area');
            } catch (\Throwable $error) { report($error); return ''; }
        }, 'template');
    }
}
