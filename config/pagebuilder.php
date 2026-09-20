<?php

return [
    'routes' => true,
    'prefix' => 'pagebuilder',
    'middleware' => ['web', 'auth'],
    // Public aliases only: ['products' => ['model' => Product::class, 'context' => 'product']]
    'hosts' => [],
    // ContextProvider implementations, instantiated by the Laravel container.
    'contexts' => [],
];
