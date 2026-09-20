<?php

namespace IlBronza\PageBuilder\Documents;

class Validator
{
    public const LAYOUTS = [['1-1'], ['1-2','1-2'], ['1-3','2-3'], ['2-3','1-3'], ['1-4','3-4'], ['3-4','1-4'], ['1-3','1-3','1-3'], ['1-4','1-4','1-4','1-4']];

    public function __construct(public Registry $registry) {}

    public function validate(array $document, string $mode = 'static', ?string $kind = null, ?array $sources = null, ?array $areas = null): array
    {
        $this->check(in_array($mode, ['static', 'template', 'area'], true), 'Invalid mode');
        $this->keys($document, ['version', 'kind', 'children']);
        $this->check(($document['version'] ?? null) === 1, 'Unsupported document version');
        $this->check(in_array($document['kind'] ?? '', ['page','fragment'], true), 'Invalid document kind');
        $this->check($kind === null || $kind === $document['kind'], 'Document cannot be inserted here');
        $this->check(strlen(json_encode($document, JSON_THROW_ON_ERROR)) <= 1048576, 'Document exceeds 1 MB');
        $ids = [];
        $walk = function ($nodes, $allowed, $depth) use (&$walk, &$ids, $mode, $sources, $areas) {
            $this->check(is_array($nodes) && array_is_list($nodes), 'Children must be a list');
            $this->check($depth <= 8, 'Document is too deep');
            foreach ($nodes as $node) {
                $this->check(is_array($node), 'Invalid node');
                $this->keys($node, ['id','type','props','styles','bindings','children']);
                $id = $node['id'] ?? null;
                $this->check(is_string($id) && preg_match('/^[a-zA-Z0-9_-]{1,80}$/D', $id) && !isset($ids[$id]), 'Invalid or duplicate node ID');
                $ids[$id] = true;
                $this->check(count($ids) <= 500, 'Too many nodes');
                $type = $node['type'] ?? '';
                $this->check(in_array($type, $allowed, true) && isset($this->registry->elements[$type]), 'Invalid node placement or unknown element');
                $def = $this->registry->elements[$type];
                $this->check(empty($def['templateOnly']) || $mode === 'template', 'Element requires template mode');
                foreach (['props','styles','bindings'] as $key) {
                    $this->check(isset($node[$key]) && is_array($node[$key]), 'Missing '.$key);
                }
                $this->keys($node['props'], array_keys($def['props']));
                foreach ($node['props'] as $key => $value) $this->property($value, $def['props'][$key]);
                $this->keys($node['styles'], $def['styles']);
                foreach ($node['styles'] as $key => $value) {
                    $this->check(in_array($value, $this->registry->styles[$key] ?? [], true), 'Invalid style token');
                }
                $this->keys($node['bindings'], array_keys(array_filter($def['props'], fn ($p) => isset($p['binding']))));
                foreach ($node['bindings'] as $key => $source) {
                    $this->check($mode === 'template' && is_string($source) && preg_match('/^[a-zA-Z0-9_.:-]{1,120}$/D', $source), 'Invalid binding');
                    if ($sources !== null) {
                        $descriptor = $sources[$source] ?? null;
                        $this->check($descriptor !== null && self::compatible($def['props'][$key]['binding'], $descriptor), 'Unavailable or incompatible source');
                    }
                }
                if ($type === 'area' && $areas !== null) $this->check(in_array($node['props']['area'] ?? 'description', $areas, true), 'Unknown area');
                if (isset($def['children'])) {
                    $walk($node['children'] ?? null, $def['children'], $depth + 1);
                    if ($type === 'row') {
                        $layout = $node['props']['layout'] ?? ['1-1'];
                        $this->check(count($node['children']) === count($layout), 'Column count does not match layout');
                    }
                } else $this->check(!isset($node['children']), 'Elements cannot contain child nodes');
            }
        };
        $walk($document['children'] ?? null, $document['kind'] === 'page' ? ['section'] : ['row'], 0);
        return $document;
    }

    public static function compatible(string $binding, array $source): bool
    {
        if ($binding === 'list') return ($source['cardinality'] ?? '') === 'many' && in_array($source['type'] ?? '', ['text','number','date','boolean'], true);
        if (($source['cardinality'] ?? '') !== 'one') return false;
        return $binding === 'text' ? in_array($source['type'] ?? '', ['text','number','date','boolean'], true) : ($source['type'] ?? '') === $binding;
    }

    private function property(mixed $value, array $spec): void
    {
        $valid = match ($spec['kind']) {
            'enum' => in_array($value, $spec['values'], true),
            'layout' => in_array($value, self::LAYOUTS, true),
            'list' => is_array($value) && array_is_list($value) && count($value) <= 200 && count(array_filter($value, fn ($v) => is_string($v) && strlen($v) <= 10000)) === count($value),
            'identifier' => is_string($value) && preg_match('/^[a-zA-Z0-9_-]{1,80}$/D', $value),
            'url' => is_string($value) && strlen($value) <= 2048 && self::safeUrl($value) === $value,
            'string' => is_string($value) && strlen($value) <= 20000,
            default => false,
        };
        $this->check((bool) $valid, 'Invalid property value');
    }

    public static function safeUrl(mixed $value): string
    {
        if (!is_string($value) || preg_match('/[\x00-\x20\x7f\\\\]/', $value)) return '';
        return $value === '' || preg_match('~^(https?://[^/]+|/(?!/)|#|mailto:|tel:)~i', $value) ? $value : '';
    }

    private function keys(array $value, array $allowed): void
    {
        $this->check(array_diff(array_keys($value), $allowed) === [], 'Unknown document property');
    }

    private function check(bool $condition, string $message): void
    {
        if (!$condition) throw new InvalidDocument($message);
    }
}
