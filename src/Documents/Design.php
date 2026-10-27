<?php

namespace IlBronza\PageBuilder\Documents;

final class Design
{
    public static function valid(string $key, mixed $value): bool
    {
        static $fields;
        $fields ??= json_decode(file_get_contents(__DIR__.'/../../resources/schema/design.json'), true, 512, JSON_THROW_ON_ERROR);
        if (!isset($fields[$key]) || !is_string($value) || strlen($value) > 2048) return false;
        $kind = $fields[$key][1];
        if ($kind === 'image') return preg_match('~^(https?://|/(?!/))~', $value) && Validator::safeUrl($value) === $value && !preg_match('/[<>"\x27(){};]/', $value);
        if ($kind === 'enum') return in_array($value, $fields[$key][2], true);
        if (preg_match('/^var\(--[a-zA-Z][a-zA-Z0-9_-]*\)$/D', $value)) return true;
        if ($kind === 'color') return (bool) preg_match('/^(?:#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{8}|transparent|currentColor)$/D', $value);
        if ($kind === 'font') return in_array($value, ['inherit','serif','sans-serif','monospace','system-ui'], true);
        if ($kind === 'number') return (bool) preg_match('/^(?:[0-3](?:\.\d{1,3})?|4)$/D', $value);
        $dimension = '/^(?:0|(?:\d{1,4}(?:\.\d{1,3})?|\.\d{1,3})(?:px|rem|em|%|vh|vw))$/D';
        return (bool) preg_match($dimension, $value) || ($kind === 'size' && $value === 'none') || ($kind === 'spacing' && ($value === 'auto' || preg_match($dimension, preg_replace('/^-/', '', $value))));
    }

    private static function tokens(array $styles, string $type): array
    {
        $result = [];
        $space = fn ($v) => in_array($v, ['none','collapse'], true) ? '0' : 'var(--pb-space-'.$v.')';
        foreach ($styles as $key => $value) {
            if ($key === 'background') {
                $dark = in_array($value, ['primary','secondary','success','warning','danger'], true);
                $result = array_replace($result, ['background-color'=>'var(--pb-palette-'.$value.')','--pb-context-text'=>'var(--pb-palette-'.($dark ? $value.'-contrast' : 'ink').')','--pb-context-heading'=>'var(--pb-palette-'.($dark ? $value.'-contrast' : 'emphasis').')','--pb-context-muted'=>'var(--pb-palette-'.($dark ? $value.'-contrast' : 'muted-ink').')','color'=>'var(--pb-context-text)']);
            }
            if ($key === 'color') $result['color'] = match ($value) {
                'default'=>'var(--pb-context-text, var(--pb-palette-ink))', 'muted'=>'var(--pb-context-muted, var(--pb-palette-muted-ink))', 'emphasis'=>'var(--pb-context-heading, var(--pb-palette-emphasis))', default=>'var(--pb-palette-'.($value === 'warning' ? 'warning-ink' : $value).')',
            };
            if (in_array($key, ['padding','margin'], true)) $result[$key] = $space($value);
            if ($key === 'align') $result['text-align'] = $value;
            if ($key === 'rowGap') $result['row-gap'] = $space($value);
            if ($key === 'vertical') $result[$type === 'column' ? 'justify-content' : 'align-items'] = ['top'=>'flex-start','middle'=>'center','bottom'=>'flex-end'][$value];
            if ($key === 'fontSize') $result['font-size'] = 'var(--pb-font-'.$value.')';
            if ($key === 'fontWeight') $result['font-weight'] = ['normal'=>'400','medium'=>'500','bold'=>'700'][$value];
            if ($key === 'radius') $result['border-radius'] = $value === 'none' ? '0' : 'var(--pb-radius-'.$value.')';
            if ($key === 'border') $result['border'] = $value === 'none' ? '0' : 'var(--pb-border-'.$value.') solid var(--pb-border-color)';
            if ($key === 'shadow') $result['box-shadow'] = $value === 'none' ? 'none' : 'var(--pb-shadow-'.$value.')';
            if ($key === 'maxWidth') $result['max-width'] = $value === 'none' ? 'none' : 'var(--pb-width-'.$value.')';
        }
        if (isset($styles['color'], $styles['background'])) $result['color'] = self::tokens(['color'=>$styles['color']], $type)['color'];
        return $result;
    }

    public static function css(array $node): string
    {
        $selector = '.pb-document [data-pb-id="'.$node['id'].'"]';
        $rules = function ($styles = [], $design = [], $columns = null, $hidden = null) use ($selector, $node) {
            $declarations = self::tokens($styles, $node['type']);
            foreach ($design as $key => $value) $declarations[preg_replace_callback('/[A-Z]/', fn ($m) => '-'.strtolower($m[0]), $key)] = $key === 'backgroundImage' ? 'url("'.$value.'")' : $value;
            if ($hidden !== null) $declarations['display'] = $hidden ? 'none' : (in_array($node['type'], ['column','row'], true) ? 'flex' : 'block');
            $decl = ''; foreach ($declarations as $key => $value) $decl .= $key.':'.$value.'!important;';
            $css = $decl ? $selector.'{'.$decl.'}' : '';
            $font = array_intersect(array_keys($declarations), ['font-size','font-family','font-weight','line-height','letter-spacing']);
            if ($font) $css .= $selector.'>:is(h1,h2,h3,h4,h5,h6){'.implode('', array_map(fn ($key) => $key.':inherit!important;', $font)).'}';
            if (isset($styles['gap'])) $css .= $selector.'{margin-left:0!important;column-gap:0!important;}'.$selector.'>*{padding-left:'.($styles['gap'] === 'collapse' ? '0' : 'var(--pb-space-'.$styles['gap'].')').'!important;}';
            if ($columns !== null) foreach ($columns as $i => $width) { [$a,$b] = explode('-', $width); $css .= $selector.'>:nth-child('.($i+1).'){width:'.self::percent((int) $a, (int) $b).'%!important;}'; }
            return $css;
        };
        $css = $rules($node['styles'], $node['design'] ?? []);
        foreach (['tablet'=>1199,'mobile'=>639] as $device => $width) if (isset($node['responsive'][$device])) {
            $r = $node['responsive'][$device];
            $body = $rules($r['styles'] ?? [], $r['design'] ?? [], $r['columns'] ?? null, $r['hidden'] ?? null);
            if ($body) $css .= '@media(max-width:'.$width.'px){'.$body.'}';
        }
        return $css;
    }

    private static function percent(int $a, int $b): string
    {
        return rtrim(rtrim(number_format(100 * $a / $b, 6, '.', ''), '0'), '.');
    }
}
