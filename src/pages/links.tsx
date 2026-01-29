import { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/contexts/app-context';
import { useUser } from '@/contexts/user-context';
import { PeriodSelector } from '@/components/periods/period-selector';
import { getReviewPeriod, saveAppraisalAssignments, deleteAssignmentsByPeriod } from '@/lib/storage';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Plus, Copy, Trash, LinkSimple, CheckCircle, Clock, FileText, Lightning, Warning, CaretRight, CaretLeft, ListChecks, TrashSimple, Info } from 'phosphor-react';
import { generateToken, generateId } from '@/lib/utils';
import { saveLink, deleteLink } from '@/lib/storage';
import { useToast } from '@/contexts/toast-context';
import { formatDate } from '@/lib/utils';
import type { AppraisalLink } from '@/types';
import { previewAutoAssignments, buildAssignmentsFromPreview } from '@/lib/auto-assignment';
import type { AutoAssignmentPreview, TemplateMapping } from '@/lib/auto-assignment';

type LinkMode = 'manual' | 'auto';
type AutoWizardStep = 1 | 2 | 3;

export function LinksPage() {
  const { employees, templates, links, activePeriods, assignments, reviewPeriods, refresh } = useApp();
  const { isAdmin } = useUser();
  const [mode, setMode] = useState<LinkMode>('manual');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedAppraiser, setSelectedAppraiser] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);
  const [expirationDays, setExpirationDays] = useState<number | ''>(30);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string | null }>({
    open: false,
    id: null,
  });
  const [deleting, setDeleting] = useState(false);
  const [bulkRemoveConfirm, setBulkRemoveConfirm] = useState<{ open: boolean; periodId: string | null; periodName: string }>({
    open: false,
    periodId: null,
    periodName: '',
  });
  const [bulkRemoving, setBulkRemoving] = useState(false);
  const { toast } = useToast();

  // Auto-assignment wizard state
  const [autoStep, setAutoStep] = useState<AutoWizardStep>(1);
  const [autoPreview, setAutoPreview] = useState<AutoAssignmentPreview | null>(null);
  const [includeLeaderToLeader, setIncludeLeaderToLeader] = useState(true);
  const [includeMemberToMember, setIncludeMemberToMember] = useState(true);
  const [includeExecToLeader, setIncludeExecToLeader] = useState(true);
  const [autoTemplateMap, setAutoTemplateMap] = useState<TemplateMapping>({
    leaderToMember: '',
    memberToLeader: '',
    leaderToLeader: '',
    memberToMember: '',
    execToLeader: '',
    hrToAll: '',
  });
  const [includeHrToAll, setIncludeHrToAll] = useState(false);
  const [autoDueDate, setAutoDueDate] = useState('');
  const [autoGenerating, setAutoGenerating] = useState(false);
  const [autoDoneCount, setAutoDoneCount] = useState<number | null>(null);

  useEffect(() => {
    if (activePeriods.length > 0 && !selectedPeriod) {
      setSelectedPeriod(activePeriods[0].id);
    }
  }, [activePeriods, selectedPeriod]);

  const livePreview = useMemo(() => {
    if (!selectedPeriod || mode !== 'auto') return null;
    return previewAutoAssignments(employees, selectedPeriod, {
      includeLeaderToMember: true,
      includeMemberToLeader: true,
      includeLeaderToLeader,
      includeMemberToMember,
      includeExecToLeader,
      includeHrToAll,
    });
  }, [employees, selectedPeriod, includeLeaderToLeader, includeMemberToMember, includeExecToLeader, includeHrToAll, mode]);

  const runAutoPreview = () => {
    if (!selectedPeriod) {
      toast({ title: 'Select period', description: 'Choose a review period first.', variant: 'error' });
      return;
    }
    if (livePreview) {
      setAutoPreview(livePreview);
      setAutoStep(2);
    }
  };

  const totalAutoCount = autoPreview
    ? autoPreview.leaderToMember.length +
      autoPreview.memberToLeader.length +
      autoPreview.leaderToLeader.length +
      autoPreview.memberToMember.length +
      autoPreview.execToLeader.length +
      autoPreview.hrToAll.length
    : 0;

  const handleAutoGenerate = async () => {
    if (!selectedPeriod || !autoPreview) return;
    const period = await getReviewPeriod(selectedPeriod);
    if (!period) {
      toast({ title: 'Error', description: 'Selected review period not found.', variant: 'error' });
      return;
    }
    const templateMapping: TemplateMapping = {
      leaderToMember: autoTemplateMap.leaderToMember || templates[0]?.id || '',
      memberToLeader: autoTemplateMap.memberToLeader || templates[0]?.id || '',
      leaderToLeader: autoTemplateMap.leaderToLeader || templates[0]?.id || '',
      memberToMember: autoTemplateMap.memberToMember || templates[0]?.id || '',
      execToLeader: autoTemplateMap.execToLeader || templates[0]?.id || '',
      hrToAll: autoTemplateMap.hrToAll || '',
    };
    const hasEmpty =
      !templateMapping.leaderToMember ||
      !templateMapping.memberToLeader ||
      (includeLeaderToLeader && !templateMapping.leaderToLeader) ||
      (includeMemberToMember && !templateMapping.memberToMember) ||
      (includeExecToLeader && !templateMapping.execToLeader) ||
      (includeHrToAll && !templateMapping.hrToAll);
    if (hasEmpty) {
      const msg = includeHrToAll && !templateMapping.hrToAll
        ? 'Please select an HR template or disable HR assignments.'
        : includeMemberToMember && !templateMapping.memberToMember
          ? 'Please select a Member→Member template or disable Member→Member.'
          : 'Choose a template for each relationship type.';
      toast({ title: 'Select templates', description: msg, variant: 'error' });
      return;
    }
    setAutoGenerating(true);
    try {
      const built = buildAssignmentsFromPreview(
        autoPreview,
        templateMapping,
        selectedPeriod,
        period.name,
        autoDueDate || undefined
      );
      await saveAppraisalAssignments(built);
      await refresh();
      setAutoDoneCount(built.length);
      setAutoStep(3);
      toast({ title: 'Success', description: `${built.length} appraisals created.`, variant: 'success' });
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to create assignments.', variant: 'error' });
    } finally {
      setAutoGenerating(false);
    }
  };

  const resetAutoWizard = () => {
    setAutoStep(1);
    setAutoPreview(null);
    setAutoDoneCount(null);
  };

  const handleGenerate = async () => {
    if (!selectedEmployee || !selectedAppraiser || !selectedTemplate || !selectedPeriod) {
      toast({ title: 'Error', description: 'Please select all required fields including review period.', variant: 'error' });
      return;
    }

    const period = await getReviewPeriod(selectedPeriod);
    if (!period) {
      toast({ title: 'Error', description: 'Selected review period not found.', variant: 'error' });
      return;
    }

    try {
      const token = generateToken();
      const expiresAt = expirationDays
        ? new Date(Date.now() + Number(expirationDays) * 24 * 60 * 60 * 1000).toISOString()
        : null;

      const link: AppraisalLink = {
        id: generateId(),
        employeeId: selectedEmployee,
        appraiserId: selectedAppraiser,
        templateId: selectedTemplate,
        reviewPeriodId: selectedPeriod,
        reviewPeriodName: period.name,
        token,
        expiresAt,
        used: false,
        createdAt: new Date().toISOString(),
      };

      await saveLink(link);
      await refresh();
      setDialogOpen(false);
      setSelectedEmployee('');
      setSelectedAppraiser('');
      setSelectedTemplate('');
      toast({ title: 'Success', description: 'Link generated successfully.', variant: 'success' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to generate link.', variant: 'error' });
    }
  };

  const handleCopyLink = (token: string) => {
    const url = `${window.location.origin}/appraisal/${token}`;
    navigator.clipboard.writeText(url);
    toast({ title: 'Copied!', description: 'Link copied to clipboard.', variant: 'success' });
  };

  const handleDeleteClick = (id: string) => {
    setDeleteConfirm({ open: true, id });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.id) return;
    setDeleting(true);
    try {
      await deleteLink(deleteConfirm.id);
      await refresh();
      toast({ title: 'Success', description: 'Link deleted successfully', variant: 'success' });
      setDeleteConfirm({ open: false, id: null });
    } catch (error) {
      console.error('Delete error:', error);
      toast({ title: 'Error', description: 'Failed to delete link. Please try again.', variant: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkRemoveConfirm = async () => {
    if (!bulkRemoveConfirm.periodId) return;
    setBulkRemoving(true);
    try {
      const count = await deleteAssignmentsByPeriod(bulkRemoveConfirm.periodId);
      await refresh();
      toast({ title: 'Success', description: `${count} appraisal form(s) removed. You can start over for this period.`, variant: 'success' });
      setBulkRemoveConfirm({ open: false, periodId: null, periodName: '' });
    } catch (error) {
      console.error('Bulk remove error:', error);
      toast({ title: 'Error', description: 'Failed to remove forms. Please try again.', variant: 'error' });
    } finally {
      setBulkRemoving(false);
    }
  };

  const formsForPeriod = useMemo(
    () => (selectedPeriod ? assignments.filter((a) => a.reviewPeriodId === selectedPeriod) : []),
    [assignments, selectedPeriod]
  );
  const periodName = selectedPeriod ? reviewPeriods.find((p) => p.id === selectedPeriod)?.name ?? selectedPeriod : '';

  const activeLinks = links.filter((l) => !l.used && (!l.expiresAt || new Date(l.expiresAt) > new Date()));
  const usedLinks = links.filter((l) => l.used);
  const existingForPeriod = selectedPeriod ? assignments.filter((a) => a.reviewPeriodId === selectedPeriod).length : 0;

  return (
    <div className="space-y-6 pb-8 sm:pb-10 lg:pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title text-foreground">Send Appraisals</h1>
          <p className="page-subtitle text-muted-foreground">Create appraisal links or auto-assign from org structure</p>
        </div>
        {mode === 'manual' && (
          <Button type="button" onClick={() => setDialogOpen(true)}>
            <Plus size={18} weight="duotone" className="mr-2" />
            Generate Link
          </Button>
        )}
      </div>

      {isAdmin() && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <Info size={20} weight="duotone" className="text-primary flex-shrink-0" />
            <div className="text-sm">
              <span className="font-medium text-foreground">Sync forms to all staff:</span>
              <span className="text-muted-foreground ml-1">Run <code className="text-xs bg-muted px-1.5 py-0.5 rounded">supabase-appraisal-assignments.sql</code> in Supabase Dashboard → SQL Editor so execs and staff see their appraisal forms on every device.</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Forms for this period: view all + bulk remove */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ListChecks size={20} weight="duotone" />
            Forms for review period
          </CardTitle>
          <CardDescription>View all appraisal forms for a period or bulk remove to start over</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground">Period</Label>
              <PeriodSelector
                value={selectedPeriod || undefined}
                onChange={setSelectedPeriod}
                showActiveOnly={false}
                showCreateOption={false}
              />
            </div>
            {selectedPeriod && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">
                  {formsForPeriod.length} form{formsForPeriod.length !== 1 ? 's' : ''} for <strong className="text-foreground">{periodName}</strong>
                </span>
                {formsForPeriod.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive hover:border-destructive"
                    onClick={() => setBulkRemoveConfirm({ open: true, periodId: selectedPeriod, periodName })}
                  >
                    <TrashSimple size={16} weight="duotone" className="mr-1.5" />
                    Bulk remove all
                  </Button>
                )}
              </div>
            )}
          </div>
          {selectedPeriod && (
            <div className="rounded-lg border border-border/60 overflow-hidden">
              {formsForPeriod.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">No appraisal forms for this period yet.</div>
              ) : (
                <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left font-medium py-2.5 px-3">Appraiser</th>
                        <th className="text-left font-medium py-2.5 px-3">Employee</th>
                        <th className="text-left font-medium py-2.5 px-3">Template</th>
                        <th className="text-left font-medium py-2.5 px-3">Type</th>
                        <th className="text-left font-medium py-2.5 px-3">Status</th>
                        <th className="text-left font-medium py-2.5 px-3 w-20">Open</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formsForPeriod.map((a) => {
                        const template = templates.find((t) => t.id === a.templateId);
                        const typeLabel =
                          a.relationshipType === 'exec-to-leader'
                            ? 'Exec→Leader'
                            : a.relationshipType === 'leader-to-member'
                              ? 'Leader→Member'
                              : a.relationshipType === 'member-to-leader'
                                ? 'Member→Leader'
                                : a.relationshipType === 'leader-to-leader'
                                  ? 'Leader→Leader'
                                  : a.relationshipType === 'member-to-member'
                                    ? 'Member→Member'
                                    : a.relationshipType === 'hr-to-all'
                                      ? 'HR→All'
                                      : a.relationshipType;
                        const statusLabel = a.status === 'completed' ? 'Completed' : a.status === 'in-progress' ? 'In progress' : 'Pending';
                        const formUrl = `/appraisal/assignment/${a.id}`;
                        return (
                          <tr key={a.id} className="border-t border-border/40 hover:bg-muted/30">
                            <td className="py-2 px-3">{a.appraiserName}</td>
                            <td className="py-2 px-3">{a.employeeName}</td>
                            <td className="py-2 px-3">{template?.name ?? a.templateId}</td>
                            <td className="py-2 px-3 text-muted-foreground">{typeLabel}</td>
                            <td className="py-2 px-3">{statusLabel}</td>
                            <td className="py-2 px-3">
                              <a
                                href={formUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline text-xs"
                              >
                                Open
                              </a>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mode toggle: Manual vs Auto */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How to create appraisals</CardTitle>
          <CardDescription>Choose manual links (one-by-one) or auto-generate from reporting structure</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => { setMode('manual'); resetAutoWizard(); }}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                mode === 'manual'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <div className="flex items-center gap-2">
                <FileText size={20} weight="duotone" />
                <span className="font-semibold">Manual Links</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">Create individual links one-by-one</p>
            </button>
            <button
              type="button"
              onClick={() => setMode('auto')}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                mode === 'auto'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <div className="flex items-center gap-2">
                <Lightning size={20} weight="duotone" />
                <span className="font-semibold">Auto-Generate</span>
                <span className="text-xs rounded bg-muted px-1.5 py-0.5">Faster</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">Bulk create from Reports To and same-team leaders</p>
            </button>
          </div>
        </CardContent>
      </Card>

      {mode === 'manual' && (
        <>
          {/* Generate Dialog (Manual) */}
          {dialogOpen && (
            <Card>
              <CardHeader>
                <CardTitle>Generate New Link</CardTitle>
                <CardDescription>Create a unique link for an employee appraisal</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Review Period *</Label>
                  {activePeriods.length === 0 ? (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">No active periods found. Please create a review period first.</p>
                      <Button type="button" variant="secondary" onClick={() => (window.location.href = '/periods')}>
                        Go to Review Periods
                      </Button>
                    </div>
                  ) : (
                    <>
                      <PeriodSelector
                        value={selectedPeriod || undefined}
                        onChange={setSelectedPeriod}
                        showActiveOnly={true}
                        showCreateOption={false}
                      />
                      {!selectedPeriod && (
                        <p className="text-sm text-destructive">Please select a review period</p>
                      )}
                    </>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employee">Employee Being Appraised</Label>
                  <Select id="employee" value={selectedEmployee} onChange={(e) => setSelectedEmployee(e.target.value)}>
                    <option value="">Select employee...</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.role})
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="appraiser">Appraiser</Label>
                  <Select id="appraiser" value={selectedAppraiser} onChange={(e) => setSelectedAppraiser(e.target.value)}>
                    <option value="">Select appraiser...</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.role})
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="template">Template</Label>
                  <Select id="template" value={selectedTemplate} onChange={(e) => setSelectedTemplate(e.target.value)}>
                    <option value="">Select template...</option>
                    {templates.map((tpl) => (
                      <option key={tpl.id} value={tpl.id}>
                        {tpl.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expiration">Expiration (Days, optional)</Label>
                  <Input
                    id="expiration"
                    type="number"
                    min="1"
                    value={expirationDays}
                    onChange={(e) => setExpirationDays(e.target.value ? Number(e.target.value) : '')}
                    placeholder="30"
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setDialogOpen(false);
                      setSelectedEmployee('');
                      setSelectedAppraiser('');
                      setSelectedTemplate('');
                      setSelectedPeriod(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleGenerate}
                    disabled={!selectedEmployee || !selectedAppraiser || !selectedTemplate || !selectedPeriod}
                  >
                    Generate Link
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Active Links */}
          {activeLinks.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Active Links</h2>
              <div className="grid gap-4">
                {activeLinks.map((link) => {
                  const employee = employees.find((e) => e.id === link.employeeId);
                  const appraiser = employees.find((e) => e.id === link.appraiserId);
                  const template = templates.find((t) => t.id === link.templateId);
                  const url = `${window.location.origin}/appraisal/${link.token}`;
                  return (
                    <Card key={link.id}>
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <Clock size={16} weight="duotone" className="text-green-600/80" />
                              <span className="text-sm font-medium text-green-600/90">Active</span>
                            </div>
                            <div>
                              <p className="font-semibold">
                                {employee?.name} ← {appraiser?.name}
                              </p>
                              <p className="text-sm text-muted-foreground">{template?.name}</p>
                              {link.reviewPeriodName && (
                                <p className="text-xs text-muted-foreground mt-1">Period: {link.reviewPeriodName}</p>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Created {formatDate(link.createdAt)}
                              {link.expiresAt && ` • Expires ${formatDate(link.expiresAt)}`}
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              <Input value={url} readOnly className="text-xs font-mono" />
                              <Button type="button" size="sm" variant="secondary" onClick={() => handleCopyLink(link.token)} title="Copy link">
                                <Copy size={16} weight="duotone" />
                              </Button>
                              <Button type="button" size="sm" variant="ghost" onClick={() => window.open(url, '_blank')} title="Open in new tab">
                                <LinkSimple size={16} weight="duotone" />
                              </Button>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClick(link.id);
                            }}
                            title="Delete link"
                          >
                            <Trash size={16} weight="duotone" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Used Links */}
          {usedLinks.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Completed</h2>
              <div className="grid gap-4">
                {usedLinks.map((link) => {
                  const employee = employees.find((e) => e.id === link.employeeId);
                  const appraiser = employees.find((e) => e.id === link.appraiserId);
                  const template = templates.find((t) => t.id === link.templateId);
                  return (
                    <Card key={link.id} className="opacity-60">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <CheckCircle size={16} weight="duotone" className="text-muted-foreground/80" />
                              <span className="text-sm font-medium text-muted-foreground">Completed</span>
                            </div>
                            <div>
                              <p className="font-semibold">
                                {employee?.name} ← {appraiser?.name}
                              </p>
                              <p className="text-sm text-muted-foreground">{template?.name}</p>
                              {link.reviewPeriodName && (
                                <p className="text-xs text-muted-foreground mt-1">Period: {link.reviewPeriodName}</p>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">Created {formatDate(link.createdAt)}</div>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClick(link.id);
                            }}
                            title="Delete link"
                          >
                            <Trash size={16} weight="duotone" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {links.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-muted-foreground">No links generated yet</p>
                <Button type="button" onClick={() => setDialogOpen(true)} className="mt-4">
                  <Plus size={18} weight="duotone" className="mr-2" />
                  Generate Your First Link
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Auto-Generate wizard */}
      {mode === 'auto' && (
        <Card>
          <CardHeader>
            <CardTitle>Auto-assignment</CardTitle>
            <CardDescription>
              {autoStep === 1 && 'Select a period to see how many appraisals will be created from your org structure (Reports To + same team).'}
              {autoStep === 2 && 'Pick a template per type and optional due date, then generate.'}
              {autoStep === 3 && 'Assignments created. Add manual links from the Manual tab if needed.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {autoStep === 1 && (
              <>
                <div className="space-y-2">
                  <Label>Review period</Label>
                  <PeriodSelector
                    value={selectedPeriod || undefined}
                    onChange={setSelectedPeriod}
                    showActiveOnly={true}
                    showCreateOption={false}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Pairs use &quot;Reports To&quot; first; members in the same team as a leader/executive count as reports when &quot;Reports To&quot; is not set.
                </p>
                <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                  <p className="text-sm font-medium">Include in this run</p>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeLeaderToLeader}
                      onChange={(e) => setIncludeLeaderToLeader(e.target.checked)}
                    />
                    <span className="text-sm">Leader → Leader (every leader appraises every other leader, company-wide)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeMemberToMember}
                      onChange={(e) => setIncludeMemberToMember(e.target.checked)}
                    />
                    <span className="text-sm">Member → Member (same department only; peers rate each other)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeExecToLeader}
                      onChange={(e) => setIncludeExecToLeader(e.target.checked)}
                    />
                    <span className="text-sm">Executive → Leader (each exec sees one form per leader in the company)</span>
                  </label>
                  {employees.some((e) => e.hierarchy === 'hr') && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeHrToAll}
                        onChange={(e) => setIncludeHrToAll(e.target.checked)}
                      />
                      <span className="text-sm">HR → All (each HR appraises all non-HR employees)</span>
                    </label>
                  )}
                </div>
                {livePreview && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border bg-card p-3">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Leader → Member</p>
                        <p className="text-2xl font-bold mt-0.5">{livePreview.leaderToMember.length}</p>
                        <p className="text-xs text-muted-foreground">Manager appraises report (Reports To or same team)</p>
                      </div>
                      <div className="rounded-lg border bg-card p-3">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Member → Leader</p>
                        <p className="text-2xl font-bold mt-0.5">{livePreview.memberToLeader.length}</p>
                        <p className="text-xs text-muted-foreground">Upward feedback</p>
                      </div>
                      <div className="rounded-lg border bg-card p-3">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Leader → Leader</p>
                        <p className="text-2xl font-bold mt-0.5">{livePreview.leaderToLeader.length}</p>
                        <p className="text-xs text-muted-foreground">Every leader × every other leader</p>
                      </div>
                      <div className="rounded-lg border bg-card p-3">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Member → Member</p>
                        <p className="text-2xl font-bold mt-0.5">{livePreview.memberToMember.length}</p>
                        <p className="text-xs text-muted-foreground">Same department only; peers rate each other</p>
                      </div>
                      <div className="rounded-lg border bg-card p-3">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Executive → Leader</p>
                        <p className="text-2xl font-bold mt-0.5">{livePreview.execToLeader.length}</p>
                        <p className="text-xs text-muted-foreground">One form per leader for each exec</p>
                      </div>
                      {includeHrToAll && (
                        <div className="rounded-lg border border-teal-500/30 bg-teal-500/5 p-3">
                          <p className="text-xs font-medium text-teal-700 dark:text-teal-300 uppercase tracking-wide">HR → All</p>
                          <p className="text-2xl font-bold mt-0.5 text-teal-700 dark:text-teal-300">{livePreview.hrToAll.length}</p>
                          <p className="text-xs text-muted-foreground">
                            {employees.filter((e) => e.hierarchy === 'hr').length} HR × {employees.filter((e) => e.hierarchy !== 'hr').length} others
                          </p>
                        </div>
                      )}
                    </div>
                    {livePreview.warnings.length > 0 && (
                      <div className="rounded-lg border border-amber-500/50 bg-amber-500/5 p-4">
                        <p className="text-sm font-medium flex items-center gap-2 text-amber-700 dark:text-amber-400">
                          <Warning size={16} />
                          Tips
                        </p>
                        <ul className="list-disc list-inside text-sm text-muted-foreground mt-2 space-y-0.5">
                          {livePreview.warnings.map((w, i) => (
                            <li key={i}>{w}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {existingForPeriod > 0 && (
                      <p className="text-sm text-amber-600 flex items-center gap-2">
                        <Warning size={16} />
                        {existingForPeriod} assignment(s) already exist for this period. Auto-generate will add more.
                      </p>
                    )}
                  </>
                )}
                <div className="flex justify-end">
                  <Button onClick={runAutoPreview} disabled={!selectedPeriod || !livePreview}>
                    {livePreview && (livePreview.leaderToMember.length + livePreview.memberToLeader.length + livePreview.leaderToLeader.length + livePreview.memberToMember.length + livePreview.execToLeader.length + livePreview.hrToAll.length) > 0
                      ? `Continue with ${livePreview.leaderToMember.length + livePreview.memberToLeader.length + livePreview.leaderToLeader.length + livePreview.memberToMember.length + livePreview.execToLeader.length + livePreview.hrToAll.length} appraisals`
                      : 'Preview & continue'}
                    <CaretRight size={16} className="ml-1" />
                  </Button>
                </div>
              </>
            )}

            {autoStep === 2 && autoPreview && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm">Leader → Member</CardTitle>
                    </CardHeader>
                    <CardContent className="py-2">
                      <p className="text-2xl font-bold">{autoPreview.leaderToMember.length}</p>
                      <p className="text-xs text-muted-foreground">Based on Reports To</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm">Member → Leader</CardTitle>
                    </CardHeader>
                    <CardContent className="py-2">
                      <p className="text-2xl font-bold">{autoPreview.memberToLeader.length}</p>
                      <p className="text-xs text-muted-foreground">Upward feedback</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm">Leader → Leader</CardTitle>
                    </CardHeader>
                    <CardContent className="py-2">
                      <p className="text-2xl font-bold">{autoPreview.leaderToLeader.length}</p>
                      <p className="text-xs text-muted-foreground">Every leader × every other leader</p>
                    </CardContent>
                  </Card>
                  {autoPreview.memberToMember.length > 0 && (
                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm">Member → Member</CardTitle>
                      </CardHeader>
                      <CardContent className="py-2">
                        <p className="text-2xl font-bold">{autoPreview.memberToMember.length}</p>
                        <p className="text-xs text-muted-foreground">Same department only</p>
                      </CardContent>
                    </Card>
                  )}
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm">Executive → Leader</CardTitle>
                    </CardHeader>
                    <CardContent className="py-2">
                      <p className="text-2xl font-bold">{autoPreview.execToLeader.length}</p>
                      <p className="text-xs text-muted-foreground">One form per leader for each exec</p>
                    </CardContent>
                  </Card>
                  {autoPreview.hrToAll.length > 0 && (
                    <Card className="border-teal-500/30 bg-teal-500/5">
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm text-teal-700 dark:text-teal-300">HR → All</CardTitle>
                      </CardHeader>
                      <CardContent className="py-2">
                        <p className="text-2xl font-bold text-teal-700 dark:text-teal-300">{autoPreview.hrToAll.length}</p>
                        <p className="text-xs text-muted-foreground">Each HR appraises all non-HR employees</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
                {autoPreview.warnings.length > 0 && (
                  <div className="rounded-lg border border-amber-500/50 bg-amber-500/5 p-4">
                    <p className="text-sm font-medium flex items-center gap-2 text-amber-700 dark:text-amber-400">
                      <Warning size={16} />
                      Warnings
                    </p>
                    <ul className="list-disc list-inside text-sm text-muted-foreground mt-2">
                      {autoPreview.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="space-y-3">
                  <Label>Templates per type</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Leader → Member</Label>
                      <Select
                        value={autoTemplateMap.leaderToMember}
                        onChange={(e) => setAutoTemplateMap((m) => ({ ...m, leaderToMember: e.target.value }))}
                      >
                        <option value="">Select...</option>
                        {templates.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Member → Leader</Label>
                      <Select
                        value={autoTemplateMap.memberToLeader}
                        onChange={(e) => setAutoTemplateMap((m) => ({ ...m, memberToLeader: e.target.value }))}
                      >
                        <option value="">Select...</option>
                        {templates.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Leader → Leader</Label>
                      <Select
                        value={autoTemplateMap.leaderToLeader}
                        onChange={(e) => setAutoTemplateMap((m) => ({ ...m, leaderToLeader: e.target.value }))}
                      >
                        <option value="">Select...</option>
                        {templates.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </Select>
                    </div>
                    {autoPreview.memberToMember.length > 0 && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Member → Member (same dept)</Label>
                        <Select
                          value={autoTemplateMap.memberToMember}
                          onChange={(e) => setAutoTemplateMap((m) => ({ ...m, memberToMember: e.target.value }))}
                        >
                          <option value="">Select...</option>
                          {templates.map((t) => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </Select>
                      </div>
                    )}
                    <div>
                      <Label className="text-xs text-muted-foreground">Executive → Leader</Label>
                      <Select
                        value={autoTemplateMap.execToLeader}
                        onChange={(e) => setAutoTemplateMap((m) => ({ ...m, execToLeader: e.target.value }))}
                      >
                        <option value="">Select...</option>
                        {templates.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </Select>
                    </div>
                    {autoPreview.hrToAll.length > 0 && (
                      <div>
                        <Label className="text-xs text-muted-foreground">HR → All</Label>
                        <Select
                          value={autoTemplateMap.hrToAll}
                          onChange={(e) => setAutoTemplateMap((m) => ({ ...m, hrToAll: e.target.value }))}
                        >
                          <option value="">Select HR template...</option>
                          {templates.filter((t) => t.type === 'hr-to-all').map((t) => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                          {templates.filter((t) => t.type === 'hr-to-all').length === 0 && (
                            <option value="" disabled>No HR → All template – create one in Templates</option>
                          )}
                        </Select>
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Due date (optional)</Label>
                    <Input
                      type="date"
                      value={autoDueDate}
                      onChange={(e) => setAutoDueDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setAutoStep(1)}>
                    <CaretLeft size={16} className="mr-1" />
                    Back
                  </Button>
                  <Button onClick={handleAutoGenerate} disabled={autoGenerating}>
                    {autoGenerating ? 'Creating...' : `Generate ${totalAutoCount} appraisals`}
                  </Button>
                </div>
              </>
            )}

            {autoStep === 3 && autoDoneCount !== null && (
              <>
                <div className="flex flex-col items-center py-6">
                  <CheckCircle size={48} weight="duotone" className="text-green-600 mb-4" />
                  <h3 className="text-xl font-semibold">{autoDoneCount} appraisals created</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Employees will see them in My Appraisals. You can add manual links for special cases.
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => { setMode('manual'); setDialogOpen(true); resetAutoWizard(); }}>
                    Create manual link
                  </Button>
                  <Button onClick={resetAutoWizard}>Done</Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, id: null })}
        onConfirm={handleDeleteConfirm}
        title="Delete Link"
        description="Are you sure you want to delete this appraisal link? This action cannot be undone."
        confirmText="Delete Link"
        cancelText="Cancel"
        variant="danger"
        loading={deleting}
      />

      <ConfirmDialog
        open={bulkRemoveConfirm.open}
        onClose={() => setBulkRemoveConfirm({ open: false, periodId: null, periodName: '' })}
        onConfirm={handleBulkRemoveConfirm}
        title="Bulk remove all forms"
        description={`Remove all appraisal forms for "${bulkRemoveConfirm.periodName}"? You can start over and re-create links or auto-assign after this. This cannot be undone.`}
        confirmText="Remove all forms"
        cancelText="Cancel"
        variant="danger"
        loading={bulkRemoving}
      />
    </div>
  );
}
