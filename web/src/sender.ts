import { api } from './api';
import type { KeyName } from './types';

export interface Sender {
  /** Press a remote key. */
  key(key: KeyName): void;
  /** Buffer typed characters; they are sent together after a short pause. */
  type(chars: string): void;
  /** Send a whole string at once, optionally followed by ENTER. */
  text(text: string, submit?: boolean): void;
  /** Run a configured shortcut by id. */
  shortcut(id: string): void;
  /** Send any buffered typing now. */
  flush(): void;
}

/**
 * Every action goes through one queue so the TV receives them in the order you
 * made them. Typing is batched, because one ADB call per character is slow.
 */
export function createSender(onError: (error: unknown) => void): Sender {
  let chain: Promise<void> = Promise.resolve();
  let pending = '';
  let timer: ReturnType<typeof setTimeout> | undefined;

  const enqueue = (job: () => Promise<unknown>): void => {
    chain = chain.then(job).then(
      () => undefined,
      (e: unknown) => onError(e),
    );
  };

  const flush = (): void => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    if (pending === '') return;
    const chars = pending;
    pending = '';
    enqueue(() => api.text(chars));
  };

  return {
    key(key) {
      flush();
      enqueue(() => api.key(key));
    },
    type(chars) {
      pending += chars;
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(flush, 120);
    },
    text(text, submit = false) {
      flush();
      enqueue(() => api.text(text, submit));
    },
    shortcut(id) {
      flush();
      enqueue(() => api.runShortcut(id));
    },
    flush,
  };
}
