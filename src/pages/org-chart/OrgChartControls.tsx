import { ArrowsOut, ArrowsIn, Hand } from 'phosphor-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface OrgChartControlsProps {
  onResetView?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  className?: string;
}

export function OrgChartControls({ onResetView, onZoomIn, onZoomOut, className }: OrgChartControlsProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {onResetView && (
        <Button variant="outline" size="sm" onClick={onResetView} className="gap-1" aria-label="Reset zoom and pan">
          <ArrowsOut size={16} weight="duotone" />
          Reset view
        </Button>
      )}
      {onZoomIn && (
        <Button variant="outline" size="sm" onClick={onZoomIn} aria-label="Zoom in on organization chart">
          <ArrowsIn size={16} weight="bold" />
        </Button>
      )}
      {onZoomOut && (
        <Button variant="outline" size="sm" onClick={onZoomOut} aria-label="Zoom out on organization chart">
          <ArrowsOut size={16} weight="bold" />
        </Button>
      )}
    </div>
  );
}
