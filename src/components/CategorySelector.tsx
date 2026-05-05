import React, { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useCustomCategories, useCreateCustomCategory } from '@/hooks/useCustomCategoriesAndTags';
import { toast } from 'sonner';

interface CategorySelectorProps {
  type: 'expense' | 'debt' | 'income';
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  defaultCategories?: Array<{ value: string; label: string }>;
}

export function CategorySelector({
  type,
  value,
  onChange,
  placeholder = 'Selecione uma categoria',
  defaultCategories = [],
}: CategorySelectorProps) {
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const { data: customCategories = [] } = useCustomCategories(type);
  const createCategory = useCreateCustomCategory();

  const handleCreateNew = async () => {
    if (!newCategoryName.trim()) {
      toast.error('Nome da categoria obrigatório');
      return;
    }

    try {
      const result = await createCategory.mutateAsync({
        name: newCategoryName.trim(),
        type,
      });
      onChange(`custom:${result.id}`);
      setNewCategoryName('');
      setIsCreatingNew(false);
      toast.success('Categoria criada!');
    } catch (err) {
      toast.error('Erro ao criar categoria');
    }
  };

  const allCategories = [
    ...defaultCategories,
    ...customCategories.map(cat => ({ value: `custom:${cat.id}`, label: cat.name })),
  ];

  if (isCreatingNew) {
    return (
      <div className="flex gap-2">
        <Input
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
          placeholder="Nova categoria..."
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleCreateNew();
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              setIsCreatingNew(false);
              setNewCategoryName('');
            }
          }}
          autoFocus
        />
        <Button
          type="button"
          onClick={handleCreateNew}
          disabled={createCategory.isPending}
          size="sm"
        >
          Criar
        </Button>
        <Button
          type="button"
          onClick={() => {
            setIsCreatingNew(false);
            setNewCategoryName('');
          }}
          variant="outline"
          size="sm"
        >
          Cancelar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {allCategories.map((category) => (
            <SelectItem key={category.value} value={category.value}>
              {category.label}
            </SelectItem>
          ))}
          <div className="px-2 py-1.5 border-t">
            <Button
              type="button"
              onClick={() => setIsCreatingNew(true)}
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-primary hover:bg-primary/10"
            >
              <Plus className="w-4 h-4" />
              Nova Categoria
            </Button>
          </div>
        </SelectContent>
      </Select>
    </div>
  );
}
