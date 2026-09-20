<?php

namespace IlBronza\PageBuilder\Services;

use IlBronza\PageBuilder\Contracts\ContextProvider;
use Illuminate\Database\Eloquent\Model;

class Contexts
{
    public function provider(string $context): ContextProvider
    {
        $class = config('pagebuilder.contexts')[$context] ?? null;
        if (!$class) throw new \InvalidArgumentException('Unknown context');
        return app($class);
    }

    public function descriptors(string $context): array
    {
        $result = [];
        foreach ($this->provider($context)->sources() as $source) {
            if (isset($result[$source->id])) throw new \LogicException('Duplicate source ID');
            $result[$source->id] = $source->descriptor();
        }
        return $result;
    }

    public function values(string $context, Model $record, mixed $actor): array
    {
        $values = [];
        foreach ($this->provider($context)->sources() as $source) {
            try { $values[$source->id] = $source->resolve($record, $actor); }
            catch (\Throwable $error) { report($error); $values[$source->id] = null; }
        }
        return $values;
    }
}
