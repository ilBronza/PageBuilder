{{-- In an authorized controller: Gate::authorize('pagebuilder.update', [$product, 'main']); --}}
@include('pagebuilder::editor', ['options' => [
    'title' => 'Scheda prodotto',
    'mode' => 'static',
    'kind' => 'page',
    'url' => route('pagebuilder.contents.show', ['host' => 'products', 'record' => $product->getKey(), 'area' => 'main']),
    'previewUrl' => route('pagebuilder.contents.preview', ['host' => 'products', 'record' => $product->getKey(), 'area' => 'main']),
]])
