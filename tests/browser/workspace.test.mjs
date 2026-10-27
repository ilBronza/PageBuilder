import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createPlayground} from '../../playground/server.mjs';
import {staticDocument} from '../../playground/seed.js';
const {chromium, expect} = (() => {
  const require = createRequire(import.meta.url);
  return {...require('playwright'), expect: require('playwright/test').expect};
})();
async function fixture(t, {variables} = {}) {
  const dir = await mkdtemp(path.join(tmpdir(), 'pagebuilder-browser-'));
  const server = await createPlayground({dataDir:dir});
  if (variables) {
    const serve = server.listeners('request')[0];
    server.removeListener('request', serve);
    server.on('request', (request, response) => {
      if (request.url === '/local-variables.css') {
        response.writeHead(200, {'Content-Type':'text/css'}); response.end(variables);
      } else serve(request, response);
    });
  }
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const browser = await chromium.launch({headless: true, ...(process.env.PAGEBUILDER_BROWSER_EXECUTABLE ? {executablePath:process.env.PAGEBUILDER_BROWSER_EXECUTABLE} : {})});
  const context = await browser.newContext({viewport:{width:1440,height:1000}});
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => { await browser.close(); await new Promise(resolve => server.close(resolve)); await rm(dir, {recursive:true,force:true}); });
  const errors = []; const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  if (variables) {
    await context.route('**/api/workspace', async route => {
      const response = await route.fetch();
      await route.fulfill({response, json:{...await response.json(), variablesUrl:`${base}/local-variables.css`,defaultVariablesUrl:`${base}/resources/css/variables.css?v=current`}});
    });
  }
  await page.goto(base);
  await expect(page.locator('[data-select=headline]')).toBeVisible();
  t.after(() => assert.deepEqual(errors, []));
  return {page, context, base};
}
async function showBuilder(page) {
  await expect(page.locator('[data-action=reload]')).toBeEnabled();
  const back = page.getByRole('button',{name:'Torna al builder',exact:true});
  if (await back.isVisible()) await back.click();
}
async function selectNode(page, id) {
  await showBuilder(page);
  await page.locator(`[data-select="${id}"]`).click();
}
async function editTitle(page, text) {
  await selectNode(page, 'headline');
  await page.locator('[data-prop=text]').fill(text);
}
async function openGroup(page,name) {const details=page.locator('.pb-settings-group').filter({has:page.getByText(name,{exact:true})});if(await details.getAttribute('open')===null)await page.getByText(name,{exact:true}).click();}
async function save(page) {
  await page.locator('[data-action=save]').click();
  await expect(page.locator('[data-action=save]')).toBeDisabled();
  await expect(page.locator('.pb-status')).toContainText('Salvato');
}

test('local variables style swatches, editable and linked previews while retaining omitted defaults', async t => {
  const {page,base} = await fixture(t, {variables:':root { --pb-palette-primary: #6844b5; --pb-palette-secondary: #164c70; }'});
  await selectNode(page,'hero');
  await page.locator('[data-palette=background]').getByRole('button',{name:'Primary',exact:true}).click();
  const swatch = page.locator('[data-palette=background] [data-color-token=primary]');
  await expect(swatch).toHaveCSS('background-color','rgb(104, 68, 181)');
  await expect(page.locator('[data-palette=background] [data-color-token=success]')).toHaveCSS('background-color','rgb(57, 115, 62)');
  const preview = page.frameLocator('.pb-preview-wrap iframe');
  await expect(preview.locator('[data-pb-id=hero]')).toHaveCSS('background-color','rgb(104, 68, 181)');
  await expect(preview.locator('[data-pb-id=cta] a')).toHaveCSS('background-color','rgb(22, 76, 112)');
  // Host pages can include public content CSS after mounting the editor.
  await page.addStyleTag({url:`${base}/resources/css/content.css`});
  await page.addStyleTag({content:`@import url("${base}/resources/css/variables.css?v=current") layer(pagebuilder-defaults);`});
  await expect(swatch).toHaveCSS('background-color','rgb(104, 68, 181)');
  await page.locator('[data-action=undo]').click();
  await page.locator('[data-record]').selectOption('a');
  await expect(page.getByText('Questo record usa un template condiviso')).toBeVisible();
  await expect(page.frameLocator('[data-editor]>iframe').locator('[data-pb-id=cta] a')).toHaveCSS('background-color','rgb(22, 76, 112)');
  await page.getByRole('button',{name:'Modifica il template',exact:true}).click();
  await selectNode(page,'cta');
  await page.getByRole('button',{name:'Impostazioni',exact:true}).click();
  await expect(page.locator('[data-palette=variant] [data-color-token=secondary]')).toHaveCSS('background-color','rgb(22, 76, 112)');
  await expect(page.locator('head link[href$="/local-variables.css"]')).toHaveCount(1);
});

test('palette colors render on headings, nested backgrounds and buttons, and persist on the public page', async t => {
  const {page,context,base} = await fixture(t);
  const preview = page.frameLocator('.pb-preview-wrap iframe');
  const heading = preview.locator('[data-pb-id=headline] h1');
  const pick = (field,name) => page.locator(`[data-palette=${field}]`).getByRole('button',{name,exact:true});
  await selectNode(page,'hero');
  for (const [name,color] of [['Successo','rgb(57, 115, 62)'],['Pericolo','rgb(181, 63, 82)'],['Primary','rgb(46, 107, 87)']]) {
    await pick('background',name).click();
    await expect(preview.locator('[data-pb-id=hero]')).toHaveCSS('background-color',color);
    await expect(heading).toHaveCSS('color','rgb(255, 255, 255)');
  }
  await pick('background','Avviso').click();
  await expect(heading).toHaveCSS('color','rgb(73, 54, 16)');
  await expect(preview.locator('[data-pb-id=intro]')).toHaveCSS('color','rgb(73, 54, 16)');
  await pick('background','Primary').click();
  // A light column must establish its own contrast inside a dark section.
  await selectNode(page,'hero_row_c0');
  await pick('background','Predefinito').click();
  await expect(heading).toHaveCSS('color','rgb(41, 61, 53)');
  await selectNode(page,'headline');
  await page.getByRole('button',{name:'Impostazioni',exact:true}).click();
  await pick('color','Pericolo').click();
  await expect(heading).toHaveCSS('color','rgb(181, 63, 82)');
  await pick('color','Bianco').click();
  await expect(heading).toHaveCSS('color','rgb(255, 255, 255)');
  await pick('color','Tema globale').click();
  await expect(pick('color','Tema globale')).toBeFocused();
  await expect(heading).toHaveCSS('color','rgb(41, 61, 53)');
  await page.locator('[data-action=undo]').click();
  await expect(pick('color','Bianco')).toHaveAttribute('aria-pressed','true');
  await expect(heading).toHaveCSS('color','rgb(255, 255, 255)');
  await page.locator('[data-action=redo]').click();
  await pick('background','Avviso').click();
  await expect(heading).toHaveCSS('color','rgb(73, 54, 16)');
  await selectNode(page,'cta');
  await page.getByRole('button',{name:'Impostazioni',exact:true}).click();
  await expect(preview.locator('[data-pb-id=cta] a')).toHaveCSS('background-color','rgb(169, 79, 53)');
  await pick('variant','Avviso').click();
  await expect(preview.locator('[data-pb-id=cta] a')).toHaveCSS('color','rgb(73, 54, 16)');
  await save(page);
  await page.locator('[data-action=reload]').click();
  await selectNode(page,'cta');
  await page.getByRole('button',{name:'Impostazioni',exact:true}).click();
  await expect(pick('variant','Avviso')).toHaveAttribute('aria-pressed','true');
  const published = await context.newPage();
  await published.goto(`${base}/public`);
  await expect(published.locator('[data-pb-id=hero]')).toHaveCSS('background-color','rgb(46, 107, 87)');
  await expect(published.locator('[data-pb-id=headline]')).toHaveCSS('background-color','rgb(240, 198, 99)');
  await expect(published.locator('[data-pb-id=headline] h1')).toHaveCSS('color','rgb(73, 54, 16)');
  await expect(published.locator('[data-pb-id=cta] a')).toHaveCSS('background-color','rgb(240, 198, 99)');
});

test('static editing, JSON import/undo, invalid import and image picker work in the browser', async t => {
  const {page} = await fixture(t);
  await editTitle(page, 'Titolo salvato'); await save(page);
  await page.locator('[data-action=reload]').click();
  await selectNode(page, 'headline');
  await expect(page.locator('[data-prop=text]')).toHaveValue('Titolo salvato');
  await page.locator('[data-import]').setInputFiles({name:'document.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(staticDocument))});
  await expect(page.locator('[data-action=save]')).toBeEnabled();
  await page.locator('[data-action=undo]').click();
  await expect(page.locator('[data-action=save]')).toBeDisabled();
  await page.locator('[data-import]').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"version":99,"kind":"page","children":[]}')});
  await expect(page.locator('.pb-message')).toContainText('Importazione non riuscita');
  await selectNode(page, 'headline');
  await expect(page.locator('[data-prop=text]')).toHaveValue('Titolo salvato');
  await selectNode(page, 'illustration');
  await page.getByRole('button',{name:'Scegli immagine',exact:true}).click();
  await page.locator('[data-media="0"]').click();
  await expect(page.locator('[data-prop=alt]')).toHaveValue('Composizione di forme geometriche');
  await page.getByRole('button',{name:'Mobile',exact:true}).click();
  await expect(page.locator('.pb-size-label')).toContainText('390');
  await expect.poll(async () => Math.round((await page.locator('.pb-preview-wrap').boundingBox()).width)).toBe(390);
  if (process.env.PAGEBUILDER_SCREENSHOT) await page.screenshot({path:process.env.PAGEBUILDER_SCREENSHOT,fullPage:true});
});

test('free areas save and shared template edits survive switching preview record', async t => {
  const {page, base} = await fixture(t);
  await page.locator('[data-record]').selectOption('a');
  await expect(page.getByText('Questo record usa un template condiviso')).toBeVisible();
  await page.locator('[data-area]').selectOption('description');
  await selectNode(page, 'local_text');
  await page.locator('[data-prop=text]').fill('Descrizione modificata di Arco'); await save(page);
  await page.locator('[data-area]').selectOption('main');
  await page.getByRole('button',{name:'Modifica il template',exact:true}).click();
  await selectNode(page, 'detail_title');
  await page.locator('[data-prop=text]').fill('Template aggiornato');
  await page.locator('[data-record]').selectOption('b');
  await expect(page.locator('[data-prop=text]')).toHaveValue('Template aggiornato');
  await expect(page.frameLocator('.pb-preview-wrap iframe').getByRole('heading',{name:'Libreria Tratto',exact:true})).toBeVisible();
  await save(page);
  const a = await (await fetch(`${base}/public?record=a`)).text(), b = await (await fetch(`${base}/public?record=b`)).text();
  assert.match(a,/Template aggiornato/); assert.match(b,/Template aggiornato/);
  assert.match(a,/Descrizione modificata di Arco/); assert.doesNotMatch(b,/Descrizione modificata di Arco/);
});

test('template creation, duplication, rename, assignment and history restore work end to end', async t => {
  const {page, base} = await fixture(t);
  await page.getByRole('button',{name:'Nuovo template',exact:true}).click();
  await page.locator('[name=name]').fill('Template di prova');
  await page.getByRole('button',{name:'Conferma',exact:true}).click();
  await expect(page.locator('[data-mode]')).toHaveValue('template');
  await expect(page.locator('.pb-brand strong')).toHaveText('Template di prova');
  await page.getByRole('button',{name:'Duplica template',exact:true}).click();
  await page.locator('[name=name]').fill('Copia');
  await page.getByRole('button',{name:'Conferma',exact:true}).click();
  await expect(page.locator('.pb-brand strong')).toHaveText('Copia');
  await page.getByRole('button',{name:'Rinomina',exact:true}).click();
  await page.locator('[name=name]').fill('Rinominato');
  await page.getByRole('button',{name:'Conferma',exact:true}).click();
  await expect(page.locator('.pb-brand strong')).toHaveText('Rinominato');
  await page.locator('[data-mode]').selectOption('area');
  await page.getByRole('button',{name:'Applica al record',exact:true}).click();
  await expect(page.getByText('Questo record usa un template condiviso')).toBeVisible();
  await page.getByRole('button',{name:'Cronologia',exact:true}).click();
  await page.getByRole('button',{name:'Ripristina versione 0',exact:true}).click();
  await expect(page.locator('[data-select=headline]')).toBeVisible();
  await expect(page.locator('.pb-manager-message')).toContainText('ripristinato');
  const state = await (await fetch(`${base}/api/records/products/page/areas/main`)).json();
  assert.equal(state.mode,'static'); assert.equal(state.revision,2);
});

test('a second browser window cannot overwrite a newer saved revision', async t => {
  const {page, context, base} = await fixture(t);
  const second = await context.newPage(); second.on('dialog',dialog=>dialog.accept());
  await second.goto(base); await expect(second.locator('[data-select=headline]')).toBeVisible();
  await editTitle(page,'Prima finestra'); await save(page);
  await editTitle(second,'Seconda finestra'); await second.locator('[data-action=save]').click();
  await expect(second.locator('.pb-message')).toContainText('Modificato in un’altra finestra');
  await expect(second.locator('[data-prop=text]')).toHaveValue('Seconda finestra');
  await expect(second.locator('[data-action=save]')).toBeEnabled();
  assert.match(await (await fetch(`${base}/public?record=page`)).text(),/Prima finestra/);
});

test('failed navigation preserves the current draft and its save destination', async t => {
  const {page, base} = await fixture(t);
  await editTitle(page, 'Bozza da conservare');
  await page.route('**/api/records/products/a/areas/main', route => route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Servizio temporaneamente non disponibile'})}));
  await page.locator('[data-record]').selectOption('a');
  await expect(page.locator('.pb-manager-message')).toContainText('temporaneamente non disponibile');
  await expect(page.locator('[data-record]')).toHaveValue('page');
  await expect(page.locator('[data-prop=text]')).toHaveValue('Bozza da conservare');
  await save(page);
  assert.match(await (await fetch(`${base}/public?record=page`)).text(),/Bozza da conservare/);
  assert.doesNotMatch(await (await fetch(`${base}/public?record=a`)).text(),/Bozza da conservare/);
});

test('layout, outline and preview share selection without changing the document', async t => {
  const {page} = await fixture(t);
  await expect(page.locator('.pb-layout-section')).toHaveCount(2);
  await expect(page.locator('.pb-layout-section').first().locator('.pb-layout-column')).toHaveCount(2);
  await page.frameLocator('.pb-preview-wrap iframe').locator('[data-pb-id=headline]').click();
  await expect(page.locator('[data-select=headline]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.pb-structure-panel')).toBeHidden();
  await expect(page.locator('.pb-properties-panel')).toBeVisible();
  await expect(page.getByRole('button',{name:'Torna al builder',exact:true})).toBeFocused();
  await page.getByRole('button',{name:'Impostazioni',exact:true}).click();
  await expect(page.locator('[data-prop=tag]')).toBeVisible();
  await expect(page.locator('[data-prop=text]')).toHaveCount(0);
  await page.getByRole('button',{name:'Avanzate',exact:true}).click();
  await expect(page.locator('[data-destination]')).toBeVisible();
  await page.getByRole('button',{name:'Contenuto',exact:true}).click();
  await expect(page.locator('[data-prop=text]')).toHaveValue('Lo spazio\nper le tue idee.');
  await expect(page.locator('.pb-breadcrumbs button')).toHaveText(['Sezione','Riga','Colonna','Titolo']);
  await page.locator('.pb-contextbar [data-action=parent]').click();
  await expect(page.locator('[data-select=hero_row_c0]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.pb-contextbar')).toContainText('Colonna');
  await showBuilder(page);
  await page.getByRole('button',{name:'Vista albero',exact:true}).click();
  await page.locator('[data-action="toggle:hero"]').click();
  await expect(page.locator('[data-select=headline]')).toHaveCount(0);
  await page.frameLocator('.pb-preview-wrap iframe').locator('[data-pb-id=headline]').click();
  await expect(page.locator('.pb-structure-panel')).toBeHidden();
  await showBuilder(page);
  await expect(page.locator('[data-select=headline]')).toBeVisible();
  await expect(page.locator('[data-action="toggle:hero"]')).toHaveAttribute('aria-expanded','true');
  await page.getByRole('button',{name:'Vista layout',exact:true}).click();
  await expect(page.locator('[data-select=headline]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('[data-action=save]')).toBeDisabled();
});

test('catalog search inserts after the chosen element in a single undoable edit and persists', async t => {
  const {page, base} = await fixture(t);
  await selectNode(page, 'headline');
  await page.locator('.pb-contextbar [data-action=add]').click();
  const search = page.getByRole('searchbox',{name:'Cerca elementi',exact:true});
  await expect(search).toBeFocused();
  await expect(page.locator('.pb-catalog-context')).toContainText('Lo spazio');
  await search.fill('foto');
  await expect(page.locator('.pb-catalog-grid button')).toHaveCount(2);
  await expect(page.getByRole('button',{name:'Aggiungi Immagine',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Aggiungi Immagine e testo',exact:true})).toBeVisible();
  await search.fill('inesistente');
  await expect(page.locator('.pb-catalog-empty')).toBeVisible();
  await search.fill('titolo');
  await page.getByRole('button',{name:'Aggiungi Titolo',exact:true}).click();
  await expect(page.locator('.pb-catalog')).not.toBeVisible();
  const items = page.locator('[data-drop-parent=hero_row_c0] .pb-layout-elements [data-select]');
  const ids = await items.evaluateAll(elements=>elements.map(el=>el.dataset.select));
  assert.equal(ids.length,5);
  assert.deepEqual([ids[0],ids[1],ids[3],ids[4]],['eyebrow','headline','intro','cta']);
  const insertedId = ids[2];
  await expect(page.locator(`[data-select="${insertedId}"]`)).toHaveAttribute('aria-pressed','true');
  await page.locator('[data-action=undo]').click();
  await expect(page.locator(`[data-select="${insertedId}"]`)).toHaveCount(0);
  await expect(page.locator('[data-action=save]')).toBeDisabled();
  await page.locator('[data-action=redo]').click();
  await expect(page.locator(`[data-select="${insertedId}"]`)).toBeVisible();
  await save(page);
  await page.locator('[data-action=reload]').click();
  await expect(page.locator(`[data-select="${insertedId}"]`)).toBeVisible();
  const state = await (await fetch(`${base}/api/records/products/page/areas/main`)).json();
  assert.equal(state.document.children[0].children[0].children[0].children[2].id,insertedId);
});

test('layout dragging, contextual duplication and structural insertion remain reversible', async t => {
  const {page} = await fixture(t);
  await page.locator('[data-select=headline]').dragTo(page.locator('[data-select=hero_row_c1]'));
  await expect(page.locator('[data-drop-parent=hero_row_c1] [data-select=headline]')).toBeVisible();
  await page.locator('[data-action=undo]').click();
  await expect(page.locator('[data-drop-parent=hero_row_c0] [data-select=headline]')).toBeVisible();
  await selectNode(page, 'headline');
  await page.getByRole('button',{name:'Avanzate',exact:true}).click();
  await page.locator('[data-destination]').selectOption('details_row_c1');
  await showBuilder(page);
  await expect(page.locator('[data-drop-parent=details_row_c1] [data-select=headline]')).toBeVisible();
  await page.locator('[data-action=undo]').click();
  await selectNode(page, 'hero');
  await page.locator('.pb-contextbar [data-action=duplicate]').click();
  await showBuilder(page);
  await expect(page.locator('.pb-layout-section')).toHaveCount(3);
  await page.locator('[data-action=undo]').click();
  await expect(page.locator('.pb-layout-section')).toHaveCount(2);
  await selectNode(page, 'hero_row');
  await page.locator('.pb-contextbar [data-action=add]').click();
  await showBuilder(page);
  await expect(page.locator('.pb-layout-section').first().locator('.pb-layout-row')).toHaveCount(2);
  await page.locator('[data-action=undo]').click();
  await expect(page.locator('.pb-layout-section').first().locator('.pb-layout-row')).toHaveCount(1);
  await expect(page.locator('[data-action=save]')).toBeDisabled();
});

test('fragment layout uses rows and the catalog exposes free areas only in templates', async t => {
  const {page} = await fixture(t);
  await selectNode(page, 'headline');
  await page.locator('.pb-contextbar [data-action=add]').click();
  await expect(page.locator('[data-action="insert:area"]')).toHaveCount(0);
  await page.getByRole('button',{name:'Chiudi catalogo',exact:true}).click();
  await page.locator('[data-record]').selectOption('a');
  await page.locator('[data-area]').selectOption('description');
  await expect(page.locator('.pb-layout-section')).toHaveCount(0);
  await expect(page.locator('.pb-layout-row')).toHaveCount(1);
  await selectNode(page, 'local_row');
  await page.locator('.pb-contextbar [data-action=add]').click();
  await expect(page.locator('.pb-layout-row')).toHaveCount(2);
  await page.locator('[data-action=undo]').click();
  await expect(page.locator('[data-action=save]')).toBeDisabled();
  await page.locator('[data-area]').selectOption('main');
  await page.getByRole('button',{name:'Modifica il template',exact:true}).click();
  await selectNode(page, 'headline');
  await page.locator('.pb-contextbar [data-action=add]').click();
  await expect(page.locator('[data-action="insert:area"]')).toBeVisible();
  await page.getByRole('searchbox',{name:'Cerca elementi',exact:true}).fill('frammento');
  await expect(page.locator('.pb-catalog-grid button')).toHaveCount(1);
  await page.getByRole('button',{name:'Aggiungi Area libera',exact:true}).click();
  await expect(page.locator('[data-prop=area]')).toHaveValue('description');
  await page.locator('[data-action=undo]').click();
  await expect(page.locator('[data-action=save]')).toBeDisabled();
});

test('responsive style overrides, visibility and custom CSS persist and render at actual viewport widths', async t => {
  const {page,context,base}=await fixture(t);
  await page.setViewportSize({width:2560,height:1000});
  await expect(page.locator('.pb-preview-wrap')).toHaveCSS('width','1280px');
  await page.setViewportSize({width:1440,height:1000});
  const preview=page.frameLocator('.pb-preview-wrap iframe');
  await selectNode(page,'headline');
  await page.getByRole('button',{name:'Impostazioni',exact:true}).click();
  await openGroup(page,'Spaziature per lato');
  await page.locator('[data-design=paddingLeft]').fill('32px');await page.locator('[data-design=paddingLeft]').press('Tab');
  await expect(preview.locator('[data-pb-id=headline]')).toHaveCSS('padding-left','32px');
  await page.getByRole('button',{name:'Stili tablet',exact:true}).click();
  await page.locator('[data-visibility]').selectOption('hide');
  await expect(preview.locator('[data-pb-id=headline]')).toBeHidden();
  await page.getByRole('button',{name:'Stili mobile',exact:true}).click();
  await page.locator('[data-visibility]').selectOption('show');
  await openGroup(page,'Spaziature per lato');
  await page.locator('[data-design=paddingLeft]').fill('8px');await page.locator('[data-design=paddingLeft]').press('Tab');
  await page.locator('[data-style=align]').selectOption('center');
  await expect(preview.locator('[data-pb-id=headline]')).toHaveCSS('padding-left','8px');
  await expect(preview.locator('[data-pb-id=headline]')).toBeVisible();
  await page.getByRole('button',{name:'Stili desktop',exact:true}).click();
  await expect(preview.locator('[data-pb-id=headline]')).toHaveCSS('padding-left','32px');
  await save(page);
  const publicPage=await context.newPage();await publicPage.goto(`${base}/public`);
  await publicPage.setViewportSize({width:1280,height:900});await expect(publicPage.locator('[data-pb-id=headline]')).toHaveCSS('padding-left','32px');
  await publicPage.setViewportSize({width:820,height:900});await expect(publicPage.locator('[data-pb-id=headline]')).toBeHidden();
  await publicPage.setViewportSize({width:390,height:900});await expect(publicPage.locator('[data-pb-id=headline]')).toBeVisible();await expect(publicPage.locator('[data-pb-id=headline]')).toHaveCSS('padding-left','8px');
});

test('rich text formats selections, protects variable chips and sanitizes pasted HTML', async t => {
  const {page,base}=await fixture(t);
  await page.locator('[data-record]').selectOption('a');await page.getByRole('button',{name:'Modifica il template',exact:true}).click();
  await selectNode(page,'eyebrow');await page.getByRole('button',{name:'Attiva testo formattato',exact:true}).click();
  const rich=page.getByRole('textbox',{name:'Testo formattato',exact:true});
  await rich.fill('Cliente: ');await rich.press('ControlOrMeta+A');await page.getByRole('button',{name:'Grassetto',exact:true}).click();
  await expect(rich.locator('b,strong')).toContainText('Cliente:');
  await rich.press('ControlOrMeta+End');
  await page.getByRole('combobox',{name:'Inserisci variabile nel testo formattato',exact:true}).selectOption('product.name');
  await expect(rich.locator('[data-variable-token]')).toHaveAttribute('contenteditable','false');
  await expect(page.frameLocator('.pb-preview-wrap iframe').locator('[data-pb-id=eyebrow]')).toContainText('Poltrona Arco');
  await rich.press('ControlOrMeta+End');
  await rich.evaluate(el=>{const data=new DataTransfer();data.setData('text/html','<p><strong>Incollato</strong><script>throw new Error("unsafe")</script><a href="javascript:alert(1)">Link</a><img src=x onerror="alert(1)"></p>');el.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:data}));});
  await expect(rich).toContainText('Incollato');
  await expect(rich.locator('script,img,[onerror],[href^="javascript:"]')).toHaveCount(0);
  await save(page);await page.locator('[data-action=reload]').click();await selectNode(page,'eyebrow');
  await expect(page.locator('[data-rich-editor]')).toContainText('Incollato');
  await expect(page.locator('[data-variable-token]')).toHaveCount(1);
  const exportResponse=await page.request.get(`${base}/api/templates/1`);const saved=await exportResponse.json();
  assert.ok(JSON.stringify(saved).includes('richText'));assert.ok(JSON.stringify(saved).includes('{{ product.name }}'));assert.ok(!JSON.stringify(saved).includes('javascript:'));
});

test('advanced identity, copy styles, disable, hover tools and JSON editing remain reversible', async t => {
  const {page}=await fixture(t);const preview=page.frameLocator('.pb-preview-wrap iframe');
  await selectNode(page,'headline');await page.getByRole('button',{name:'Avanzate',exact:true}).click();
  await page.locator('[data-meta=name]').fill('Titolo principale');await page.locator('[data-meta=name]').press('Tab');
  await page.locator('[data-meta=anchor]').fill('titolo-principale');await page.locator('[data-meta=anchor]').press('Tab');
  await page.locator('[data-meta=classes]').fill('custom-heading');await page.locator('[data-meta=classes]').press('Tab');
  await page.getByText('CSS controllato',{exact:true}).click();
  await page.locator('[data-design-code]').fill('padding-top: 17px; border-radius: var(--pb-radius-small);');
  await page.getByRole('button',{name:'Copia stili',exact:true}).click();
  await expect(preview.locator('#titolo-principale')).toHaveClass(/custom-heading/);
  await selectNode(page,'intro');await page.getByRole('button',{name:'Avanzate',exact:true}).click();await page.getByRole('button',{name:'Incolla stili',exact:true}).click();
  await expect(preview.locator('[data-pb-id=intro]')).toHaveCSS('padding-top','17px');
  await page.locator('[data-meta=disabled]').check();await expect(preview.locator('[data-pb-id=intro]')).toHaveCount(0);
  await page.locator('[data-action=undo]').click();await expect(preview.locator('[data-pb-id=intro]')).toBeVisible();
  await showBuilder(page);await page.locator('[data-select=headline]').hover();await expect(preview.locator('[data-pb-id=headline]')).toHaveClass(/pb-hovered/);
  await preview.locator('[data-pb-id=headline]').hover();await expect(preview.getByRole('toolbar',{name:'Azioni rapide elemento'})).toBeVisible();
  await page.getByRole('button',{name:'Mostra codice',exact:true}).click();await expect(page.locator('[data-code]')).toHaveAttribute('readonly','');
  await page.getByRole('button',{name:'Documento JSON',exact:true}).click();const before=await page.locator('[data-code]').inputValue();
  await page.locator('[data-code]').fill('{broken');await page.getByRole('button',{name:'Applica JSON',exact:true}).click();await expect(page.locator('.pb-code-error')).toContainText('JSON non applicato');
  const doc=JSON.parse(before);doc.children[0].meta={name:'Hero dal codice'};await page.locator('[data-code]').fill(JSON.stringify(doc));await page.getByRole('button',{name:'Applica JSON',exact:true}).click();
  await expect(page.locator('[data-select=hero]')).toContainText('Hero dal codice');await page.locator('[data-action=undo]').click();await expect(page.locator('[data-select=hero]')).not.toContainText('Hero dal codice');
  await page.getByRole('button',{name:'Schermo intero',exact:true}).click();await expect(page.locator('.pb-editor')).toHaveClass(/pb-fullscreen/);await page.keyboard.press('Escape');await expect(page.locator('.pb-editor')).not.toHaveClass(/pb-fullscreen/);
});

test('new components and visual table editing survive save and reopen', async t => {
  const {page}=await fixture(t);const preview=page.frameLocator('.pb-preview-wrap iframe');
  await selectNode(page,'headline');await page.locator('.pb-contextbar [data-action=add]').click();await page.getByRole('button',{name:'Aggiungi Tabella',exact:true}).click();
  await page.locator('[data-table-header="0"]').fill('Servizio');await page.locator('[data-table-cell="0:0"]').fill('Noleggio');
  await page.getByRole('button',{name:'Aggiungi colonna',exact:true}).click();await page.locator('[data-table-header="2"]').fill('Note');
  await page.getByRole('button',{name:'Aggiungi riga tabella',exact:true}).click();await expect(preview.locator('.pb-table tbody tr')).toHaveCount(3);
  for(const name of ['Card','Icona','Immagine e testo']){await page.locator('.pb-contextbar [data-action=add]').click();await page.getByRole('button',{name:`Aggiungi ${name}`,exact:true}).click();}
  await save(page);await page.locator('[data-action=reload]').click();
  await expect(preview.getByRole('columnheader',{name:'Servizio',exact:true})).toBeVisible();await expect(preview.getByRole('cell',{name:'Noleggio',exact:true})).toBeVisible();
  await expect(preview.locator('.pb-card-inner')).toHaveCount(1);await expect(preview.locator('.pb-icon-svg')).toHaveCount(1);await expect(preview.locator('.pb-image-text')).toHaveCount(1);
});
