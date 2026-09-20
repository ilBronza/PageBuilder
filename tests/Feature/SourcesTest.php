<?php

namespace IlBronza\PageBuilder\Tests\Feature;

use IlBronza\PageBuilder\Data\Source;
use IlBronza\PageBuilder\Integrations\FileCabinetSource;
use IlBronza\PageBuilder\Services\Contexts;
use IlBronza\PageBuilder\Tests\{TestCase, Product};

class SourcesTest extends TestCase
{
    public function test_sources_handle_scalar_collection_missing_values_and_permission(): void {
        $record=Product::create(['name'=>'A']);
        $this->assertSame('A', app(Contexts::class)->values('product',$record,null)['product.name']);
        $this->assertNull(app(Contexts::class)->values('product',$record,null)['secret']);
        $this->assertSame('private',app(Contexts::class)->values('product',$record,$this->actor())['secret']);
        $many=new Source('relation.tags','Tags','text','many',fn()=>collect(['a','b',null,new \stdClass]));
        $this->assertSame(['a','b'],$many->resolve($record,null));
        $one=new Source('missing','Missing','text','one',fn()=>null);$this->assertNull($one->resolve($record,null));
        $date=new Source('date','Date','date','one',fn()=>new \DateTimeImmutable('2026-09-17'));$this->assertSame('2026-09-17',$date->resolve($record,null));
    }
    public function test_filecabinet_adapter_reads_real_row_type_without_writing(): void {
        $sourceRoot=realpath(__DIR__.'/../../../FileCabinet/src');
        if (!$sourceRoot) $this->markTestSkipped('Optional FileCabinet working copy unavailable');
        $loader=require __DIR__.'/../../../.ibtest/vendor/autoload.php';
        foreach (glob(__DIR__.'/../../../*/composer.json') as $file) {
            $json=json_decode(file_get_contents($file),true);
            foreach ($json['autoload']['psr-4']??[] as $ns=>$path) if(is_string($path)) $loader->addPsr4($ns,dirname($file).'/'.$path,true);
        }
        $reader=new \IlBronza\FileCabinet\Providers\RowTypes\Rows\FormrowText;
        $formrow=$this->getMockBuilder(\IlBronza\FileCabinet\Models\Formrow::class)->disableOriginalConstructor()->onlyMethods(['isRepeatable','isMultiple'])->getMock();
        $formrow->method('isRepeatable')->willReturn(false);
        $formrow->method('isMultiple')->willReturn(false);
        $row=$this->getMockBuilder(\IlBronza\FileCabinet\Models\Dossierrow::class)->disableOriginalConstructor()->onlyMethods(['getFormrow','getRowType','getAttribute','save'])->getMock();
        $row->method('getFormrow')->willReturn($formrow);
        $row->method('getRowType')->willReturn($reader);
        $row->expects($this->once())->method('getAttribute')->with('string')->willReturn('Rovere');
        $row->expects($this->never())->method('save');
        $record=new class($row) extends Product {
            public array $names=[];
            public function __construct(private $row=null){parent::__construct();}
            public function getDossierRowByNames(string $form,string $field): ?\IlBronza\FileCabinet\Models\Dossierrow {$this->names=[$form,$field];return $this->row;}
        };
        $this->assertSame('Rovere',FileCabinetSource::field('fc.material','Materiale','technical','material')->resolve($record,null));
        $this->assertSame(['technical','material'],$record->names);
        $this->expectException(\InvalidArgumentException::class);
        FileCabinetSource::field('fc.file','File','technical','private','image');
    }
}
