<?php

namespace IlBronza\PageBuilder\Http;

use IlBronza\PageBuilder\Documents\{Registry, Renderer, Validator};
use IlBronza\PageBuilder\Models\PageTemplate;
use IlBronza\PageBuilder\Services\{ContentManager, Contexts, TemplateManager};
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Gate;

class BuilderController extends Controller
{
    public function __construct(private ContentManager $contents, private TemplateManager $templates, private Contexts $contexts) {}

    private function owner(string $host, string $record)
    {
        $definition = config('pagebuilder.hosts')[$host] ?? null;
        abort_unless($definition && is_subclass_of($definition['model'], \Illuminate\Database\Eloquent\Model::class), 404);
        $owner = $definition['model']::findOrFail($record);
        abort_unless($owner->pageBuilderContext() === $definition['context'], 404);
        return $owner;
    }

    private function attempt(callable $callback)
    {
        try { return response()->json(\IlBronza\PageBuilder\Documents\Codec::wire($callback())); }
        catch (\InvalidArgumentException $error) { return response()->json(['message' => $error->getMessage()], 422); }
    }

    public function show(Request $request, string $host, string $record, string $area)
    {
        return $this->attempt(fn () => $this->contents->load($this->owner($host, $record), $area, $request->user()));
    }

    public function save(Request $request, string $host, string $record, string $area)
    {
        return $this->attempt(fn () => $this->contents->save($this->owner($host, $record), $area, $request->all(), $request->user()));
    }

    public function preview(Request $request, string $host, string $record, string $area)
    {
        return $this->attempt(function () use ($request, $host, $record, $area) {
            $owner = $this->owner($host, $record);
            $this->contents->authorize($owner, $area, $request->user(), 'update');
            $doc = $request->input('document', []);
            if (!is_array($doc)) throw new \InvalidArgumentException('Document must be an object');
            app(Validator::class)->validate($doc, 'static', $owner->pageBuilderArea($area)['kind']);
            return ['html' => app(Renderer::class)->render($doc)];
        });
    }

    public function indexTemplates(Request $request)
    {
        $context = (string) $request->query('context', '');
        Gate::forUser($request->user())->authorize('pagebuilder.template', ['list', $context, null]);
        return $this->attempt(function () use ($context) {
            $registry = app(Registry::class);
            return ['templates' => PageTemplate::where('context', $context)->orderBy('name')->get(['id','name','context','kind','revision']), 'sources' => $this->contexts->descriptors($context), 'areas' => $this->contexts->provider($context)->areas(), 'catalog' => $registry->elements, 'styles' => $registry->styles];
        });
    }

    public function showTemplate(Request $request, PageTemplate $template)
    {
        Gate::forUser($request->user())->authorize('pagebuilder.template', ['view', $template->context, $template]);
        return response()->json(\IlBronza\PageBuilder\Documents\Codec::wire($template));
    }

    public function storeTemplate(Request $request)
    {
        return $this->attempt(fn () => $this->templates->save(null, $request->all(), $request->user()));
    }

    public function saveTemplate(Request $request, PageTemplate $template)
    {
        return $this->attempt(fn () => $this->templates->save($template, $request->all(), $request->user()));
    }

    public function previewTemplate(Request $request, PageTemplate $template, string $host, string $record, string $area)
    {
        return $this->attempt(function () use ($request, $template, $host, $record, $area) {
            Gate::forUser($request->user())->authorize('pagebuilder.template', ['view', $template->context, $template]);
            $owner = $this->owner($host, $record);
            abort_unless($owner->pageBuilderContext() === $template->context && $owner->pageBuilderArea($area)['kind'] === 'page', 422);
            $doc = $request->input('document', $template->document);
            if (!is_array($doc)) throw new \InvalidArgumentException('Document must be an object');
            app(Validator::class)->validate($doc, 'template', 'page', $this->contexts->descriptors($template->context), $this->contexts->provider($template->context)->areas());
            return ['html' => $this->contents->renderTemplate($doc, $owner, $area, $request->user())];
        });
    }
}
