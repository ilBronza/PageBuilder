const defaults = [new URL('../vendor/uikit.min.css',import.meta.url).href,new URL('../css/content.css',import.meta.url).href];

export function previewStyles(options) {
  return [...new Set([...(options.previewStyles ?? defaults), ...(options.variablesUrl ? [options.variablesUrl] : [])])];
}

/** Keep refreshed package defaults below the host's unlayered theme overrides. */
export function defaultVariablesStyle(options) {
  if (!options.defaultVariablesUrl) return '';
  const url=encodeURI(options.defaultVariablesUrl).replace(/["'()<>]/g,c=>`%${c.charCodeAt(0).toString(16)}`);
  return `<style>@import url("${url}") layer(pagebuilder-defaults);</style>`;
}

/** The same optional variables file styles the swatches and both kinds of iframe preview. */
export function loadVariables(root, options) {
  if (!options.variablesUrl) return;
  const document = root.ownerDocument;
  const url = new URL(options.variablesUrl, document.baseURI).href;
  if ([...document.querySelectorAll('link[rel="stylesheet"]')].some(link => link.href === url)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet'; link.href = url;
  document.head.append(link);
}
