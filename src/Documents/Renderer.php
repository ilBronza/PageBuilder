<?php

namespace IlBronza\PageBuilder\Documents;

class Renderer
{
    private string $css = '';

    public function __construct(public Registry $registry, public Validator $validator) {}

    /** $area resolves an allowed fragment to already-rendered HTML. No arbitrary HTML property exists. */
    public function render(array $document, array $values = [], ?callable $area = null, string $mode = 'static'): string
    {
        $this->validator->validate($document, $mode);
        $savedCss = $this->css; $this->css = '';
        $nodes = fn ($children) => implode('', array_map(fn ($n) => $this->node($n, $values, $area, $mode), $children));
        try {
            $html = $nodes($document['children']);
            return '<div class="pb-document">'.($this->css ? '<style data-pb-design>'.$this->css.'</style>' : '').$html.'</div>';
        } finally { $this->css = $savedCss; }
    }

    private function node(array $node, array $values, ?callable $area, string $mode): string
    {
        if (!empty($node['meta']['disabled'])) return '';
        $this->css .= Design::css($node);
        $type = $node['type'];
        $def = $this->registry->elements[$type];
        $p = array_map(fn ($spec) => $spec['default'], $def['props']);
        $p = array_replace($p, $node['props']);
        if ($mode === 'template') foreach ($def['props'] as $key => $spec) {
            if (isset($node['bindings'][$key])) continue;
            if (($spec['binding'] ?? '') === 'text') $p[$key] = InlineVariables::resolve($p[$key], $values);
            if ($spec['kind'] === 'list') $p[$key] = array_map(fn ($item) => InlineVariables::resolve($item, $values), $p[$key]);
            if ($spec['kind'] === 'table') $p[$key] = array_map(fn ($row) => array_map(fn ($item) => InlineVariables::resolve($item, $values), $row), $p[$key]);
        }
        foreach ($node['bindings'] as $key => $source) {
            $value = $values[$source] ?? null;
            $p[$key] = $def['props'][$key]['kind'] === 'list'
                ? (is_array($value) ? array_values(array_filter($value, 'is_scalar')) : [])
                : (is_scalar($value) ? self::scalar($value) : '');
        }
        $children = fn () => implode('', array_map(fn ($child) => $this->node($child, $values, $area, $mode), $node['children'] ?? []));
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
        if (in_array($node['styles']['background'] ?? '', ['primary','secondary','success','danger'], true)) $classes[] = 'uk-light';
        if ($type === 'row') $classes[] = 'uk-grid';
        if (!empty($node['meta']['classes'])) $classes[] = $node['meta']['classes'];
        $attr = (!empty($node['meta']['anchor']) ? ' id="'.self::escape($node['meta']['anchor']).'"' : '').' class="'.self::escape(implode(' ', $classes)).'" data-pb-id="'.self::escape($node['id']).'"';
        return match ($type) {
            'section' => '<section'.$attr.'><div class="uk-container'.($p['width'] === 'default' ? '' : ' uk-container-'.$p['width']).'">'.$children().'</div></section>',
            'row' => '<div'.$attr.'>'.implode('', array_map(fn ($child, $width) => '<div class="uk-width-1-1 uk-width-'.$width.'@s">'.$this->node($child, $values, $area, $mode).'</div>', $node['children'], $p['layout'])).'</div>',
            'column' => '<div'.$attr.'>'.$children().'</div>',
            'heading' => '<div'.$attr.'><'.$p['tag'].($p['size'] === 'default' ? '' : ' class="uk-heading-'.$p['size'].'"').'>'.self::escape($p['text']).'</'.$p['tag'].'></div>',
            'text' => '<div'.$attr.'>'.(!empty($p['richText']) && !isset($node['bindings']['text']) ? '<div class="pb-rich-text">'.RichText::render($p['richText'], $values, $mode).'</div>' : '<p class="pb-text">'.self::escape($p['text']).'</p>').'</div>',
            'image' => '<div'.$attr.'>'.($p['src'] === '' || Validator::safeUrl($p['src']) === '' ? '' : '<img src="'.self::escape(Validator::safeUrl($p['src'])).'" alt="'.self::escape($p['alt']).'" class="pb-image pb-ratio-'.$p['ratio'].'" loading="lazy">').'</div>',
            'button' => '<div'.$attr.'><a class="uk-button uk-button-'.$p['variant'].'" href="'.self::escape(Validator::safeUrl($p['href'])).'">'.self::escape($p['text']).'</a></div>',
            'divider' => '<div'.$attr.'><hr'.($p['variant'] === 'default' ? '' : ' class="uk-divider-'.$p['variant'].'"').'></div>',
            'list' => '<div'.$attr.'><ul class="uk-list uk-list-'.$p['variant'].'">'.implode('', array_map(fn ($item) => '<li>'.self::escape(self::scalar($item)).'</li>', $p['items'])).'</ul></div>',
            'card', 'imageText', 'icon', 'table' => '<div'.$attr.'>'.$this->element($type, $p).'</div>',
            'area' => '<div'.$attr.'>'.($area ? $area($p['area']) : '').'</div>',
            default => '<div'.$attr.'>'.$this->registry->renderCustom($type, $p).'</div>',
        };
    }

    private function element(string $type, array $p): string
    {
        $img = !empty($p['src']) && Validator::safeUrl($p['src']) !== '' ? '<img src="'.self::escape(Validator::safeUrl($p['src'])).'" alt="'.self::escape($p['alt']).'" loading="lazy">' : '';
        if ($type === 'card') return '<article class="pb-card-inner">'.$img.'<div class="pb-card-body"><h3>'.self::escape($p['title']).'</h3><p class="pb-text">'.self::escape($p['text']).'</p>'.(!empty($p['href']) && Validator::safeUrl($p['href']) !== '' ? '<a href="'.self::escape(Validator::safeUrl($p['href'])).'">'.self::escape($p['linkText']).'</a>' : '').'</div></article>';
        if ($type === 'imageText') return '<div class="pb-image-text pb-image-'.$p['position'].'">'.($img ? '<div class="pb-image-text-media">'.$img.'</div>' : '').'<div class="pb-image-text-body"><h3>'.self::escape($p['title']).'</h3><p class="pb-text">'.self::escape($p['text']).'</p></div></div>';
        if ($type === 'icon') {
            static $icons; $icons ??= json_decode(file_get_contents(__DIR__.'/../../resources/schema/icons.json'), true, 512, JSON_THROW_ON_ERROR);
            return '<svg class="pb-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"'.($p['label'] !== '' ? ' role="img" aria-label="'.self::escape($p['label']).'"' : ' aria-hidden="true"').'><path d="'.$icons[$p['icon']].'"></path></svg>';
        }
        return '<div class="pb-table-scroll"><table class="pb-table"><thead><tr>'.implode('', array_map(fn ($cell) => '<th scope="col">'.self::escape($cell).'</th>', $p['columns'])).'</tr></thead><tbody>'.implode('', array_map(fn ($row) => '<tr>'.implode('', array_map(fn ($cell) => '<td>'.self::escape($cell).'</td>', $row)).'</tr>', $p['rows'])).'</tbody></table></div>';
    }

    public static function scalar(mixed $value): string { return is_bool($value) ? ($value ? 'true' : 'false') : (string) $value; }
    public static function escape(mixed $value): string { return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
}
