import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, X } from 'lucide-react';
import { useCustomTags, useCreateCustomTag } from '@/hooks/useCustomCategoriesAndTags';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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

interface TagSelectorProps {
  selected?: string[];
  onAddTag?: (tagId: string) => void;
  onRemoveTag?: (tagId: string) => void;
  maxTags?: number;
}

export function TagSelector({
  selected = [],
  onAddTag,
  onRemoveTag,
  maxTags,
}: TagSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(COLOR_OPTIONS[5]); // blue por padrão
  const { data: tags = [] } = useCustomTags();
  const createTag = useCreateCustomTag();

  const handleCreateNew = async () => {
    if (!newTagName.trim()) {
      toast.error('Nome da tag obrigatório');
      return;
    }

    try {
      const result = await createTag.mutateAsync({
        name: newTagName.trim(),
        color: newTagColor,
      });
      onAddTag?.(result.id);
      setNewTagName('');
      setNewTagColor(COLOR_OPTIONS[5]);
      setIsCreatingNew(false);
      setIsOpen(false);
      toast.success('Tag criada!');
    } catch (err: any) {
      const status = err?.status ?? err?.statusCode;
      const code = err?.code;
      const message = err?.message || '';
      if (status === 409 || code === '23505' || message.toLowerCase().includes('duplicate')) {
        toast.error('Essa tag ja existe');
        return;
      }
      toast.error('Erro ao criar tag');
    }
  };

  const selectedTags = tags.filter(t => selected.includes(t.id));
  const availableTags = tags.filter(t => !selected.includes(t.id));
  const canAddMore = !maxTags || selected.length < maxTags;

  if (isCreatingNew) {
    return (
      <div className="space-y-4 p-4">
        <div>
          <Label htmlFor="tag-name">Nome da Tag</Label>
          <Input
            id="tag-name"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            placeholder="Ex: Urgente, Importante"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleCreateNew();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                setIsCreatingNew(false);
                setNewTagName('');
              }
            }}
          />
        </div>
        <div>
          <Label>Cor</Label>
          <div className="grid grid-cols-5 gap-2">
            {COLOR_OPTIONS.map((color) => (
              <button
                key={color}
                type="button"
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
        <div className="flex gap-2">
          <Button
            type="button"
            onClick={handleCreateNew}
            disabled={createTag.isPending}
            size="sm"
            className="flex-1"
          >
            Criar Tag
          </Button>
          <Button
            type="button"
            onClick={() => {
              setIsCreatingNew(false);
              setNewTagName('');
              setNewTagColor(COLOR_OPTIONS[5]);
              setIsOpen(false);
            }}
            variant="outline"
            size="sm"
            className="flex-1"
          >
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Selected Tags */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedTags.map((tag) => (
            <div
              key={tag.id}
              className="flex items-center gap-2 px-2 py-1 rounded-full text-sm text-white"
              style={{ backgroundColor: tag.color }}
            >
              {tag.name}
              <button
                onClick={() => onRemoveTag?.(tag.id)}
                type="button"
                className="hover:opacity-75 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Tag Dialog */}
      {canAddMore && (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              {selectedTags.length > 0 ? 'Adicionar Tag' : 'Adicionar Tags'}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Tag</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {availableTags.length > 0 && (
                <div>
                  <Label className="text-xs uppercase font-semibold text-muted-foreground mb-2 block">
                    Tags Disponíveis
                  </Label>
                  <div className="space-y-2">
                    {availableTags.map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => {
                          onAddTag?.(tag.id);
                          setIsOpen(false);
                        }}
                        className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-secondary transition-colors text-left"
                      >
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="text-sm">{tag.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {availableTags.length === 0 && !isCreatingNew && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma tag disponível</p>
              )}

              <div className="border-t pt-4">
                <Button
                  type="button"
                  onClick={() => setIsCreatingNew(true)}
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Criar Nova Tag
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {maxTags && selectedTags.length >= maxTags && (
        <p className="text-xs text-muted-foreground">Máximo de {maxTags} tag(s) atingido</p>
      )}
    </div>
  );
}
