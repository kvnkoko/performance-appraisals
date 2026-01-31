import { useRef, useState, useEffect } from 'react';
import { Camera, X } from 'phosphor-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ImageUploaderProps {
  value?: string | null;
  onChange: (dataUrl: string | null) => void;
  className?: string;
  shape?: 'circle' | 'square';
  size?: 'sm' | 'md' | 'lg';
  /** Max width/height (long edge). Higher = sharper on retina, more bandwidth. Default 1200. */
  maxDimension?: number;
  /** JPEG quality 0–1. Default 0.88 for good sharpness without huge files. */
  jpegQuality?: number;
}

const sizeMap = { sm: 24, md: 32, lg: 40 };

const DEFAULT_MAX_DIMENSION = 1200;
const DEFAULT_JPEG_QUALITY = 0.88;

/** Resize and compress image; returns data URL. Uses higher resolution/quality for sharper photos. */
function resizeAndCompressImage(
  file: File,
  maxDimension: number = DEFAULT_MAX_DIMENSION,
  jpegQuality: number = DEFAULT_JPEG_QUALITY
): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const scale = Math.min(1, maxDimension / Math.max(w, h));
      const width = Math.round(w * scale);
      const height = Math.round(h * scale);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas not available'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      const isPng = file.type === 'image/png';
      const dataUrl = canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', isPng ? undefined : jpegQuality);
      resolve(dataUrl);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}

/** Re-encode an existing data URL at new quality (for already-uploaded images). Keeps dimensions, caps at maxDimension. */
export function recompressDataUrl(
  dataUrl: string,
  maxDimension: number = DEFAULT_MAX_DIMENSION,
  jpegQuality: number = DEFAULT_JPEG_QUALITY
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const scale = Math.min(1, maxDimension / Math.max(w, h));
      const width = Math.round(w * scale);
      const height = Math.round(h * scale);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas not available'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      const out = canvas.toDataURL('image/jpeg', jpegQuality);
      resolve(out);
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
}

export function ImageUploader({
  value,
  onChange,
  className,
  shape = 'circle',
  size = 'md',
  maxDimension = DEFAULT_MAX_DIMENSION,
  jpegQuality = DEFAULT_JPEG_QUALITY,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(value ?? null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setPreview(value ?? null);
  }, [value]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    e.target.value = '';
    setUploading(true);
    resizeAndCompressImage(file, maxDimension, jpegQuality)
      .then((dataUrl) => {
        setPreview(dataUrl);
        onChange(dataUrl);
      })
      .catch(() => {
        const reader = new FileReader();
        reader.onload = () => {
          setPreview(reader.result as string);
          onChange(reader.result as string);
        };
        reader.readAsDataURL(file);
      })
      .finally(() => setUploading(false));
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
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="gap-1"
        >
          <Camera size={14} />
          {uploading ? 'Processing…' : preview ? 'Change' : 'Upload'}
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
