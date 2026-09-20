<?php

namespace IlBronza\PageBuilder\Documents;

final class Codec
{
    /** PHP decodes {} to []; preserve JSON object maps across storage and HTTP. */
    public static function wire(mixed $value): mixed
    {
        if ($value instanceof \Illuminate\Contracts\Support\Arrayable) $value = $value->toArray();
        if (!is_array($value)) return $value;
        $result = [];
        foreach ($value as $key => $item) {
            $item = self::wire($item);
            $result[$key] = in_array($key, ['props','bindings'], true) || ($key === 'styles' && isset($value['id'], $value['type'])) ? (object) $item : $item;
        }
        return $result;
    }
}
