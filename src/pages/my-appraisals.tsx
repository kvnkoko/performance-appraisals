import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '@/contexts/app-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ClipboardText,
  CheckCircle,
  Clock,
  ArrowRight,
  MagnifyingGlass,
  Warning,
  CalendarBlank,
  Robot,
  Link as LinkIcon,
  Star,
} from 'phosphor-react';
import { formatDate } from '@/lib/utils';
import type { AppraisalLink } from '@/types';
import type { AppraisalAssignment } from '@/types';

type FilterType = 'all' | 'pending' | 'completed';
type SourceFilter = 'all' | 'auto' | 'manual';

type UnifiedItem =
  | { type: 'link'; id: string; link: AppraisalLink; employeeName: string; reviewPeriodName?: string; status: 'pending' | 'completed'; source: 'manual' }
  | { type: 'assignment'; id: string; assignment: AppraisalAssignment; employeeName: string; reviewPeriodName?: string; status: 'pending' | 'in-progress' | 'completed'; source: 'auto' | 'manual' };

export function MyAppraisalsPage() {
  const { links, assignments, employees, templates, reviewPeriods, loading } = useApp();
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('pending');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('employeeId');
    if (stored) setEmployeeId(stored);
  }, []);

  const isLinkExpired = (expiresAt: string | null) => expiresAt != null && new Date(expiresAt) < new Date();
  const isLinkExpiringSoon = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    const d = new Date(expiresAt);
    const now = new Date();
    return d > now && d.getTime() - now.getTime() < 3 * 24 * 60 * 60 * 1000;
  };

  const unified: UnifiedItem[] = [];
  if (employeeId) {
    links
      .filter((l) => l.appraiserId === employeeId)
      .forEach((link) => {
        const emp = employees.find((e) => e.id === link.employeeId);
        unified.push({
          type: 'link',
          id: link.id,
          link,
          employeeName: emp?.name ?? 'Unknown',
          reviewPeriodName: link.reviewPeriodName,
          status: link.used ? 'completed' : 'pending',
          source: 'manual',
        });
      });
    assignments
      .filter((a) => a.appraiserId === employeeId)
      .forEach((a) => {
        const period = reviewPeriods.find((p) => p.id === a.reviewPeriodId);
        unified.push({
          type: 'assignment',
          id: a.id,
          assignment: a,
          employeeName: a.employeeName,
          reviewPeriodName: period?.name,
          status: a.status,
          source: a.assignmentType === 'auto' ? 'auto' : 'manual',
        });
      });
  }

  const filtered = unified.filter((item) => {
    const done = item.type === 'link' ? item.status === 'completed' : item.status === 'completed';
    const pending = !done;
    if (item.type === 'link') {
      const expired = isLinkExpired(item.link.expiresAt);
      if (pending && expired) return false;
    }
    const matchesStatus =
      filter === 'all' ? true : filter === 'pending' ? pending : done;
    const matchesSource =
      sourceFilter === 'all' ? true : sourceFilter === 'auto' ? item.source === 'auto' : item.source === 'manual';
    const matchesSearch =
      !searchQuery ||
      item.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.reviewPeriodName ?? '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSource && matchesSearch;
  });

  const sorted = [...filtered].sort((a, b) => {
    const aDone = a.type === 'link' ? a.status === 'completed' : a.status === 'completed';
    const bDone = b.type === 'link' ? b.status === 'completed' : b.status === 'completed';
    if (!aDone && bDone) return -1;
    if (aDone && !bDone) return 1;
    const aDate = a.type === 'link' ? a.link.createdAt : a.assignment.createdAt;
    const bDate = b.type === 'link' ? b.link.createdAt : b.assignment.createdAt;
    return new Date(bDate).getTime() - new Date(aDate).getTime();
  });

  const pendingCount = unified.filter((u) => {
    if (u.type === 'link') return !u.link.used && !isLinkExpired(u.link.expiresAt);
    return u.status !== 'completed';
  }).length;
  const completedCount = unified.filter((u) => {
    if (u.type === 'link') return u.link.used;
    return u.status === 'completed';
  }).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title text-foreground">My Appraisals</h1>
        <p className="text-muted-foreground mt-2">Reviews assigned to you (auto-assigned and special requests)</p>
      </div>

      <div className="flex gap-4">
        <button
          type="button"
          onClick={() => setFilter('pending')}
          className={`flex-1 p-4 rounded-lg border-2 transition-all ${
            filter === 'pending' ? 'border-amber-500 bg-amber-500/10' : 'border-border hover:border-amber-500/50'
          }`}
        >
          <div className="flex items-center gap-3">
            <Clock size={24} weight="duotone" className="text-amber-500" />
            <div className="text-left">
              <div className="text-2xl font-bold">{pendingCount}</div>
              <div className="text-sm text-muted-foreground">Pending</div>
            </div>
          </div>
        </button>
        <button
          type="button"
          onClick={() => setFilter('completed')}
          className={`flex-1 p-4 rounded-lg border-2 transition-all ${
            filter === 'completed' ? 'border-green-500 bg-green-500/10' : 'border-border hover:border-green-500/50'
          }`}
        >
          <div className="flex items-center gap-3">
            <CheckCircle size={24} weight="duotone" className="text-green-500" />
            <div className="text-left">
              <div className="text-2xl font-bold">{completedCount}</div>
              <div className="text-sm text-muted-foreground">Completed</div>
            </div>
          </div>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Input
            placeholder="Search by employee or period..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-12 pl-10 text-base"
          />
          <MagnifyingGlass size={20} weight="duotone" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        </div>
        <div className="flex rounded-lg border bg-muted/30 p-1">
          <button
            type="button"
            onClick={() => setSourceFilter('all')}
            className={`px-3 py-1.5 rounded text-sm font-medium ${sourceFilter === 'all' ? 'bg-background shadow' : 'text-muted-foreground'}`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setSourceFilter('auto')}
            className={`px-3 py-1.5 rounded text-sm font-medium flex items-center gap-1 ${sourceFilter === 'auto' ? 'bg-background shadow' : 'text-muted-foreground'}`}
          >
            <Robot size={14} weight="duotone" />
            Auto
          </button>
          <button
            type="button"
            onClick={() => setSourceFilter('manual')}
            className={`px-3 py-1.5 rounded text-sm font-medium flex items-center gap-1 ${sourceFilter === 'manual' ? 'bg-background shadow' : 'text-muted-foreground'}`}
          >
            <LinkIcon size={14} weight="duotone" />
            Special
          </button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            {filter === 'pending' ? (
              <>
                <CheckCircle size={48} weight="duotone" className="text-green-500/50 mb-4" />
                <h3 className="text-lg font-semibold mb-2">All caught up!</h3>
                <p className="text-muted-foreground text-center">You have no pending appraisals to complete.</p>
              </>
            ) : filter === 'completed' ? (
              <>
                <ClipboardText size={48} weight="duotone" className="text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold mb-2">No completed appraisals</h3>
                <p className="text-muted-foreground text-center">You haven’t completed any appraisals yet.</p>
              </>
            ) : (
              <>
                <ClipboardText size={48} weight="duotone" className="text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold mb-2">No appraisals found</h3>
                <p className="text-muted-foreground text-center">
                  {searchQuery ? 'Try adjusting your search or filters.' : 'No appraisals have been assigned to you.'}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sorted.map((item) => {
            const template = templates.find((t) => t.id === (item.type === 'link' ? item.link.templateId : item.assignment.templateId));
            const isDone = item.type === 'link' ? item.status === 'completed' : item.status === 'completed';
            const isPending = !isDone;
            const expired = item.type === 'link' ? isLinkExpired(item.link.expiresAt) : false;
            const expiringSoon = item.type === 'link' ? isLinkExpiringSoon(item.link.expiresAt) : false;
            const dueLabel = item.type === 'link' && item.link.expiresAt
              ? formatDate(item.link.expiresAt)
              : item.type === 'assignment' && item.assignment.dueDate
                ? formatDate(item.assignment.dueDate)
                : null;

            return (
              <Card
                key={item.id}
                className={`transition-all ${
                  isDone
                    ? 'opacity-75'
                    : expired
                      ? 'border-red-500/50 bg-red-500/5'
                      : expiringSoon
                        ? 'border-amber-500/50 bg-amber-500/5'
                        : 'hover:shadow-lg'
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-4">
                      <div
                        className={`p-3 rounded-xl ${
                          isDone ? 'bg-green-500/10' : expired ? 'bg-red-500/10' : 'bg-primary/10'
                        }`}
                      >
                        {isDone ? (
                          <CheckCircle size={24} weight="duotone" className="text-green-500" />
                        ) : expired ? (
                          <Warning size={24} weight="duotone" className="text-red-500" />
                        ) : (
                          <ClipboardText size={24} weight="duotone" className="text-primary" />
                        )}
                      </div>
                      <div>
                        <div className="font-semibold text-lg">Review for {item.employeeName}</div>
                        <div className="flex items-center gap-2 flex-wrap mt-1">
                          {item.reviewPeriodName && (
                            <span className="flex items-center gap-1 text-sm text-muted-foreground">
                              <CalendarBlank size={14} />
                              {item.reviewPeriodName}
                            </span>
                          )}
                          {template && <span className="text-sm text-muted-foreground">• {template.name}</span>}
                          <span className="inline-flex items-center gap-1">
                            {item.source === 'auto' ? (
                              <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-500/15 text-blue-700 dark:text-blue-300 flex items-center gap-1">
                                <Robot size={12} weight="duotone" />
                                Auto
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-500/15 text-purple-700 dark:text-purple-300 flex items-center gap-1">
                                <Star size={12} weight="duotone" />
                                Special
                              </span>
                            )}
                          </span>
                        </div>
                        {dueLabel && isPending && !expired && (
                          <div className={`text-xs mt-1 ${expiringSoon ? 'text-amber-500' : 'text-muted-foreground'}`}>
                            Due: {dueLabel}
                          </div>
                        )}
                        {isDone && (
                          <div className="text-xs text-green-600 mt-1">Completed</div>
                        )}
                        {expired && isPending && (
                          <div className="text-xs text-red-500 mt-1">Expired</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isPending && !expired && (
                        item.type === 'link' ? (
                          <Link to={`/appraisal/${item.link.token}`}>
                            <Button>
                              Start Review
                              <ArrowRight size={16} className="ml-2" />
                            </Button>
                          </Link>
                        ) : (
                          <Link to={`/appraisal/assignment/${item.assignment.id}`}>
                            <Button>
                              Start Review
                              <ArrowRight size={16} className="ml-2" />
                            </Button>
                          </Link>
                        )
                      )}
                      {isDone && (
                        <span className="px-3 py-1 rounded-full bg-green-500/10 text-green-600 text-sm font-medium">
                          Submitted
                        </span>
                      )}
                      {expired && isPending && (
                        <span className="px-3 py-1 rounded-full bg-red-500/10 text-red-600 text-sm font-medium">
                          Expired
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
