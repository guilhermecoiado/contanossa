import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
// import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Plus, Trash2, User, DollarSign } from 'lucide-react';
import { useCreateMember, useUpdateMember, useDeleteIncomeSources } from '@/hooks/useMembers';
import { Member, IncomeSource } from '@/types/finance';
import { toast } from 'sonner';

const incomeSourceSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Nome obrigatório'),
  is_fixed: z.boolean().default(false),
  amount: z.number().nullable().optional(),
  entry_day: z.number().min(1).max(31).nullable().optional(),
});

const memberSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  phone: z.string().nullable().optional(),
  incomeSources: z.array(incomeSourceSchema).min(1, 'Adicione pelo menos uma fonte de renda'),
});


type MemberFormData = z.infer<typeof memberSchema>;

interface MemberFormProps {
  member?: Member & { incomeSources?: IncomeSource[] };
  onSuccess?: () => void;
}

export function MemberForm({ member, onSuccess }: MemberFormProps) {
  const [step, setStep] = useState<'info' | 'income'>('info');
  const createMember = useCreateMember();
  const updateMember = useUpdateMember();
  const deleteIncomeSources = useDeleteIncomeSources();

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<MemberFormData>({
    resolver: zodResolver(memberSchema),
    defaultValues: member ? {
      name: member.name,
      email: member.email,
      phone: member.phone,
      incomeSources: member.incomeSources ?? [{ name: '', is_fixed: true, amount: undefined, entry_day: undefined }],
    } : {
      incomeSources: [{ name: '', is_fixed: true, amount: undefined, entry_day: undefined }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'incomeSources',
  });

  const onSubmit = async (data: MemberFormData) => {
    try {
      // Filtrar fontes sem nome vazio
      const validSources = data.incomeSources
        .filter((s): s is typeof s & { name: string } => !!s.name?.trim())
        .map(s => ({
          id: s.id,
          name: s.name.trim(),
          is_fixed: s.is_fixed ?? true,
          amount: (s.is_fixed && s.amount) ? Number(s.amount) : null,
          entry_day: (s.is_fixed && s.entry_day) ? s.entry_day : null,
        }));
      

      if (validSources.length === 0) {
        toast.error('Adicione pelo menos uma fonte de renda com nome');
        return;
      }

      // Continuar com o cadastro
      await performMemberSave(data, validSources);
    } catch (error: any) {
      console.error('[MemberForm] Erro ao salvar:', error);
      toast.error(error.message || 'Erro ao salvar membro');
    }
  };

  const performMemberSave = async (data: MemberFormData, validSources: any[]) => {
    if (member) {
      // Editar membro existente

      await updateMember.mutateAsync({
        id: member.id,
        name: data.name,
        email: data.email,
        phone: data.phone,
        incomeSources: validSources,
        existingSourceIds: member.incomeSources?.map(s => s.id) ?? [],
      });
      toast.success('Membro atualizado com sucesso!');
    } else {
      // Criar novo membro

      await createMember.mutateAsync({
        name: data.name,
        email: data.email,
        phone: data.phone,
        incomeSources: validSources,
      });
      toast.success('Membro cadastrado com sucesso!');
    }
    onSuccess?.();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {step === 'info' ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg sm:text-2xl">
              <User className="w-5 h-5" />
              Informações do Membro
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome Completo</Label>
                <Input
                  id="name"
                  {...register('name')}
                  placeholder="João Silva"
                />
                {errors.name && (
                  <p className="text-xs text-destructive">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  {...register('email')}
                  placeholder="joao@email.com"
                />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  {...register('phone')}
                  placeholder="(11) 99999-9999"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="button" onClick={() => setStep('income')}>
                Próximo: Fontes de Renda
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Fontes de Renda
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.map((field, index) => {
              const isFixed = watch(`incomeSources.${index}.is_fixed`);
              
              return (
                <div
                  key={field.id}
                  className="p-4 border border-border rounded-lg space-y-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="space-y-2 flex-1">
                      <Label>Nome da Fonte</Label>
                      <Input
                        {...register(`incomeSources.${index}.name`)}
                        placeholder="Ex: Salário, Freelance, Bico"
                      />
                    </div>
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(index)}
                        className="text-destructive ml-2 mt-7"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>

                  <div className="border-t border-border pt-4">
                    <div className="flex items-center gap-3 mb-4">
                      <button
                        type="button"
                        onClick={() => {
                          const newValue = !isFixed;
                          setValue(`incomeSources.${index}.is_fixed`, newValue);
                          // Limpar campos opcionais quando mudar
                          if (!newValue) {
                            setValue(`incomeSources.${index}.amount`, null);
                            setValue(`incomeSources.${index}.entry_day`, null);
                          }
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          isFixed ? 'bg-primary' : 'bg-amber-500'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            isFixed ? 'translate-x-1' : 'translate-x-6'
                          }`}
                        />
                      </button>
                      <Label 
                        htmlFor={`is_fixed_${index}`} 
                        className="cursor-pointer font-medium"
                        onClick={() => {
                          const newValue = !isFixed;
                          setValue(`incomeSources.${index}.is_fixed`, newValue);
                          // Limpar campos opcionais quando mudar
                          if (!newValue) {
                            setValue(`incomeSources.${index}.amount`, null);
                            setValue(`incomeSources.${index}.entry_day`, null);
                          }
                        }}
                      >
                        <span className={!isFixed ? 'text-amber-600' : 'text-foreground'}>
                          {isFixed ? 'Renda Fixa Mensal' : 'Renda Variável'}
                        </span>
                      </Label>
                    </div>

                    {isFixed ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-primary/5 p-3 rounded">
                        <div className="space-y-2">
                          <Label htmlFor={`amount_${index}`}>Valor Mensal</Label>
                          <Input
                            id={`amount_${index}`}
                            inputMode="numeric"
                            placeholder="R$ 0,00"
                            value={
                              (() => {
                                const raw = watch(`incomeSources.${index}.amount`);
                                if (typeof raw === 'number' && !isNaN(raw)) {
                                  return raw.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                                }
                                return '';
                              })()
                            }
                            onChange={e => {
                              let digits = e.target.value.replace(/\D/g, '');
                              let number = digits ? parseFloat(digits) / 100 : 0;
                              setValue(`incomeSources.${index}.amount`, number || null);
                            }}
                          />
                          {errors.incomeSources?.[index]?.amount && (
                            <p className="text-xs text-destructive">
                              {errors.incomeSources[index]?.amount?.message}
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`entry_day_${index}`}>Dia de Entrada (opcional)</Label>
                          <Input
                            id={`entry_day_${index}`}
                            type="number"
                            min="1"
                            max="31"
                            {...register(`incomeSources.${index}.entry_day`, {
                              valueAsNumber: true,
                            })}
                            placeholder="5"
                          />
                          {errors.incomeSources?.[index]?.entry_day && (
                            <p className="text-xs text-destructive">
                              {errors.incomeSources[index]?.entry_day?.message}
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-secondary/50 p-3 rounded text-sm text-muted-foreground">
                        <p>Esta fonte tem renda variável. Você pode registrar os valores específicos em cada mês.</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            <Button
              type="button"
              variant="outline"
              onClick={() =>
                append({ name: '', is_fixed: true, amount: undefined, entry_day: undefined })
              }
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Fonte de Renda
            </Button>

            <div className="flex justify-between pt-4">
              <Button type="button" variant="outline" onClick={() => setStep('info')}>
                Voltar
              </Button>
              <Button type="submit" disabled={createMember.isPending || updateMember.isPending}>
                {createMember.isPending || updateMember.isPending 
                  ? (member ? 'Atualizando...' : 'Cadastrando...') 
                  : (member ? 'Atualizar Membro' : 'Cadastrar Membro')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

    </form>
  );
}
