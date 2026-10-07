import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createPlayground} from '../../playground/server.mjs';
import {staticDocument, templateDocument} from '../../playground/seed.js';

test('playground persists templates, assignments and recoverable revisions with conflict protection', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'pagebuilder-api-'));
  await writeFile(path.join(directory, 'page.json'), JSON.stringify({revision: 7, document: staticDocument}));
  let server;
  async function start() { server = await createPlayground({dataDir: directory}); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); return `http://127.0.0.1:${server.address().port}`; }
  async function stop() { await new Promise(resolve => server.close(resolve)); }
  let base = await start();
  async function request(url, method = 'GET', body, status = 200) {
    const response = await fetch(base + url, {method, ...(body ? {body:JSON.stringify(body), headers:{'Content-Type':'application/json'}} : {})});
    assert.equal(response.status, status, await response.clone().text()); return response.json();
  }
  try {
    const url = '/api/records/products/page/areas/main';
    const current = await request(url); assert.equal(current.revision, 7);
    const template = await request('/api/templates', 'POST', {name: 'Prova', context:'product', revision:0, document:templateDocument});
    const linked = await request(url, 'PUT', {...current, mode:'template', template_id:template.id, document:null});
    await request(url, 'PUT', current, 409);
    const history = await request(`${url}/history`); assert.equal(history.revisions.length, 2);
    const snapshot = await request(`${url}/history/7`); assert.deepEqual(snapshot.document, staticDocument);
    await request(url, 'PUT', {...snapshot, id:linked.id, revision:linked.revision});
    const areaUrl = '/api/records/products/a/areas/description', area = await request(areaUrl);
    await request(areaUrl, 'PUT', {...area, mode:'area'}, 422);
    await request(areaUrl, 'PUT', {...area, mode:'static'});
    await request(areaUrl, 'PUT', {...area, mode:'template', template_id:template.id, document:null}, 409);
    const preview = await request(`/api/templates/${template.id}/preview/products/a/main`, 'POST', {});
    assert.match(preview.html, /Poltrona Arco/);
    const denied = await fetch(base + '/api/workspace', {headers:{Origin:'https://example.com'}}); assert.equal(denied.status, 403);
    await stop(); base = await start();
    assert.equal((await request('/api/templates')).templates.length, 2);
    assert.deepEqual((await request(url)).document, staticDocument);
    assert.equal((await request(`${url}/history`)).revisions.length, 3);
  } finally { await stop(); await rm(directory, {recursive:true, force:true}); }
});
