import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle } from 'phosphor-react';
import { getLinkByToken, saveLink, getTemplate, getEmployee, saveAppraisal } from '@/lib/storage';
import { generateId, calculateScore } from '@/lib/utils';
import { useToast } from '@/contexts/toast-context';
import { RatingSelector } from '@/components/ui/rating-selector';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { AppraisalResponse, Category, CategoryItem } from '@/types';

const responseSchema = z.record(z.union([z.string(), z.number()]));

type ResponseFormData = z.infer<typeof responseSchema>;

export function AppraisalFormPage() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [link, setLink] = useState<any>(null);
  const [template, setTemplate] = useState<any>(null);
  const [employee, setEmployee] = useState<any>(null);
  const [appraiser, setAppraiser] = useState<any>(null);
  const [completed, setCompleted] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ResponseFormData>({
    resolver: zodResolver(responseSchema),
  });

  const watchedValues = watch();

  useEffect(() => {
    loadData();
  }, [token]);

  const loadData = async () => {
    if (!token) {
      toast({ title: 'Invalid Link', description: 'This appraisal link is invalid.', variant: 'error' });
      return;
    }

    try {
      const linkData = await getLinkByToken(token);
      if (!linkData) {
        toast({ title: 'Link Not Found', description: 'This appraisal link does not exist.', variant: 'error' });
        return;
      }

      if (linkData.used) {
        setCompleted(true);
        setLoading(false);
        return;
      }

      if (linkData.expiresAt && new Date(linkData.expiresAt) < new Date()) {
        toast({ title: 'Link Expired', description: 'This appraisal link has expired.', variant: 'error' });
        return;
      }

      const [templateData, employeeData, appraiserData] = await Promise.all([
        getTemplate(linkData.templateId),
        getEmployee(linkData.employeeId),
        getEmployee(linkData.appraiserId),
      ]);

      if (!templateData || !employeeData || !appraiserData) {
        toast({ title: 'Error', description: 'Failed to load appraisal data.', variant: 'error' });
        return;
      }

      setLink(linkData);
      setTemplate(templateData);
      setEmployee(employeeData);
      setAppraiser(appraiserData);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load appraisal form.', variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const calculateQuestionScores = () => {
    if (!template) return {};
    
    const scores: Record<string, { weightScore: number; percentageScore: number }> = {};
    
    // Flatten categories and items
    const allItems: Array<{ id: string; categoryName: string; text: string; type: string; weight: number; required: boolean }> = [];
    if (template.categories && template.categories.length > 0) {
      template.categories.forEach((cat: any) => {
        cat.items.forEach((item: any) => {
          allItems.push({
            id: item.id,
            categoryName: cat.categoryName,
            text: item.text,
            type: item.type,
            weight: item.weight,
            required: item.required,
          });
        });
      });
    } else if (template.questions && template.questions.length > 0) {
      // Legacy support
      template.questions.forEach((q: any) => {
        allItems.push({
          id: q.id,
          categoryName: q.categoryName || '',
          text: q.text,
          type: q.type,
          weight: q.weight,
          required: q.required,
        });
      });
    }
    
    allItems.forEach((item) => {
      const response = watchedValues[item.id];
      if (response) {
        if (item.type === 'rating-1-5') {
          const rating = Number(response);
          if (rating >= 1 && rating <= 5) {
            scores[item.id] = {
              weightScore: rating * item.weight,
              percentageScore: (rating * item.weight) / 5,
            };
          }
        } else if (item.type === 'text' || item.type === 'multiple-choice') {
          // For text and multiple-choice, if answered, treat as max rating (5)
          const responseStr = String(response).trim();
          if (responseStr.length > 0) {
            scores[item.id] = {
              weightScore: 5 * item.weight,
              percentageScore: item.weight,
            };
          }
        }
      }
    });
    return scores;
  };

  const calculateTotalScore = () => {
    const scores = calculateQuestionScores();
    const totalWeightScore = Object.values(scores).reduce((sum, s) => sum + s.weightScore, 0);
    const totalPercentage = Object.values(scores).reduce((sum, s) => sum + s.percentageScore, 0);
    return { totalWeightScore, totalPercentage };
  };

  const onSubmit = async (data: ResponseFormData) => {
    if (!link || !template) return;

    setSubmitting(true);
    try {
      // Flatten categories and items
      const allItems: Array<{ id: string; type: string; weight: number }> = [];
      if (template.categories && template.categories.length > 0) {
        template.categories.forEach((cat: any) => {
          cat.items.forEach((item: any) => {
            allItems.push({
              id: item.id,
              type: item.type,
              weight: item.weight,
            });
          });
        });
      } else if (template.questions && template.questions.length > 0) {
        // Legacy support
        template.questions.forEach((q: any) => {
          allItems.push({
            id: q.id,
            type: q.type,
            weight: q.weight,
          });
        });
      }
      
      const responses: AppraisalResponse[] = allItems.map((item) => ({
        questionId: item.id,
        value: data[item.id] || '',
      }));

      const { score, maxScore } = calculateScore(responses, allItems);

      // Get period from link or create default
      const periodId = (link as any).reviewPeriodId || 'default';
      const periodName = (link as any).reviewPeriodName || 'Initial Period';

      const appraisal = {
        id: generateId(),
        templateId: template.id,
        employeeId: link.employeeId,
        appraiserId: link.appraiserId,
        reviewPeriodId: periodId,
        reviewPeriodName: periodName,
        responses,
        score,
        maxScore,
        completedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      await saveAppraisal(appraisal);
      await saveLink({ ...link, used: true });

      setCompleted(true);
      toast({ title: 'Success', description: 'Appraisal submitted successfully!', variant: 'success' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to submit appraisal.', variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">Loading appraisal form...</p>
        </div>
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
            <p className="text-muted-foreground text-center">
              Your appraisal has been submitted successfully.
            </p>
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
            <p className="text-muted-foreground text-center">
              Unable to load appraisal form. Please contact your administrator.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Organize categories and items for hierarchical display
  const categories: Array<{
    id: string;
    categoryName: string;
    items: Array<CategoryItem & { mainCategoryName: string }>;
  }> = [];
  
  if (template.categories && template.categories.length > 0) {
    template.categories.forEach((cat: Category) => {
      categories.push({
        id: cat.id,
        categoryName: cat.categoryName,
        items: cat.items.map((item: CategoryItem) => ({
          ...item,
          mainCategoryName: cat.categoryName,
        })),
      });
    });
  } else if (template.questions && template.questions.length > 0) {
    // Legacy support - group by category
    const categoryMap = new Map<string, Array<CategoryItem & { mainCategoryName: string }>>();
    template.questions.forEach((q: any) => {
      const catName = q.categoryName || 'General';
      if (!categoryMap.has(catName)) {
        categoryMap.set(catName, []);
      }
      categoryMap.get(catName)!.push({
        ...q,
        mainCategoryName: catName,
      });
    });
    categoryMap.forEach((items, catName) => {
      categories.push({
        id: generateId(),
        categoryName: catName,
        items,
      });
    });
  }
  
  const scores = calculateQuestionScores();
  const { totalWeightScore, totalPercentage } = calculateTotalScore();
  
  // Calculate max possible score
  let maxPossibleScore = 0;
  categories.forEach(cat => {
    cat.items.forEach(item => {
      if (item.type === 'rating-1-5') {
        maxPossibleScore += item.weight * 5;
      } else {
        maxPossibleScore += item.weight * 5; // Treat text/multiple-choice as max if answered
      }
    });
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        {/* Header */}
        <div className="mb-6 lg:mb-8 text-center space-y-2">
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-foreground/70 bg-clip-text text-transparent myanmar-text">
            {template.name}
          </h1>
          {template.subtitle && (
            <p className="text-muted-foreground myanmar-text text-base lg:text-lg">
              {template.subtitle}
            </p>
          )}
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <span>Appraising:</span>
            <span className="font-semibold text-foreground">{employee.name}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          {/* Desktop Table View */}
          <div className="hidden lg:block">
            <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
              <CardContent className="p-0">
                <div className="relative">
                  {/* Rating Scale Indicator */}
                  <div className="sticky top-0 z-10 bg-gradient-to-r from-muted/95 via-muted/98 to-muted/95 backdrop-blur-md border-b-2 border-border/50 px-4 py-2.5">
                    <div className="flex items-center justify-center gap-1 text-xs font-medium text-muted-foreground">
                      <span className="text-red-500 dark:text-red-400">1 (Lowest)</span>
                      <span className="mx-2">→</span>
                      <span className="text-amber-500 dark:text-amber-400">2</span>
                      <span className="mx-2">→</span>
                      <span className="text-green-500 dark:text-green-400">3</span>
                      <span className="mx-2">→</span>
                      <span className="text-blue-500 dark:text-blue-400">4</span>
                      <span className="mx-2">→</span>
                      <span className="text-purple-500 dark:text-purple-400 font-bold">5 (Highest)</span>
                    </div>
                  </div>
                  
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gradient-to-r from-muted/80 via-muted/60 to-muted/80 border-b-2 border-border/50">
                        <th className="px-3 py-2.5 text-left font-bold text-xs uppercase tracking-wider text-muted-foreground w-12">No.</th>
                        <th className="px-4 py-2.5 text-left font-bold text-xs uppercase tracking-wider text-muted-foreground min-w-[420px]">Description</th>
                        <th className="px-3 py-2.5 text-center font-bold text-xs uppercase tracking-wider text-muted-foreground w-20">Weight</th>
                        <th className="px-4 py-2.5 text-center font-bold text-xs uppercase tracking-wider text-muted-foreground" colSpan={5}>Rating (1-5)</th>
                        <th className="px-3 py-2.5 text-center font-bold text-xs uppercase tracking-wider text-muted-foreground w-24">Score</th>
                        <th className="px-3 py-2.5 text-center font-bold text-xs uppercase tracking-wider text-muted-foreground w-28">% Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categories.map((category, catIndex) => {
                        let itemCounter = 0;
                        return (
                          <React.Fragment key={category.id}>
                            {/* Category Header Row */}
                            <tr className="bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border-b-2 border-primary/20">
                              <td colSpan={9} className="px-4 py-3">
                                <div className="font-bold text-sm lg:text-base myanmar-text text-foreground flex items-center gap-2">
                                  <div className="w-1 h-5 bg-gradient-to-b from-primary to-primary/60 rounded-full"></div>
                                  {category.categoryName}
                                </div>
                              </td>
                            </tr>
                            {/* Category Items */}
                            {category.items.map((item, itemIndex) => {
                              itemCounter++;
                              const globalIndex = categories.slice(0, catIndex).reduce((sum, cat) => sum + cat.items.length, 0) + itemIndex;
                              const currentValue = watchedValues[item.id];
                              const questionScores = scores[item.id] || { weightScore: 0, percentageScore: 0 };
                              const isEven = globalIndex % 2 === 0;
                              
                              return (
                                <tr 
                                  key={item.id} 
                                  className={`border-b border-border/30 transition-all duration-200 ${
                                    isEven ? 'bg-background' : 'bg-muted/20'
                                  } hover:bg-muted/40 hover:shadow-sm`}
                                >
                                  <td className="px-3 py-3 text-center text-sm font-medium text-muted-foreground">
                                    {globalIndex + 1}
                                  </td>
                                  <td className="px-4 py-3 myanmar-text leading-relaxed">
                                    {item.categoryName && (
                                      <div className="text-xs font-semibold text-primary/80 mb-1.5 pl-2.5 border-l-2 border-primary/40">
                                        {item.categoryName}
                                      </div>
                                    )}
                                    <div className={`text-sm whitespace-pre-line ${item.categoryName ? 'pl-2.5' : ''}`}>
                                      {item.text}
                                    </div>
                                  </td>
                                  <td className="px-3 py-3 text-center">
                                    <span className="text-sm font-semibold text-muted-foreground">{item.weight}%</span>
                                  </td>
                                  <td className="px-2 py-3" colSpan={5}>
                                    {item.type === 'rating-1-5' ? (
                                      <div className="flex justify-center gap-1">
                                        {[1, 2, 3, 4, 5].map((rating) => {
                                          const isSelected = Number(currentValue) === rating;
                                          return (
                                            <label 
                                              key={rating} 
                                              className={`flex flex-col items-center justify-center cursor-pointer transition-all duration-200 rounded-md border min-w-[40px] h-[48px] ${
                                                isSelected 
                                                  ? 'bg-primary text-primary-foreground border-primary shadow-md scale-105 ring-1 ring-primary/20' 
                                                  : 'bg-background border-border text-muted-foreground hover:bg-muted hover:border-border/80 hover:text-foreground'
                                              }`}
                                            >
                                              <input
                                                type="radio"
                                                {...register(item.id)}
                                                value={rating}
                                                checked={isSelected}
                                                onChange={() => setValue(item.id, rating)}
                                                className="sr-only"
                                                required={item.required}
                                              />
                                              <span className={`text-base font-semibold ${isSelected ? 'text-primary-foreground' : ''}`}>
                                                {rating}
                                              </span>
                                            </label>
                                          );
                                        })}
                                      </div>
                                    ) : item.type === 'text' ? (
                                      <Textarea
                                        {...register(item.id)}
                                        placeholder="Enter your feedback..."
                                        className="min-h-[70px] myanmar-text text-sm"
                                        required={item.required}
                                      />
                                    ) : item.type === 'multiple-choice' ? (
                                      <Select
                                        {...register(item.id)}
                                        className="w-full text-sm"
                                        required={item.required}
                                      >
                                        <option value="">Select an option...</option>
                                        {item.options?.map((option, optIndex) => (
                                          <option key={optIndex} value={option}>
                                            {option}
                                          </option>
                                        ))}
                                      </Select>
                                    ) : null}
                                  </td>
                                  <td className="px-3 py-3 text-center">
                                    <span className={`text-sm font-semibold ${
                                      questionScores.weightScore > 0 ? 'text-foreground' : 'text-muted-foreground/50'
                                    }`}>
                                      {questionScores.weightScore > 0 ? questionScores.weightScore.toFixed(2) : '—'}
                                    </span>
                                  </td>
                                  <td className="px-3 py-3 text-center">
                                    <span className={`text-sm font-semibold ${
                                      questionScores.percentageScore > 0 ? 'text-foreground' : 'text-muted-foreground/50'
                                    }`}>
                                      {questionScores.percentageScore > 0 ? `${questionScores.percentageScore.toFixed(2)}%` : '—'}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}
                      {/* Total Row */}
                      <tr className="bg-gradient-to-r from-primary/15 via-primary/10 to-primary/15 border-t-2 border-primary/30">
                        <td colSpan={8} className="px-4 py-4 text-right">
                          <span className="text-base font-bold text-foreground">Total Score:</span>
                        </td>
                        <td className="px-3 py-4 text-center">
                          <span className="text-base font-bold text-foreground">{totalWeightScore.toFixed(2)}</span>
                        </td>
                        <td className="px-3 py-4 text-center">
                          <span className="text-base font-bold text-primary">{totalPercentage.toFixed(2)}%</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Mobile/Tablet Card View */}
          <div className="lg:hidden space-y-4">
            {/* Rating Scale Indicator */}
            <Card className="bg-gradient-to-r from-muted/95 via-muted/98 to-muted/95 border-2 border-border/50">
              <CardContent className="p-3">
                <div className="flex items-center justify-center gap-1 text-xs font-medium text-muted-foreground">
                  <span className="text-red-500 dark:text-red-400">1 (Lowest)</span>
                  <span className="mx-1">→</span>
                  <span className="text-amber-500 dark:text-amber-400">2</span>
                  <span className="mx-1">→</span>
                  <span className="text-green-500 dark:text-green-400">3</span>
                  <span className="mx-1">→</span>
                  <span className="text-blue-500 dark:text-blue-400">4</span>
                  <span className="mx-1">→</span>
                  <span className="text-purple-500 dark:text-purple-400 font-bold">5 (Highest)</span>
                </div>
              </CardContent>
            </Card>

            {categories.map((category, catIndex) => {
              let itemCounter = 0;
              return (
                <div key={category.id} className="space-y-3">
                  {/* Category Header */}
                  <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border-2 border-primary/20">
                    <CardContent className="p-3">
                      <div className="font-bold text-sm myanmar-text text-foreground flex items-center gap-2">
                        <div className="w-1 h-4 bg-gradient-to-b from-primary to-primary/60 rounded-full"></div>
                        {category.categoryName}
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* Category Items */}
                  {category.items.map((item, itemIndex) => {
                    itemCounter++;
                    const globalIndex = categories.slice(0, catIndex).reduce((sum, cat) => sum + cat.items.length, 0) + itemIndex;
                    const currentValue = watchedValues[item.id];
                    const questionScores = scores[item.id] || { weightScore: 0, percentageScore: 0 };
                    
                    return (
                      <Card key={item.id} className={`border border-border/30 ${item.categoryName ? 'ml-3 border-l-2 border-primary/40' : ''}`}>
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-muted-foreground mb-1">Item #{globalIndex + 1}</div>
                              {item.categoryName && (
                                <div className="text-xs font-semibold myanmar-text text-primary/80 mb-1.5">
                                  {item.categoryName}
                                </div>
                              )}
                            </div>
                            <div className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
                              {item.weight}%
                            </div>
                          </div>
                          
                          <div className="myanmar-text text-sm leading-relaxed">
                            <div className="whitespace-pre-line">{item.text}</div>
                          </div>

                          <div>
                            {item.type === 'rating-1-5' ? (
                              <div className="space-y-2">
                                <div className="text-xs font-medium text-muted-foreground mb-2">Rating (1-5):</div>
                                <RatingSelector
                                  value={currentValue ? Number(currentValue) : undefined}
                                  onChange={(value) => setValue(item.id, value)}
                                  required={item.required}
                                />
                              </div>
                            ) : item.type === 'text' ? (
                              <Textarea
                                {...register(item.id)}
                                placeholder="Enter your feedback..."
                                className="min-h-[90px] myanmar-text text-sm"
                                required={item.required}
                              />
                            ) : item.type === 'multiple-choice' ? (
                              <Select
                                {...register(item.id)}
                                className="w-full text-sm"
                                required={item.required}
                              >
                                <option value="">Select an option...</option>
                                {item.options?.map((option, optIndex) => (
                                  <option key={optIndex} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </Select>
                            ) : null}
                          </div>

                          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border/30">
                            <div>
                              <div className="text-xs text-muted-foreground mb-1">Weight Score</div>
                              <div className={`text-sm font-semibold ${
                                questionScores.weightScore > 0 ? 'text-foreground' : 'text-muted-foreground/50'
                              }`}>
                                {questionScores.weightScore > 0 ? questionScores.weightScore.toFixed(2) : '—'}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground mb-1">% Score</div>
                              <div className={`text-sm font-semibold ${
                                questionScores.percentageScore > 0 ? 'text-foreground' : 'text-muted-foreground/50'
                              }`}>
                                {questionScores.percentageScore > 0 ? `${questionScores.percentageScore.toFixed(2)}%` : '—'}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              );
            })}

            {/* Total Score Card */}
            <Card className="bg-gradient-to-r from-primary/15 via-primary/10 to-primary/15 border-2 border-primary/30">
              <CardContent className="p-4">
                <div className="flex justify-between items-center">
                  <span className="text-base font-bold text-foreground">Total Score:</span>
                  <div className="text-right">
                    <div className="text-lg font-bold text-foreground">{totalWeightScore.toFixed(2)}</div>
                    <div className="text-sm font-semibold text-primary">{totalPercentage.toFixed(2)}%</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Submit Button */}
          <div className="mt-6 lg:mt-8 flex justify-end">
            <Button 
              type="submit" 
              size="lg" 
              disabled={submitting}
              className="min-w-[160px] shadow-lg hover:shadow-xl transition-all duration-300"
            >
              {submitting ? 'Submitting...' : 'Submit Appraisal'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
