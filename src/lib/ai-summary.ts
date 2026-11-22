import type { Appraisal, MyPeriodResult } from '@/types';
import { getTemplates, getEmployees } from './storage';

export interface PerformanceInsight {
  strengths: string[];
  improvements: string[];
  narrative: string;
  percentage: number;
}

/** Totals per question across a person's reviews; the same shape get_my_results() returns. */
export type QuestionTotals = MyPeriodResult['questions'];

const STRENGTH_PHRASES = [
  'demonstrates exceptional',
  'shows strong',
  'excels in',
  'displays outstanding',
  'has excellent',
  'performs exceptionally well in',
];

const IMPROVEMENT_PHRASES = [
  'shows room for improvement in',
  'would benefit from enhancing',
  'currently performing below benchmark in',
  'has opportunities to strengthen',
  'could improve',
];

const PERFORMANCE_LEVELS = {
  excellent: { min: 90, text: 'excellent performance' },
  good: { min: 75, text: 'strong performance' },
  satisfactory: { min: 60, text: 'satisfactory performance' },
  needsImprovement: { min: 0, text: 'performance that requires attention' },
};

/** Write the summary from per-question totals. Used for staff (server summaries) and admins alike. */
export function summarizePerformance(employeeName: string, percentage: number, questions: QuestionTotals): PerformanceInsight {
  const questionPercentages = questions
    .filter((q) => q.max > 0)
    .map((q) => ({ name: q.name, percentage: (q.total / q.max) * 100 }))
    .sort((a, b) => b.percentage - a.percentage);

  const strengths = questionPercentages
    .filter((q) => q.percentage >= 75)
    .slice(0, 3);

  const improvements = questionPercentages
    .filter((q) => q.percentage < 75)
    .slice(-3)
    .reverse();

  const rounded = Math.round(percentage);
  const level = Object.values(PERFORMANCE_LEVELS).find((data) => rounded >= data.min) ?? PERFORMANCE_LEVELS.needsImprovement;
  const name = employeeName.trim() || 'This employee';
  const list = (items: { name: string; percentage: number }[]) =>
    items.slice(0, 2).map((q) => `${q.name} (${Math.round(q.percentage)}%)`).join(' and ');
  const outlook =
    rounded >= 90
      ? 'exceeds expectations'
      : rounded >= 75
      ? 'meets expectations'
      : rounded >= 60
      ? 'is working towards expectations'
      : 'would benefit from additional support to meet expectations';
  const narrative = [
    `${name} demonstrates ${level.text}, with an overall score of ${rounded}% across all reviews.`,
    strengths.length > 0 ? `The strongest areas are ${list(strengths)}.` : '',
    improvements.length > 0 ? `The main areas to develop are ${list(improvements)}.` : '',
    `Overall, ${name} ${outlook}.`,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    strengths: strengths.length > 0
      ? strengths.map((q, i) => `${STRENGTH_PHRASES[i % STRENGTH_PHRASES.length]} ${q.name} (${Math.round(q.percentage)}%)`)
      : ['No significant strengths identified'],
    improvements: improvements.length > 0
      ? improvements.map((q, i) => `${IMPROVEMENT_PHRASES[i % IMPROVEMENT_PHRASES.length]} ${q.name} (${Math.round(q.percentage)}%)`)
      : ['No specific improvement areas identified'],
    narrative,
    percentage: rounded,
  };
}

/** Per-question totals from full appraisal forms (admins). Mirrors the "questions" part of get_my_results(). */
export async function questionTotalsFromAppraisals(appraisals: Appraisal[]): Promise<QuestionTotals> {
  const templates = await getTemplates();
  const totals = new Map<string, { name: string; total: number; max: number }>();

  for (const appraisal of appraisals) {
    const template = appraisal.templateSnapshot ?? templates.find((t) => t.id === appraisal.templateId);
    if (!template) continue;
    const entries = template.categories?.length
      ? template.categories.flatMap((c) => c.items.map((item) => ({ item, category: c.categoryName })))
      : (template.questions ?? []).map((item) => ({ item, category: item.categoryName ?? '' }));

    for (const { item, category } of entries) {
      if (item.type !== 'rating-1-5') continue;
      const value = Number(appraisal.responses.find((r) => r.questionId === item.id)?.value);
      if (!Number.isInteger(value) || value < 1 || value > 5) continue;
      const label = category ? (item.categoryName ? `${category}: ${item.categoryName}` : category) : item.text;
      const key = `${item.text.toLowerCase().slice(0, 100)}|${label}`;
      const entry = totals.get(key) ?? { name: label, total: 0, max: 0 };
      entry.total += (value / 5) * item.weight;
      entry.max += item.weight;
      totals.set(key, entry);
    }
  }
  return [...totals.values()];
}

/** Summary for one person from their full forms (admins). Pass the group-weighted score when known. */
export async function generatePerformanceSummary(
  employeeId: string,
  appraisals: Appraisal[],
  overallPct?: number
): Promise<PerformanceInsight> {
  const employeeAppraisals = appraisals.filter((a) => a.employeeId === employeeId && a.completedAt);
  if (employeeAppraisals.length === 0) {
    return {
      strengths: [],
      improvements: [],
      narrative: 'No completed appraisals available for this employee.',
      percentage: 0,
    };
  }

  const employee = (await getEmployees()).find((e) => e.id === employeeId);
  const totalScore = employeeAppraisals.reduce((sum, a) => sum + a.score, 0);
  const totalMaxScore = employeeAppraisals.reduce((sum, a) => sum + a.maxScore, 0);
  const percentage = overallPct ?? (totalMaxScore > 0 ? (totalScore / totalMaxScore) * 100 : 0);
  return summarizePerformance(employee?.name ?? 'This employee', percentage, await questionTotalsFromAppraisals(employeeAppraisals));
}
