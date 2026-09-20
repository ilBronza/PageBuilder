<?php

namespace IlBronza\PageBuilder\Documents;

class Registry
{
    public array $elements;
    public array $styles;
    private array $renderers = [];

    public function __construct()
    {
        $this->elements = json_decode(file_get_contents(__DIR__.'/../../resources/schema/catalog.json'), true, 512, JSON_THROW_ON_ERROR);
        $this->styles = json_decode(file_get_contents(__DIR__.'/../../resources/schema/styles.json'), true, 512, JSON_THROW_ON_ERROR);
    }

    /** Extensions are trusted application code; return escaped HTML from the renderer. */
    public function register(string $type, array $definition, callable $render): void
    {
        if (!preg_match('/^[a-z][a-z0-9-]{0,63}$/D', $type) || isset($this->elements[$type]) || isset($definition['children'])) {
            throw new \InvalidArgumentException('Invalid custom element');
        }
        $this->elements[$type] = $definition;
        $this->elements['column']['children'][] = $type;
        $this->renderers[$type] = $render;
    }

    public function renderCustom(string $type, array $props): string
    {
        return isset($this->renderers[$type]) ? ($this->renderers[$type])($props) : '';
    }
}
