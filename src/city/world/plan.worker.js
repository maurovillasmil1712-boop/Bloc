/* Builds the city plan off the main thread so the loading bar keeps moving. */
import { makePlan } from './plan.js';
self.onmessage = () => {
  try {
    const p = makePlan();
    self.postMessage({ plan: p }, [p.occ.a.buffer, p.height.data.buffer]);
  } catch (e) { self.postMessage({ error: String(e && e.message || e) }); }
};
