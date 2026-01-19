import type { Appraisal } from '@/types';
import { getTemplates, getEmployees } from './storage';

export interface PerformanceInsight {
  strengths: string[];
  improvements: string[];
  narrative: string;
  percentage: number;
}

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

export async function generatePerformanceSummary(
  employeeId: string,
  appraisals: Appraisal[]
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

  const templates = await getTemplates();
  const employees = await getEmployees();
  const employee = employees.find((e) => e.id === employeeId);

  // Calculate overall percentage
  const totalScore = employeeAppraisals.reduce((sum, a) => sum + a.score, 0);
  const totalMaxScore = employeeAppraisals.reduce((sum, a) => sum + a.maxScore, 0);
  const percentage = totalMaxScore > 0 ? Math.round((totalScore / totalMaxScore) * 100) : 0;

  // Analyze by question/category
  const questionScores: Record<string, { total: number; max: number; count: number; categoryName?: string }> = {};

  employeeAppraisals.forEach((appraisal) => {
    const template = templates.find((t) => t.id === appraisal.templateId);
    if (!template) return;

    // Support both new category structure and legacy questions structure
    if (template.categories && template.categories.length > 0) {
      // New structure: categories with items
      template.categories.forEach((category) => {
        category.items.forEach((item) => {
          const response = appraisal.responses.find((r) => r.questionId === item.id);
          if (!response) return;

          // Use category name + item text as key, or just item text if no category name
          const key = item.text.toLowerCase().substring(0, 100); // Limit length for key
          const displayName = item.categoryName 
            ? `${category.categoryName}: ${item.categoryName || item.text.substring(0, 50)}`
            : category.categoryName 
            ? `${category.categoryName}: ${item.text.substring(0, 50)}`
            : item.text.substring(0, 50);

          if (!questionScores[key]) {
            questionScores[key] = { total: 0, max: 0, count: 0, categoryName: displayName };
          }

          let score = 0;
          if (item.type === 'rating-1-5') {
            score = (Number(response.value) / 5) * item.weight;
          } else if ((item.type as string) === 'rating-1-10') {
            score = (Number(response.value) / 10) * item.weight;
          } else if (response.value && String(response.value).trim()) {
            score = item.weight;
          }

          questionScores[key].total += score;
          questionScores[key].max += item.weight;
          questionScores[key].count += 1;
        });
      });
    } else if (template.questions && template.questions.length > 0) {
      // Legacy structure: questions array
      appraisal.responses.forEach((response) => {
        const question = template.questions!.find((q) => q.id === response.questionId);
        if (!question) return;

        const key = question.text.toLowerCase();
        if (!questionScores[key]) {
          questionScores[key] = { total: 0, max: 0, count: 0, categoryName: question.categoryName || question.text };
        }

        let score = 0;
        if (question.type === 'rating-1-5') {
          score = (Number(response.value) / 5) * question.weight;
        } else if ((question.type as string) === 'rating-1-10') {
          score = (Number(response.value) / 10) * question.weight;
        } else if (response.value && String(response.value).trim()) {
          score = question.weight;
        }

        questionScores[key].total += score;
        questionScores[key].max += question.weight;
        questionScores[key].count += 1;
      });
    }
  });

  // Calculate percentages per question/category
  const questionPercentages: Array<{ name: string; percentage: number }> = Object.entries(questionScores)
    .map(([key, data]) => ({
      name: data.categoryName || key,
      percentage: data.max > 0 ? (data.total / data.max) * 100 : 0,
    }))
    .sort((a, b) => b.percentage - a.percentage);

  // Identify strengths (top 2-3)
  const strengths = questionPercentages
    .filter((q) => q.percentage >= 75)
    .slice(0, 3)
    .map((q) => {
      const phrase = STRENGTH_PHRASES[Math.floor(Math.random() * STRENGTH_PHRASES.length)];
      const displayName = q.name.length > 60 ? q.name.substring(0, 60) + '...' : q.name;
      return `${phrase} ${displayName} (${Math.round(q.percentage)}%)`;
    });

  // Identify improvements (bottom 2-3)
  const improvements = questionPercentages
    .filter((q) => q.percentage < 75)
    .slice(-3)
    .reverse()
    .map((q) => {
      const phrase = IMPROVEMENT_PHRASES[Math.floor(Math.random() * IMPROVEMENT_PHRASES.length)];
      const displayName = q.name.length > 60 ? q.name.substring(0, 60) + '...' : q.name;
      return `${phrase} ${displayName} (${Math.round(q.percentage)}%)`;
    });

  // Generate narrative
  const level = Object.entries(PERFORMANCE_LEVELS)
    .reverse()
    .find(([_, data]) => percentage >= data.min)?.[1] || PERFORMANCE_LEVELS.needsImprovement;

  const employeeName = employee?.name || 'This employee';
  const narrative = `${employeeName} demonstrates ${level.text}, achieving ${percentage}% of the total possible score across all appraisals. ${
    strengths.length > 0
      ? `Key strengths include ${strengths.slice(0, 2).join(' and ')}. `
      : ''
  }${
    improvements.length > 0
      ? `Areas for development include ${improvements.slice(0, 2).join(' and ')}. `
      : ''
  }Overall, ${employeeName.toLowerCase()} ${percentage >= 75 ? 'meets' : 'is working towards'} performance expectations and ${percentage >= 90 ? 'exceeds' : percentage >= 60 ? 'meets' : 'would benefit from additional support to meet'} organizational standards.`;

  return {
    strengths: strengths.length > 0 ? strengths : ['No significant strengths identified'],
    improvements: improvements.length > 0 ? improvements : ['No specific improvement areas identified'],
    narrative,
    percentage,
  };
}
