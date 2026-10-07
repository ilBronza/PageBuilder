{{-- $products is a collection already scoped by the host app's tenant and authorization rules. --}}
@php
    $options = app(\IlBronza\PageBuilder\Services\WorkspaceOptions::class)
        ->forRecords('products', $products, auth()->user());
    // Optional: supply only public presentation images from the host's media library.
    $options['media'] = $publicImages ?? [];
@endphp
@include('pagebuilder::workspace', ['options' => $options])
