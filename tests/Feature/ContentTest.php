<?php

namespace IlBronza\PageBuilder\Tests\Feature;

use IlBronza\PageBuilder\Models\{PageContent, PageTemplate};
use IlBronza\PageBuilder\Services\{ContentManager, TemplateManager};
use IlBronza\PageBuilder\Tests\{TestCase, Product, Article};

class ContentTest extends TestCase
{
    public function test_two_models_and_two_areas_round_trip_without_changes(): void {
        foreach ([Product::class,Article::class] as $class) {
            $record=$class::create(['name'=>$class]);
            $page=$this->doc('A < B & "quote"');$fragment=$this->doc('Local','fragment');
            $main=$this->saveArea($record,'main',$page);$description=$this->saveArea($record,'description',$fragment);
            $this->assertNotSame($main['id'],$description['id']);
            $record=$record->fresh();
            $this->assertSame($page,$record->pageContent('main')->document);
            $this->assertSame($fragment,$record->pageContent('description')->document);
            $this->assertStringContainsString('A &lt; B &amp; &quot;quote&quot;',$record->renderPageArea('main',$this->actor()));
        }
    }
    public function test_shared_template_propagates_and_areas_survive_removal_and_reinsertion(): void {
        $manager=app(ContentManager::class);$templates=app(TemplateManager::class);
        $doc=$this->doc();$col=&$doc['children'][0]['children'][0]['children'][0];
        $col['children'][0]['bindings']=['text'=>'product.name'];
        $col['children'][]=['id'=>'free','type'=>'area','props'=>['area'=>'description'],'styles'=>[],'bindings'=>[]];
        unset($col);
        $template=$templates->save(null,['name'=>'Shared','context'=>'product','revision'=>0,'document'=>$doc],$this->actor());
        $records=[];
        foreach (['Arco','Tratto'] as $name) {
            $r=Product::create(['name'=>$name]);$records[]=$r;
            $this->saveArea($r,'description',$this->doc('Local '.$name,'fragment'));
            $manager->save($r,'main',['id'=>null,'revision'=>0,'mode'=>'template','template_id'=>$template->id],$this->actor());
            $html=$r->renderPageArea('main',$this->actor());
            $this->assertStringContainsString($name,$html);$this->assertStringContainsString('Local '.$name,$html);
            $this->assertNull($r->pageContent('main')->document);
        }
        $removed=$doc;array_pop($removed['children'][0]['children'][0]['children'][0]['children']);
        $template=$templates->save($template,['name'=>'Shared','revision'=>1,'document'=>$removed],$this->actor());
        foreach ($records as $r) { $this->assertStringNotContainsString('Local ',$r->renderPageArea('main',$this->actor()));$this->assertNotNull($r->pageContent('description')); }
        $doc['children'][0]['children'][0]['children'][0]['children'][0]['props']['size']='large';
        $templates->save($template,['name'=>'Shared','revision'=>2,'document'=>$doc],$this->actor());
        foreach ($records as $r) { $html=$r->renderPageArea('main',$this->actor());$this->assertStringContainsString('uk-heading-large',$html);$this->assertStringContainsString('Local '.$r->name,$html); }
        $this->assertStringNotContainsString('Arco',json_encode($template->fresh()->document));
    }
    public function test_foreign_keys_cannot_share_local_contents_across_tables(): void {
        $a=Product::create(['name'=>'A']);$b=Article::create(['name'=>'B']);$this->saveArea($a,'main',$this->doc());
        $this->expectException(\LogicException::class);$b->page_content_id=$a->page_content_id;$b->save();
    }
    public function test_detach_and_owner_deletion_keep_orphans_without_deleting_documents(): void {
        $a=Product::create(['name'=>'A']);$main=$this->saveArea($a,'main',$this->doc());$description=$this->saveArea($a,'description',$this->doc('Local','fragment'));
        app(ContentManager::class)->detach($a,'main',$this->actor());
        $this->assertNull($a->fresh()->page_content_id);$this->assertNull(PageContent::find($main['id'])->ownership_key);
        $a->delete();$this->assertNotNull(PageContent::find($description['id']));$this->assertNull(PageContent::find($description['id'])->ownership_key);
    }
    public function test_stale_save_does_not_overwrite(): void {
        $a=Product::create(['name'=>'A']);$saved=$this->saveArea($a,'main',$this->doc());$this->saveArea($a,'main',$this->doc('New'));
        $this->expectException(\Symfony\Component\HttpKernel\Exception\ConflictHttpException::class);
        app(ContentManager::class)->save($a,'main',$saved,$this->actor());
    }
    public function test_template_cannot_be_attached_to_fragment_preventing_cycles(): void {
        $a=Product::create(['name'=>'A']);$template=app(TemplateManager::class)->save(null,['name'=>'T','context'=>'product','revision'=>0,'document'=>$this->doc()],$this->actor());
        $this->expectException(\InvalidArgumentException::class);
        app(ContentManager::class)->save($a,'description',['id'=>null,'revision'=>0,'mode'=>'template','template_id'=>$template->id],$this->actor());
    }
    public function test_denied_area_and_corrupt_data_are_empty_in_public_output(): void {
        $a=Product::create(['name'=>'A']);$this->saveArea($a,'description',$this->doc('secret','fragment'));$this->assertSame('',$a->renderPageArea('description'));
        $saved=$this->saveArea($a,'main',$this->doc());PageContent::whereKey($saved['id'])->update(['document'=>'{"version":99}']);
        $this->assertSame('',$a->renderPageArea('main'));
    }
}
