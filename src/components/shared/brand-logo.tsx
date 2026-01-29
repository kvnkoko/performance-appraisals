import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/utils';

/** Black logo for light backgrounds; white logo for dark backgrounds. */
const LOGO_BLACK_SRC = '/Horizontal Logo Black.png';
const LOGO_WHITE_SRC = '/Horizontal Logo, White 2.png';

interface BrandLogoProps {
  className?: string;
  alt?: string;
}

/**
 * Renders the horizontal company logo: black in light mode, white in dark mode (for contrast).
 */
export function BrandLogo({ className, alt = 'Company logo' }: BrandLogoProps) {
  const { resolvedTheme } = useTheme();
  const src = resolvedTheme === 'dark' ? encodeURI(LOGO_WHITE_SRC) : LOGO_BLACK_SRC;

  return (
    <img
      key={resolvedTheme}
      src={src}
      alt={alt}
      className={cn('w-auto max-h-9 object-contain object-left', className)}
      loading="eager"
      decoding="async"
    />
  );
}

/** Logo for use outside theme provider (e.g. auth). Uses media query to pick black/white. */
export function BrandLogoStatic({ className, alt = 'Company logo' }: BrandLogoProps) {
  return (
    <picture className={cn('inline-block', className)}>
      <source media="(prefers-color-scheme: dark)" srcSet={encodeURI(LOGO_WHITE_SRC)} />
      <img
        src={LOGO_BLACK_SRC}
        alt={alt}
        className="w-auto max-h-9 object-contain object-left"
        loading="eager"
        decoding="async"
      />
    </picture>
  );
}
