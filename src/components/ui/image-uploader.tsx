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
  /** Max width/height (long edge). Defaults to the profile photo size. */
  maxDimension?: number;
  /** JPEG quality 0–1. */
  jpegQuality?: number;
}

const sizeMap = { sm: 24, md: 32, lg: 40 };

/**
 * Photos are stored inline and downloaded with every directory load, so they are kept small.
 * Profile photos appear at most ~670px wide (the profile hero), covers up to ~1200px.
 */
export const PROFILE_PHOTO = { maxDimension: 640, jpegQuality: 0.82 } as const;
export const COVER_PHOTO = { maxDimension: 1600, jpegQuality: 0.8 } as const;

const DEFAULT_MAX_DIMENSION = PROFILE_PHOTO.maxDimension;
const DEFAULT_JPEG_QUALITY = PROFILE_PHOTO.jpegQuality;

/** Draw onto a white background (JPEG has no transparency) and encode as JPEG. */
function encodeJpeg(img: HTMLImageElement, maxDimension: number, jpegQuality: number): string {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const scale = Math.min(1, maxDimension / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not available');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', jpegQuality);
}

/** Resize and compress an uploaded image; returns a JPEG data URL. */
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
      try {
        resolve(encodeJpeg(img, maxDimension, jpegQuality));
      } catch (error) {
        reject(error);
      }
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
      try {
        const out = encodeJpeg(img, maxDimension, jpegQuality);
        // Never replace an image with a bigger copy of itself.
        resolve(out.length < dataUrl.length ? out : dataUrl);
      } catch (error) {
        reject(error);
      }
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
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setPreview(value ?? null);
  }, [value]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    e.target.value = '';
    setUploading(true);
    setFailed(false);
    // An image the browser cannot read (e.g. HEIC) is rejected rather than stored at full size.
    resizeAndCompressImage(file, maxDimension, jpegQuality)
      .then((dataUrl) => {
        setPreview(dataUrl);
        onChange(dataUrl);
      })
      .catch(() => setFailed(true))
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
      {failed && (
        <p className="mt-1 text-xs text-destructive">That image could not be read. Try a JPG or PNG.</p>
      )}
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
