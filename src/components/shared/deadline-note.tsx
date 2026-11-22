import { cn } from '@/lib/utils';
import { deadlineText, type SubmissionWindow } from '@/lib/deadline';

export function DeadlineNote({ deadline, closedHint }: { deadline: SubmissionWindow | null; closedHint?: string }) {
  if (!deadline?.dueDay) return null;
  return (
    <p
      className={cn(
        'mx-auto max-w-xl rounded-md border px-3 py-2 text-sm',
        deadline.isClosed
          ? 'border-destructive/40 bg-destructive/10 text-destructive'
          : deadline.isLate
          ? 'border-amber-500/40 bg-amber-500/10'
          : 'border-border bg-muted/40 text-muted-foreground'
      )}
    >
      {deadlineText(deadline, closedHint)}
      {deadline.isLate && !deadline.isClosed && '. It will be marked as submitted late.'}
    </p>
  );
}
