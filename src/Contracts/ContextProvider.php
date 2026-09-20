<?php

namespace IlBronza\PageBuilder\Contracts;

use Illuminate\Database\Eloquent\Model;

interface ContextProvider
{
    /** @return array<\IlBronza\PageBuilder\Data\Source> Definitions, never client-submitted paths. */
    public function sources(): array;
    /** Stable IDs of fragment areas this template can include. */
    public function areas(): array;
}
