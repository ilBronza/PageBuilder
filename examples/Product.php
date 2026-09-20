<?php

namespace App\Models;

use IlBronza\PageBuilder\Traits\HasPageContent;
use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    use HasPageContent;
    // Add InteractsWithFormTrait here only if this host already integrates FileCabinet.

    public function pageBuilderContext(): string { return 'product'; }

    public function pageBuilderAreas(): array
    {
        return [
            'main' => ['column' => 'page_content_id', 'kind' => 'page', 'label' => 'Scheda prodotto'],
            'description' => ['column' => 'description_page_content_id', 'kind' => 'fragment', 'label' => 'Descrizione libera'],
        ];
    }
}
