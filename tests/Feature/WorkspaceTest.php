<?php

namespace IlBronza\PageBuilder\Tests\Feature;

use IlBronza\PageBuilder\Models\PageContent;
use IlBronza\PageBuilder\Services\{ContentManager, TemplateManager, WorkspaceOptions};
use IlBronza\PageBuilder\Tests\{TestCase, Product};
use Illuminate\Support\Facades\{DB, Gate};

class WorkspaceTest extends TestCase
{
    public function test_fragment_http_save_uses_static_mode_and_preserves_history(): void
    {
        $record = Product::create(['name' => 'Arco']);
        $this->actingAs($this->actor());
        $url = '/pagebuilder/records/products/'.$record->id.'/areas/description';
        $state = $this->getJson($url)->assertOk()->json();
        $first = $this->putJson($url, array_merge($state, ['mode' => 'static', 'document' => $this->doc('Prima', 'fragment')]))->assertOk()->json();
        $second = $this->putJson($url, array_merge($first, ['document' => $this->doc('Seconda', 'fragment')]))->assertOk()->json();
        $history = $this->getJson($url.'/history')->assertOk()->assertJsonCount(2, 'revisions');
        $history->assertJsonPath('revisions.0.revision', 2);
        $snapshot = $this->getJson($url.'/history/1')->assertOk();
        $this->assertStringContainsString('"props":{}', $snapshot->getContent());
        $this->assertStringContainsString('Prima', json_encode($snapshot->json()));
        $restored = $this->putJson($url, array_merge($snapshot->json(), ['id' => $second['id'], 'revision' => $second['revision']]))->assertOk()->json();
        $this->assertSame(3, $restored['revision']);
        $this->assertStringContainsString('Prima', $record->fresh()->renderPageArea('description', $this->actor()));
        $this->putJson($url, $second)->assertConflict();
        $this->getJson($url.'/history')->assertJsonCount(3, 'revisions');
        $actor = $this->actor(); $actor->admin = false;
        $this->actingAs($actor)->getJson($url.'/history/1')->assertForbidden();
    }

    public function test_static_template_switch_and_shared_template_restore_preserve_both_histories(): void
    {
        $record = Product::create(['name' => 'Arco']);
        $this->actingAs($this->actor());
        $url = '/pagebuilder/records/products/'.$record->id.'/areas/main';
        $original = $this->saveArea($record, 'main', $this->doc('Originale'));
        // Simulate a pre-upgrade document with no historical entries.
        DB::table('pagebuilder_revisions')->delete();
        $template = app(TemplateManager::class)->save(null, ['name' => 'Scheda', 'context' => 'product', 'revision' => 0, 'document' => $this->doc('Template')], $this->actor());
        $linked = $this->putJson($url, ['id' => $original['id'], 'revision' => $original['revision'], 'mode' => 'template', 'template_id' => $template->id, 'document' => null])->assertOk()->json();
        $this->getJson($url.'/history')->assertJsonCount(2, 'revisions');
        $this->getJson($url.'/history/1')->assertSee('Originale');
        $templateUrl = '/pagebuilder/templates/'.$template->id;
        $updated = $this->putJson($templateUrl, ['name' => 'Rinominato', 'revision' => $template->revision, 'document' => $this->doc('Nuovo')])->assertOk()->json();
        $snapshot = $this->getJson($templateUrl.'/history/1')->assertOk()->json();
        $this->putJson($templateUrl, $snapshot + ['revision' => $updated['revision']])->assertOk()->assertJsonPath('revision', 3);
        $this->assertStringContainsString('Template', $record->fresh()->renderPageArea('main', $this->actor()));
        $snapshot = $this->getJson($url.'/history/1')->json();
        $this->putJson($url, $snapshot + ['id' => $linked['id'], 'revision' => $linked['revision']])->assertOk();
        $this->assertStringContainsString('Originale', $record->fresh()->renderPageArea('main', $this->actor()));
        $this->getJson($templateUrl.'/history/99')->assertNotFound();
    }

    public function test_workspace_only_contains_explicit_authorized_records_and_areas(): void
    {
        $record = Product::create(['name' => 'Arco']);
        $other = Product::create(['name' => 'Tratto']);
        Gate::define('pagebuilder.update', fn ($actor, $owner, $area) => $owner->id === $record->id && $area === 'description');
        $options = app(WorkspaceOptions::class)->forRecords('products', [$record, $other], $this->actor());
        $this->assertCount(1, $options['records']);
        $this->assertSame('description', $options['records'][0]['areas'][0]['id']);
        $this->assertCount(1, $options['records'][0]['areas']);
        $this->assertNull($options['recoveryUrl']);
        $this->actingAs($this->actor())->get('/pagebuilder/records/products/'.$record->id.'/edit')->assertOk()->assertSee('mountWorkspace');
        $this->get('/pagebuilder/records/products/'.$other->id.'/edit')->assertForbidden();
    }

    public function test_orphan_recovery_requires_its_own_permission_and_copies_without_reassigning(): void
    {
        $source = Product::create(['name' => 'Source']); $target = Product::create(['name' => 'Target']);
        $old = $this->saveArea($source, 'description', $this->doc('Recuperabile', 'fragment'));
        app(ContentManager::class)->detach($source, 'description', $this->actor());
        $this->actingAs($this->actor())->getJson('/pagebuilder/contents/orphans')->assertForbidden();
        $this->getJson('/pagebuilder/contents/orphans/'.$old['id'])->assertForbidden();
        Gate::define('pagebuilder.recover', fn ($actor, $action, $content = null) => $actor->admin && ($action === 'list' || $content->id === $old['id']));
        $this->getJson('/pagebuilder/contents/orphans')->assertOk()->assertJsonCount(1, 'contents');
        $snapshot = $this->getJson('/pagebuilder/contents/orphans/'.$old['id'])->assertOk()->json();
        $url = '/pagebuilder/records/products/'.$target->id.'/areas/description';
        $new = $this->putJson($url, $snapshot + ['id' => null, 'revision' => 0])->assertOk()->json();
        $this->assertNotSame($old['id'], $new['id']);
        $this->assertNull(PageContent::findOrFail($old['id'])->ownership_key);
        $this->assertStringContainsString('Recuperabile', $target->fresh()->renderPageArea('description', $this->actor()));
        $this->getJson('/pagebuilder/contents/orphans/'.$new['id'])->assertForbidden();
        Gate::define('pagebuilder.recover', fn () => true);
        $this->getJson('/pagebuilder/contents/orphans/'.$new['id'])->assertNotFound();
    }

    public function test_template_catalog_respects_individual_permissions(): void
    {
        $manager = app(TemplateManager::class);
        $visible = $manager->save(null, ['name' => 'Visibile', 'context' => 'product', 'revision' => 0, 'document' => $this->doc()], $this->actor());
        $hidden = $manager->save(null, ['name' => 'Riservato', 'context' => 'product', 'revision' => 0, 'document' => $this->doc()], $this->actor());
        Gate::define('pagebuilder.template', fn ($actor, $action, $context, $template = null) => $action === 'list' || ($action === 'view' && $template?->id === $visible->id));
        $this->actingAs($this->actor())->getJson('/pagebuilder/templates?context=product')
            ->assertOk()->assertJsonCount(1, 'templates')->assertJsonPath('templates.0.id', $visible->id)
            ->assertJsonPath('canCreate', false)->assertJsonPath('templates.0.can_update', false)->assertJsonPath('templates.0.can_use', false);
        $this->getJson('/pagebuilder/templates/'.$hidden->id)->assertForbidden();
        $this->getJson('/pagebuilder/templates/'.$visible->id.'/history')->assertForbidden();
    }
}
