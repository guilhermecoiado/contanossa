import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import type { FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useIncomeSources, useMembers } from '@/hooks/useMembers';
import { useBanks } from '@/hooks/useFinances';
import { useCreateIncome } from '@/hooks/useFinances';
import { useUpdateIncome } from '@/hooks/useIncomeActions';
import { toast } from 'sonner';
import { isEssentialPlan } from '@/lib/plans';
import { TagSelector } from '@/components/TagSelector';
import { supabase } from '@/integrations/supabase/client';
import { Calculator } from 'lucide-react';
import { CalculatorModal } from '@/components/ui/CalculatorModal';

const incomeSchema = z.object({
  income_source_id: z.preprocess((value) => (value === null ? undefined : value), z.string().optional()),
  custom_source: z.preprocess((value) => (value === null ? undefined : value), z.string().optional()),
  bank_id: z.preprocess((value) => (value === null ? undefined : value), z.string().optional()),
  amount: z.preprocess(
    (value) => (value === null || value === '' ? undefined : value),
    z.number().min(0.01, 'Valor deve ser maior que zero')
  ),
  description: z.preprocess((value) => (value === null ? undefined : value), z.string().optional()),
  is_realized: z.boolean().default(true),
  realized_date: z.preprocess((value) => (value === null ? undefined : value), z.string().optional()),
  date: z.preprocess((value) => (value === null ? undefined : value), z.string().optional()),
  reference_month: z.preprocess(
    (value) => (value === null || value === '' ? undefined : value),
    z.number().min(1).max(12)
  ),
  tags: z.preprocess(
    (value) => (value === null ? [] : value),
    z.array(z.string()).optional().default([])
  ),
}).refine(
  (data) => {
    if (data.income_source_id === 'other' && !data.custom_source?.trim()) {
      return false;
    }
    if (data.is_realized && !data.realized_date) {
      return false;
    }
    return true;
  },
  { message: 'Informe a origem da entrada e a data de realização', path: ['custom_source', 'realized_date'] }
);

type IncomeFormData = z.infer<typeof incomeSchema>;

interface IncomeFormProps {
  onSuccess?: () => void;
  initialFormMode?: 'full' | 'simple';
  defaultValues?: Partial<IncomeFormData> & {
    id?: string;
    member_id?: string;
    bank_id?: string | null;
    income_source_id?: string | null;
    custom_source?: string | null;
    realized_date?: string | null;
    is_realized?: boolean;
    date?: string | null;
  };
}

function getTodayLocalISO() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}


export function IncomeForm({ onSuccess, initialFormMode = 'full', defaultValues }: IncomeFormProps) {
  const { currentMember, currentPlan } = useAuth();
  const isEssential = isEssentialPlan(currentPlan);
  const { data: members = [] } = useMembers();
  // Corrige: sempre usar o membro do defaultValues ao editar, ou o selecionado
  // Corrige: garantir que os campos do formulário estejam sempre preenchidos ao editar
  const [selectedMemberId, setSelectedMemberId] = useState<string | undefined>(defaultValues?.member_id || currentMember?.id);
  const { data: incomeSources } = useIncomeSources(selectedMemberId);
  const { data: banks = [] } = useBanks(selectedMemberId);
  const createIncome = useCreateIncome();
  const updateIncome = useUpdateIncome();
  // Saldo do banco é gerenciado automaticamente por triggers no Supabase
  // Corrige: showCustomSource deve considerar o valor inicial do campo
  const [showCustomSource, setShowCustomSource] = useState(
    (defaultValues?.income_source_id === 'other') || (!!defaultValues?.custom_source)
  );
  const [formMode, setFormMode] = useState<'full' | 'simple'>(initialFormMode);


  // Para dialog de realizar
  const [realizeDialogOpen, setRealizeDialogOpen] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [realizeDate, setRealizeDate] = useState(() => getTodayLocalISO());

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
    watch,
  } = useForm<IncomeFormData>({
    resolver: zodResolver(incomeSchema),
    defaultValues: defaultValues
      ? {
          ...defaultValues,
          realized_date: defaultValues.realized_date || defaultValues.date?.split('T')[0] || getTodayLocalISO(),
          is_realized: defaultValues.is_realized ?? true,
          amount: defaultValues.amount ?? 0,
          description: defaultValues.description || '',
          bank_id: defaultValues.bank_id || '',
          income_source_id: defaultValues.income_source_id || '',
          custom_source: defaultValues.custom_source || '',
          reference_month: defaultValues.reference_month ?? (new Date().getMonth() + 1),
          tags: defaultValues.tags || [],
        }
      : {
          realized_date: getTodayLocalISO(),
          is_realized: true,
          bank_id: '',
          income_source_id: '',
          custom_source: '',
          reference_month: new Date().getMonth() + 1,
          tags: [],
        },
  });

  const selectedTags = watch('tags') || [];

  const loadTags = async (incomeId: string) => {
    const { data, error } = await supabase
      .from('income_tags')
      .select('tag_id')
      .eq('income_id', incomeId);

    if (error) {
      console.error('Erro ao carregar tags da entrada:', error);
      return;
    }

    const tagIds = (data || []).map(item => item.tag_id);
    setValue('tags', tagIds);
  };

  const replaceTags = async (incomeId: string, tagIds: string[]) => {
    await supabase
      .from('income_tags')
      .delete()
      .eq('income_id', incomeId);

    if (!tagIds || tagIds.length === 0) return;

    const rows = tagIds.map(tagId => ({ income_id: incomeId, tag_id: tagId }));
    const { error } = await supabase.from('income_tags').insert(rows);
    if (error) throw error;
  };

  useEffect(() => {
    if (defaultValues?.id) {
      loadTags(defaultValues.id);
    }
  }, [defaultValues?.id]);

  useEffect(() => {
    if (!defaultValues?.id) {
      setFormMode(initialFormMode);
    }
  }, [defaultValues?.id, initialFormMode]);

  const onSubmit = async (data: IncomeFormData) => {
    if (!selectedMemberId) {
      toast.error('Selecione o membro da família');
      return;
    }

    try {
      let incomeSourceId = data.income_source_id;
      let description = data.description;
      if (incomeSourceId === 'other') {
        description = data.custom_source || data.description;
        incomeSourceId = undefined;
      }
      const memberId = selectedMemberId;
      // Garante que o campo 'date' nunca seja nulo
      const entryDate = getTodayLocalISO();
      // O campo reference_month é apenas informativo
      if (defaultValues && defaultValues.id) {
        // Editar entrada existente
        const bancoAntigo = defaultValues.bank_id;
        const bancoNovo = data.bank_id && data.bank_id !== '' ? data.bank_id : null;
        const valor = data.amount;
        const { reference_month, tags, ...dataWithoutRefMonth } = data;
        await updateIncome.mutateAsync({
          ...dataWithoutRefMonth,
          member_id: memberId,
          income_source_id: incomeSourceId && incomeSourceId !== '' ? incomeSourceId : null,
          bank_id: isEssential ? null : bancoNovo,
          description,
          id: defaultValues.id,
          date: entryDate,
          // reference_month não é mais enviado, é apenas informativo
        });
        try {
          await replaceTags(defaultValues.id, selectedTags);
        } catch (tagError: any) {
          console.error('Erro ao atualizar tags da entrada:', tagError);
          toast.error('Entrada salva, mas houve erro ao atualizar tags.');
        }
        // Se mudou de banco, deduz do antigo e soma no novo, apenas se realizado
        // O saldo do banco é ajustado automaticamente por trigger no Supabase
        if (data.is_realized) {
          if (bancoAntigo && bancoAntigo !== bancoNovo) {
            // DESABILITADO: Trigger automático cuida disso
            // Remove do banco antigo o valor antigo
            // await updateBankBalance.mutateAsync({ bank_id: bancoAntigo, amount: -defaultValues.amount });
            // Soma no novo banco o valor novo
            // if (bancoNovo) {
            //   await updateBankBalance.mutateAsync({ bank_id: bancoNovo, amount: valor });
            // }
          } else if (bancoNovo) {
            const diff = valor - (defaultValues.amount || 0);
            if (diff !== 0) {
              // DESABILITADO: Trigger automático cuida disso
              // await updateBankBalance.mutateAsync({ bank_id: bancoNovo, amount: diff });
            }
          }
        }
        toast.success('Entrada atualizada com sucesso!');
      } else {
        // Nova entrada
        const createdIncome = await createIncome.mutateAsync({
          member_id: memberId,
          income_source_id: incomeSourceId && incomeSourceId !== '' ? incomeSourceId : null,
          amount: data.amount,
          description,
          date: entryDate,
          bank_id: isEssential ? null : (data.bank_id && data.bank_id !== '' ? data.bank_id : null),
          is_realized: data.is_realized,
          realized_date: data.is_realized ? (data.realized_date || entryDate) : undefined,
        });
        if (createdIncome?.id) {
          try {
            await replaceTags(createdIncome.id, selectedTags);
          } catch (tagError: any) {
            console.error('Erro ao salvar tags da entrada:', tagError);
            toast.error('Entrada salva, mas houve erro ao salvar tags.');
          }
        }
        
        // O saldo do banco é atualizado automaticamente por trigger no Supabase
        // Não precisamos mais fazer isso manualmente
        toast.success('Entrada registrada com sucesso!');
        reset();
      }
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao registrar entrada');
    }
  };

  const onInvalid = (formErrors: FieldErrors<IncomeFormData>) => {
    const firstError = Object.values(formErrors)[0];
    const message = typeof firstError?.message === 'string'
      ? firstError.message
      : 'Preencha os campos obrigatórios antes de salvar.';
    toast.error(message);
  };

  return (
    <>
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-4">
      <div className="space-y-2">
        <Label>Modo de lançamento</Label>
        <div className="grid grid-cols-2 gap-2 rounded-lg border border-border/70 bg-muted/20 p-1">
          <button
            type="button"
            onClick={() => setFormMode('full')}
            className={`h-9 rounded-md text-sm font-medium transition-colors ${
              formMode === 'full'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            Completo
          </button>
          <button
            type="button"
            onClick={() => setFormMode('simple')}
            className={`h-9 rounded-md text-sm font-medium transition-colors ${
              formMode === 'simple'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            Simples
          </button>
        </div>
      </div>

      {/* Membro da Família - sempre visível */}
      <div className="space-y-2">
        <Label htmlFor="member_id">Membro da Família</Label>
        <Select
          value={selectedMemberId || ''}
          onValueChange={value => {
            setSelectedMemberId(value);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione o membro" />
          </SelectTrigger>
          <SelectContent>
            {members.map(member => (
              <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {formMode === 'full' && (
        <div className="space-y-2">
          <Label htmlFor="reference_month">Mês de referência</Label>
          <Select value={String(watch('reference_month'))} onValueChange={value => setValue('reference_month', Number(value))}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o mês" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Janeiro</SelectItem>
              <SelectItem value="2">Fevereiro</SelectItem>
              <SelectItem value="3">Março</SelectItem>
              <SelectItem value="4">Abril</SelectItem>
              <SelectItem value="5">Maio</SelectItem>
              <SelectItem value="6">Junho</SelectItem>
              <SelectItem value="7">Julho</SelectItem>
              <SelectItem value="8">Agosto</SelectItem>
              <SelectItem value="9">Setembro</SelectItem>
              <SelectItem value="10">Outubro</SelectItem>
              <SelectItem value="11">Novembro</SelectItem>
              <SelectItem value="12">Dezembro</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Banco (somente plano completo) */}
      {!isEssential && formMode === 'full' && (
        <Select
          onValueChange={value => setValue('bank_id', value)}
          value={watch('bank_id') || ''}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione o banco (opcional)" />
          </SelectTrigger>
          <SelectContent>
            {banks.map(bank => (
              <SelectItem key={bank.id} value={bank.id}>{bank.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {formMode === 'full' && (
        <div className="space-y-2">
          <Label>Fonte de Renda</Label>
          <Select
            onValueChange={(value) => {
              setValue('income_source_id', value);
              setShowCustomSource(value === 'other');
              if (value !== 'other') setValue('custom_source', '');
            }}
            value={watch('income_source_id') || ''}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma fonte (opcional)" />
            </SelectTrigger>
            <SelectContent>
              {incomeSources?.map((source) => (
                <SelectItem key={source.id} value={source.id}>
                  {source.name}
                </SelectItem>
              ))}
              <SelectItem value="other">Outros</SelectItem>
            </SelectContent>
          </Select>
          {showCustomSource && (
            <div className="mt-2">
              <Input
                id="custom_source"
                {...register('custom_source')}
                placeholder="Digite a origem da entrada"
              />
              {errors.custom_source && (
                <p className="text-xs text-destructive">{errors.custom_source.message}</p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor="amount">Valor</Label>
          <button
            type="button"
            onClick={() => setShowCalculator(true)}
            className="ml-1 text-muted-foreground hover:text-primary transition-colors"
            title="Abrir calculadora"
          >
            <Calculator size={16} />
          </button>
        </div>
        <Input
          id="amount"
          inputMode="numeric"
          placeholder="R$ 0,00"
          value={
            (() => {
              const raw = watch('amount');
              if (typeof raw === 'number' && !isNaN(raw)) {
                return raw.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
              }
              return '';
            })()
          }
          onChange={e => {
            // Remove tudo que não for dígito
            let digits = e.target.value.replace(/\D/g, '');
            // Converte para centavos
            let number = digits ? parseFloat(digits) / 100 : 0;
            setValue('amount', number || undefined);
          }}
        />
        {errors.amount && (
          <p className="text-xs text-destructive">{errors.amount.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descrição</Label>
        <Input
          id="description"
          {...register('description')}
          placeholder="Descrição da entrada"
        />
      </div>

      {formMode === 'full' && (
        <div className="space-y-2">
          <Label>Tags (Opcional)</Label>
          <TagSelector
            selected={selectedTags}
            onAddTag={(tagId) => {
              if (!selectedTags.includes(tagId)) {
                setValue('tags', [...selectedTags, tagId]);
              }
            }}
            onRemoveTag={(tagId) => {
              setValue('tags', selectedTags.filter(id => id !== tagId));
            }}
            maxTags={5}
          />
        </div>
      )}

      {/* Status de realização */}
      <div className="space-y-2">
        <Label>Status</Label>
        <Select
          value={watch('is_realized') ? 'realizado' : 'nao_realizado'}
          onValueChange={value => {
            setValue('is_realized', value === 'realizado');
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione o status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="realizado">Realizado</SelectItem>
            <SelectItem value="nao_realizado">Não Realizado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Info para não realizado */}
      {!watch('is_realized') && (
        <div className="rounded-md bg-blue-100 text-blue-800 p-3 text-sm mt-2">
          A entrada será registrada como <b>não realizada</b>. Você poderá realizar depois.
        </div>
      )}


      {defaultValues && defaultValues.id ? (
        <Button type="submit" className="w-full" disabled={createIncome.isPending || updateIncome.isPending}>
          {updateIncome.isPending ? 'Salvando...' : 'Salvar Alterações'}
        </Button>
      ) : watch('is_realized') ? (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-2 w-full"
            onClick={() => setRealizeDialogOpen(true)}
            disabled={createIncome.isPending}
          >
            {createIncome.isPending ? 'Realizando...' : 'Realizar'}
          </Button>
          <Dialog open={realizeDialogOpen} onOpenChange={setRealizeDialogOpen}>
            <DialogContent aria-describedby="realize-income-form-desc">
              <span id="realize-income-form-desc" className="sr-only">Selecione a data para confirmar a realização da entrada antes de salvar.</span>
              <DialogHeader>
                <DialogTitle>Realizar Entrada</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Label htmlFor="realize-date-form">Data de Realização</Label>
                <Input
                  id="realize-date-form"
                  type="date"
                  value={realizeDate}
                  onChange={e => setRealizeDate(e.target.value)}
                />
                <Button
                  className="w-full"
                  disabled={!realizeDate || createIncome.isPending}
                  onClick={async () => {
                    setValue('realized_date', realizeDate);
                    setValue('is_realized', true);
                    setRealizeDialogOpen(false);
                    await handleSubmit(onSubmit)();
                  }}
                >Salvar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </>
      ) : (
        <Button
          type="submit"
          className="w-full"
          disabled={createIncome.isPending}
        >
          {createIncome.isPending ? 'Registrando...' : 'Registrar Entrada'}
        </Button>
      )}
    </form>
    <CalculatorModal
      open={showCalculator}
      onClose={() => setShowCalculator(false)}
      onConfirm={(value) => setValue('amount', value)}
      initialValue={watch('amount')}
    />
    </>
  );
}
