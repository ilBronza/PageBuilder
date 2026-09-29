<?php

namespace IlBronza\PageBuilder\Tests\Unit;

use IlBronza\PageBuilder\Documents\{InlineVariables, InvalidDocument, Registry, Renderer, Validator};
use PHPUnit\Framework\TestCase;

class InlineVariablesTest extends TestCase
{
    public function test_values_are_substituted_once_and_escaped_by_renderer(): void
    {
        $registry = new Registry;
        $renderer = new Renderer($registry, new Validator($registry));
        $node = fn ($id, $type, $props, $children = null) => array_filter(['id'=>$id, 'type'=>$type, 'props'=>$props, 'styles'=>[], 'bindings'=>[], 'children'=>$children], fn ($v) => $v !== null);
        $doc = ['version'=>1, 'kind'=>'page', 'children'=>[$node('s','section',[],[$node('r','row',[],[$node('c','column',[],[$node('t','text',['text'=>'Cliente {{ order.name }}: {{ order.total }}; {{ missing }}'])])])])]];
        $html = $renderer->render($doc, ['order.name'=>'<script>{{ order.total }}</script>', 'order.total'=>0], null, 'template');
        $this->assertStringContainsString('Cliente &lt;script&gt;{{ order.total }}&lt;/script&gt;: 0;', $html);
        $this->assertStringNotContainsString('<script>', $html);
        $this->assertStringContainsString('{{ order.name }}', $renderer->render($doc));
    }

    public function test_unknown_or_collection_variables_cannot_be_saved(): void
    {
        $this->expectException(InvalidDocument::class);
        InlineVariables::validate('{{ order.rows }}', ['order.rows'=>['type'=>'text','cardinality'=>'many']]);
    }

    public function test_unknown_variable_cannot_be_saved(): void
    {
        $this->expectException(InvalidDocument::class);
        InlineVariables::validate('{{ order.secret }}', []);
    }

    public function test_expressions_are_not_executable(): void
    {
        $this->expectException(InvalidDocument::class);
        InlineVariables::validate('{{ phpinfo() }}', null);
    }
}
