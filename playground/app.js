import {mountWorkspace} from '../resources/js/workspace.js';
const root = document.querySelector('#workspace');
try {
  const response = await fetch('/api/workspace');
  if (!response.ok) throw new Error('Configurazione non disponibile');
  await mountWorkspace(root, await response.json());
} catch (error) { root.textContent = `Impossibile aprire il playground: ${error.message}`; }
