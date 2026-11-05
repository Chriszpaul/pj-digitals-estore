type Flow = { pending: boolean; checkout: boolean; error: string };
let flow: Flow = { pending: false, checkout: false, error: '' };
const listeners = new Set<() => void>();
function update(next: Flow) { flow = next; listeners.forEach(listener => listener()); }
export const getHostedAuthFlow = () => flow;
export function subscribeHostedAuthFlow(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function beginHostedAuthFlow(checkout: boolean) { update({ pending: true, checkout, error: '' }); }
export function finishHostedAuthFlow(error = '') { update({ ...flow, pending: false, error }); }
