import { useState } from 'react';
import { useApp } from '@/contexts/app-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Plus, Pencil, Trash, Copy, FileText } from 'phosphor-react';
import { TemplateDialog } from '@/components/templates/template-dialog';
import { APPRAISAL_TYPE_LABELS } from '@/types';
import { deleteTemplate, saveTemplate } from '@/lib/storage';
import { useToast } from '@/contexts/toast-context';
import { formatDate, generateId } from '@/lib/utils';
import type { QuestionType } from '@/types';

export function TemplatesPage() {
  const { templates, refresh } = useApp();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string | null; name: string }>({
    open: false,
    id: null,
    name: '',
  });
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteConfirm({ open: true, id, name });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.id) return;
    
    setDeleting(true);
    try {
      await deleteTemplate(deleteConfirm.id);
      await refresh();
      toast({ title: 'Success', description: 'Template deleted successfully', variant: 'success' });
      setDeleteConfirm({ open: false, id: null, name: '' });
    } catch (error) {
      console.error('Delete error:', error);
      toast({ title: 'Error', description: 'Failed to delete template. Please try again.', variant: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const handleDuplicate = async (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      try {
        // Create a copy with new ID
        const newTemplate: any = {
          ...template,
          id: generateId(),
          name: `${template.name} (Copy)`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1,
        };
        
        // Handle new category structure
        if (template.categories && template.categories.length > 0) {
          newTemplate.categories = template.categories.map((cat) => ({
            ...cat,
            id: generateId(),
            items: cat.items.map((item) => ({
              ...item,
              id: generateId(),
            })),
          }));
        } else if (template.questions && template.questions.length > 0) {
          // Legacy support - convert questions to categories
          const categoryMap = new Map();
          template.questions.forEach((q) => {
            const catName = q.categoryName || 'Category';
            if (!categoryMap.has(catName)) {
              categoryMap.set(catName, {
                id: generateId(),
                categoryName: catName,
                items: [],
                order: categoryMap.size,
              });
            }
            const cat = categoryMap.get(catName);
            // Convert legacy rating-1-10 to rating-1-5, or use the type as-is
            const itemType: QuestionType = ((q.type as string) === 'rating-1-10') 
              ? 'rating-1-5' 
              : (q.type as QuestionType);
            cat.items.push({
              id: generateId(),
              text: q.text,
              type: itemType,
              weight: q.weight,
              required: q.required,
              options: q.options,
              order: cat.items.length,
            });
          });
          newTemplate.categories = Array.from(categoryMap.values());
        }
        
        await saveTemplate(newTemplate);
        await refresh();
        toast({ title: 'Template duplicated', variant: 'success' });
      } catch (error) {
        toast({ title: 'Error', description: 'Failed to duplicate template.', variant: 'error' });
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title text-foreground">Templates</h1>
          <p className="page-subtitle text-muted-foreground">Manage your appraisal templates</p>
        </div>
        <Button type="button" onClick={() => { setEditingTemplate(null); setDialogOpen(true); }}>
          <Plus size={18} weight="duotone" className="mr-2" />
          Create Template
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card className="border-0">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 mb-6">
              <FileText className="h-16 w-16 text-blue-400" weight="duotone" />
            </div>
            <h3 className="text-xl font-bold mb-2">No templates yet</h3>
            <p className="text-muted-foreground/80 text-center mb-6 max-w-md">
              Create your first appraisal template to get started
            </p>
            <Button onClick={() => { setEditingTemplate(null); setDialogOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />
              Create Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => {
            // Calculate total items and weight from categories
            const totalItems = template.categories 
              ? template.categories.reduce((sum, cat) => sum + (cat.items?.length || 0), 0)
              : (template.questions?.length || 0);
            const totalPoints = template.categories
              ? template.categories.reduce((catSum, cat) => 
                  catSum + (cat.items?.reduce((itemSum, item) => itemSum + item.weight, 0) || 0), 0
                )
              : (template.questions?.reduce((sum, q) => sum + q.weight, 0) || 0);
            
            return (
              <Card key={template.id} className="border-0 hover:scale-[1.02] transition-all duration-300 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <CardHeader className="relative z-10">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg myanmar-text font-bold">{template.name}</CardTitle>
                      <CardDescription className="mt-1.5 text-muted-foreground/80">
                        {template.subtitle ? (
                          <span className="myanmar-text">{template.subtitle}</span>
                        ) : (
                          APPRAISAL_TYPE_LABELS[template.type]
                        )}
                      </CardDescription>
                      {template.subtitle && (
                        <p className="text-xs text-muted-foreground/70 mt-1.5">
                          {APPRAISAL_TYPE_LABELS[template.type]}
                        </p>
                      )}
                    </div>
                    <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20">
                      <FileText size={18} weight="duotone" className="text-indigo-400" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="relative z-10">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 rounded-xl glass-subtle">
                        <p className="text-xs text-muted-foreground/80 font-medium mb-1">Items</p>
                        <p className="text-2xl font-bold text-foreground">{totalItems}</p>
                      </div>
                      <div className="p-3 rounded-xl glass-subtle">
                        <p className="text-xs text-muted-foreground/80 font-medium mb-1">Weight</p>
                        <p className="text-2xl font-bold text-foreground">{totalPoints.toFixed(1)}%</p>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground/70 pt-2 border-t border-border/30">
                      Updated {formatDate(template.updatedAt)}
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1 hover:bg-purple-500 hover:text-white hover:border-purple-500 transition-all"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingTemplate(template.id);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil size={16} weight="duotone" className="mr-1.5" />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="hover:bg-blue-500 hover:text-white hover:border-blue-500 transition-all"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicate(template.id);
                        }}
                        title="Duplicate template"
                      >
                        <Copy size={16} weight="duotone" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(template.id, template.name);
                        }}
                        title="Delete template"
                      >
                        <Trash size={16} weight="duotone" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <TemplateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        templateId={editingTemplate}
        onSuccess={refresh}
      />

      <ConfirmDialog
        open={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, id: null, name: '' })}
        onConfirm={handleDeleteConfirm}
        title="Delete Template"
        description={`Are you sure you want to delete "${deleteConfirm.name}"? This action cannot be undone and will remove all associated data.`}
        confirmText="Delete Template"
        cancelText="Cancel"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}
