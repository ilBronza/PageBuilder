<?php

namespace IlBronza\PageBuilder\Tests\Feature;

use IlBronza\PageBuilder\Documents\{Codec, InvalidDocument, Registry, Validator};
use IlBronza\PageBuilder\Tests\{TestCase, Product};

class AdvancedDocumentTest extends TestCase
{
    public function test_editor_options_keep_catalog_style_lists_and_document_style_maps_distinct(): void
    {
        $catalog = app(Registry::class)->elements;
        $catalog['custom'] = ['label'=>'Custom', 'props'=>[], 'styles'=>[]];
        $wire = json_decode(json_encode(Codec::wire(['catalog'=>$catalog, 'document'=>$this->doc()]), JSON_THROW_ON_ERROR));
        $this->assertSame($catalog['heading']['styles'], $wire->catalog->heading->styles);
        $this->assertSame([], $wire->catalog->custom->styles);
        $this->assertInstanceOf(\stdClass::class, $wire->document->children[0]->styles);
    }

    public function test_advanced_document_survives_storage_and_empty_maps_remain_json_objects(): void
    {
        $document = $this->doc('Titolo');
        $document['children'][0]['meta'] = ['name'=>'Intestazione','anchor'=>'intestazione','classes'=>'project-header'];
        $document['children'][0]['design'] = ['paddingTop'=>'var(--pb-space-small)'];
        $document['children'][0]['responsive'] = ['tablet'=>['styles'=>[],'design'=>[]], 'mobile'=>['design'=>['paddingTop'=>'0'],'hidden'=>false]];
        $product = Product::create(['name'=>'Esempio']);
        $this->saveArea($product, 'main', $document);
        $saved = $product->fresh()->pageContent('main')->document;
        $this->assertSame($document, $saved);
        $json = json_encode(Codec::wire($saved), JSON_THROW_ON_ERROR);
        $this->assertStringContainsString('"styles":{},"design":{}', $json);
        $html = $product->renderPageArea('main', $this->actor());
        $this->assertStringContainsString('id="intestazione"', $html);
        $this->assertStringContainsString('@media(max-width:639px)', $html);
    }

    public function test_rich_text_cannot_bypass_source_permissions(): void
    {
        $doc = $this->doc();
        $node = &$doc['children'][0]['children'][0]['children'][0]['children'][0];
        $node['type'] = 'text';
        $node['props'] = ['text'=>'Testo', 'richText'=>[['type'=>'paragraph','children'=>[['text'=>'{{ private.value }}']]]]];
        $this->expectException(InvalidDocument::class);
        app(Validator::class)->validate($doc, 'template', null, []);
    }
}
