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
            // Catalog definitions use a list of allowed style keys; nodes and
            // responsive overrides use a map of selected style values.
            $styleMap = $key === 'styles' && !(isset($value['label'], $value['props']) && !isset($value['id']));
            $result[$key] = in_array($key, ['props','bindings','meta','design','responsive','tablet','mobile'], true) || $styleMap ? (object) $item : $item;
        }
        return $result;
    }
}
