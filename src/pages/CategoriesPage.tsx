import React, { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, Tag, Tags } from 'lucide-react';
import { toast } from 'sonner';
import {
  useCustomCategories,
  useCreateCustomCategory,
  useUpdateCustomCategory,
  useDeleteCustomCategory,
  useCustomTags,
  useCreateCustomTag,
  useUpdateCustomTag,
  useDeleteCustomTag,
  CustomCategory,
  CustomTag,
} from '@/hooks/useCustomCategoriesAndTags';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from '@/components/ConfirmDialog';

const CATEGORY_TYPES = [
  { value: 'expense', label: 'Saídas' },
  { value: 'debt', label: 'Dívidas' },
  { value: 'income', label: 'Entradas' },
];

const COLOR_OPTIONS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#6366f1', // indigo
  '#14b8a6', // teal
];

export default function CategoriesPage() {
  const [categoryType, setCategoryType] = useState<'expense' | 'debt' | 'income'>('expense');
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [isAddTagOpen, setIsAddTagOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CustomCategory | null>(null);
  const [editingTag, setEditingTag] = useState<CustomTag | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(COLOR_OPTIONS[5]); // blue por padrão
  const [deleteCategoryId, setDeleteCategoryId] = useState<string | null>(null);
  const [deleteTagId, setDeleteTagId] = useState<string | null>(null);
  const [isDeleteCategoryOpen, setIsDeleteCategoryOpen] = useState(false);
  const [isDeleteTagOpen, setIsDeleteTagOpen] = useState(false);

  const { data: categories = [], isLoading: categoriesLoading } = useCustomCategories(categoryType);
  const { data: tags = [], isLoading: tagsLoading } = useCustomTags();
  const createCategory = useCreateCustomCategory();
  const updateCategory = useUpdateCustomCategory();
  const deleteCategory = useDeleteCustomCategory();
  const createTag = useCreateCustomTag();
  const updateTag = useUpdateCustomTag();
  const deleteTag = useDeleteCustomTag();

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error('Nome da categoria obrigatório');
      return;
    }

    try {
      if (editingCategory) {
        await updateCategory.mutateAsync({
          id: editingCategory.id,
          name: newCategoryName.trim(),
        });
        toast.success('Categoria atualizada!');
      } else {
        await createCategory.mutateAsync({
          name: newCategoryName.trim(),
          type: categoryType,
        });
        toast.success('Categoria criada!');
      }
      setNewCategoryName('');
      setEditingCategory(null);
      setIsAddCategoryOpen(false);
    } catch (err) {
      toast.error('Erro ao salvar categoria');
    }
  };

  const handleAddTag = async () => {
    if (!newTagName.trim()) {
      toast.error('Nome da tag obrigatório');
      return;
    }

    try {
      if (editingTag) {
        await updateTag.mutateAsync({
          id: editingTag.id,
          name: newTagName.trim(),
          color: newTagColor,
        });
        toast.success('Tag atualizada!');
      } else {
        await createTag.mutateAsync({
          name: newTagName.trim(),
          color: newTagColor,
        });
        toast.success('Tag criada!');
      }
      setNewTagName('');
      setNewTagColor(COLOR_OPTIONS[5]);
      setEditingTag(null);
      setIsAddTagOpen(false);
    } catch (err: any) {
      const status = err?.status ?? err?.statusCode;
      const code = err?.code;
      const message = err?.message || '';
      if (status === 409 || code === '23505' || message.toLowerCase().includes('duplicate')) {
        toast.error('Essa tag ja existe');
        return;
      }
      toast.error('Erro ao salvar tag');
    }
  };

  const handleDeleteCategory = async () => {
    if (!deleteCategoryId) return;

    try {
      await deleteCategory.mutateAsync(deleteCategoryId);
      toast.success('Categoria deletada!');
      setIsDeleteCategoryOpen(false);
      setDeleteCategoryId(null);
    } catch (err) {
      toast.error('Erro ao deletar categoria');
    }
  };

  const handleDeleteTag = async () => {
    if (!deleteTagId) return;

    try {
      await deleteTag.mutateAsync(deleteTagId);
      toast.success('Tag deletada!');
      setIsDeleteTagOpen(false);
      setDeleteTagId(null);
    } catch (err) {
      toast.error('Erro ao deletar tag');
    }
  };

  const openEditCategory = (category: CustomCategory) => {
    setEditingCategory(category);
    setNewCategoryName(category.name);
    setIsAddCategoryOpen(true);
  };

  const openEditTag = (tag: CustomTag) => {
    setEditingTag(tag);
    setNewTagName(tag.name);
    setNewTagColor(tag.color);
    setIsAddTagOpen(true);
  };

  const closeDialogs = () => {
    setIsAddCategoryOpen(false);
    setIsAddTagOpen(false);
    setNewCategoryName('');
    setNewTagName('');
    setNewTagColor(COLOR_OPTIONS[5]);
    setEditingCategory(null);
    setEditingTag(null);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Desktop Header */}
        <div className="hidden sm:flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500 flex items-center justify-center flex-shrink-0">
            <Tags className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Categorias e Tags</h1>
            <p className="text-muted-foreground">Gerencie suas categorias personalizadas e tags</p>
          </div>
        </div>
        {/* Mobile Header Box */}
        <div className="sm:hidden flex flex-col items-center gap-3 bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-950 dark:to-cyan-900 rounded-xl p-4 border border-cyan-200 dark:border-cyan-800 shadow-sm w-full">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500 flex items-center justify-center flex-shrink-0">
              <Tags className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Categorias e Tags</h1>
          </div>
          <p className="text-muted-foreground text-center text-sm">Gerencie suas categorias personalizadas e tags</p>
        </div>

        {/* Categories Section */}
        <div className="space-y-4 rounded-2xl border border-border bg-card/60 backdrop-blur-sm p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Categorias</h2>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Select value={categoryType} onValueChange={(value: any) => setCategoryType(value)}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Dialog open={isAddCategoryOpen} onOpenChange={open => {
                if (!open) closeDialogs();
                setIsAddCategoryOpen(open);
              }}>
                <DialogTrigger asChild>
                  <Button className="w-full sm:w-auto gap-2">
                    <Plus className="w-4 h-4" />
                    Nova Categoria
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="mt-2">
                      <Input
                        id="category-name"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder="Ex: Saúde, Educação, etc"
                      />
                    </div>
                    <Button 
                      onClick={handleAddCategory}
                      disabled={createCategory.isPending || updateCategory.isPending}
                      className="w-full"
                    >
                      {editingCategory ? 'Atualizar' : 'Criar'} Categoria
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {categoriesLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : categories.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">Nenhuma categoria personalizada ainda</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {categories.map((category) => (
                <div key={category.id} className="glass-card rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">{category.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {CATEGORY_TYPES.find(t => t.value === category.type)?.label}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditCategory(category)}
                      className="p-2 hover:bg-primary/10 rounded transition-colors"
                      title="Editar categoria"
                    >
                      <Pencil className="w-4 h-4 text-primary" />
                    </button>
                    <button
                      onClick={() => {
                        setDeleteCategoryId(category.id);
                        setIsDeleteCategoryOpen(true);
                      }}
                      className="p-2 hover:bg-destructive/10 rounded transition-colors"
                      title="Deletar categoria"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tags Section */}
        <div className="space-y-4 rounded-2xl border border-primary/20 bg-primary/5 backdrop-blur-sm p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                <Tag className="w-5 h-5" />
                Tags Personalizadas
              </h2>
            </div>
            <Dialog open={isAddTagOpen} onOpenChange={open => {
              if (!open) closeDialogs();
              setIsAddTagOpen(open);
            }}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto gap-2">
                  <Plus className="w-4 h-4" />
                  Nova Tag
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingTag ? 'Editar Tag' : 'Nova Tag'}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="mt-2">
                    <Input
                      id="tag-name"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      placeholder="Ex: Urgente, Importante, etc"
                    />
                  </div>
                  <div>
                    <Label htmlFor="tag-color">Cor</Label>
                    <div className="grid grid-cols-5 gap-2">
                      {COLOR_OPTIONS.map((color) => (
                        <button
                          key={color}
                          onClick={() => setNewTagColor(color)}
                          className={cn(
                            'w-10 h-10 rounded-lg transition-all border-2',
                            newTagColor === color ? 'border-foreground ring-2 ring-offset-2 ring-primary' : 'border-transparent'
                          )}
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ))}
                    </div>
                  </div>
                  <Button 
                    onClick={handleAddTag}
                    disabled={createTag.isPending || updateTag.isPending}
                    className="w-full"
                  >
                    {editingTag ? 'Atualizar' : 'Criar'} Tag
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {tagsLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : tags.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">Nenhuma tag personalizada ainda</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {tags.map((tag) => (
                <div key={tag.id} className="glass-card rounded-lg p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    <p className="font-medium text-foreground">{tag.name}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditTag(tag)}
                      className="p-2 hover:bg-primary/10 rounded transition-colors"
                      title="Editar tag"
                    >
                      <Pencil className="w-4 h-4 text-primary" />
                    </button>
                    <button
                      onClick={() => {
                        setDeleteTagId(tag.id);
                        setIsDeleteTagOpen(true);
                      }}
                      className="p-2 hover:bg-destructive/10 rounded transition-colors"
                      title="Deletar tag"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete Category Confirmation */}
      <ConfirmDialog
        open={isDeleteCategoryOpen}
        onOpenChange={setIsDeleteCategoryOpen}
        title="Deletar Categoria"
        description="Tem certeza que deseja deletar esta categoria? Esta ação não pode ser desfeita."
        actionLabel="Deletar"
        cancelLabel="Cancelar"
        isDangerous
        isLoading={deleteCategory.isPending}
        onConfirm={handleDeleteCategory}
      />

      {/* Delete Tag Confirmation */}
      <ConfirmDialog
        open={isDeleteTagOpen}
        onOpenChange={setIsDeleteTagOpen}
        title="Deletar Tag"
        description="Tem certeza que deseja deletar esta tag? Esta ação não pode ser desfeita."
        actionLabel="Deletar"
        cancelLabel="Cancelar"
        isDangerous
        isLoading={deleteTag.isPending}
        onConfirm={handleDeleteTag}
      />
    </MainLayout>
  );
}
