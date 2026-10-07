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
async function fixture(t) {
  const dir = await mkdtemp(path.join(tmpdir(), 'pagebuilder-browser-'));
  const server = await createPlayground({dataDir:dir});
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const browser = await chromium.launch({headless: true, ...(process.env.PAGEBUILDER_BROWSER_EXECUTABLE ? {executablePath:process.env.PAGEBUILDER_BROWSER_EXECUTABLE} : {})});
  const context = await browser.newContext({viewport:{width:1440,height:1000}});
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => { await browser.close(); await new Promise(resolve => server.close(resolve)); await rm(dir, {recursive:true,force:true}); });
  const errors = []; const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  await page.goto(base);
  await expect(page.locator('[data-select=headline]')).toBeVisible();
  t.after(() => assert.deepEqual(errors, []));
  return {page, context, base};
}
async function editTitle(page, text) {
  await page.locator('[data-select=headline]').click();
  await page.locator('[data-prop=text]').fill(text);
}
async function save(page) {
  await page.locator('[data-action=save]').click();
  await expect(page.locator('[data-action=save]')).toBeDisabled();
  await expect(page.locator('.pb-status')).toContainText('Salvato');
}

test('static editing, JSON import/undo, invalid import and image picker work in the browser', async t => {
  const {page} = await fixture(t);
  await editTitle(page, 'Titolo salvato'); await save(page);
  await page.locator('[data-action=reload]').click();
  await page.locator('[data-select=headline]').click();
  await expect(page.locator('[data-prop=text]')).toHaveValue('Titolo salvato');
  await page.locator('[data-import]').setInputFiles({name:'document.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(staticDocument))});
  await expect(page.locator('[data-action=save]')).toBeEnabled();
  await page.locator('[data-action=undo]').click();
  await expect(page.locator('[data-action=save]')).toBeDisabled();
  await page.locator('[data-import]').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"version":99,"kind":"page","children":[]}')});
  await expect(page.locator('.pb-message')).toContainText('Importazione non riuscita');
  await page.locator('[data-select=headline]').click();
  await expect(page.locator('[data-prop=text]')).toHaveValue('Titolo salvato');
  await page.locator('[data-select=illustration]').click();
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
  await page.locator('[data-select=local_text]').click();
  await page.locator('[data-prop=text]').fill('Descrizione modificata di Arco'); await save(page);
  await page.locator('[data-area]').selectOption('main');
  await page.getByRole('button',{name:'Modifica il template',exact:true}).click();
  await page.locator('[data-select=detail_title]').click();
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
