import { useState, useEffect } from 'react';
import { useApp } from '@/contexts/app-context';
import { PeriodSelector } from '@/components/periods/period-selector';
import { getReviewPeriod } from '@/lib/storage';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Plus, Copy, Trash, LinkSimple, CheckCircle, Clock } from 'phosphor-react';
import { generateToken, generateId } from '@/lib/utils';
import { saveLink, deleteLink } from '@/lib/storage';
import { useToast } from '@/contexts/toast-context';
import { formatDate } from '@/lib/utils';
import type { AppraisalLink } from '@/types';

export function LinksPage() {
  const { employees, templates, links, activePeriods, refresh } = useApp();
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
  const { toast } = useToast();

  useEffect(() => {
    // Auto-select first active period if available
    if (activePeriods.length > 0 && !selectedPeriod) {
      setSelectedPeriod(activePeriods[0].id);
    }
  }, [activePeriods, selectedPeriod]);

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

  const activeLinks = links.filter((l) => !l.used && (!l.expiresAt || new Date(l.expiresAt) > new Date()));
  // const expiredLinks = links.filter((l) => l.expiresAt && new Date(l.expiresAt) <= new Date() && !l.used);
  const usedLinks = links.filter((l) => l.used);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Appraisal Links</h1>
          <p className="text-muted-foreground mt-2">Generate and manage appraisal links</p>
        </div>
        <Button type="button" onClick={() => setDialogOpen(true)}>
          <Plus size={18} weight="duotone" className="mr-2" />
          Generate Link
        </Button>
      </div>

      {/* Generate Dialog */}
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
                  <Button type="button" variant="secondary" onClick={() => window.location.href = '/periods'}>
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
              <Select
                id="employee"
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
              >
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
              <Select
                id="appraiser"
                value={selectedAppraiser}
                onChange={(e) => setSelectedAppraiser(e.target.value)}
              >
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
              <Select
                id="template"
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
              >
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
              <Button type="button" variant="ghost" onClick={() => {
                setDialogOpen(false);
                setSelectedEmployee('');
                setSelectedAppraiser('');
                setSelectedTemplate('');
                setSelectedPeriod(null);
              }}>
                Cancel
              </Button>
              <Button type="button" onClick={handleGenerate} disabled={!selectedEmployee || !selectedAppraiser || !selectedTemplate || !selectedPeriod}>
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
                            <p className="text-xs text-muted-foreground mt-1">
                              Period: {link.reviewPeriodName}
                            </p>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Created {formatDate(link.createdAt)}
                          {link.expiresAt && ` • Expires ${formatDate(link.expiresAt)}`}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <Input value={url} readOnly className="text-xs font-mono" />
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => handleCopyLink(link.token)}
                            title="Copy link"
                          >
                            <Copy size={16} weight="duotone" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => window.open(url, '_blank')}
                            title="Open in new tab"
                          >
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
                            <p className="text-xs text-muted-foreground mt-1">
                              Period: {link.reviewPeriodName}
                            </p>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Created {formatDate(link.createdAt)}
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
    </div>
  );
}
