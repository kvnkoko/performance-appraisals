import { useState } from 'react';
import { ShieldCheck, Download, Wrench } from 'phosphor-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/contexts/toast-context';
import { useApp } from '@/contexts/app-context';
import {
  applyIntegrityFixes,
  integrityReportCsv,
  ISSUE_LABELS,
  scanIntegrity,
  type IntegrityIssueKind,
  type IntegrityScan,
} from '@/lib/integrity';

function downloadCsv(contents: string, filename: string) {
  const blob = new Blob([contents], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function IntegrityCheckCard() {
  const { refresh } = useApp();
  const { toast } = useToast();
  const [scan, setScan] = useState<IntegrityScan | null>(null);
  const [fixedAt, setFixedAt] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [fixing, setFixing] = useState(false);

  const runScan = async () => {
    setScanning(true);
    setFixedAt(null);
    try {
      setScan(await scanIntegrity());
    } catch (error) {
      console.error('Integrity scan failed:', error);
      toast({ title: 'Check failed', description: 'Could not load data from the server. Please try again.', variant: 'error' });
    } finally {
      setScanning(false);
    }
  };

  const runFix = async () => {
    if (!scan) return;
    setFixing(true);
    try {
      const result = await applyIntegrityFixes(scan);
      const at = new Date().toISOString();
      setFixedAt(at);
      downloadCsv(integrityReportCsv(scan, at), `integrity-report-${at.slice(0, 10)}.csv`);
      await refresh();
      toast({
        title: 'Fixes applied',
        description: `${result.completed} form(s) marked completed, ${result.removed} duplicate form(s) removed, ${result.linksClosed} link(s) closed. Report downloaded.`,
        variant: 'success',
      });
    } catch (error) {
      console.error('Integrity fix failed:', error);
      toast({ title: 'Fix stopped partway', description: 'Some fixes may not have been applied. Run the check again to see what is left.', variant: 'error' });
    } finally {
      setFixing(false);
    }
  };

  const counts = new Map<IntegrityIssueKind, number>();
  for (const issue of scan?.issues ?? []) counts.set(issue.kind, (counts.get(issue.kind) ?? 0) + 1);
  const autoFixable = scan ? scan.toDelete.length + scan.toMarkCompleted.length + scan.linksToMarkUsed.length : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck size={20} weight="duotone" />
          Data integrity check
        </CardTitle>
        <CardDescription>
          Finds duplicate forms and forms that still show as pending after the review was submitted. Submitted appraisals are never changed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button type="button" variant="secondary" className="w-full" onClick={runScan} disabled={scanning || fixing}>
          {scanning ? 'Checking...' : scan ? 'Run check again' : 'Run check'}
        </Button>

        {scan && (
          <div className="space-y-3">
            {scan.issues.length === 0 ? (
              <p className="text-sm text-muted-foreground">No problems found.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {(Object.keys(ISSUE_LABELS) as IntegrityIssueKind[])
                  .filter((kind) => counts.get(kind))
                  .map((kind) => (
                    <li key={kind} className="flex items-start justify-between gap-3">
                      <span className="text-muted-foreground">{ISSUE_LABELS[kind]}</span>
                      <span className="font-semibold tabular-nums">{counts.get(kind)}</span>
                    </li>
                  ))}
              </ul>
            )}

            {scan.issues.length > 0 && (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="button" className="flex-1" onClick={runFix} disabled={fixing || autoFixable === 0 || !!fixedAt}>
                  <Wrench size={16} weight="duotone" className="mr-2" />
                  {fixing ? 'Fixing...' : fixedAt ? 'Fixed' : `Fix ${autoFixable} automatically`}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => downloadCsv(integrityReportCsv(scan, fixedAt ?? undefined), `integrity-report-${scan.scannedAt.slice(0, 10)}.csv`)}
                >
                  <Download size={16} weight="duotone" className="mr-2" />
                  Download report
                </Button>
              </div>
            )}

            {(counts.get('duplicate-submission') || counts.get('missing-reference')) ? (
              <p className="text-xs text-muted-foreground">
                Duplicate submissions and missing references are listed in the report for manual review; they are not changed automatically.
              </p>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
