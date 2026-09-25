import { compare } from './engine';
import { validateConfig } from './model';
self.onmessage = (event: MessageEvent) => {
  const config = validateConfig(event.data);
  if (!config) {
    self.postMessage({ error: 'Invalid configuration' });
    return;
  }
  try {
    self.postMessage(compare(config));
  } catch {
    self.postMessage({ error: 'Simulation failed' });
  }
};
