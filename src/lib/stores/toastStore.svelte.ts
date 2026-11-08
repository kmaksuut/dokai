export type ToastType = 'error' | 'success' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  createdAt: number;
  durationMs: number;
}

export const toastState = $state<{ items: ToastItem[] }>({
  items: []
});

const toastTimers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Adds a dismissible toast notification on the right side of the screen.
 * Automatically closes after `durationMs` (defaults to 30,000ms = 30 seconds) if not closed by user.
 */
export function showToast(options: {
  type: ToastType;
  title: string;
  message: string;
  durationMs?: number;
}): string {
  const id = 'toast-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
  const durationMs = options.durationMs ?? 30000;

  const newItem: ToastItem = {
    id,
    type: options.type,
    title: options.title,
    message: options.message,
    createdAt: Date.now(),
    durationMs
  };

  toastState.items = [newItem, ...toastState.items].slice(0, 8);

  if (durationMs > 0) {
    const timer = setTimeout(() => {
      dismissToast(id);
    }, durationMs);
    toastTimers.set(id, timer);
  }

  return id;
}

export function dismissToast(id: string) {
  const timer = toastTimers.get(id);
  if (timer) {
    clearTimeout(timer);
    toastTimers.delete(id);
  }
  toastState.items = toastState.items.filter((t) => t.id !== id);
}

export function clearAllToasts() {
  for (const timer of toastTimers.values()) {
    clearTimeout(timer);
  }
  toastTimers.clear();
  toastState.items = [];
}
