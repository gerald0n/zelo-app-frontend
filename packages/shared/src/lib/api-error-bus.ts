type Listener = (message: string) => void;

const listeners = new Set<Listener>();

export function emitApiError(message: string) {
  listeners.forEach((listener) => listener(message));
}

export function subscribeApiError(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
