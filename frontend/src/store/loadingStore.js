let count = 0;
const listeners = new Set();

const notify = () => listeners.forEach((cb) => cb(count));

export const startRequest = () => {
  count += 1;
  notify();
};

export const endRequest = () => {
  count = Math.max(0, count - 1);
  notify();
};

export const subscribeLoading = (cb) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export const isLoading = () => count > 0;
