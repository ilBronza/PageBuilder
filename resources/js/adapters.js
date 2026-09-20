export function httpAdapter({url, previewUrl, csrfToken, mode = 'static', onLoad}) {
  let envelope = null;
  async function request(target, method = 'GET', data, signal) {
    const response = await fetch(target, {method, credentials:'same-origin', signal, headers:{'Accept':'application/json',...(data ? {'Content-Type':'application/json'} : {}),...(csrfToken ? {'X-CSRF-TOKEN':csrfToken} : {})}, ...(data ? {body:JSON.stringify(data)} : {})});
    const result = await response.json().catch(()=>({}));
    if (!response.ok) throw new Error(response.status === 409 ? 'Il contenuto è stato modificato altrove. Esporta le modifiche, poi ricarica.' : result.message || `Richiesta fallita (${response.status})`);
    return result;
  }
  return {
    async load() {
      envelope = await request(url);
      if (!envelope.document) throw new Error('Questa area usa un template condiviso. Apri il template o modifica una sua area libera.');
      onLoad?.(envelope);
      return envelope.document;
    },
    async save(document) {
      if (!envelope) throw new Error('Carica il documento prima di salvarlo.');
      envelope = await request(url,'PUT',{...envelope, mode, document});
      return envelope.document;
    },
    ...(previewUrl ? {async preview(document, {signal} = {}) { return (await request(previewUrl,'POST',{document},signal)).html; }} : {}),
  };
}
