// Custom toast system - imperative API
// Usage: toast.success('Done!', { description: 'Your changes were saved.' })

type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastData {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration: number;
}

type ToastListener = (t: ToastData) => void;

const listeners = new Set<ToastListener>();
let nextId = 0;

export function subscribe(fn: ToastListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(
  type: ToastType,
  title: string,
  options?: { description?: string; duration?: number }
): void {
  const data: ToastData = {
    id: String(++nextId),
    type,
    title,
    description: options?.description,
    duration: options?.duration ?? 4000,
  };
  listeners.forEach(fn => fn(data));
}

export const toast = {
  success: (title: string, options?: { description?: string; duration?: number }): void =>
    emit('success', title, options),
  error: (title: string, options?: { description?: string; duration?: number }): void =>
    emit('error', title, options),
  info: (title: string, options?: { description?: string; duration?: number }): void =>
    emit('info', title, options),
  warning: (title: string, options?: { description?: string; duration?: number }): void =>
    emit('warning', title, options),
};
