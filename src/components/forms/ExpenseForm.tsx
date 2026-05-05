import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
// Definições e hooks
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import React from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Toggle } from '@/components/ui/toggle';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useMembers } from '@/hooks/useMembers';
import { useExpenseCategories, useCards, useCreateExpense, useBanks, useUpdateExpense } from '@/hooks/useFinances';
import { supabase } from '@/integrations/supabase/client';
import { useUpdateCard } from '@/hooks/useCardActions';
import { useUpdateBankBalance } from '@/hooks/useBankActions';
import { useCreateFamilyTransferRequest, type FamilyTransferRecipient, resolveFamilyTransferRecipient } from '@/hooks/useFamilyTransfers';
import { toast } from 'sonner';
import { isEssentialPlan } from '@/lib/plans';
import { CategorySelector } from '@/components/CategorySelector';
import { TagSelector } from '@/components/TagSelector';
import { Calculator } from 'lucide-react';
import { CalculatorModal } from '@/components/ui/CalculatorModal';

const optionalString = z.preprocess(
  (value) => (value === null || value === undefined || value === '' ? undefined : String(value)),
  z.string().optional()
);

const expenseSchema = z.object({
  member_id: z.string().min(1, 'Selecione o membro'),
  category_id: optionalString,
  card_id: optionalString,
  bank_id: optionalString,
  output_mode: optionalString,
  paymentType: z.enum(['bank', 'card']),
  amount: z.preprocess(
    (value) => {
      if (value === null || value === undefined || value === '') return undefined;
      const parsed = typeof value === 'string' ? Number(value) : value;
      return Number.isFinite(parsed as number) ? parsed : undefined;
    },
    z.number().min(0.01, 'Valor deve ser maior que zero')
  ),
  description: z.string().min(1, 'Descrição obrigatória'),
  status: z.enum(['realizado', 'nao_realizado']),
  date: optionalString,
  reference_month: z.preprocess(
    (value) => (value === null || value === undefined || value === '' ? undefined : Number(value)),
    z.number().min(1).max(12)
  ),
  is_recurring: z.boolean(),
  total_installments: z.preprocess(
    (value) => (value === null || value === undefined || value === '' ? undefined : Number(value)),
    z.number().optional()
  ),
  first_installment_date: optionalString,
  last_installment_date: optionalString,
  lend_card: z.boolean().optional(),
  lend_to: optionalString,
  lend_card_family_public_id: optionalString,
  lend_money: z.boolean().optional(),
  lend_money_to: optionalString,
  lend_family_public_id: optionalString,
  tags: z.array(z.string()).optional().default([]),
});

type ExpenseFormData = z.infer<typeof expenseSchema>;

function getTodayLocalISO() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

interface ExpenseFormProps {
  onSuccess?: () => void;
  simpleMode?: boolean;
  initialData?: Partial<ExpenseFormData> & {
    id?: string;
    custom_category_id?: string | null;
    category_id?: string | null;
    recurring_id?: string | null;
    installment_number?: number | null;
    total_installments?: number | null;
    date?: string | null;
  };
}


export function ExpenseForm({ onSuccess, simpleMode = false, initialData }: ExpenseFormProps) {
  const { currentMember, currentPlan } = useAuth();
  const isEssential = isEssentialPlan(currentPlan);
  const { data: members = [] } = useMembers();
  const { data: categories } = useExpenseCategories();
  const initialCategoryValue = initialData?.custom_category_id
    ? `custom:${initialData.custom_category_id}`
    : initialData?.category_id
      ? `default:${initialData.category_id}`
      : '';
  const [showLendTo, setShowLendTo] = useState(false);
  const [showLendMoney, setShowLendMoney] = useState(false);
  const [resolvedRecipient, setResolvedRecipient] = useState<FamilyTransferRecipient | null>(null);
  const [resolvedCardRecipient, setResolvedCardRecipient] = useState<FamilyTransferRecipient | null>(null);
  const [isResolvingRecipient, setIsResolvingRecipient] = useState(false);
  const [isResolvingCardRecipient, setIsResolvingCardRecipient] = useState(false);
  const [confirmTransferOpen, setConfirmTransferOpen] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [pendingTransferSubmission, setPendingTransferSubmission] = useState<ExpenseFormData | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
    defaultValues: initialData ? {
      ...initialData,
      category_id: initialCategoryValue,
      card_id: initialData.card_id ?? undefined,
      bank_id: initialData.bank_id ?? undefined,
      output_mode: initialData.output_mode ?? undefined,
      paymentType: initialData.paymentType || (initialData.card_id ? 'card' : 'bank'),
      status: initialData.status || 'realizado',
      date: initialData.date ?? undefined,
      amount: initialData.amount ?? 0,
      reference_month: initialData.reference_month ?? (new Date().getMonth() + 1),
      total_installments: initialData.total_installments ?? undefined,
      is_recurring: initialData.is_recurring ?? false,
      first_installment_date: initialData.first_installment_date ?? undefined,
      last_installment_date: initialData.last_installment_date ?? undefined,
      lend_to: initialData.lend_to ?? undefined,
      lend_card_family_public_id: initialData.lend_card_family_public_id ?? undefined,
      lend_money: initialData.lend_money ?? false,
      lend_money_to: initialData.lend_money_to ?? undefined,
      lend_family_public_id: initialData.lend_family_public_id ?? undefined,
      tags: initialData.tags || [],
    } : {
      paymentType: 'bank',
      status: 'realizado',
      date: '',
      amount: 0,
      reference_month: new Date().getMonth() + 1,
      total_installments: undefined,
      is_recurring: false,
      lend_card_family_public_id: '',
      lend_money: false,
      lend_money_to: '',
      lend_family_public_id: '',
      tags: [],
    },
  });

  // Atualiza exibição do campo lend_to
  useEffect(() => {
    setShowLendTo(watch('paymentType') === 'card' && watch('lend_card'));
    setShowLendMoney(watch('paymentType') === 'bank' && !!watch('lend_money'));
  }, [watch('paymentType'), watch('lend_card'), watch('lend_money')]);
  const selectedMemberId = watch('member_id');
  const { data: cards } = useCards(selectedMemberId);
  const { data: banks } = useBanks(selectedMemberId);
  const [outputType, setOutputType] = useState('');
  const [customOutputType, setCustomOutputType] = useState('');
  const createExpense = useCreateExpense();
  const createFamilyTransferRequest = useCreateFamilyTransferRequest();
  const updateExpense = useUpdateExpense();
  const updateBankBalance = useUpdateBankBalance();
  const updateCard = useUpdateCard();

  // Novo: tipo de despesa
  const [expenseType, setExpenseType] = useState<'simples' | 'parcelado' | 'recorrente'>(() => {
    if (initialData?.is_recurring) return 'recorrente';
    if (Number(initialData?.total_installments || 0) > 1) return 'parcelado';
    return 'simples';
  });
  const effectiveExpenseType = isEssential ? 'simples' : expenseType;
  const isRecurring = effectiveExpenseType === 'recorrente';
  const isInstallment = effectiveExpenseType === 'parcelado';
  const isSimpleEntryMode = simpleMode && !initialData?.id;
  const selectedCategory = watch('category_id');
  const selectedTags = watch('tags') || [];
  const paymentType = watch('paymentType');
  const outputMode = watch('output_mode');
  const showLaunchDateField = isSimpleEntryMode || paymentType === 'bank' || (!isEssential && paymentType === 'card' && expenseType === 'simples');

  useEffect(() => {
    if (!initialData?.id) return;

    if (initialData.is_recurring) {
      setExpenseType('recorrente');
    } else if (Number(initialData.total_installments || 0) > 1) {
      setExpenseType('parcelado');
    } else {
      setExpenseType('simples');
    }
  }, [initialData?.id, initialData?.is_recurring, initialData?.total_installments]);

  useEffect(() => {
    if (initialData?.date) {
      setLaunchDate(initialData.date);
    }
  }, [initialData?.date]);
  
  const parseCategoryValue = (value?: string) => {
    if (!value) return { categoryId: null, customCategoryId: null };
    if (value.startsWith('custom:')) {
      return { categoryId: null, customCategoryId: value.replace('custom:', '') };
    }
    if (value.startsWith('default:')) {
      return { categoryId: value.replace('default:', ''), customCategoryId: null };
    }
    return { categoryId: value, customCategoryId: null };
  };

  const formatFamilyPublicIdInput = (rawValue: string) => {
    const normalized = (rawValue || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const withoutPrefix = normalized.startsWith('FAM') ? normalized.slice(3) : normalized;

    if (!withoutPrefix) return '';
    return `FAM-${withoutPrefix.slice(0, 10)}`;
  };

  const applyCardLimitReservation = async (cardId: string | undefined, amount: number) => {
    if (!cardId || !cards?.length || !Number.isFinite(amount)) return;
    const card = cards.find(item => item.id === cardId);
    if (!card) return;

    const creditLimit = Number(card.credit_limit ?? 0) || 0;
    const currentUsed = Number(card.used_limit ?? 0) || 0;
    const currentAvailable = Number(
      card.available_limit ?? (creditLimit - currentUsed)
    ) || 0;
    const nextUsed = currentUsed + amount;
    const nextAvailable = currentAvailable - amount;

    await updateCard.mutateAsync({
      id: card.id,
      used_limit: nextUsed,
      available_limit: nextAvailable,
    });
  };

  const loadTags = async (expenseId: string) => {
    const { data, error } = await supabase
      .from('expense_tags')
      .select('tag_id')
      .eq('expense_id', expenseId);

    if (error) {
      console.error('Erro ao carregar tags:', error);
      return;
    }

    const tagIds = (data || []).map(item => item.tag_id);
    setValue('tags', tagIds);
  };

  const replaceTags = async (expenseId: string, tagIds: string[]) => {
    await supabase
      .from('expense_tags')
      .delete()
      .eq('expense_id', expenseId);

    if (!tagIds || tagIds.length === 0) return;

    const rows = tagIds.map(tagId => ({ expense_id: expenseId, tag_id: tagId }));
    const { error } = await supabase.from('expense_tags').insert(rows);
    if (error) throw error;
  };

  useEffect(() => {
    if (initialData?.id) {
      loadTags(initialData.id);
    }
  }, [initialData?.id]);

  useEffect(() => {
    const loadInstallmentSeries = async () => {
      if (!initialData?.id) return;
      if (Number(initialData.total_installments || 0) <= 1) return;

      let query = supabase
        .from('expenses')
        .select('date, installment_number, total_installments')
        .eq('member_id', initialData.member_id)
        .eq('total_installments', Number(initialData.total_installments));

      if (initialData.recurring_id) {
        query = query.eq('recurring_id', initialData.recurring_id);
      } else {
        query = query.ilike('description', `${(initialData.description || '').replace(/\s*\(\d+\/\d+\)\s*$/, '')}%`);
      }

      const { data, error } = await query.order('date', { ascending: true });
      if (error || !data?.length) return;

      const first = data[0]?.date;
      const last = data[data.length - 1]?.date;
      const total = Number(data[0]?.total_installments || initialData.total_installments || data.length);

      if (first) setValue('first_installment_date', first);
      if (last) setValue('last_installment_date', last);
      setValue('total_installments', total);
    };

    void loadInstallmentSeries();
  }, [initialData?.id, initialData?.member_id, initialData?.description, initialData?.recurring_id, initialData?.total_installments, setValue]);
  // Novo: controle do toggle de dedução do limite do cartão para recorrente
  const [deductFromCardLimit, setDeductFromCardLimit] = useState(false);

  // Para dialog de realizar recorrente cartão
  const [realizeDialogOpen, setRealizeDialogOpen] = useState(false);
  const [realizeDate, setRealizeDate] = useState(() => getTodayLocalISO());
  
  // Para o campo de "Data do Lançamento" de Rotativo
  const [launchDate, setLaunchDate] = useState(() => getTodayLocalISO());

  // Se mudar o membro, limpa banco selecionado
  useEffect(() => {
    setValue('bank_id', '');
  }, [selectedMemberId]);

  useEffect(() => {
    if (watch('paymentType') !== 'bank' && watch('lend_money')) {
      setValue('lend_money', false);
      setValue('lend_money_to', '');
      setValue('lend_family_public_id', '');
      setResolvedRecipient(null);
    }
  }, [watch('paymentType')]);

  useEffect(() => {
    if (watch('paymentType') !== 'card' && watch('lend_card')) {
      setValue('lend_card', false);
      setValue('lend_to', '');
      setValue('lend_card_family_public_id', '');
      setResolvedCardRecipient(null);
    }
  }, [watch('paymentType')]);

  const resolveRecipientByPublicId = async (familyPublicIdRaw?: string) => {
    const familyPublicId = familyPublicIdRaw?.trim().toUpperCase();
    if (!familyPublicId) return null;

    setIsResolvingRecipient(true);
    try {
      const recipient = await resolveFamilyTransferRecipient(familyPublicId);
      setResolvedRecipient(recipient);
      return recipient;
    } catch {
      setResolvedRecipient(null);
      return null;
    } finally {
      setIsResolvingRecipient(false);
    }
  };

  // Adicione lógica de edição
  const submitExpenseData = async (
    data: ExpenseFormData,
    forceRealized = false,
    realizedDateValue?: string,
    transferRecipient?: FamilyTransferRecipient | null,
  ) => {
    if (!data.member_id) {
      toast.error('Selecione o membro responsável pela saída');
      return;
    }

    const effectivePaymentType = isEssential ? 'bank' : paymentType;

    // Por padrão, não realizada, exceto se for recorrente cartão e forçar realizado
    const is_realized = forceRealized;
    // Para Rotativo, usa a data de lançamento selecionada; para outros tipos, usa a data atual
    const dateStr = launchDate || initialData?.date || realizedDateValue || getTodayLocalISO();
    const { categoryId, customCategoryId } = parseCategoryValue(data.category_id);
    const normalizedCategoryId = categoryId;
    const normalizedCustomCategoryId = customCategoryId;

    const normalizedDescription = data.description;

    if (expenseType === 'recorrente') {
      // Salva em recurring_expenses sempre como não realizada
      const { error } = await supabase.from('recurring_expenses').insert({
        member_id: data.member_id,
        description: normalizedDescription,
        amount: data.amount,
        category_id: normalizedCategoryId,
        custom_category_id: normalizedCustomCategoryId,
        start_date: dateStr,
        is_active: true,
        total_installments: 1, // recorrente padrão, não parcelado
        card_id: effectivePaymentType === 'card' ? data.card_id : null,
        deduct_from_card_limit: effectivePaymentType === 'card' ? !!deductFromCardLimit : false,
        is_realized: false,
        lend_card: !!data.lend_card,
        lend_to: data.lend_card ? data.lend_to : null,
      });
      if (error) {
        toast.error('Erro ao salvar recorrente: ' + error.message);
        return;
      }
      toast.success('Despesa recorrente cadastrada!');
      if (onSuccess) onSuccess();
      reset();
      setDeductFromCardLimit(false);
      return;
    }

    try {
      // Para "Emprestar Dinheiro", registra como realizado automaticamente
      // Para outros casos, lança como não realizado
      const isLendingMoney = showLendMoney && transferRecipient;
      const isRealizedNow = isLendingMoney ? true : false;
      
      const payloadBase = {
        member_id: data.member_id,
        category_id: normalizedCategoryId,
        custom_category_id: normalizedCustomCategoryId,
        amount: data.amount,
        description: normalizedDescription,
        is_realized: isRealizedNow,
        lend_card: !!data.lend_card,
        lend_to: data.lend_card ? data.lend_to : null,
        lend_card_family_public_id: data.lend_card ? (data.lend_card_family_public_id?.trim() || null) : null,
        lend_money: !!data.lend_money,
        lend_money_to: data.lend_money ? data.lend_money_to : null,
      };

      // Busca o cartão selecionado para pegar o dia de vencimento
      const selectedCard = cards?.find(card => card.id === data.card_id);
      let parcelasCriadas = false;

      // --- Lógica de dedução do saldo do banco ao realizar despesa ---
      // Só executa se for pagamento por banco, modo de saída selecionado e despesa realizada (ou empréstimo)
      const shouldDeductFromBank =
        effectivePaymentType === 'bank' &&
        !!data.bank_id &&
        (!!data.output_mode || isLendingMoney) &&
        (is_realized || isLendingMoney);
      let selectedBank: any = null;
      let newBankBalance: number | null = null;
      if (shouldDeductFromBank && banks) {
        selectedBank = banks.find((b) => b.id === data.bank_id);
        if (selectedBank) {
          newBankBalance = Number(selectedBank.balance) - Number(data.amount);
        }
      }

      if (initialData && initialData.id) {
        // Edição de despesa
        await updateExpense.mutateAsync({
          id: initialData.id,
          member_id: data.member_id,
          category_id: normalizedCategoryId || undefined,
          custom_category_id: normalizedCustomCategoryId || undefined,
          card_id: data.card_id || undefined,
          amount: data.amount,
          description: normalizedDescription,
          date: dateStr,
          bank_id: data.bank_id || undefined,
          output_mode: data.output_mode || undefined,
          total_installments: Number(initialData.total_installments || 0) > 1 ? Number(initialData.total_installments) : undefined,
          installment_number: initialData.installment_number || undefined,
          lend_card: !!data.lend_card,
          lend_to: data.lend_card ? data.lend_to : null,
          lend_card_family_public_id: data.lend_card ? (data.lend_card_family_public_id?.trim() || null) : null,
          lend_money: !!data.lend_money,
          lend_money_to: data.lend_money ? data.lend_money_to : null,
        });
        await replaceTags(initialData.id, selectedTags);

        // Cascade update to subsequent installments in the same series
        const isParcelada = Number(initialData.total_installments || 0) > 1;
        if (isParcelada) {
          const newBaseDescription = normalizedDescription.replace(/\s*\(\d+\/\d+\)$/, '').trim();
          const currentInstallmentNumber = initialData.installment_number || 0;
          const totalInstallments = Number(initialData.total_installments);

          // Prefer recurring_id as the unique series key.
          let findQuery;
          if (initialData.recurring_id) {
            findQuery = supabase
              .from('expenses')
              .select('id, installment_number')
              .eq('recurring_id', initialData.recurring_id)
              .gt('installment_number', currentInstallmentNumber)
              .order('installment_number', { ascending: true });
          } else {
            findQuery = supabase
              .from('expenses')
              .select('id, installment_number')
              .eq('member_id', initialData.member_id)
              .eq('total_installments', totalInstallments)
              .gt('installment_number', currentInstallmentNumber)
              .neq('id', initialData.id);

            const baseDescription = (initialData.description || '').replace(/\s*\(\d+\/\d+\)$/, '').trim();
            findQuery = findQuery.eq('amount', Number(initialData.amount || 0));
            if (initialData.category_id) {
              findQuery = findQuery.eq('category_id', initialData.category_id);
            } else {
              findQuery = findQuery.is('category_id', null);
            }
            if (initialData.custom_category_id) {
              findQuery = findQuery.eq('custom_category_id', initialData.custom_category_id);
            } else {
              findQuery = findQuery.is('custom_category_id', null);
            }
            if (baseDescription) {
              findQuery = findQuery.ilike('description', `${baseDescription} (%/%)`);
            }

            if (initialData.card_id) {
              findQuery = findQuery.eq('card_id', initialData.card_id);
            } else if (initialData.bank_id) {
              findQuery = findQuery.eq('bank_id', initialData.bank_id);
            } else {
              findQuery = findQuery.is('card_id', null).is('bank_id', null);
            }

            findQuery = findQuery.order('installment_number', { ascending: true });
          }

          const { data: futureExpenses, error: findError } = await findQuery;

          if (!findError && futureExpenses) {
            let updatedCount = 0;
            for (const futureExp of futureExpenses) {
              const nextInstallmentNumber = Number(futureExp.installment_number || 0);
              const { error: updateError } = await supabase.from('expenses').update({
                member_id: data.member_id,
                category_id: normalizedCategoryId || null,
                custom_category_id: normalizedCustomCategoryId || null,
                card_id: data.card_id || null,
                bank_id: data.bank_id || null,
                output_mode: data.output_mode || null,
                amount: data.amount,
                description: nextInstallmentNumber > 0
                  ? `${newBaseDescription} (${nextInstallmentNumber}/${totalInstallments})`
                  : newBaseDescription,
                lend_card: !!data.lend_card,
                lend_to: data.lend_card ? data.lend_to : null,
                lend_card_family_public_id: data.lend_card ? (data.lend_card_family_public_id?.trim() || null) : null,
                lend_money: !!data.lend_money,
                lend_money_to: data.lend_money ? data.lend_money_to : null,
              }).eq('id', futureExp.id);

              if (!updateError) {
                updatedCount++;
              }
            }

            if (futureExpenses.length > 0) {
              toast.success(`Despesa atual e ${updatedCount} futuras salvas com sucesso.`);
            } else {
              toast.success('Despesa salva com sucesso.');
            }
          }
        } else {
          toast.success('Despesa salva com sucesso.');
        }
      } else if (isInstallment && effectivePaymentType === 'card' && data.card_id && data.first_installment_date && data.last_installment_date) {
        // Parcelado com datas customizadas
        const firstDate = new Date(data.first_installment_date);
        const lastDate = new Date(data.last_installment_date);
        // Calcular número de parcelas (meses entre as datas, inclusive)
        let installments = 0;
        let tempDate = new Date(firstDate);
        while (tempDate <= lastDate) {
          installments++;
          tempDate.setMonth(tempDate.getMonth() + 1);
        }
        
        // Generate a common recurring_id for all installments
        const recurringId = crypto.randomUUID?.() || `rec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        let totalParcelado = 0;
        tempDate = new Date(firstDate);
        for (let i = 0; i < installments; i++) {
          const parcelaData = new Date(firstDate);
          parcelaData.setMonth(firstDate.getMonth() + i);
          const parcelaMonth = parcelaData.getMonth() + 1;
          const parcelaYear = parcelaData.getFullYear();
          const payload = {
            ...payloadBase,
            card_id: data.card_id,
            bank_id: data.bank_id || undefined,
            output_mode: data.output_mode || undefined,
            description: `${data.description} (${i+1}/${installments})`,
            date: parcelaData.toISOString().split('T')[0],
            is_recurring: false,
            recurring_id: recurringId,
            total_installments: installments,
            installment_number: i + 1,
            month: parcelaMonth,
            year: parcelaYear,
            lend_card: !!data.lend_card,
            lend_to: data.lend_card ? data.lend_to : null,
            first_installment_date: i === 0 ? data.first_installment_date || parcelaData.toISOString().split('T')[0] : null,
            last_installment_date: i === installments - 1 ? data.last_installment_date || parcelaData.toISOString().split('T')[0] : null,
          };
          totalParcelado += data.amount;
          const createdExpense = await createExpense.mutateAsync(payload);
          if (createdExpense?.id) {
            await replaceTags(createdExpense.id, selectedTags);
          }
        }
        if (data.lend_card && !isRealizedNow) {
          await applyCardLimitReservation(data.card_id, totalParcelado);
        }
        parcelasCriadas = true;
        toast.success(`Despesa parcelada criada em ${installments}x!`);
      } else if (effectivePaymentType === 'bank') {
        // Banco (qualquer modo de saída)
        const payload = {
          ...payloadBase,
          bank_id: isEssential ? undefined : (data.bank_id || undefined),
          output_mode: data.output_mode || undefined,
          is_recurring: false,
          total_installments: isInstallment ? data.total_installments : undefined,
          installment_number: isInstallment ? 1 : undefined,
          date: dateStr,
          ...(isLendingMoney && { is_realized: true, realized_date: dateStr }),
          lend_card: !!data.lend_card,
          lend_to: data.lend_card ? data.lend_to : null,
        };
        const createdExpense = await createExpense.mutateAsync(payload);
        if (createdExpense?.id) {
          await replaceTags(createdExpense.id, selectedTags);

          if (showLendMoney && transferRecipient) {
            await createFamilyTransferRequest.mutateAsync({
              creditor_member_id: data.member_id,
              debtor_member_id: transferRecipient.member_id,
              creditor_name: currentMember?.name || undefined,
              debtor_name: transferRecipient.member_name,
              creditor_expense_id: createdExpense.id,
              creditor_bank_id: data.bank_id,
              amount: data.amount,
              description: data.lend_money_to?.trim() || normalizedDescription,
              requested_date: dateStr,
            });
          }
        }
        // Deduz do saldo do banco quando for empréstimo ou despesa realizada
        if (shouldDeductFromBank && selectedBank && newBankBalance !== null) {
          const amountDelta = newBankBalance - (selectedBank.balance || 0);
          await updateBankBalance.mutateAsync({ bank_id: selectedBank.id, amount: amountDelta });
        }
        
        toast.success(showLendMoney && transferRecipient ? 'Empréstimo disparado e saldo deduzido do banco!' : 'Despesa lançada!');
      } else if (effectivePaymentType === 'card') {
        // Cartão (não parcelado)
        const payload = {
          ...payloadBase,
          card_id: data.card_id || undefined,
          bank_id: data.bank_id || undefined,
          output_mode: data.output_mode || undefined,
          is_recurring: false,
          total_installments: isInstallment ? data.total_installments : undefined,
          installment_number: isInstallment ? 1 : undefined,
          date: dateStr,
          lend_card: !!data.lend_card,
          lend_to: data.lend_card ? data.lend_to : null,
        };
        const createdExpense = await createExpense.mutateAsync(payload);
        if (createdExpense?.id) {
          await replaceTags(createdExpense.id, selectedTags);
        }
        if (data.lend_card && !isRealizedNow) {
          await applyCardLimitReservation(data.card_id, data.amount);
        }
        toast.success('Despesa registrada com sucesso!');
      } else {
        // Outros casos
        const payload = {
          ...payloadBase,
          bank_id: data.bank_id || undefined,
          output_mode: data.output_mode || undefined,
          is_recurring: false,
          total_installments: undefined,
          date: dateStr,
          lend_card: !!data.lend_card,
          lend_to: data.lend_card ? data.lend_to : null,
        };
        const createdExpense = await createExpense.mutateAsync(payload);
        if (createdExpense?.id) {
          await replaceTags(createdExpense.id, selectedTags);
        }
        toast.success('Despesa registrada com sucesso!');
      }
      reset();
      setResolvedRecipient(null);
      setResolvedCardRecipient(null);
      setPendingTransferSubmission(null);
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao registrar despesa');
    }
  };

  const onSubmit = async (data: ExpenseFormData, forceRealized = false, realizedDateValue?: string) => {
    if (showLendMoney && !initialData?.id) {
      if (!data.lend_money_to?.trim()) {
        toast.error('Informe o nome da pessoa para quem você está emprestando.');
        return;
      }

      if (data.lend_family_public_id?.trim()) {
        const recipient = await resolveRecipientByPublicId(data.lend_family_public_id);
        if (!recipient) {
          toast.error('ID da família inválido.');
          return;
        }

        if (recipient.member_id === data.member_id) {
          toast.error('Você não pode lançar cobrança para o próprio membro.');
          return;
        }

        setResolvedRecipient(recipient);
        setPendingTransferSubmission(data);
        setConfirmTransferOpen(true);
        return;
      }
    }

    if (watch('paymentType') === 'card' && data.lend_card && data.lend_card_family_public_id?.trim()) {
      const recipient = await resolveRecipientByPublicId(data.lend_card_family_public_id);
      if (!recipient) {
        toast.error('ID da família inválido.');
        return;
      }
    }

    await submitExpenseData(data, forceRealized, realizedDateValue);
  };

  const onInvalid = (formErrors: any) => {
    const firstError = Object.values(formErrors || {})[0] as { message?: string } | undefined;
    toast.error(firstError?.message || 'Verifique os campos obrigatórios para salvar a edição.');
  };

  return (
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-4">
      {/* Tipo de Despesa removido do topo, agora aparece apenas para cartão abaixo do campo de cartão */}
      <div className="space-y-2">
        <Label htmlFor="member_id">Membro da Família</Label>
        <Select value={watch('member_id') || ''} onValueChange={value => setValue('member_id', value)}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione o membro" />
          </SelectTrigger>
          <SelectContent>
            {members.map(member => (
              <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.member_id && <p className="text-xs text-destructive">{errors.member_id.message}</p>}
      </div>

      {!isSimpleEntryMode && (
        <>
      {/* Toggle Deduzir do limite do cartão para recorrente */}
      {isRecurring && paymentType === 'card' && (
        <div className="flex items-center gap-2 mb-2">
          <Toggle
            pressed={deductFromCardLimit}
            onPressedChange={setDeductFromCardLimit}
            aria-label="Deduzir do limite do cartão"
          >
            Deduzir do limite do cartão
          </Toggle>
        </div>
      )}
      {/* Campos de parcelas e datas agora aparecem apenas em Cartão > Parcelado */}
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
      <div className="space-y-2">
        <Label>Categoria</Label>
        <CategorySelector
          type="expense"
          value={selectedCategory || ''}
          onChange={(value) => setValue('category_id', value)}
          placeholder="Selecione uma categoria"
          defaultCategories={
            categories
              ?.filter((cat, idx, arr) => arr.findIndex(c => c.name === cat.name) === idx)
              .filter(category => category.name.toLowerCase() !== 'outros')
              .map((cat) => ({
                value: `default:${cat.id}`,
                label: cat.name
              })) || []
          }
        />
      </div>

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

      {!isEssential && (
        <div className="space-y-2">
          <Label>Tipo de pagamento</Label>
          <Select value={paymentType || 'bank'} onValueChange={value => setValue('paymentType', value as 'bank' | 'card')}>
            <SelectTrigger>
              <SelectValue placeholder="Escolha Banco ou Cartão" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bank">Banco</SelectItem>
              <SelectItem value="card">Cartão</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {!isEssential && paymentType === 'bank' && (
        <>
          <div className="space-y-2">
            <Label>Banco</Label>
            <Select onValueChange={value => setValue('bank_id', value)} value={watch('bank_id') || ''}>
              <SelectTrigger {...register('bank_id')}>
                <SelectValue placeholder="Selecione o banco" />
              </SelectTrigger>
              <SelectContent>
                {banks?.map((bank) => (
                  <SelectItem key={bank.id} value={bank.id}>{bank.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {watch('bank_id') && (
            <div className="space-y-2">
              <Label>Modo de saída</Label>
              <Select onValueChange={value => setValue('output_mode', value)} value={outputMode || ''}>
                <SelectTrigger {...register('output_mode')}>
                  <SelectValue placeholder="Selecione o modo de saída" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">Pix</SelectItem>
                  <SelectItem value="ted">TED</SelectItem>
                  <SelectItem value="doc">DOC</SelectItem>
                  <SelectItem value="debito">Débito</SelectItem>
                  <SelectItem value="poupanca">Poupança</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {!initialData?.id && (
            <>
              <button
                type="button"
                onClick={() => setValue('lend_money', !watch('lend_money'))}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium border transition-colors w-full mt-1 ${
                  watch('lend_money')
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'bg-muted/40 border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground'
                }`}
              >
                {/* toggle pill */}
                <span className={`relative inline-flex h-4 w-7 shrink-0 rounded-full border transition-colors ${watch('lend_money') ? 'bg-primary border-primary' : 'bg-muted-foreground/30 border-transparent'}`}>
                  <span className={`absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${watch('lend_money') ? 'translate-x-3' : 'translate-x-0'}`} />
                </span>
                Emprestar Dinheiro
              </button>

              {showLendMoney && (
                <div className="space-y-2 mt-2">
                  <Label htmlFor="lend_money_to">Quem está recebendo o valor</Label>
                  <Input
                    id="lend_money_to"
                    {...register('lend_money_to')}
                    placeholder="Quem está recebendo o valor"
                  />

                  <Label htmlFor="lend_family_public_id" className="mt-2 block">ID da Família</Label>
                  <Input
                    id="lend_family_public_id"
                    value={watch('lend_family_public_id') || ''}
                    placeholder="Ex.: FAM-ABC123DEF4"
                    onChange={(event) => {
                      const formatted = formatFamilyPublicIdInput(event.target.value);
                      setValue('lend_family_public_id', formatted);
                    }}
                    onBlur={async (event) => {
                      const value = event.target.value?.trim();
                      if (!value) {
                        setResolvedRecipient(null);
                        return;
                      }

                      const recipient = await resolveRecipientByPublicId(value);
                      if (!recipient) {
                        toast.error('ID da família não encontrado.');
                      }
                    }}
                  />

                  {isResolvingRecipient && (
                    <p className="text-xs text-muted-foreground">Validando ID da família...</p>
                  )}

                  {resolvedRecipient && (
                    <p className="text-xs text-primary">Usuário encontrado: {resolvedRecipient.member_name}</p>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}

      {!isEssential && paymentType === 'card' && (
        <>
          <div className="space-y-2">
            <Label>Cartão</Label>
            <Select onValueChange={value => setValue('card_id', value)} value={watch('card_id') || ''}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o cartão" />
              </SelectTrigger>
              <SelectContent>
                {cards?.filter(card => !card.is_blocked).map((card) => (
                  <SelectItem key={card.id} value={card.id}>{card.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Novo campo: Emprestar Cartão */}
          <button
            type="button"
            onClick={() => setValue('lend_card', !watch('lend_card'))}
            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium border transition-colors w-full mt-1 ${
              watch('lend_card')
                ? 'bg-primary/10 border-primary text-primary'
                : 'bg-muted/40 border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground'
            }`}
          >
            {/* toggle pill */}
            <span className={`relative inline-flex h-4 w-7 shrink-0 rounded-full border transition-colors ${watch('lend_card') ? 'bg-primary border-primary' : 'bg-muted-foreground/30 border-transparent'}`}>
              <span className={`absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${watch('lend_card') ? 'translate-x-3' : 'translate-x-0'}`} />
            </span>
            Emprestar Cartão
          </button>
          {showLendTo && (
            <div className="space-y-2 mt-2">
              <Label htmlFor="lend_to">Nome de quem está emprestando</Label>
              <Input
                id="lend_to"
                {...register('lend_to')}
                placeholder="Nome de quem está usando o cartão"
              />

              <Label htmlFor="lend_card_family_public_id" className="mt-2 block">ID da Família (opcional)</Label>
              <Input
                id="lend_card_family_public_id"
                value={watch('lend_card_family_public_id') || ''}
                placeholder="Ex.: FAM-ABC123DEF4"
                onChange={(event) => {
                  const formatted = formatFamilyPublicIdInput(event.target.value);
                  setValue('lend_card_family_public_id', formatted);
                }}
                onBlur={async (event) => {
                  const value = event.target.value?.trim();
                  if (!value) {
                    setResolvedCardRecipient(null);
                    return;
                  }

                  setIsResolvingCardRecipient(true);
                  const recipient = await resolveRecipientByPublicId(value);
                  setIsResolvingCardRecipient(false);

                  if (!recipient) {
                    toast.error('ID da família inválido.');
                    setResolvedCardRecipient(null);
                    return;
                  }

                  setResolvedCardRecipient(recipient);
                }}
              />

              {isResolvingCardRecipient && (
                <p className="text-xs text-muted-foreground">Validando ID da família...</p>
              )}

              {resolvedCardRecipient && (
                <p className="text-xs text-primary">Usuário encontrado: {resolvedCardRecipient.member_name}</p>
              )}
            </div>
          )}

          {/* Tipo de Lançamento: só aparece para cartão, logo abaixo do campo de cartão */}
          <div className="space-y-2">
            <Label htmlFor="tipo-lancamento">Tipo de Lançamento</Label>
            <Select id="tipo-lancamento" value={expenseType} onValueChange={val => setExpenseType(val as any)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="simples">Rotativo</SelectItem>
                <SelectItem value="parcelado">Parcelado</SelectItem>
                <SelectItem value="recorrente">Recorrente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Parcelado/Recorrente logic */}
          {isInstallment && (
            <>
              <div className="space-y-2">
                <Label htmlFor="total_installments">Quantidade de parcelas</Label>
                <Input
                  id="total_installments"
                  type="number"
                  min={2}
                  {...register('total_installments', { valueAsNumber: true })}
                  onChange={e => {
                    const value = Number(e.target.value);
                    setValue('total_installments', value);
                    // Se já tem data da primeira parcela, calcula a última
                    const first = watch('first_installment_date');
                    if (first && value > 1) {
                      const firstDate = new Date(first);
                      const lastDate = new Date(firstDate);
                      lastDate.setMonth(firstDate.getMonth() + value - 1);
                      setValue('last_installment_date', lastDate.toISOString().split('T')[0]);
                    }
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="first_installment_date">Data Primeira Parcela</Label>
                <Input
                  id="first_installment_date"
                  type="date"
                  {...register('first_installment_date')}
                  onChange={e => {
                    setValue('first_installment_date', e.target.value);
                    const total = watch('total_installments');
                    if (e.target.value && total && total > 1) {
                      const firstDate = new Date(e.target.value);
                      const lastDate = new Date(firstDate);
                      lastDate.setMonth(firstDate.getMonth() + total - 1);
                      setValue('last_installment_date', lastDate.toISOString().split('T')[0]);
                    }
                  }}
                />
                {/* Mês efetivo da 1ª parcela */}
                {(() => {
                  const first = watch('first_installment_date');
                  let mesEfetivo = '';
                  if (first) {
                    const data = new Date(first);
                    mesEfetivo = data.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
                  }
                  return first ? (
                    <p className="text-xs text-primary mt-1">Primeira parcela efetiva em: <b>{mesEfetivo.charAt(0).toUpperCase() + mesEfetivo.slice(1)}</b></p>
                  ) : null;
                })()}
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_installment_date">Data Última Parcela</Label>
                <Input
                  id="last_installment_date"
                  type="date"
                  {...register('last_installment_date')}
                />
              </div>
            </>
          )}
          {/* Se for recorrente, não mostra campo de parcelas */}
        </>
      )}
        </>
      )}

      {showLaunchDateField && (
        <div className="space-y-2">
          <Label htmlFor="launch_date">Data do Lançamento</Label>
          <Input
            id="launch_date"
            type="date"
            value={launchDate}
            onChange={e => setLaunchDate(e.target.value)}
            title="Data em que o lançamento vai aparecer"
          />
          <p className="text-xs text-muted-foreground">Escolha em qual data o lançamento vai aparecer</p>
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
          {paymentType === 'card' && isInstallment && (
            <span className="px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 text-xs font-semibold ml-2">
              Obs: Valor referente à parcela
            </span>
          )}
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
        {/* Valor total da compra */}
        {paymentType === 'card' && isInstallment && (() => {
          const parcela = watch('amount');
          const qtd = watch('total_installments');
          if (typeof parcela === 'number' && qtd && qtd > 1) {
            const total = parcela * qtd;
            return (
              <p className="text-xs text-primary mt-1">Valor total da compra: <b>{total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</b></p>
            );
          }
          return null;
        })()}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descrição</Label>
        <Input
          id="description"
          {...register('description')}
          placeholder="Descrição da despesa"
        />
        {errors.description && (
          <p className="text-xs text-destructive">{errors.description.message}</p>
        )}
        {/* Preview dos campos de empréstimo de cartão removido conforme solicitado */}
      </div>


      {/* Campo de data removido do formulário principal. A seleção de data será feita no popup ao realizar a despesa. */}


      {/* Exibe o alerta para todos os tipos, inclusive recorrente */}
      {!isSimpleEntryMode && (
        <div className="p-3 mb-1 rounded-md bg-yellow-50 border border-yellow-300 dark:bg-yellow-900/60 dark:border-yellow-700 text-center text-sm leading-relaxed">
          <span className="font-semibold">Atenção:</span> Despesas sempre são lançadas como <span className="font-semibold">Não Realizadas</span>. Confirme o lançamento no painel.
        </div>
      )}
      {/* Botão dinâmico para recorrente cartão */}
      {isRecurring && paymentType === 'card' ? (
        <Button type="submit" className="w-full" disabled={createExpense.isPending}>
          {initialData && initialData.id
            ? (createExpense.isPending ? 'Salvando...' : 'Salvar Alterações')
            : (createExpense.isPending ? 'Registrando...' : 'Registrar Despesa')}
        </Button>
      ) : (
        <Button type="submit" className="w-full" disabled={createExpense.isPending}>
          {initialData && initialData.id
            ? (createExpense.isPending ? 'Salvando...' : 'Salvar Alterações')
            : (createExpense.isPending ? 'Registrando...' : 'Registrar Despesa')}
        </Button>
      )}

      <Dialog open={confirmTransferOpen} onOpenChange={setConfirmTransferOpen}>
        <DialogContent aria-describedby="confirm-transfer-desc">
          <DialogHeader>
            <DialogTitle>
              Confirmar lançamento para {resolvedRecipient?.member_name || 'destinatário'}?
            </DialogTitle>
          </DialogHeader>

          <span id="confirm-transfer-desc" className="sr-only">
            Confirmação para criar cobrança de empréstimo entre membros da família.
          </span>

          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              A saída será lançada e ficará pendente de confirmação para ambos os lados.
            </p>
            {pendingTransferSubmission && (
              <p className="text-foreground font-medium">
                Valor: {pendingTransferSubmission.amount?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setConfirmTransferOpen(false);
                setPendingTransferSubmission(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={async () => {
                if (!pendingTransferSubmission) return;

                await submitExpenseData(
                  pendingTransferSubmission,
                  false,
                  undefined,
                  resolvedRecipient,
                );
                setConfirmTransferOpen(false);
              }}
            >
              Confirmar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <CalculatorModal
        open={showCalculator}
        onClose={() => setShowCalculator(false)}
        onConfirm={(value) => setValue('amount', value)}
        initialValue={watch('amount')}
      />
    </form>
  );
}
