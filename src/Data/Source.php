<?php

namespace IlBronza\PageBuilder\Data;

use Closure;
use Illuminate\Database\Eloquent\Model;

class Source
{
    public function __construct(
        public readonly string $id,
        public readonly string $label,
        public readonly string $type,
        public readonly string $cardinality,
        private Closure $read,
        private ?Closure $authorize = null,
    ) {
        if (!preg_match('/^[a-zA-Z0-9_.:-]{1,120}$/D', $id)
            || !in_array($type, ['text','number','date','boolean','url','image'], true)
            || !in_array($cardinality, ['one','many'], true)) throw new \InvalidArgumentException('Invalid source descriptor');
    }

    public function descriptor(): array
    {
        return ['id' => $this->id, 'label' => $this->label, 'type' => $this->type, 'cardinality' => $this->cardinality];
    }

    public function resolve(Model $record, mixed $actor): mixed
    {
        if ($this->authorize && !($this->authorize)($record, $actor)) return null;
        $value = ($this->read)($record);
        $normalize = function ($item) {
            if ($item instanceof \DateTimeInterface) $item = $item->format('Y-m-d');
            if (!is_scalar($item)) return null;
            return match ($this->type) {
                'number' => is_numeric($item) ? $item : null,
                'boolean' => is_bool($item) ? $item : null,
                default => (string) $item,
            };
        };
        if ($this->cardinality === 'one') return $normalize($value);
        if (!is_iterable($value)) return [];
        $result = [];
        foreach ($value as $item) {
            if (count($result) >= 200) break;
            if (($item = $normalize($item)) !== null) $result[] = $item;
        }
        return $result;
    }
}
