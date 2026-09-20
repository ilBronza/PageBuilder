<?php

namespace IlBronza\PageBuilder\Tests\Feature;

use IlBronza\PageBuilder\Tests\{TestCase, Product};

class HttpTest extends TestCase
{
    public function test_api_authentication_authorization_validation_and_round_trip(): void {
        $record=Product::create(['name'=>'A']);$url='/pagebuilder/records/products/'.$record->id.'/areas/main';
        $this->getJson($url)->assertUnauthorized();
        $actor=$this->actor();$actor->admin=false;
        $this->actingAs($actor)->putJson($url,['id'=>null,'revision'=>0,'document'=>$this->doc()])->assertForbidden();
        $this->actingAs($this->actor());
        $input=['id'=>null,'revision'=>0,'mode'=>'static','document'=>$this->doc()];
        $saved=$this->putJson($url,$input)->assertOk()->json();
        $this->getJson($url)->assertOk()->assertJsonPath('document.children.0.id','section');
        $this->assertStringContainsString('"styles":{}',$this->getJson($url)->getContent());
        $this->putJson($url,$input)->assertConflict();
        $invalid=$saved;$invalid['document']='invalid';$this->putJson($url,$invalid)->assertUnprocessable();
        $saved['document']['version']=99;$this->putJson($url,$saved)->assertUnprocessable();
        $this->getJson('/pagebuilder/records/UnknownModel/1/areas/main')->assertNotFound();
        $this->getJson('/pagebuilder/records/products/'.$record->id.'/areas/unknown')->assertUnprocessable();
    }
    public function test_preview_and_public_renderer_match_and_escape_values(): void {
        $record=Product::create(['name'=>'A']);$document=$this->doc('<script>alert(1)</script>');
        $this->saveArea($record,'main',$document);
        $url='/pagebuilder/records/products/'.$record->id.'/areas/main/preview';
        $response=$this->actingAs($this->actor())->postJson($url,['document'=>$document])->assertOk();
        $this->assertSame($record->renderPageArea('main',$this->actor()),$response->json('html'));
        $this->assertStringNotContainsString('<script>',$response->json('html'));
    }
    public function test_blade_editor_and_public_content_views_render(): void {
        $record=Product::create(['name'=>'A']);$this->saveArea($record,'main',$this->doc('Blade content'));
        $html=view('pagebuilder::editor',['options'=>['url'=>'/test','mode'=>'static']])->render();
        $this->assertStringContainsString('mountEditor',$html);
        $html=view('pagebuilder::content',['record'=>$record,'area'=>'main','actor'=>$this->actor()])->render();
        $this->assertStringContainsString('Blade content',$html);
    }

    public function test_template_archive_and_preview_require_context_and_record_permissions(): void {
        $record=Product::create(['name'=>'Preview record']);
        $doc=$this->doc();$doc['children'][0]['children'][0]['children'][0]['children'][0]['bindings']=['text'=>'product.name'];
        $this->actingAs($this->actor());
        $saved=$this->postJson('/pagebuilder/templates',['name'=>'Example','context'=>'product','revision'=>0,'document'=>$doc])->assertOk()->json();
        $this->getJson('/pagebuilder/templates?context=product')->assertOk()->assertJsonCount(1,'templates');
        $this->getJson('/pagebuilder/templates/'.$saved['id'])->assertOk();
        $this->postJson('/pagebuilder/templates/'.$saved['id'].'/preview/products/'.$record->id.'/main',['document'=>$doc])->assertOk()->assertSee('Preview record');
        $doc['children'][0]['children'][0]['children'][0]['children'][0]['bindings']=['text'=>'private.method'];
        $this->putJson('/pagebuilder/templates/'.$saved['id'],['name'=>'Example','revision'=>1,'document'=>$doc])->assertUnprocessable();
    }
}
