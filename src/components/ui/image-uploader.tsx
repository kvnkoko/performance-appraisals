import { useRef, useState } from 'react';
import { Camera, X } from 'phosphor-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ImageUploaderProps {
  value?: string | null;
  onChange: (dataUrl: string | null) => void;
  className?: string;
  shape?: 'circle' | 'square';
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = { sm: 24, md: 32, lg: 40 };

export function ImageUploader({ value, onChange, className, shape = 'circle', size = 'md' }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(value ?? null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPreview(dataUrl);
      onChange(dataUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const clear = () => {
    setPreview(null);
    onChange(null);
  };

  const px = sizeMap[size] * 4;

  return (
    <div className={cn('relative inline-block', className)}>
      <div
        className={cn(
          'flex items-center justify-center bg-muted border-2 border-dashed border-border overflow-hidden',
          shape === 'circle' ? 'rounded-full' : 'rounded-lg',
          size === 'sm' && 'w-24 h-24',
          size === 'md' && 'w-32 h-32',
          size === 'lg' && 'w-40 h-40'
        )}
        style={{ minWidth: px, minHeight: px }}
      >
        {preview ? (
          <img src={preview} alt="" className="h-full w-full object-cover" />
        ) : (
          <Camera size={px / 2} weight="duotone" className="text-muted-foreground" />
        )}
      </div>
      <div className="mt-2 flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          className="gap-1"
        >
          <Camera size={14} />
          {preview ? 'Change' : 'Upload'}
        </Button>
        {preview && (
          <Button type="button" variant="ghost" size="sm" onClick={clear} className="gap-1 text-destructive">
            <X size={14} />
            Remove
          </Button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handleFile}
        aria-label="Upload image"
      />
    </div>
  );
}
