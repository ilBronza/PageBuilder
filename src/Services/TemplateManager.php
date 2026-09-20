<?php

namespace IlBronza\PageBuilder\Services;

use IlBronza\PageBuilder\Documents\Validator;
use IlBronza\PageBuilder\Models\PageTemplate;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class TemplateManager
{
    public function __construct(private Validator $validator, private Contexts $contexts) {}

    public function save(?PageTemplate $template, array $input, mixed $actor): PageTemplate
    {
        $context = $template?->context ?? ($input['context'] ?? '');
        Gate::forUser($actor)->authorize('pagebuilder.template', [$template ? 'update' : 'create', $context, $template]);
        if (!is_array($input['document'] ?? null)) throw new \InvalidArgumentException('Document must be an object');
        $document = $this->validator->validate($input['document'] ?? [], 'template', 'page', $this->contexts->descriptors($context), $this->contexts->provider($context)->areas());
        if (!is_string($input['name'] ?? null) || trim($input['name']) === '' || strlen($input['name']) > 255) throw new \InvalidArgumentException('Invalid template name');
        return (new PageTemplate)->getConnection()->transaction(function () use ($template, $context, $document, $input) {
            if ($template) $template = PageTemplate::whereKey($template->id)->lockForUpdate()->firstOrFail();
            if (($input['revision'] ?? null) !== ($template?->revision ?? 0)) throw new ConflictHttpException('Template changed. Reload before saving.');
            $template ??= new PageTemplate(['context' => $context, 'kind' => 'page']);
            $template->fill(['name' => $input['name'], 'document' => $document, 'revision' => ($template->revision ?? 0) + 1]);
            $template->save();
            return $template;
        });
    }
}
