<?php

namespace IlBronza\PageBuilder\Documents;

class Renderer
{
    public function __construct(public Registry $registry, public Validator $validator) {}

    /** $area resolves an allowed fragment to already-rendered HTML. No arbitrary HTML property exists. */
    public function render(array $document, array $values = [], ?callable $area = null, string $mode = 'static'): string
    {
        $this->validator->validate($document, $mode);
        $nodes = fn ($children) => implode('', array_map(fn ($n) => $this->node($n, $values, $area), $children));
        return '<div class="pb-document">'.$nodes($document['children']).'</div>';
    }

    private function node(array $node, array $values, ?callable $area): string
    {
        $type = $node['type'];
        $def = $this->registry->elements[$type];
        $p = array_map(fn ($spec) => $spec['default'], $def['props']);
        $p = array_replace($p, $node['props']);
        foreach ($node['bindings'] as $key => $source) {
            $value = $values[$source] ?? null;
            $p[$key] = $def['props'][$key]['kind'] === 'list'
                ? (is_array($value) ? array_values(array_filter($value, 'is_scalar')) : [])
                : (is_scalar($value) ? self::scalar($value) : '');
        }
        $children = fn () => implode('', array_map(fn ($child) => $this->node($child, $values, $area), $node['children'] ?? []));
        $classes = ['pb-node', 'pb-'.$type];
        foreach ($node['styles'] as $key => $value) {
            $classes[] = match ($key) {
                'background' => 'uk-background-'.$value,
                'color' => $value === 'default' ? 'pb-color-default' : 'uk-text-'.$value,
                'align' => 'uk-text-'.$value,
                'padding' => $value === 'none' ? 'uk-padding-remove' : ($value === 'default' ? 'uk-padding' : 'uk-padding-'.$value),
                'margin' => $value === 'none' ? 'uk-margin-remove' : ($value === 'default' ? 'uk-margin' : 'uk-margin-'.$value),
                'gap' => $value === 'default' ? 'uk-grid' : 'uk-grid-'.$value,
                'rowGap' => 'pb-row-gap-'.$value,
                'vertical' => 'pb-valign-'.$value,
                default => '',
            };
        }
        if (in_array($node['styles']['background'] ?? '', ['primary','secondary'], true)) $classes[] = 'uk-light';
        if ($type === 'row') $classes[] = 'uk-grid';
        $attr = ' class="'.self::escape(implode(' ', $classes)).'" data-pb-id="'.self::escape($node['id']).'"';
        return match ($type) {
            'section' => '<section'.$attr.'><div class="uk-container'.($p['width'] === 'default' ? '' : ' uk-container-'.$p['width']).'">'.$children().'</div></section>',
            'row' => '<div'.$attr.'>'.implode('', array_map(fn ($child, $width) => '<div class="uk-width-1-1 uk-width-'.$width.'@s">'.$this->node($child, $values, $area).'</div>', $node['children'], $p['layout'])).'</div>',
            'column' => '<div'.$attr.'>'.$children().'</div>',
            'heading' => '<div'.$attr.'><'.$p['tag'].($p['size'] === 'default' ? '' : ' class="uk-heading-'.$p['size'].'"').'>'.self::escape($p['text']).'</'.$p['tag'].'></div>',
            'text' => '<div'.$attr.'><p class="pb-text">'.self::escape($p['text']).'</p></div>',
            'image' => '<div'.$attr.'>'.($p['src'] === '' || Validator::safeUrl($p['src']) === '' ? '' : '<img src="'.self::escape(Validator::safeUrl($p['src'])).'" alt="'.self::escape($p['alt']).'" class="pb-image pb-ratio-'.$p['ratio'].'" loading="lazy">').'</div>',
            'button' => '<div'.$attr.'><a class="uk-button uk-button-'.$p['variant'].'" href="'.self::escape(Validator::safeUrl($p['href'])).'">'.self::escape($p['text']).'</a></div>',
            'divider' => '<div'.$attr.'><hr'.($p['variant'] === 'default' ? '' : ' class="uk-divider-'.$p['variant'].'"').'></div>',
            'list' => '<div'.$attr.'><ul class="uk-list uk-list-'.$p['variant'].'">'.implode('', array_map(fn ($item) => '<li>'.self::escape(self::scalar($item)).'</li>', $p['items'])).'</ul></div>',
            'area' => '<div'.$attr.'>'.($area ? $area($p['area']) : '').'</div>',
            default => '<div'.$attr.'>'.$this->registry->renderCustom($type, $p).'</div>',
        };
    }

    public static function scalar(mixed $value): string { return is_bool($value) ? ($value ? 'true' : 'false') : (string) $value; }
    public static function escape(mixed $value): string { return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
}
