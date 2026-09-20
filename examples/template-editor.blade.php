{{-- $template is an existing PageTemplate; $product is an authorized preview record. --}}
@php($context = app(\IlBronza\PageBuilder\Services\Contexts::class))
@include('pagebuilder::editor', ['options' => [
    'title' => $template->name,
    'mode' => 'template',
    'kind' => 'page',
    'url' => route('pagebuilder.templates.show', ['template' => $template]),
    'previewUrl' => route('pagebuilder.templates.preview', ['template' => $template, 'host' => 'products', 'record' => $product->getKey(), 'area' => 'main']),
    'sources' => $context->descriptors('product'),
    'areas' => $context->provider('product')->areas(),
]])
