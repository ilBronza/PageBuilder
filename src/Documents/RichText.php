<?php

namespace IlBronza\PageBuilder\Documents;

final class RichText
{
    public static function valid(mixed $blocks, string $mode = 'static', ?array $sources = null): bool
    {
        if (!is_array($blocks) || !array_is_list($blocks) || count($blocks) > 200) return false;
        $count = 0;
        foreach ($blocks as $block) {
            if (!is_array($block) || array_diff(array_keys($block), ['type','children']) || !in_array($block['type'] ?? '', ['paragraph','bullet','ordered'], true) || !isset($block['children']) || !is_array($block['children']) || !array_is_list($block['children'])) return false;
            foreach ($block['children'] as $run) {
                if (++$count > 2000 || !is_array($run) || array_diff(array_keys($run), ['text','marks','href']) || !is_string($run['text'] ?? null) || strlen($run['text']) > 20000) return false;
                if (array_key_exists('marks', $run) && (!is_array($run['marks']) || !array_is_list($run['marks']) || count($run['marks']) > 2 || count(array_unique($run['marks'], SORT_REGULAR)) !== count($run['marks']) || array_filter($run['marks'], fn ($mark) => !in_array($mark, ['bold','italic'], true)))) return false;
                if (array_key_exists('href', $run) && (!is_string($run['href']) || strlen($run['href']) > 2048 || Validator::safeUrl($run['href']) !== $run['href'])) return false;
                if ($mode === 'template') InlineVariables::validate($run['text'], $sources);
            }
        }
        return true;
    }

    public static function render(array $blocks, array $values, string $mode): string
    {
        $html = ''; $list = '';
        foreach ($blocks as $block) {
            $tag = ['paragraph'=>'','bullet'=>'ul','ordered'=>'ol'][$block['type']];
            if ($tag !== $list) { if ($list) $html .= '</'.$list.'>'; if ($tag) $html .= '<'.$tag.'>'; $list = $tag; }
            $inner = '';
            foreach ($block['children'] as $run) {
                $text = Renderer::escape($mode === 'template' ? InlineVariables::resolve($run['text'], $values) : $run['text']);
                if (in_array('bold', $run['marks'] ?? [], true)) $text = '<strong>'.$text.'</strong>';
                if (in_array('italic', $run['marks'] ?? [], true)) $text = '<em>'.$text.'</em>';
                if (!empty($run['href'])) $text = '<a href="'.Renderer::escape($run['href']).'">'.$text.'</a>';
                $inner .= $text;
            }
            $html .= '<'.($tag ? 'li' : 'p').'>'.$inner.'</'.($tag ? 'li' : 'p').'>';
        }
        return $html.($list ? '</'.$list.'>' : '');
    }
}
