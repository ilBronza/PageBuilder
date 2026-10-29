<?php

return [
    'routes' => true,
    'prefix' => 'pagebuilder',
    'middleware' => ['web', 'auth'],
    // Public aliases only: ['products' => ['model' => Product::class, 'context' => 'product']]
    'hosts' => [],
    // ContextProvider implementations, instantiated by the Laravel container.
    'contexts' => [],
    // Optional Spatie Media Library v11. Each alias is an explicit access scope.
    // ['documents' => ['label' => 'Immagini documenti', 'disk' => 'public']]
    // Gate: pagebuilder.media ($actor, $action: view|upload|update, $library).
    'media' => [
        'libraries' => [],
        'max_kb' => 10240,
        'max_pixels' => 40000000,
    ],
];
