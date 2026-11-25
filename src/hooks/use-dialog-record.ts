import { useEffect, useRef, useState } from 'react';

/**
 * Loads the record an edit dialog is opened for. Results that arrive after the dialog was closed
 * or reopened for another record are dropped, so the form never shows or saves the wrong record.
 * Returns true until the record for the current id has loaded.
 */
export function useDialogRecord<T>(
  open: boolean,
  id: string | null | undefined,
  fetch: (id: string) => Promise<T | undefined>,
  onLoaded: (record: T | undefined) => void,
  onError: (error: unknown) => void
): boolean {
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const callbacks = useRef({ fetch, onLoaded, onError });
  callbacks.current = { fetch, onLoaded, onError };

  useEffect(() => {
    setLoadedId(null);
    if (!open || !id) return;
    let current = true;
    callbacks.current
      .fetch(id)
      .then((record) => current && callbacks.current.onLoaded(record))
      .catch((error) => current && callbacks.current.onError(error))
      .finally(() => current && setLoadedId(id));
    return () => {
      current = false;
    };
  }, [open, id]);

  return open && !!id && loadedId !== id;
}
