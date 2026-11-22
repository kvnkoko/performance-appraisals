import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Trophy, PencilSimple, X, Info } from 'phosphor-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useApp } from '@/contexts/app-context';
import { useToast } from '@/contexts/toast-context';
import { getPeriodRankings, setPeriodAward, describeError } from '@/lib/storage';
import { cn } from '@/lib/utils';
import {
  RANKING_BOARD_LABELS,
  REVIEW_GROUP_LABELS,
  type Employee,
  type PeriodAward,
  type PeriodRanking,
  type RankingBoard,
  type ReviewGroup,
} from '@/types';

export const BOARDS: RankingBoard[] = ['members', 'leaders'];

export interface RankedPerson {
  employee: Employee;
  ranking: PeriodRanking;
}

/** Server rankings for one period (or all periods), reloaded whenever the data changes. */
export function usePeriodRankings(periodId: string | null | 'all') {
  const { appraisals, settings, employees } = useApp();
  const [rankings, setRankings] = useState<PeriodRanking[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!periodId) {
      setRankings([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getPeriodRankings(periodId === 'all' ? undefined : periodId)
      .then((rows) => !cancelled && setRankings(rows))
      .catch((error) => console.error('Could not load rankings:', error))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [periodId, appraisals, settings.hrScoreWeight, settings.requireHrForRanking]);

  const people = useMemo(() => {
    const byId = new Map(employees.map((e) => [e.id, e]));
    return rankings
      .map((ranking) => ({ ranking, employee: byId.get(ranking.employeeId) }))
      .filter((p): p is RankedPerson => !!p.employee);
  }, [rankings, employees]);

  return { people, loading };
}

/** Ranked people on one board for one period, best first. */
export function boardList(people: RankedPerson[], periodId: string, board: RankingBoard): RankedPerson[] {
  return people
    .filter((p) => p.ranking.reviewPeriodId === periodId && p.ranking.board === board && p.ranking.eligible)
    .sort((a, b) => (a.ranking.rank ?? 999) - (b.ranking.rank ?? 999) || a.employee.name.localeCompare(b.employee.name));
}

/** People with reviews in the period who are not ranked, with the reason. */
export function notRankedList(people: RankedPerson[], periodId: string): RankedPerson[] {
  return people
    .filter((p) => p.ranking.reviewPeriodId === periodId && !p.ranking.eligible)
    .sort((a, b) => a.employee.name.localeCompare(b.employee.name));
}

/** The award for a board: the admin's choice if one was made, otherwise the board's #1. */
export function effectiveAward(
  awards: Partial<Record<RankingBoard, PeriodAward>> | undefined,
  board: RankingBoard,
  ranked: RankedPerson[],
  employees: Employee[]
): { employee: Employee; award?: PeriodAward; isTop: boolean } | null {
  const chosen = awards?.[board];
  const top = ranked[0];
  if (chosen) {
    const employee = employees.find((e) => e.id === chosen.employeeId);
    if (employee) return { employee, award: chosen, isTop: top?.employee.id === employee.id };
  }
  return top ? { employee: top.employee, isTop: true } : null;
}

export function pctTone(pct: number): string {
  if (pct >= 90) return 'text-emerald-600 dark:text-emerald-400';
  if (pct >= 75) return 'text-blue-600 dark:text-blue-400';
  if (pct >= 60) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

const GROUP_SHORT: Record<ReviewGroup, string> = { manager: 'Managers', peers: 'Peers', team: 'Team', hr: 'HR', other: 'Other' };
const GROUP_ORDER: ReviewGroup[] = ['manager', 'peers', 'team', 'other', 'hr'];

export function GroupChips({ ranking }: { ranking: PeriodRanking }) {
  const groups = GROUP_ORDER.filter((g) => ranking.groups[g]).map((g) => [g, ranking.groups[g]!] as const);
  return (
    <div className="flex flex-wrap gap-1">
      {groups.map(([group, g]) => (
        <span
          key={group}
          className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
          title={`${REVIEW_GROUP_LABELS[group]}: ${g.count} review${g.count === 1 ? '' : 's'}`}
        >
          {GROUP_SHORT[group]} {Math.round(g.pct)}% · {g.count}
        </span>
      ))}
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  return (
    <div
      className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0',
        rank === 1
          ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow'
          : rank === 2
          ? 'bg-gradient-to-br from-gray-300 to-gray-400 dark:from-gray-600 dark:to-gray-700 text-white'
          : rank === 3
          ? 'bg-gradient-to-br from-amber-300 to-amber-400 text-white'
          : 'bg-muted text-foreground'
      )}
    >
      {rank}
    </div>
  );
}

export function RankingRow({ person, showGroups = true }: { person: RankedPerson; showGroups?: boolean }) {
  const { employee, ranking } = person;
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 py-2.5 px-3 rounded-lg border',
        (ranking.rank ?? 99) <= 3
          ? 'bg-gradient-to-r from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-200/70 dark:border-amber-800/50'
          : 'bg-muted/30 border-border'
      )}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {ranking.rank !== null && <RankBadge rank={ranking.rank} />}
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm truncate">{employee.name.trim()}</div>
          <div className="text-xs text-muted-foreground truncate">{employee.role}</div>
          {showGroups && <div className="mt-1"><GroupChips ranking={ranking} /></div>}
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className={cn('text-base font-bold', pctTone(ranking.overallPct))}>{Math.round(ranking.overallPct)}%</div>
        <div className="text-xs text-muted-foreground">{ranking.reviewCount} reviews</div>
      </div>
    </div>
  );
}

/** Member and Leader of the Period for one period, each with its top-3 shortlist. */
export function AwardsPanel({ periodId, periodName, people }: { periodId: string; periodName: string; people: RankedPerson[] }) {
  const { settings, employees } = useApp();
  const [editing, setEditing] = useState<RankingBoard | null>(null);
  const awards = settings.periodAwards?.[periodId];

  return (
    <Card className="border overflow-hidden bg-gradient-to-br from-muted/30 via-background to-muted/20 dark:from-muted/20 dark:to-muted/10">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Trophy size={16} weight="duotone" className="text-amber-500/80" />
          Awards · {periodName}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0 grid gap-4 md:grid-cols-2">
        {BOARDS.map((board) => {
          const ranked = boardList(people, periodId, board);
          const winner = effectiveAward(awards, board, ranked, employees);
          return (
            <div
              key={board}
              className="rounded-xl border bg-card p-4 shadow-sm border-amber-200/60 dark:border-amber-700/40 bg-gradient-to-br from-amber-50/50 to-transparent dark:from-amber-950/30 dark:to-transparent"
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-amber-700/90 dark:text-amber-300/90">
                  {RANKING_BOARD_LABELS[board].award}
                </span>
                {ranked.length > 0 && (
                  <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditing(board)}>
                    <PencilSimple size={14} className="mr-1" />
                    Change
                  </Button>
                )}
              </div>
              {winner ? (
                <>
                  <p className="font-semibold text-foreground">{winner.employee.name.trim()}</p>
                  <p className="text-xs text-muted-foreground">{winner.employee.role}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {winner.isTop ? (
                      <span className="rounded-md bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:text-emerald-200">
                        Top-ranked
                      </span>
                    ) : (
                      <span className="rounded-md bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-200">
                        Chosen by admin
                      </span>
                    )}
                  </div>
                  {winner.award?.reason && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Reason:</span> {winner.award.reason}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No one is ranked on this board yet.</p>
              )}
              {ranked.length > 0 && (
                <div className="mt-3 space-y-1">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Shortlist</p>
                  {ranked.slice(0, 3).map((p) => (
                    <div key={p.employee.id} className="flex items-center justify-between text-sm">
                      <span className="truncate">
                        {p.ranking.rank}. {p.employee.name.trim()}
                      </span>
                      <span className={cn('font-semibold', pctTone(p.ranking.overallPct))}>{Math.round(p.ranking.overallPct)}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
      {editing && (
        <AwardDialog
          periodId={periodId}
          periodName={periodName}
          board={editing}
          ranked={boardList(people, periodId, editing)}
          current={awards?.[editing]}
          onClose={() => setEditing(null)}
        />
      )}
    </Card>
  );
}

function AwardDialog({
  periodId,
  periodName,
  board,
  ranked,
  current,
  onClose,
}: {
  periodId: string;
  periodName: string;
  board: RankingBoard;
  ranked: RankedPerson[];
  current?: PeriodAward;
  onClose: () => void;
}) {
  const { refresh } = useApp();
  const { toast } = useToast();
  const top = ranked[0];
  const [employeeId, setEmployeeId] = useState(current?.employeeId ?? top?.employee.id ?? '');
  const [reason, setReason] = useState(current?.reason ?? '');
  const [saving, setSaving] = useState(false);
  const needsReason = !!employeeId && employeeId !== top?.employee.id;

  const save = async (useTop: boolean) => {
    setSaving(true);
    try {
      if (useTop) await setPeriodAward(periodId, board, null, null);
      else await setPeriodAward(periodId, board, employeeId, needsReason ? reason.trim() : null);
      await refresh();
      toast({ title: 'Award saved', variant: 'success' });
      onClose();
    } catch (error) {
      toast({ title: 'Could not save the award', description: describeError(error, 'Please try again.'), variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-xl border bg-card shadow-xl" role="dialog" aria-modal aria-labelledby="award-title">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 id="award-title" className="font-semibold">
            {RANKING_BOARD_LABELS[board].award} · {periodName}
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div className="space-y-2">
            <Label htmlFor="award-employee">Awarded to</Label>
            <Select id="award-employee" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              {ranked.map((p) => (
                <option key={p.employee.id} value={p.employee.id}>
                  {p.ranking.rank}. {p.employee.name.trim()} ({Math.round(p.ranking.overallPct)}%)
                </option>
              ))}
            </Select>
          </div>
          {needsReason && (
            <div className="space-y-2">
              <Label htmlFor="award-reason">Reason for not choosing #1 (required, kept for audit)</Label>
              <Textarea
                id="award-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Led the product launch; #1 already won last month"
                className="min-h-[80px]"
              />
            </div>
          )}
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info size={14} className="mt-0.5 flex-shrink-0" />
            Without a choice, the award goes to whoever is ranked #1.
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t bg-muted/30 px-5 py-4">
          {current && (
            <Button type="button" variant="ghost" disabled={saving} onClick={() => save(true)}>
              Go back to #1
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={saving || !employeeId || (needsReason && !reason.trim())} onClick={() => save(false)}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/** Ranking list per board, with a tab for each board. */
export function BoardsCard({
  periodId,
  periodName,
  people,
  onShowAll,
}: {
  periodId: string;
  periodName: string;
  people: RankedPerson[];
  onShowAll: (board: RankingBoard) => void;
}) {
  const [board, setBoard] = useState<RankingBoard>('members');
  const ranked = boardList(people, periodId, board);
  return (
    <Card className="border">
      <CardHeader className="p-3 pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Trophy size={18} weight="duotone" className="text-amber-600/80" />
              Rankings
            </CardTitle>
            <CardDescription className="text-xs">
              {periodName} · each reviewer group counts equally, HR at its set weight
            </CardDescription>
          </div>
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="tablist">
            {BOARDS.map((b) => (
              <button
                key={b}
                type="button"
                role="tab"
                aria-selected={board === b}
                onClick={() => setBoard(b)}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-medium',
                  board === b ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {RANKING_BOARD_LABELS[b].board}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        {ranked.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No one is ranked on this board for this period.</p>
        ) : (
          <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1 scrollbar-thin">
            {ranked.slice(0, 10).map((p) => (
              <RankingRow key={p.employee.id} person={p} />
            ))}
          </div>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full mt-2 text-muted-foreground hover:text-foreground"
          onClick={() => onShowAll(board)}
        >
          Full {RANKING_BOARD_LABELS[board].board.toLowerCase()} ranking ({ranked.length}) and who isn't ranked
        </Button>
      </CardContent>
    </Card>
  );
}

export function FullRankingsModal({
  periodId,
  periodName,
  board,
  people,
  onClose,
}: {
  periodId: string;
  periodName: string;
  board: RankingBoard;
  people: RankedPerson[];
  onClose: () => void;
}) {
  const ranked = boardList(people, periodId, board);
  const notRanked = notRankedList(people, periodId).filter((p) => !p.ranking.board || p.ranking.board === board);
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" role="dialog" aria-modal onClick={onClose}>
      <div className="bg-card border rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Trophy size={20} weight="duotone" className="text-amber-600/80" />
            {RANKING_BOARD_LABELS[board].board} · {periodName}
          </h2>
          <button type="button" onClick={onClose} className="p-2 rounded-lg text-muted-foreground hover:bg-muted" aria-label="Close">
            <X size={20} weight="bold" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-4 space-y-1.5 min-h-0">
          {ranked.map((p) => (
            <RankingRow key={p.employee.id} person={p} />
          ))}
          {notRanked.length > 0 && (
            <>
              <p className="pt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Not ranked</p>
              {notRanked.map((p) => (
                <div key={p.employee.id} className="flex items-center justify-between gap-3 rounded-lg border border-dashed px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{p.employee.name.trim()}</div>
                    <div className="text-xs text-muted-foreground">{p.ranking.notRankedReason}</div>
                  </div>
                  <div className="text-sm text-muted-foreground">{Math.round(p.ranking.overallPct)}%</div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
