<?php

namespace App\PageBuilder;

use IlBronza\PageBuilder\Contracts\ContextProvider;
use IlBronza\PageBuilder\Data\Source;
use IlBronza\PageBuilder\Integrations\FileCabinetSource;

class ProductContext implements ContextProvider
{
    public function areas(): array { return ['description']; }

    public function sources(): array
    {
        return [
            new Source('product.name', 'Nome', 'text', 'one', fn ($product) => $product->name),
            new Source('product.category', 'Categoria', 'text', 'one', fn ($product) => $product->category?->name),
            new Source('product.tags', 'Etichette', 'text', 'many', fn ($product) => $product->tags->pluck('name')),
            // Read ONLY a field that the host has explicitly approved for this audience.
            FileCabinetSource::field('technical.material', 'Materiale', 'Scheda tecnica', 'Materiale', 'text',
                fn ($product, $actor) => $actor !== null && $actor->can('view', $product)),
        ];
    }
}
