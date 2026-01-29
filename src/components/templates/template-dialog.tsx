import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useForm, useFieldArray, Control, UseFormRegister, FieldErrors, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { X, Plus, Trash, CaretDown, CaretRight } from 'phosphor-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { RichTextarea } from '@/components/ui/rich-textarea';
import { Card } from '@/components/ui/card';
import { useApp } from '@/contexts/app-context';
import { getTemplate, saveTemplate } from '@/lib/storage';
import { generateId } from '@/lib/utils';
import type { Template, Category, QuestionType } from '@/types';
import { APPRAISAL_TYPE_LABELS } from '@/types';
import { useToast } from '@/contexts/toast-context';

interface CategoryEditorProps {
  categoryIndex: number;
  categoryField: { id: string };
  category: Category;
  isExpanded: boolean;
  onToggle: () => void;
  onRemove: () => void;
  control: Control<any>;
  register: UseFormRegister<any>;
  errors: FieldErrors<any>;
  setValue: any;
}

function CategoryEditor({
  categoryIndex,
  isExpanded,
  onToggle,
  onRemove,
  control,
  register,
  errors,
  setValue,
}: CategoryEditorProps) {
  const { fields: itemFields, append: appendItem, remove: removeItem } = useFieldArray({
    control,
    name: `categories.${categoryIndex}.items`,
  });
  
  const watchItemTypes = useWatch({
    control,
    name: `categories.${categoryIndex}.items`,
  });

  return (
    <Card className="border border-border/50">
      <div className="p-3 space-y-3">
        {/* Category Header */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggle}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {isExpanded ? (
              <CaretDown size={18} weight="duotone" />
            ) : (
              <CaretRight size={18} weight="duotone" />
            )}
          </button>
          <Input
            {...register(`categories.${categoryIndex}.categoryName`)}
            placeholder="Category name"
            className="myanmar-text font-medium h-9 flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="h-9 w-9 p-0"
            title="Delete category"
          >
            <Trash size={16} weight="duotone" />
          </Button>
        </div>
        {(errors as any).categories?.[categoryIndex]?.categoryName && (
          <p className="text-xs text-destructive ml-7">
            {(errors as any).categories?.[categoryIndex]?.categoryName?.message || ''}
          </p>
        )}

        {/* Category Items */}
        {isExpanded && (
          <div className="ml-7 space-y-2">
            {itemFields.map((itemField, itemIndex) => {
              const itemType = watchItemTypes?.[itemIndex]?.type || 'rating-1-5';
              const currentOptions = watchItemTypes?.[itemIndex]?.options || [];
              const optionsString = currentOptions.join(', ');
              
              return (
                <div key={itemField.id} className="p-3 bg-muted/30 rounded-md border border-border/30 space-y-2.5">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Sub-Category Name (Optional)</Label>
                    <Input
                      {...register(`categories.${categoryIndex}.items.${itemIndex}.categoryName`)}
                      placeholder="Enter sub-category name"
                      className="myanmar-text h-9 text-sm"
                    />
                  </div>

                  <div className="grid gap-2.5 md:grid-cols-[1fr_1.5fr_auto]">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Weight (%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0.1"
                        max="100"
                        {...register(`categories.${categoryIndex}.items.${itemIndex}.weight`, { valueAsNumber: true })}
                        placeholder="5"
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Type</Label>
                      <Select {...register(`categories.${categoryIndex}.items.${itemIndex}.type`)} className="h-[2.75rem] text-sm w-full py-2.5 min-h-[2.75rem]">
                        <option value="rating-1-5">Rating 1-5</option>
                        <option value="text">Text Feedback</option>
                        <option value="multiple-choice">Multiple Choice</option>
                      </Select>
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-2 cursor-pointer text-xs whitespace-nowrap">
                        <input
                          type="checkbox"
                          {...register(`categories.${categoryIndex}.items.${itemIndex}.required`)}
                          className="rounded w-4 h-4 flex-shrink-0"
                        />
                        <span>Required</span>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Description</Label>
                    <RichTextarea
                      value={watchItemTypes?.[itemIndex]?.text || ''}
                      placeholder="Enter description... Select lines and click bullet icon to add bullets"
                      className="myanmar-text text-sm"
                      rows={6}
                      onValueChange={(value) => {
                        setValue(`categories.${categoryIndex}.items.${itemIndex}.text`, value, { shouldValidate: true });
                      }}
                    />
                    {(errors as any).categories?.[categoryIndex]?.items?.[itemIndex]?.text && (
                      <p className="text-xs text-destructive">
                        {(errors as any).categories?.[categoryIndex]?.items?.[itemIndex]?.text?.message || ''}
                      </p>
                    )}
                  </div>

                  {itemType === 'multiple-choice' && (
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Options (comma-separated)</Label>
                      <Input
                        {...register(`categories.${categoryIndex}.items.${itemIndex}.optionsString`)}
                        placeholder="Option 1, Option 2, Option 3"
                        className="h-9 text-sm"
                        onChange={(e) => {
                          const options = e.target.value.split(',').map(opt => opt.trim()).filter(opt => opt.length > 0);
                          setValue(`categories.${categoryIndex}.items.${itemIndex}.options`, options);
                        }}
                        defaultValue={optionsString}
                      />
                      <p className="text-xs text-muted-foreground">Separate options with commas</p>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(itemIndex)}
                      className="h-8 text-xs"
                      title="Delete item"
                    >
                      <Trash size={14} weight="duotone" className="mr-1" />
                      Remove
                    </Button>
                  </div>
                </div>
              );
            })}

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => appendItem({
                id: generateId(),
                categoryName: '',
                text: '',
                type: 'rating-1-5',
                weight: 5,
                required: true,
                options: [],
                order: itemFields.length,
              })}
              className="h-8 text-xs w-full"
            >
              <Plus size={14} weight="duotone" className="mr-1.5" />
              Add Item
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

const itemSchema = z.object({
  id: z.string(),
  categoryName: z.string().optional(), // Sub-category name
  text: z.string().min(1, 'Description is required'),
  type: z.enum(['rating-1-5', 'text', 'multiple-choice']),
  weight: z.number().min(0.1, 'Weight must be at least 0.1%').max(100, 'Weight cannot exceed 100%'),
  required: z.boolean(),
  options: z.array(z.string()).optional(),
  order: z.number(),
});

const categorySchema = z.object({
  id: z.string(),
  categoryName: z.string().min(1, 'Category name is required'),
  items: z.array(itemSchema).min(1, 'At least one item is required'),
  order: z.number(),
});

const templateSchema = z.object({
  name: z.string().min(1, 'Template name is required'),
  subtitle: z.string().optional(),
  type: z.enum(['executives-to-leaders', 'leaders-to-members', 'members-to-leaders', 'leaders-to-leaders', 'members-to-members', 'hr-to-all']),
  categories: z.array(categorySchema).min(1, 'At least one category is required'),
}).refine(
  (data) => {
    const totalWeight = data.categories.reduce((catSum, cat) => 
      catSum + cat.items.reduce((itemSum, item) => itemSum + item.weight, 0), 0
    );
    return Math.abs(totalWeight - 100) < 0.01;
  },
  {
    message: 'Total weight must equal 100%',
    path: ['categories'],
  }
);

type TemplateFormData = z.infer<typeof templateSchema>;

interface TemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string | null;
  onSuccess: () => void;
}

export function TemplateDialog({ open, onOpenChange, templateId, onSuccess }: TemplateDialogProps) {
  const { refresh } = useApp();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: '',
      subtitle: '',
      type: 'leaders-to-members',
      categories: [{
        id: generateId(),
        categoryName: '',
        items: [{
          id: generateId(),
          text: '',
          type: 'rating-1-5',
          weight: 5,
          required: true,
          order: 0,
        }],
        order: 0,
      }],
    },
  });

  const { fields: categoryFields, append: appendCategory, remove: removeCategory } = useFieldArray({
    control,
    name: 'categories',
  });

  const categories = watch('categories');
  const totalWeight = categories.reduce((catSum, cat) => 
    catSum + cat.items.reduce((itemSum, item) => itemSum + item.weight, 0), 0
  );
  const isWeightValid = Math.abs(totalWeight - 100) < 0.01;

  useEffect(() => {
    if (open && templateId) {
      loadTemplate();
    } else if (open && !templateId) {
      reset({
        name: '',
        subtitle: '',
        type: 'leaders-to-members',
        categories: [{
          id: generateId(),
          categoryName: '',
          items: [{
            id: generateId(),
            categoryName: '',
            text: '',
            type: 'rating-1-5',
            weight: 5,
            required: true,
            options: [],
            order: 0,
          }],
          order: 0,
        }],
      });
      setExpandedCategories(new Set());
    }
  }, [open, templateId]);

  const loadTemplate = async () => {
    if (!templateId) return;
    try {
      const template = await getTemplate(templateId);
      if (template) {
        let categoriesData: Category[] = [];
        if (template.categories && template.categories.length > 0) {
          categoriesData = template.categories;
        } else if (template.questions && template.questions.length > 0) {
          const categoryMap = new Map<string, Category>();
          template.questions.forEach((q) => {
            const catName = q.categoryName || 'Category';
            const catKey = catName;
            if (!categoryMap.has(catKey)) {
              categoryMap.set(catKey, {
                id: generateId(),
                categoryName: catName,
                items: [],
                order: categoryMap.size,
              });
            }
            const cat = categoryMap.get(catKey)!;
            cat.items.push({
              id: q.id,
              categoryName: '',
              text: q.text,
              type: ((q.type as string) === 'rating-1-10' ? 'rating-1-5' : q.type) as QuestionType,
              weight: q.weight,
              required: q.required,
              options: q.options || [],
              order: cat.items.length,
            });
          });
          categoriesData = Array.from(categoryMap.values());
        }
        
        if (categoriesData.length === 0) {
          categoriesData = [{
            id: generateId(),
            categoryName: '',
            items: [{
              id: generateId(),
              categoryName: '',
              text: '',
              type: 'rating-1-5',
              weight: 5,
              required: true,
              options: [],
              order: 0,
            }],
            order: 0,
          }];
        }

        reset({
          name: template.name,
          subtitle: template.subtitle || '',
          type: template.type,
          categories: categoriesData.sort((a, b) => a.order - b.order),
        });
        setExpandedCategories(new Set(categoriesData.map(c => c.id)));
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load template.', variant: 'error' });
    }
  };

  const onSubmit = async (data: TemplateFormData) => {
    setLoading(true);
    try {
      const existingTemplate = templateId ? await getTemplate(templateId) : null;
      const template: Template = {
        id: templateId || generateId(),
        name: data.name,
        subtitle: data.subtitle || undefined,
        type: data.type,
        categories: data.categories.map((cat, catIndex) => ({
          ...cat,
          order: catIndex,
          items: cat.items.map((item, itemIndex) => ({
            ...item,
            order: itemIndex,
          })),
        })),
        createdAt: existingTemplate?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: existingTemplate ? existingTemplate.version + 1 : 1,
      };

      await saveTemplate(template);
      await refresh();
      onSuccess();
      onOpenChange(false);
      toast({ title: 'Success', description: 'Template saved successfully.', variant: 'success' });
    } catch (error) {
      console.error('Template save error:', error);
      toast({ title: 'Error', description: 'Failed to save template.', variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const distributeWeightsEqually = () => {
    const allItems: Array<{ categoryIndex: number; itemIndex: number }> = [];
    categories.forEach((cat, catIndex) => {
      cat.items.forEach((_item, itemIndex) => {
        allItems.push({ categoryIndex: catIndex, itemIndex: itemIndex });
      });
    });

    if (allItems.length === 0) {
      toast({ title: 'Error', description: 'No items to distribute weights.', variant: 'error' });
      return;
    }

    const weightPerItem = 100 / allItems.length;
    allItems.forEach(({ categoryIndex, itemIndex }) => {
      setValue(
        `categories.${categoryIndex}.items.${itemIndex}.weight`,
        parseFloat(weightPerItem.toFixed(2)),
        { shouldValidate: true, shouldDirty: true }
      );
    });

    toast({ 
      title: 'Success', 
      description: `Weights distributed equally: ${weightPerItem.toFixed(2)}% per item.`, 
      variant: 'success' 
    });
  };

  const addCategory = () => {
    appendCategory({
      id: generateId(),
      categoryName: '',
      items: [{
        id: generateId(),
        categoryName: '',
        text: '',
        type: 'rating-1-5',
        weight: 5,
        required: true,
        options: [],
        order: 0,
      }],
      order: categoryFields.length,
    });
  };

  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background rounded-lg border shadow-lg w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
          <h2 className="text-xl font-bold">
            {templateId ? 'Edit Template' : 'Create Template'}
          </h2>
          <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            <X size={18} weight="duotone" />
          </Button>
        </div>

        <form onSubmit={handleSubmit(onSubmit, (errors) => {
          console.log('Form validation errors:', errors);
          const errorMessages: string[] = [];
          if (errors.name) errorMessages.push(`Template name: ${errors.name.message}`);
          if (errors.type) errorMessages.push(`Appraisal type: ${errors.type.message}`);
          if (errors.categories) {
            if (typeof errors.categories === 'object' && 'message' in errors.categories) {
              errorMessages.push(`Categories: ${errors.categories.message}`);
            }
            // Check individual category/item errors
            if (Array.isArray(errors.categories)) {
              errors.categories.forEach((catError, catIndex) => {
                if (catError?.categoryName) {
                  errorMessages.push(`Category ${catIndex + 1} name: ${catError.categoryName.message}`);
                }
                if (catError?.items && Array.isArray(catError.items)) {
                  catError.items.forEach((itemError: any, itemIndex: number) => {
                    if (itemError?.text) {
                      errorMessages.push(`Category ${catIndex + 1}, Item ${itemIndex + 1} description: ${itemError.text.message || ''}`);
                    }
                    if (itemError?.weight) {
                      errorMessages.push(`Category ${catIndex + 1}, Item ${itemIndex + 1} weight: ${itemError.weight.message || ''}`);
                    }
                  });
                }
              });
            }
          }
          if (errorMessages.length > 0) {
            toast({ 
              title: 'Validation Errors', 
              description: errorMessages.join('. '), 
              variant: 'error' 
            });
          }
        })} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto min-h-0">
          <div className="p-6 space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-sm font-medium">Template Name</Label>
                <Input 
                  id="name" 
                  {...register('name')} 
                  placeholder="e.g., Q1 Performance Review" 
                  className="myanmar-text h-10"
                />
                {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="subtitle" className="text-sm font-medium">Template Subtitle</Label>
                <Input 
                  id="subtitle" 
                  {...register('subtitle')} 
                  placeholder="e.g., Comprehensive evaluation" 
                  className="myanmar-text h-10"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="type" className="text-sm font-medium">Appraisal Type</Label>
              <Select id="type" {...register('type')} className="h-[2.75rem] min-h-[2.75rem]">
                {Object.entries(APPRAISAL_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
              {watch('type') === 'members-to-members' && (
                <p className="text-xs text-muted-foreground mt-1">Used for peer review: members of the same department rate each other only.</p>
              )}
              {errors.type && <p className="text-xs text-destructive mt-1">{errors.type.message}</p>}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Categories</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={distributeWeightsEqually}
                    className="h-7 text-xs"
                    title="Distribute weights equally to 100%"
                  >
                    Auto-Distribute Weights
                  </Button>
                  <div className={`text-xs font-semibold px-2 py-1 rounded ${isWeightValid ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30' : 'text-destructive bg-destructive/10'}`}>
                    {totalWeight.toFixed(1)}% {isWeightValid ? '✓' : '(Need 100%)'}
                  </div>
                </div>
              </div>
              {errors.categories && typeof errors.categories === 'object' && 'message' in errors.categories && (
                <p className="text-xs text-destructive">{errors.categories.message as string}</p>
              )}
              {Object.keys(errors).length > 0 && (
                <div className="text-xs text-destructive space-y-1">
                  {errors.name && <p>• {errors.name.message}</p>}
                  {errors.type && <p>• {errors.type.message}</p>}
                  {categories.map((cat, catIndex) => {
                    const catErrors = errors.categories?.[catIndex];
                    if (catErrors?.categoryName) {
                      return <p key={catIndex}>• Category {catIndex + 1}: {catErrors.categoryName.message}</p>;
                    }
                    if (catErrors?.items) {
                      return cat.items.map((item, itemIndex) => {
                        const itemErrors = (catErrors.items as any)?.[itemIndex];
                        if (itemErrors?.text) {
                          return <p key={`${catIndex}-${itemIndex}`}>• Category {catIndex + 1}, Item {itemIndex + 1}: {itemErrors.text.message || ''}</p>;
                        }
                        return null;
                      });
                    }
                    return null;
                  })}
                </div>
              )}

              <div className="space-y-2">
                {categoryFields.map((categoryField, categoryIndex) => {
                  const category = categories[categoryIndex];
                  const isExpanded = expandedCategories.has(categoryField.id);
                  
                  return (
                    <CategoryEditor
                      key={categoryField.id}
                      categoryIndex={categoryIndex}
                      categoryField={categoryField}
                      category={category}
                      isExpanded={isExpanded}
                      onToggle={() => toggleCategory(categoryField.id)}
                      onRemove={() => removeCategory(categoryIndex)}
                      control={control}
                      register={register}
                      errors={errors}
                      setValue={setValue}
                    />
                  );
                })}
              </div>

              <Button type="button" variant="secondary" onClick={addCategory} className="w-full h-10">
                <Plus size={18} weight="duotone" className="mr-2" />
                Add Category
              </Button>
            </div>
          </div>
          </div>

          <div className="flex justify-end gap-3 px-6 py-4 border-t bg-muted/30 flex-shrink-0">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="h-9">
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading || !isWeightValid} 
              className="h-9"
              onClick={(e) => {
                if (!isWeightValid) {
                  e.preventDefault();
                  toast({ 
                    title: 'Validation Error', 
                    description: `Total weight is ${totalWeight.toFixed(1)}%. It must equal exactly 100%.`, 
                    variant: 'error' 
                  });
                }
              }}
            >
              {loading ? 'Saving...' : templateId ? 'Update Template' : 'Create Template'}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
