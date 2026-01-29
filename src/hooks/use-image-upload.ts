import { useState, useCallback } from 'react';

export function useImageUpload(initialValue?: string | null) {
  const [value, setValue] = useState<string | null>(initialValue ?? null);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => setValue(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  }, []);

  const clear = useCallback(() => setValue(null), []);

  return { value, setValue, handleFile, clear };
}
