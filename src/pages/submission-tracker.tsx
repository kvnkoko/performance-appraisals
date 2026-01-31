import { useMemo, useState } from 'react';
import { useApp } from '@/contexts/app-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { ListChecks, CheckCircle, Clock, Hourglass, Eye, Trash } from 'phosphor-react';
import type { AppraisalAssignment, Appraisal, Template, ReviewPeriod, Employee } from '@/types';
import { formatDate } from '@/lib/utils';
import { deleteAppraisal, deleteAppraisalAssignment } from '@/lib/storage';
import { useToast } from '@/contexts/toast-context';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { CompletedFormViewModal } from '@/components/shared/completed-form-view-modal';

const PAGE_SIZE = 50;

type Row = {
  assignmentId: string;
  appraisalId: string | null;
  periodId: string;
  periodName: string;
  templateId: string;
  formName: string;
  appraiserId: string;
  appraiserName: string;
  employeeId: string;
  employeeName: string;
  status: 'pending' | 'in-progress' | 'completed';
  score: number | null;
  maxScore: number | null;
  submittedAt: string | null;
};

function matchAppraisal(
  a: AppraisalAssignment,
  appraisals: Appraisal[]
): Appraisal | undefined {
  return appraisals.find(
    (x) =>
      x.appraiserId === a.appraiserId &&
      x.employeeId === a.employeeId &&
      x.templateId === a.templateId &&
      x.reviewPeriodId === a.reviewPeriodId &&
      x.completedAt != null
  );
}

function buildRows(
  assignments: AppraisalAssignment[],
  appraisals: Appraisal[],
  templates: Template[],
  reviewPeriods: ReviewPeriod[],
  filterPeriodId: string | null,
  filterTemplateId: string | null,
  filterAppraiserId: string | null,
  filterEmployeeId: string | null
): Row[] {
  const byPeriod = filterPeriodId
    ? assignments.filter((a) => a.reviewPeriodId === filterPeriodId)
    : assignments;
  const byTemplate = filterTemplateId
    ? byPeriod.filter((a) => a.templateId === filterTemplateId)
    : byPeriod;
  const byAppraiser = filterAppraiserId
    ? byTemplate.filter((a) => a.appraiserId === filterAppraiserId)
    : byTemplate;
  const byEmployee = filterEmployeeId
    ? byAppraiser.filter((a) => a.employeeId === filterEmployeeId)
    : byAppraiser;

  return byEmployee.map((a) => {
    const appraisal = matchAppraisal(a, appraisals);
    const template = templates.find((t) => t.id === a.templateId);
    const period = reviewPeriods.find((p) => p.id === a.reviewPeriodId);
    const status: Row['status'] = appraisal ? 'completed' : (a.status as Row['status']);
    return {
      assignmentId: a.id,
      appraisalId: appraisal?.id ?? null,
      periodId: a.reviewPeriodId,
      periodName: period?.name ?? a.reviewPeriodId,
      templateId: a.templateId,
      formName: template?.name ?? a.templateId,
      appraiserId: a.appraiserId,
      appraiserName: a.appraiserName,
      employeeId: a.employeeId,
      employeeName: a.employeeName,
      status,
      score: appraisal?.score ?? null,
      maxScore: appraisal?.maxScore ?? null,
      submittedAt: appraisal?.completedAt ?? null,
    };
  });
}

/** When there are no assignments, show completed appraisals whose employee and appraiser still exist. */
function buildRowsFromAppraisals(
  appraisals: Appraisal[],
  templates: Template[],
  reviewPeriods: ReviewPeriod[],
  employees: Employee[],
  filterPeriodId: string | null,
  filterTemplateId: string | null,
  filterAppraiserId: string | null,
  filterEmployeeId: string | null
): Row[] {
  const employeeIds = new Set(employees.map((e) => e.id));
  const nameById = employees.reduce((acc, e) => ({ ...acc, [e.id]: e.name }), {} as Record<string, string>);

  let list = appraisals.filter(
    (a) =>
      a.completedAt != null &&
      employeeIds.has(a.employeeId) &&
      employeeIds.has(a.appraiserId)
  );
  if (filterPeriodId) list = list.filter((a) => a.reviewPeriodId === filterPeriodId);
  if (filterTemplateId) list = list.filter((a) => a.templateId === filterTemplateId);
  if (filterAppraiserId) list = list.filter((a) => a.appraiserId === filterAppraiserId);
  if (filterEmployeeId) list = list.filter((a) => a.employeeId === filterEmployeeId);

  return list.map((a) => {
    const template = templates.find((t) => t.id === a.templateId);
    const period = reviewPeriods.find((p) => p.id === a.reviewPeriodId);
    return {
      assignmentId: a.id,
      appraisalId: a.id,
      periodId: a.reviewPeriodId,
      periodName: period?.name ?? a.reviewPeriodName ?? a.reviewPeriodId,
      templateId: a.templateId,
      formName: template?.name ?? a.templateId,
      appraiserId: a.appraiserId,
      appraiserName: nameById[a.appraiserId] ?? a.appraiserId,
      employeeId: a.employeeId,
      employeeName: nameById[a.employeeId] ?? a.employeeId,
      status: 'completed' as const,
      score: a.score,
      maxScore: a.maxScore,
      submittedAt: a.completedAt,
    };
  });
}

export function SubmissionTrackerPage() {
  const { assignments, appraisals, templates, reviewPeriods, employees, refresh } = useApp();
  const { toast } = useToast();
  const [filterPeriodId, setFilterPeriodId] = useState<string | null>(null);
  const [filterTemplateId, setFilterTemplateId] = useState<string | null>(null);
  const [filterAppraiserId, setFilterAppraiserId] = useState<string | null>(null);
  const [filterEmployeeId, setFilterEmployeeId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [viewAppraisalId, setViewAppraisalId] = useState<string | null>(null);
  const [deleteRow, setDeleteRow] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);

  const rows = useMemo(() => {
    const assignmentRows =
      assignments.length > 0
        ? buildRows(
            assignments,
            appraisals,
            templates,
            reviewPeriods,
            filterPeriodId,
            filterTemplateId,
            filterAppraiserId,
            filterEmployeeId
          )
        : [];

    const employeeIds = new Set(employees.map((e) => e.id));
    const hasMatchingAssignment = (a: Appraisal) =>
      assignments.some(
        (as) =>
          as.appraiserId === a.appraiserId &&
          as.employeeId === a.employeeId &&
          as.templateId === a.templateId &&
          as.reviewPeriodId === a.reviewPeriodId
      );
    const orphanAppraisals = appraisals.filter(
      (a) =>
        a.completedAt != null &&
        employeeIds.has(a.employeeId) &&
        employeeIds.has(a.appraiserId) &&
        !hasMatchingAssignment(a)
    );
    const orphanRows = buildRowsFromAppraisals(
      orphanAppraisals,
      templates,
      reviewPeriods,
      employees,
      filterPeriodId,
      filterTemplateId,
      filterAppraiserId,
      filterEmployeeId
    );

    if (assignmentRows.length > 0 || orphanRows.length > 0) {
      return [...assignmentRows, ...orphanRows];
    }
    return buildRowsFromAppraisals(
      appraisals,
      templates,
      reviewPeriods,
      employees,
      filterPeriodId,
      filterTemplateId,
      filterAppraiserId,
      filterEmployeeId
    );
  }, [
    assignments,
    appraisals,
    templates,
    reviewPeriods,
    employees,
    filterPeriodId,
    filterTemplateId,
    filterAppraiserId,
    filterEmployeeId,
  ]);

  const appraiserOptions = useMemo(
    () =>
      [...employees]
        .map((e) => ({ id: e.id, name: e.name }))
        .sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [employees]
  );

  const employeeOptions = useMemo(
    () =>
      [...employees]
        .map((e) => ({ id: e.id, name: e.name }))
        .sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [employees]
  );

  const sortedRows = useMemo(() => {
    const byPeriod = [...rows].sort((a, b) =>
      (a.periodName || '').localeCompare(b.periodName || '')
    );
    return byPeriod.sort((a, b) =>
      (a.submittedAt || '').localeCompare(b.submittedAt || '')
    );
  }, [rows]);

  const paginatedRows = useMemo(() => {
    const start = page * PAGE_SIZE;
    return sortedRows.slice(start, start + PAGE_SIZE);
  }, [sortedRows, page]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const canPrev = page > 0;
  const canNext = page < totalPages - 1;

  const handleDeleteForm = async () => {
    if (!deleteRow) return;
    setDeleting(true);
    try {
      if (deleteRow.appraisalId) await deleteAppraisal(deleteRow.appraisalId);
      await deleteAppraisalAssignment(deleteRow.assignmentId);
      await refresh();
      setDeleteRow(null);
      toast({ title: 'Form removed', description: 'Assignment and any submitted form have been deleted.', variant: 'success' });
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to delete form. Please try again.', variant: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 pb-8 sm:pb-10 lg:pb-12 min-w-0 max-w-full">
      <div className="space-y-1">
        <h1 className="page-title text-foreground flex items-center gap-2">
          <ListChecks size={28} weight="duotone" className="text-accent" />
          Submission Tracker
        </h1>
        <p className="page-subtitle">
          Who has submitted which form for whom, by period
        </p>
      </div>

      <Card className="border-2">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold">Filters</CardTitle>
          <CardDescription className="text-sm">
            Narrow by period, form, appraiser, or employee
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Period</label>
              <Select
                value={filterPeriodId ?? ''}
                onChange={(e) => {
                  const v = e.target.value || null;
                  setFilterPeriodId(v);
                  setPage(0);
                }}
                className="w-full"
              >
                <option value="">All periods</option>
                {[...reviewPeriods]
                  .sort((a, b) => (b.year !== a.year ? b.year - a.year : 0))
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Form (template)</label>
              <Select
                value={filterTemplateId ?? ''}
                onChange={(e) => {
                  setFilterTemplateId(e.target.value || null);
                  setPage(0);
                }}
                className="w-full"
              >
                <option value="">All forms</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Appraiser (who)</label>
              <Select
                value={filterAppraiserId ?? ''}
                onChange={(e) => {
                  setFilterAppraiserId(e.target.value || null);
                  setPage(0);
                }}
                className="w-full"
              >
                <option value="">All appraisers</option>
                {appraiserOptions.map(({ id, name }) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Employee (for whom)</label>
              <Select
                value={filterEmployeeId ?? ''}
                onChange={(e) => {
                  setFilterEmployeeId(e.target.value || null);
                  setPage(0);
                }}
                className="w-full"
              >
                <option value="">All employees</option>
                {employeeOptions.map(({ id, name }) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-2">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold">Submissions</CardTitle>
          <CardDescription className="text-sm">
            {sortedRows.length} submission{sortedRows.length !== 1 ? 's' : ''}
            {(filterPeriodId || filterTemplateId || filterAppraiserId || filterEmployeeId) &&
              ' (filtered)'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {paginatedRows.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <ListChecks size={48} weight="duotone" className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">No submissions match the current filters.</p>
              <p className="text-sm mt-1">
                {assignments.length === 0
                  ? 'Complete appraisals or add assignments for the selected period to see them here.'
                  : 'Adjust filters or add assignments for the selected period.'}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-3 font-semibold text-foreground">Period</th>
                      <th className="text-left py-3 px-3 font-semibold text-foreground">Form</th>
                      <th className="text-left py-3 px-3 font-semibold text-foreground">Appraiser</th>
                      <th className="text-left py-3 px-3 font-semibold text-foreground">For</th>
                      <th className="text-left py-3 px-3 font-semibold text-foreground">Status</th>
                      <th className="text-right py-3 px-3 font-semibold text-foreground">Score</th>
                      <th className="text-left py-3 px-3 font-semibold text-foreground">Submitted at</th>
                      <th className="text-right py-3 px-3 font-semibold text-foreground w-20">View</th>
                      <th className="text-right py-3 px-3 font-semibold text-foreground w-20">Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.map((r) => (
                      <tr
                        key={r.assignmentId}
                        className="border-b border-border/60 hover:bg-muted/30 transition-colors"
                      >
                        <td className="py-3 px-3 text-foreground">{r.periodName}</td>
                        <td className="py-3 px-3 text-foreground">{r.formName}</td>
                        <td className="py-3 px-3 text-foreground">{r.appraiserName}</td>
                        <td className="py-3 px-3 text-foreground">{r.employeeName}</td>
                        <td className="py-3 px-3">
                          {r.status === 'completed' ? (
                            <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                              <CheckCircle size={16} weight="duotone" />
                              Submitted
                            </span>
                          ) : r.status === 'in-progress' ? (
                            <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
                              <Hourglass size={16} weight="duotone" />
                              In progress
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-muted-foreground font-medium">
                              <Clock size={16} weight="duotone" />
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-medium">
                          {r.score != null && r.maxScore != null
                            ? `${r.score} / ${r.maxScore}`
                            : '—'}
                        </td>
                        <td className="py-3 px-3 text-muted-foreground">
                          {r.submittedAt ? formatDate(r.submittedAt) : '—'}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {r.status === 'completed' && r.appraisalId ? (
                            <button
                              type="button"
                              onClick={() => setViewAppraisalId(r.appraisalId)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium text-foreground bg-muted hover:bg-muted/80 transition-colors"
                              title="View completed form"
                            >
                              <Eye size={16} weight="duotone" />
                              View
                            </button>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => setDeleteRow(r)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
                            title="Remove this form (assignment and any submission)"
                          >
                            <Trash size={16} weight="duotone" />
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                  <span className="text-sm text-muted-foreground">
                    Page {page + 1} of {totalPages} · {sortedRows.length} total
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={!canPrev}
                      className="px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={!canNext}
                      className="px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteRow != null}
        onClose={() => setDeleteRow(null)}
        onConfirm={handleDeleteForm}
        title="Remove this form?"
        description={deleteRow ? `Remove the form "${deleteRow.formName}" for ${deleteRow.appraiserName} → ${deleteRow.employeeName}?${deleteRow.appraisalId ? ' Any submitted appraisal will also be deleted.' : ''}` : ''}
        confirmText="Remove form"
        cancelText="Cancel"
        variant="danger"
        loading={deleting}
      />

      <CompletedFormViewModal
        open={viewAppraisalId != null}
        onClose={() => setViewAppraisalId(null)}
        appraisalId={viewAppraisalId}
      />
    </div>
  );
}
