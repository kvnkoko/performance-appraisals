/**
 * Appraisal form loaded by assignment ID (auto-assigned or manual assignment).
 * Used when employee opens an appraisal from "My Appraisals" via assignment (no link token).
 */
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle } from 'phosphor-react';
import { useApp } from '@/contexts/app-context';
import {
  getAppraisalAssignment,
  getTemplate,
  getEmployee,
  getReviewPeriod,
  saveAppraisal,
  saveAppraisalAssignment,
} from '@/lib/storage';
import { generateId, calculateScore } from '@/lib/utils';
import { useToast } from '@/contexts/toast-context';
import { RatingSelector } from '@/components/ui/rating-selector';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { AppraisalResponse, Category, CategoryItem } from '@/types';
import type { AppraisalAssignment } from '@/types';

const responseSchema = z.record(z.union([z.string(), z.number()]));
type ResponseFormData = z.infer<typeof responseSchema>;

export function AppraisalFormByAssignmentPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { refresh } = useApp();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [assignment, setAssignment] = useState<AppraisalAssignment | null>(null);
  const [template, setTemplate] = useState<any>(null);
  const [employee, setEmployee] = useState<any>(null);
  const [appraiser, setAppraiser] = useState<any>(null);
  const [completed, setCompleted] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
  } = useForm<ResponseFormData>({
    resolver: zodResolver(responseSchema),
  });
  const watchedValues = watch();

  useEffect(() => {
    loadData();
  }, [assignmentId]);

  const loadData = async () => {
    if (!assignmentId) {
      toast({ title: 'Invalid assignment', description: 'This appraisal assignment is invalid.', variant: 'error' });
      setLoading(false);
      return;
    }
    try {
      const assignmentData = await getAppraisalAssignment(assignmentId);
      if (!assignmentData) {
        toast({ title: 'Not found', description: 'This appraisal assignment does not exist.', variant: 'error' });
        setLoading(false);
        return;
      }
      if (assignmentData.status === 'completed') {
        setCompleted(true);
        setLoading(false);
        return;
      }
      const [templateData, employeeData, appraiserData] = await Promise.all([
        getTemplate(assignmentData.templateId),
        getEmployee(assignmentData.employeeId),
        getEmployee(assignmentData.appraiserId),
      ]);
      if (!templateData || !employeeData || !appraiserData) {
        toast({ title: 'Error', description: 'Failed to load appraisal data.', variant: 'error' });
        setLoading(false);
        return;
      }
      setAssignment(assignmentData);
      setTemplate(templateData);
      setEmployee(employeeData);
      setAppraiser(appraiserData);
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to load appraisal form.', variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const calculateQuestionScores = () => {
    if (!template) return {} as Record<string, { weightScore: number; percentageScore: number }>;
    const allItems: Array<{ id: string; type: string; weight: number; required: boolean }> = [];
    if (template.categories?.length) {
      template.categories.forEach((cat: any) => {
        cat.items.forEach((item: any) => allItems.push({ id: item.id, type: item.type, weight: item.weight, required: item.required }));
      });
    } else if (template.questions?.length) {
      template.questions.forEach((q: any) => allItems.push({ id: q.id, type: q.type, weight: q.weight, required: q.required }));
    }
    const scores: Record<string, { weightScore: number; percentageScore: number }> = {};
    allItems.forEach((item) => {
      const response = watchedValues[item.id];
      if (!response) return;
      if (item.type === 'rating-1-5') {
        const rating = Number(response);
        if (rating >= 1 && rating <= 5) {
          scores[item.id] = { weightScore: rating * item.weight, percentageScore: (rating * item.weight) / 5 };
        }
      } else if (item.type === 'text' || item.type === 'multiple-choice') {
        if (String(response).trim().length > 0) {
          scores[item.id] = { weightScore: 5 * item.weight, percentageScore: item.weight };
        }
      }
    });
    return scores;
  };

  const calculateTotalScore = () => {
    const scores = calculateQuestionScores();
    return {
      totalWeightScore: Object.values(scores).reduce((s, x) => s + x.weightScore, 0),
      totalPercentage: Object.values(scores).reduce((s, x) => s + x.percentageScore, 0),
    };
  };

  const onSubmit = async (data: ResponseFormData) => {
    if (!assignment || !template) return;
    setSubmitting(true);
    try {
      const allItems: Array<{ id: string; type: string; weight: number }> = [];
      if (template.categories?.length) {
        template.categories.forEach((cat: any) => cat.items.forEach((item: any) => allItems.push({ id: item.id, type: item.type, weight: item.weight })));
      } else if (template.questions?.length) {
        template.questions.forEach((q: any) => allItems.push({ id: q.id, type: q.type, weight: q.weight }));
      }
      const responses: AppraisalResponse[] = allItems.map((item) => ({ questionId: item.id, value: data[item.id] || '' }));
      const { score, maxScore } = calculateScore(responses, allItems);
      const period = await getReviewPeriod(assignment.reviewPeriodId);
      const reviewPeriodName = period?.name ?? 'Review Period';

      await saveAppraisal({
        id: generateId(),
        templateId: template.id,
        employeeId: assignment.employeeId,
        appraiserId: assignment.appraiserId,
        reviewPeriodId: assignment.reviewPeriodId,
        reviewPeriodName,
        responses,
        score,
        maxScore,
        completedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
      await saveAppraisalAssignment({ ...assignment, status: 'completed' });
      await refresh();

      setCompleted(true);
      toast({ title: 'Success', description: 'Appraisal submitted successfully!', variant: 'success' });
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to submit appraisal.', variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center"><p className="text-muted-foreground">Loading appraisal form...</p></div>
      </div>
    );
  }
  if (completed) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle size={64} weight="duotone" className="text-green-600/80 mb-4" />
            <h2 className="text-2xl font-bold mb-2">Thank You!</h2>
            <p className="text-muted-foreground text-center mb-4">Your appraisal has been submitted successfully.</p>
            <Button onClick={() => navigate('/my-appraisals')}>Back to My Appraisals</Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  if (!template || !employee) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <p className="text-muted-foreground text-center">Unable to load appraisal form. Please contact your administrator.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const categories: Array<{ id: string; categoryName: string; items: Array<CategoryItem & { mainCategoryName: string }> }> = [];
  if (template.categories?.length) {
    template.categories.forEach((cat: Category) => {
      categories.push({
        id: cat.id,
        categoryName: cat.categoryName,
        items: cat.items.map((item: CategoryItem) => ({ ...item, mainCategoryName: cat.categoryName })),
      });
    });
  } else if (template.questions?.length) {
    const categoryMap = new Map<string, Array<CategoryItem & { mainCategoryName: string }>>();
    template.questions.forEach((q: any) => {
      const catName = q.categoryName || 'General';
      if (!categoryMap.has(catName)) categoryMap.set(catName, []);
      categoryMap.get(catName)!.push({ ...q, mainCategoryName: catName });
    });
    categoryMap.forEach((items, catName) => categories.push({ id: generateId(), categoryName: catName, items }));
  }

  const scores = calculateQuestionScores();
  const { totalWeightScore, totalPercentage } = calculateTotalScore();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="mb-6 lg:mb-8 text-center space-y-2">
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">{template.name}</h1>
          {template.subtitle && <p className="text-muted-foreground">{template.subtitle}</p>}
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <span>Appraising:</span>
            <span className="font-semibold text-foreground">{employee.name}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="hidden lg:block">
            <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
              <CardContent className="p-0">
                <div className="sticky top-0 z-10 bg-muted/95 border-b px-4 py-2.5 text-xs text-muted-foreground text-center">
                  1 (Lowest) → 5 (Highest)
                </div>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-muted/80 border-b">
                      <th className="px-3 py-2.5 text-left text-xs w-12">No.</th>
                      <th className="px-4 py-2.5 text-left text-xs min-w-[320px]">Description</th>
                      <th className="px-3 py-2.5 text-center text-xs w-20">Weight</th>
                      <th className="px-4 py-2.5 text-center" colSpan={5}>Rating (1-5)</th>
                      <th className="px-3 py-2.5 text-center text-xs w-24">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((category, catIndex) => (
                      <React.Fragment key={category.id}>
                        <tr className="bg-primary/10 border-b-2 border-primary/20">
                          <td colSpan={9} className="px-4 py-3 font-bold text-sm">{category.categoryName}</td>
                        </tr>
                        {category.items.map((item, itemIndex) => {
                          const globalIndex = categories.slice(0, catIndex).reduce((s, c) => s + c.items.length, 0) + itemIndex;
                          const currentValue = watchedValues[item.id];
                          const questionScores = scores[item.id] || { weightScore: 0, percentageScore: 0 };
                          return (
                            <tr key={item.id} className="border-b border-border/30">
                              <td className="px-3 py-3 text-center text-sm">{globalIndex + 1}</td>
                              <td className="px-4 py-3 text-sm">{item.text}</td>
                              <td className="px-3 py-3 text-center text-sm">{item.weight}%</td>
                              <td className="px-2 py-3" colSpan={5}>
                                {item.type === 'rating-1-5' ? (
                                  <div className="flex justify-center gap-1">
                                    {[1, 2, 3, 4, 5].map((r) => (
                                      <label
                                        key={r}
                                        className={`flex flex-col items-center justify-center cursor-pointer rounded border min-w-[40px] h-[48px] ${
                                          Number(currentValue) === r ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border'
                                        }`}
                                      >
                                        <input type="radio" {...register(item.id)} value={r} className="sr-only" required={item.required} />
                                        <span>{r}</span>
                                      </label>
                                    ))}
                                  </div>
                                ) : item.type === 'text' ? (
                                  <Textarea {...register(item.id)} placeholder="Enter feedback..." className="min-h-[70px] text-sm" required={item.required} />
                                ) : item.type === 'multiple-choice' ? (
                                  <Select {...register(item.id)} className="w-full text-sm" required={item.required}>
                                    <option value="">Select...</option>
                                    {item.options?.map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
                                  </Select>
                                ) : null}
                              </td>
                              <td className="px-3 py-3 text-center text-sm">{questionScores.weightScore > 0 ? questionScores.weightScore.toFixed(2) : '—'}</td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    ))}
                    <tr className="bg-primary/15 border-t-2">
                      <td colSpan={8} className="px-4 py-4 text-right font-bold">Total:</td>
                      <td className="px-3 py-4 text-center font-bold">{totalWeightScore.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>

          <div className="lg:hidden space-y-4">
            {categories.map((category, catIndex) => (
              <div key={category.id} className="space-y-3">
                <Card className="bg-primary/10 border-2 border-primary/20">
                  <CardContent className="p-3 font-bold text-sm">{category.categoryName}</CardContent>
                </Card>
                {category.items.map((item, itemIndex) => {
                  const globalIndex = categories.slice(0, catIndex).reduce((s, c) => s + c.items.length, 0) + itemIndex;
                  const currentValue = watchedValues[item.id];
                  const questionScores = scores[item.id] || { weightScore: 0, percentageScore: 0 };
                  return (
                    <Card key={item.id} className="border">
                      <CardContent className="p-4 space-y-3">
                        <div className="text-sm">{item.text}</div>
                        <div className="text-xs text-muted-foreground">{item.weight}%</div>
                        {item.type === 'rating-1-5' ? (
                          <RatingSelector
                            value={currentValue ? Number(currentValue) : undefined}
                            onChange={(v) => setValue(item.id, v)}
                            required={item.required}
                          />
                        ) : item.type === 'text' ? (
                          <Textarea {...register(item.id)} placeholder="Enter feedback..." className="min-h-[90px]" required={item.required} />
                        ) : (
                          <Select {...register(item.id)} className="w-full" required={item.required}>
                            <option value="">Select...</option>
                            {item.options?.map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
                          </Select>
                        )}
                        <div className="text-sm font-semibold">Score: {questionScores.weightScore > 0 ? questionScores.weightScore.toFixed(2) : '—'}</div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ))}
            <Card className="bg-primary/15 border-2">
              <CardContent className="p-4 flex justify-between items-center">
                <span className="font-bold">Total Score:</span>
                <span className="font-bold">{totalWeightScore.toFixed(2)} ({totalPercentage.toFixed(2)}%)</span>
              </CardContent>
            </Card>
          </div>

          <div className="mt-6 lg:mt-8 flex justify-end">
            <Button type="submit" size="lg" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Appraisal'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
