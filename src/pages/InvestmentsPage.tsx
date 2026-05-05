import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useInvestments, useCreateInvestment } from '@/hooks/useFinances';
import { useDeleteInvestment } from '@/hooks/useInvestmentActions';
import { useUpdateInvestment } from '@/hooks/useUpdateInvestment';
import { useBrapiAssetList, useBrapiQuotes } from '@/hooks/useBrapi';
import { useBcbRates } from '@/hooks/useBcbRates';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { checkSession, handleAuthError } from '@/lib/authErrorHandler';
import { fetchBrapiCloseOnDate } from '@/lib/brapi';
import { Plus, PiggyBank, TrendingUp, Pencil, Trash2, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

type Asset = {
  symbol: string;
  name: string;
  lastPrice: number;
  type?: string;
};

type InvestmentMode = 'market' | 'crypto' | 'consortium' | 'cdb' | 'other';

const investmentSchema = z.object({
  investment_mode: z.enum(['market', 'crypto', 'consortium', 'cdb', 'other']),
  name: z.string().optional(),
  type: z.string().optional(),
  symbol: z.string().optional(),
  quantity: z.number().optional(),
  purchase_price: z.number().optional(),
  consortium_credit_value: z.number().optional(),
  consortium_monthly_value: z.number().optional(),
  consortium_term_months: z.number().optional(),
  consortium_is_contemplated: z.boolean().optional(),
  consortium_contemplated_value: z.number().optional(),
  consortium_will_sell: z.boolean().optional(),
  consortium_sale_value: z.number().optional(),
  cdb_bank_name: z.string().optional(),
  cdb_indexer: z.enum(['cdi', 'selic']).optional(),
  cdb_rate_percent: z.number().optional(),
  initial_value: z.number().min(0),
  current_value: z.number().min(0),
  start_date: z.string().min(1, 'Data da compra obrigatoria'),
  notes: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.investment_mode === 'market' || data.investment_mode === 'crypto') {
    if (!data.symbol) {
      ctx.addIssue({ code: 'custom', message: 'Ativo obrigatorio', path: ['symbol'] });
    }
    if (!data.quantity || data.quantity <= 0) {
      ctx.addIssue({ code: 'custom', message: 'Quantidade deve ser maior que zero', path: ['quantity'] });
    }
    if (!data.purchase_price || data.purchase_price <= 0) {
      ctx.addIssue({
        code: 'custom',
        message: data.investment_mode === 'crypto' ? 'Valor investido deve ser maior que zero' : 'Preco deve ser maior que zero',
        path: ['purchase_price'],
      });
    }
  } else if (data.investment_mode === 'consortium') {
    if (!data.name || !data.name.trim()) {
      ctx.addIssue({ code: 'custom', message: 'Nome da carta obrigatorio', path: ['name'] });
    }
    if (!data.consortium_credit_value || data.consortium_credit_value <= 0) {
      ctx.addIssue({ code: 'custom', message: 'Valor da carta obrigatorio', path: ['consortium_credit_value'] });
    }
    if (!data.consortium_monthly_value || data.consortium_monthly_value <= 0) {
      ctx.addIssue({ code: 'custom', message: 'Valor mensal obrigatorio', path: ['consortium_monthly_value'] });
    }
    if (!data.consortium_term_months || data.consortium_term_months <= 0) {
      ctx.addIssue({ code: 'custom', message: 'Prazo obrigatorio', path: ['consortium_term_months'] });
    }
    if (data.consortium_is_contemplated && (!data.consortium_contemplated_value || data.consortium_contemplated_value <= 0)) {
      ctx.addIssue({ code: 'custom', message: 'Informe o valor contemplado', path: ['consortium_contemplated_value'] });
    }
    if (data.consortium_will_sell && (!data.consortium_sale_value || data.consortium_sale_value <= 0)) {
      ctx.addIssue({ code: 'custom', message: 'Informe o valor de venda', path: ['consortium_sale_value'] });
    }
  } else if (data.investment_mode === 'cdb') {
    if (!data.cdb_bank_name || !data.cdb_bank_name.trim()) {
      ctx.addIssue({ code: 'custom', message: 'Banco obrigatorio', path: ['cdb_bank_name'] });
    }
    if (!data.cdb_indexer) {
      ctx.addIssue({ code: 'custom', message: 'Indexador obrigatorio', path: ['cdb_indexer'] });
    }
    if (!data.cdb_rate_percent || data.cdb_rate_percent <= 0) {
      ctx.addIssue({ code: 'custom', message: 'Taxa do CDB obrigatoria', path: ['cdb_rate_percent'] });
    }
    if (!data.purchase_price || data.purchase_price <= 0) {
      ctx.addIssue({ code: 'custom', message: 'Valor investido deve ser maior que zero', path: ['purchase_price'] });
    }
  } else if (data.investment_mode === 'other') {
    if (!data.name || !data.name.trim()) {
      ctx.addIssue({ code: 'custom', message: 'Nome do investimento obrigatorio', path: ['name'] });
    }
    if (!data.initial_value || data.initial_value <= 0) {
      ctx.addIssue({ code: 'custom', message: 'Valor investido deve ser maior que zero', path: ['initial_value'] });
    }
    if (data.current_value < 0) {
      ctx.addIssue({ code: 'custom', message: 'Valor atual nao pode ser negativo', path: ['current_value'] });
    }
  }
});

type InvestmentFormData = z.infer<typeof investmentSchema>;

const typeLabels: Record<string, string> = {
  savings: 'Poupanca',
  cdb: 'CDB',
  tesouro: 'Tesouro Direto',
  stocks: 'Acoes',
  fii: 'FIIs',
  crypto: 'Criptomoedas',
  other: 'Outro',
  consortium: 'Consorcio',
};

function inferInvestmentType(symbol: string) {
  if (symbol.endsWith('11')) return 'fii';
  if (symbol.includes('-USD') || symbol.includes('USDT') || symbol.includes('BTC')) return 'crypto';
  return 'stocks';
}

function getInvestmentModeFromType(type?: string): InvestmentMode {
  if (type === 'consortium') return 'consortium';
  if (type === 'crypto') return 'crypto';
  if (type === 'cdb') return 'cdb';
  if (type === 'other') return 'other';
  return 'market';
}

function isCryptoAsset(asset: Asset) {
  const inferredType = asset.type || inferInvestmentType(asset.symbol);
  return inferredType === 'crypto';
}

function filterAssetsByMode(assets: Asset[], mode: InvestmentMode) {
  if (mode === 'crypto') return assets.filter(isCryptoAsset);
  if (mode === 'market') return assets.filter((asset) => !isCryptoAsset(asset));
  return assets;
}

function getCryptoQuoteSymbol(symbol: string) {
  const normalized = symbol.toUpperCase().trim();
  if (!normalized) return '';
  if (normalized.includes('-')) return normalized;
  return `${normalized}-BRL`;
}

function getCryptoQuoteCandidates(symbol: string) {
  const normalized = symbol.toUpperCase().trim();
  if (!normalized) return [];
  const noDash = normalized.replace('-', '');
  return Array.from(new Set([`${normalized}-BRL`, `${noDash}BRL`, normalized]));
}

function getQuoteRequestSymbols(symbol: string, typeOrMode?: string) {
  if (!symbol) return [] as string[];
  if (typeOrMode === 'crypto') return getCryptoQuoteCandidates(symbol);
  return [symbol];
}

function getQuoteValue(
  quoteMap: Record<string, number>,
  symbol?: string | null,
  typeOrMode?: string
) {
  if (!symbol) return undefined;
  if (typeOrMode === 'crypto') {
    const candidates = getCryptoQuoteCandidates(symbol);
    for (const candidate of candidates) {
      const value = quoteMap[candidate];
      if (typeof value === 'number') return value;
    }
    return undefined;
  }
  const value = quoteMap[symbol];
  return typeof value === 'number' ? value : undefined;
}

function parseDecimalInput(value: string) {
  const normalized = value.replace(',', '.').replace(/[^\d.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function calcPositionValues(quantity: number, purchasePrice: number, liveQuote?: number) {
  const invested = Number((quantity * purchasePrice).toFixed(2));
  const current = Number(((liveQuote || purchasePrice) * quantity).toFixed(2));
  const gain = current - invested;
  const gainPct = invested > 0 ? (gain / invested) * 100 : 0;
  return { invested, current, gain, gainPct };
}

function calcCryptoValues(quantity: number, investedValue: number, liveQuote?: number) {
  const invested = Number(investedValue.toFixed(2));
  const current = Number(((liveQuote || 0) * quantity).toFixed(2));
  const gain = current - invested;
  const gainPct = invested > 0 ? (gain / invested) * 100 : 0;
  return { invested, current, gain, gainPct };
}

function calcCdbValues(
  startDate: string,
  investedValue: number,
  indexer: 'cdi' | 'selic',
  cdbRatePercent: number,
  rates?: { cdi?: number; selic?: number }
) {
  const start = new Date(startDate);
  const now = new Date();
  const businessDays = countBusinessDays(start, now);

  const benchmarkAnnual = indexer === 'cdi' ? rates?.cdi : rates?.selic;
  if (!benchmarkAnnual || benchmarkAnnual <= 0) {
    const invested = Number(investedValue.toFixed(2));
    return { invested, current: invested, gain: 0, gainPct: 0, benchmarkAnnual: undefined };
  }

  const effectiveAnnual = (benchmarkAnnual * cdbRatePercent) / 100;
  const factor = Math.pow(1 + effectiveAnnual / 100, businessDays / 252);
  const invested = Number(investedValue.toFixed(2));
  const current = Number((invested * factor).toFixed(2));
  const gain = current - invested;
  const gainPct = invested > 0 ? (gain / invested) * 100 : 0;

  return { invested, current, gain, gainPct, benchmarkAnnual };
}

function countBusinessDays(start: Date, end: Date) {
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return 0;

  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);

  const endDate = new Date(end);
  endDate.setHours(0, 0, 0, 0);

  let total = 0;
  while (cursor < endDate) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) total += 1;
    cursor.setDate(cursor.getDate() + 1);
  }

  return total;
}

function monthsSince(startDate: string) {
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return 0;
  const now = new Date();
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  return Math.max(1, months + 1);
}

function calcConsortiumValues(
  startDate: string,
  creditValue: number,
  monthlyValue: number,
  termMonths: number,
  isContemplated?: boolean,
  contemplatedValue?: number,
  willSell?: boolean,
  saleValue?: number
) {
  const paidInstallments = Math.min(termMonths, monthsSince(startDate));
  const remainingInstallments = Math.max(termMonths - paidInstallments, 0);
  const totalPlanned = Number((monthlyValue * termMonths).toFixed(2));
  const invested = Number((monthlyValue * paidInstallments).toFixed(2));
  let current = invested;

  if (willSell && saleValue && saleValue > 0) {
    current = Number(saleValue.toFixed(2));
  } else if (isContemplated && contemplatedValue && contemplatedValue > 0) {
    current = Number(contemplatedValue.toFixed(2));
  }

  const gain = current - invested;
  const gainPct = invested > 0 ? (gain / invested) * 100 : 0;
  return { invested, current, gain, gainPct, paidInstallments, remainingInstallments, totalPlanned, creditValue };
}

function InvestmentSummary({
  mode,
  startDate,
  cdbIndexer,
  cdbRatePercent,
  rates,
  quantity,
  purchasePrice,
  quote,
}: {
  mode: InvestmentMode;
  startDate?: string;
  cdbIndexer?: 'cdi' | 'selic';
  cdbRatePercent?: number;
  rates?: { cdi?: number; selic?: number };
  quantity: number;
  purchasePrice: number;
  quote?: number;
}) {
  const { invested, current, gain, gainPct, benchmarkAnnual } =
    mode === 'cdb'
      ? calcCdbValues(
          startDate || new Date().toISOString().slice(0, 10),
          purchasePrice,
          cdbIndexer || 'cdi',
          Number(cdbRatePercent || 0),
          rates
        )
      :
    mode === 'crypto'
      ? calcCryptoValues(quantity, purchasePrice, quote)
      : calcPositionValues(quantity, purchasePrice, quote);

  return (
    <div className="rounded-lg border border-border p-3 space-y-2 bg-muted/30">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Valor investido</span>
        <span className="font-medium">{formatCurrency(invested)}</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{mode === 'cdb' ? 'Taxa base atual' : 'Cotacao atual'}</span>
        <span className="font-medium">
          {mode === 'cdb'
            ? benchmarkAnnual
              ? `${benchmarkAnnual.toFixed(2)}% a.a.`
              : 'Indisponivel'
            : quote
              ? formatCurrency(quote)
              : 'Indisponivel'}
        </span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Valor atual</span>
        <span className="font-medium">{formatCurrency(current)}</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Resultado</span>
        <span className={cn('font-semibold', gain >= 0 ? 'text-income' : 'text-expense')}>
          {gain >= 0 ? '+' : ''}{formatCurrency(gain)} ({gainPct.toFixed(2)}%)
        </span>
      </div>
    </div>
  );
}

function ConsortiumSummary({
  startDate,
  creditValue,
  monthlyValue,
  termMonths,
  isContemplated,
  contemplatedValue,
  willSell,
  saleValue,
}: {
  startDate: string;
  creditValue: number;
  monthlyValue: number;
  termMonths: number;
  isContemplated?: boolean;
  contemplatedValue?: number;
  willSell?: boolean;
  saleValue?: number;
}) {
  const { invested, current, gain, gainPct, paidInstallments, remainingInstallments, totalPlanned } = calcConsortiumValues(
    startDate,
    creditValue,
    monthlyValue,
    termMonths,
    isContemplated,
    contemplatedValue,
    willSell,
    saleValue
  );

  return (
    <div className="rounded-lg border border-border p-3 space-y-2 bg-muted/30">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Valor da carta</span>
        <span className="font-medium">{formatCurrency(creditValue)}</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Parcelas pagas</span>
        <span className="font-medium">{paidInstallments}/{termMonths}</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Parcelas restantes</span>
        <span className="font-medium">{remainingInstallments}</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Total pago</span>
        <span className="font-medium">{formatCurrency(invested)}</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Total previsto no prazo</span>
        <span className="font-medium">{formatCurrency(totalPlanned)}</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Valor atual estimado</span>
        <span className="font-medium">{formatCurrency(current)}</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Resultado</span>
        <span className={cn('font-semibold', gain >= 0 ? 'text-income' : 'text-expense')}>
          {gain >= 0 ? '+' : ''}{formatCurrency(gain)} ({gainPct.toFixed(2)}%)
        </span>
      </div>
    </div>
  );
}

function ManualInvestmentSummary({
  invested,
  current,
}: {
  invested: number;
  current: number;
}) {
  const gain = current - invested;
  const gainPct = invested > 0 ? (gain / invested) * 100 : 0;

  return (
    <div className="rounded-lg border border-border p-3 space-y-2 bg-muted/30">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Valor investido</span>
        <span className="font-medium">{formatCurrency(invested)}</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Valor atual</span>
        <span className="font-medium">{formatCurrency(current)}</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Resultado</span>
        <span className={cn('font-semibold', gain >= 0 ? 'text-income' : 'text-expense')}>
          {gain >= 0 ? '+' : ''}{formatCurrency(gain)} ({gainPct.toFixed(2)}%)
        </span>
      </div>
    </div>
  );
}

function pickAssetMeta(symbol: string, assets: Asset[]) {
  const asset = assets.find((a) => a.symbol === symbol);
  return {
    name: asset?.name || symbol,
    type: asset?.type || inferInvestmentType(symbol),
    lastPrice: asset?.lastPrice,
  };
}

function EditInvestmentDialog({
  investment,
  open,
  onOpenChange,
}: {
  investment: any;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const updateInvestment = useUpdateInvestment();
  const [isLoadingHistoricalPrice, setIsLoadingHistoricalPrice] = useState(false);
  const [isCryptoSuggestionsOpen, setIsCryptoSuggestionsOpen] = useState(false);
  const [isMarketSuggestionsOpen, setIsMarketSuggestionsOpen] = useState(false);
  const { data: bcbRates } = useBcbRates();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset,
  } = useForm<InvestmentFormData>({
    resolver: zodResolver(investmentSchema),
    defaultValues: {
      ...investment,
      investment_mode: getInvestmentModeFromType(investment?.type),
      quantity: Number(investment?.quantity || 0),
      purchase_price: investment?.type === 'crypto'
        ? Number(investment?.initial_value || 0)
        : Number(investment?.purchase_price || 0),
      symbol: investment?.symbol || '',
      consortium_credit_value: Number(investment?.consortium_credit_value || 0),
      consortium_monthly_value: Number(investment?.consortium_monthly_value || 0),
      consortium_term_months: Number(investment?.consortium_term_months || 0),
      consortium_is_contemplated: Boolean(investment?.consortium_is_contemplated),
      consortium_contemplated_value: Number(investment?.consortium_contemplated_value || 0),
      consortium_will_sell: Boolean(investment?.consortium_will_sell),
      consortium_sale_value: Number(investment?.consortium_sale_value || 0),
      cdb_bank_name: investment?.cdb_bank_name || '',
      cdb_indexer: (investment?.cdb_indexer as 'cdi' | 'selic') || 'cdi',
      cdb_rate_percent: Number(investment?.cdb_rate_percent || 0),
      start_date: investment?.start_date || '',
    },
  });

  const investmentMode = watch('investment_mode');
  const selectedSymbol = watch('symbol');
  const quantity = Number(watch('quantity') || 0);
  const purchasePrice = Number(watch('purchase_price') || 0);
  const consortiumCreditValue = Number(watch('consortium_credit_value') || 0);
  const consortiumMonthlyValue = Number(watch('consortium_monthly_value') || 0);
  const consortiumTermMonths = Number(watch('consortium_term_months') || 0);
  const consortiumIsContemplated = Boolean(watch('consortium_is_contemplated'));
  const consortiumContemplatedValue = Number(watch('consortium_contemplated_value') || 0);
  const consortiumWillSell = Boolean(watch('consortium_will_sell'));
  const consortiumSaleValue = Number(watch('consortium_sale_value') || 0);
  const manualInvestedValue = Number(watch('initial_value') || 0);
  const manualCurrentValue = Number(watch('current_value') || 0);
  const cdbBankName = watch('cdb_bank_name') || '';
  const cdbIndexer = (watch('cdb_indexer') as 'cdi' | 'selic' | undefined) || 'cdi';
  const cdbRatePercent = Number(watch('cdb_rate_percent') || 0);
  const { data: assets = [] } = useBrapiAssetList(selectedSymbol || '');
  const filteredAssets = useMemo(() => filterAssetsByMode(assets, investmentMode as InvestmentMode), [assets, investmentMode]);
  const selectedQuoteRequestSymbols = selectedSymbol
    ? getQuoteRequestSymbols(selectedSymbol, investmentMode)
    : [];
  const { data: quotes = {} } = useBrapiQuotes(selectedQuoteRequestSymbols);
  const selectedQuote = getQuoteValue(quotes, selectedSymbol, investmentMode);

  useEffect(() => {
    if (open && investment) {
      reset({
        ...investment,
        investment_mode: getInvestmentModeFromType(investment?.type),
        quantity: Number(investment?.quantity || 0),
        purchase_price: investment?.type === 'crypto'
          ? Number(investment?.initial_value || 0)
          : Number(investment?.purchase_price || 0),
        symbol: investment?.symbol || '',
        consortium_credit_value: Number(investment?.consortium_credit_value || 0),
        consortium_monthly_value: Number(investment?.consortium_monthly_value || 0),
        consortium_term_months: Number(investment?.consortium_term_months || 0),
        consortium_is_contemplated: Boolean(investment?.consortium_is_contemplated),
        consortium_contemplated_value: Number(investment?.consortium_contemplated_value || 0),
        consortium_will_sell: Boolean(investment?.consortium_will_sell),
        consortium_sale_value: Number(investment?.consortium_sale_value || 0),
        cdb_bank_name: investment?.cdb_bank_name || '',
        cdb_indexer: (investment?.cdb_indexer as 'cdi' | 'selic') || 'cdi',
        cdb_rate_percent: Number(investment?.cdb_rate_percent || 0),
        start_date: investment?.start_date || '',
      });
    }
  }, [investment, open, reset]);

  useEffect(() => {
    if ((investmentMode === 'market' || investmentMode === 'crypto' || investmentMode === 'cdb') && purchasePrice > 0 && (quantity > 0 || investmentMode === 'cdb')) {
      const { invested, current } =
        investmentMode === 'crypto'
          ? calcCryptoValues(quantity, purchasePrice, selectedQuote)
          : investmentMode === 'cdb'
            ? calcCdbValues(watch('start_date') || new Date().toISOString().slice(0, 10), purchasePrice, cdbIndexer, cdbRatePercent, bcbRates)
            : calcPositionValues(quantity, purchasePrice, selectedQuote);
      setValue('initial_value', invested);
      setValue('current_value', current);
    }
  }, [investmentMode, quantity, purchasePrice, selectedQuote, setValue, watch, cdbIndexer, cdbRatePercent, bcbRates]);

  useEffect(() => {
    if (investmentMode === 'consortium' && consortiumMonthlyValue > 0 && consortiumTermMonths > 0 && watch('start_date')) {
      const { invested, current } = calcConsortiumValues(
        watch('start_date'),
        consortiumCreditValue,
        consortiumMonthlyValue,
        consortiumTermMonths,
        consortiumIsContemplated,
        consortiumContemplatedValue,
        consortiumWillSell,
        consortiumSaleValue
      );
      setValue('initial_value', invested);
      setValue('current_value', current);
    }
  }, [
    investmentMode,
    consortiumCreditValue,
    consortiumMonthlyValue,
    consortiumTermMonths,
    consortiumIsContemplated,
    consortiumContemplatedValue,
    consortiumWillSell,
    consortiumSaleValue,
    setValue,
    watch,
  ]);

  const onSubmit = async (data: InvestmentFormData) => {
    try {
      const isSessionValid = await checkSession();
      if (!isSessionValid) {
        toast.error('Sua sessao expirou. Faca login novamente.');
        onOpenChange(false);
        navigate('/');
        return;
      }

      if (data.investment_mode === 'consortium') {
        const { invested, current } = calcConsortiumValues(
          data.start_date,
          Number(data.consortium_credit_value || 0),
          Number(data.consortium_monthly_value || 0),
          Number(data.consortium_term_months || 0),
          Boolean(data.consortium_is_contemplated),
          Number(data.consortium_contemplated_value || 0),
          Boolean(data.consortium_will_sell),
          Number(data.consortium_sale_value || 0)
        );

        await updateInvestment.mutateAsync({
          id: investment.id,
          name: data.name || 'Carta de credito',
          type: 'consortium',
          symbol: null,
          quantity: null,
          purchase_price: null,
          consortium_credit_value: Number(data.consortium_credit_value || 0),
          consortium_monthly_value: Number(data.consortium_monthly_value || 0),
          consortium_term_months: Number(data.consortium_term_months || 0),
          consortium_is_contemplated: Boolean(data.consortium_is_contemplated),
          consortium_contemplated_value: data.consortium_is_contemplated ? Number(data.consortium_contemplated_value || 0) : null,
          consortium_will_sell: Boolean(data.consortium_will_sell),
          consortium_sale_value: data.consortium_will_sell ? Number(data.consortium_sale_value || 0) : null,
          initial_value: invested,
          current_value: current,
          start_date: data.start_date,
          notes: data.notes,
        });
      } else if (data.investment_mode === 'cdb') {
        const { invested, current } = calcCdbValues(
          data.start_date,
          Number(data.purchase_price || 0),
          (data.cdb_indexer as 'cdi' | 'selic') || 'cdi',
          Number(data.cdb_rate_percent || 0),
          bcbRates
        );

        await updateInvestment.mutateAsync({
          id: investment.id,
          name: `CDB - ${data.cdb_bank_name || 'Banco'}`,
          type: 'cdb',
          symbol: null,
          quantity: null,
          purchase_price: Number(data.purchase_price || 0),
          cdb_bank_name: data.cdb_bank_name || null,
          cdb_indexer: data.cdb_indexer || null,
          cdb_rate_percent: Number(data.cdb_rate_percent || 0),
          consortium_credit_value: null,
          consortium_monthly_value: null,
          consortium_term_months: null,
          consortium_is_contemplated: null,
          consortium_contemplated_value: null,
          consortium_will_sell: null,
          consortium_sale_value: null,
          initial_value: invested,
          current_value: current,
          start_date: data.start_date,
          notes: data.notes,
        });
      } else if (data.investment_mode === 'other') {
        await updateInvestment.mutateAsync({
          id: investment.id,
          name: data.name || 'Outro investimento',
          type: 'other',
          symbol: null,
          quantity: null,
          purchase_price: null,
          cdb_bank_name: null,
          cdb_indexer: null,
          cdb_rate_percent: null,
          consortium_credit_value: null,
          consortium_monthly_value: null,
          consortium_term_months: null,
          consortium_is_contemplated: null,
          consortium_contemplated_value: null,
          consortium_will_sell: null,
          consortium_sale_value: null,
          initial_value: Number(data.initial_value || 0),
          current_value: Number(data.current_value || 0),
          start_date: data.start_date,
          notes: data.notes,
        });
      } else {
        const meta = pickAssetMeta(data.symbol || '', assets);
        const { invested, current } =
          data.investment_mode === 'crypto'
            ? calcCryptoValues(Number(data.quantity || 0), Number(data.purchase_price || 0), selectedQuote)
            : calcPositionValues(Number(data.quantity || 0), Number(data.purchase_price || 0), selectedQuote);

        await updateInvestment.mutateAsync({
          id: investment.id,
          name: meta.name,
          type: data.investment_mode === 'crypto' ? 'crypto' : meta.type,
          symbol: data.symbol || null,
          quantity: data.quantity ?? null,
          purchase_price: data.purchase_price ?? null,
          consortium_credit_value: null,
          consortium_monthly_value: null,
          consortium_term_months: null,
          consortium_is_contemplated: null,
          consortium_contemplated_value: null,
          consortium_will_sell: null,
          consortium_sale_value: null,
          initial_value: invested,
          current_value: current,
          start_date: data.start_date,
          notes: data.notes,
        });
      }

      onOpenChange(false);
      toast.success('Investimento atualizado!');
    } catch (error: any) {
      const errorMsg = handleAuthError(error, () => {
        onOpenChange(false);
        navigate('/');
      });
      if (errorMsg !== 'Sessao expirada') toast.error(errorMsg);
    }
  };

  const handleUsePurchaseDayClose = async () => {
    if (investmentMode === 'consortium') return;
    if (!selectedSymbol || !watch('start_date')) {
      toast.error('Selecione ativo e data da compra primeiro.');
      return;
    }

    try {
      setIsLoadingHistoricalPrice(true);
      const historical = await fetchBrapiCloseOnDate(selectedSymbol, watch('start_date'));
      setValue('purchase_price', Number(historical.close.toFixed(2)));
      toast.success(`Preco preenchido com fechamento de ${formatDate(historical.usedDate)}.`);
    } catch (error: any) {
      toast.error(error?.message || 'Nao foi possivel carregar o fechamento da data.');
    } finally {
      setIsLoadingHistoricalPrice(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar investimento</DialogTitle>
          <DialogDescription>Atualize os dados do investimento selecionado.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo de cadastro</Label>
            <Select value={investmentMode} onValueChange={(value: InvestmentMode) => setValue('investment_mode', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="market">Ativo de Mercado</SelectItem>
                <SelectItem value="crypto">Criptomoedas</SelectItem>
                <SelectItem value="consortium">Consórcio / Carta de Crédito</SelectItem>
                <SelectItem value="cdb">CDB</SelectItem>
                <SelectItem value="other">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {investmentMode === 'market' || investmentMode === 'crypto' ? (
            <>
              {investmentMode === 'crypto' ? (
                <div className="space-y-2">
                  <Label>Moeda</Label>
                  <Input
                    value={selectedSymbol || ''}
                    onChange={(e) => {
                      const ticker = e.target.value.toUpperCase().trim();
                      setValue('symbol', ticker);
                      setValue('name', ticker);
                      setValue('type', 'crypto');
                      setIsCryptoSuggestionsOpen(true);
                    }}
                    onFocus={() => setIsCryptoSuggestionsOpen(true)}
                    onBlur={() => setTimeout(() => setIsCryptoSuggestionsOpen(false), 120)}
                    placeholder="Ex: BTC, ETH, ADA..."
                  />
                  {isCryptoSuggestionsOpen && (
                    <div className="rounded-md border border-border bg-popover text-popover-foreground shadow-md max-h-56 overflow-auto">
                      {filteredAssets
                        .filter((asset) =>
                          asset.symbol.toUpperCase().includes((selectedSymbol || '').toUpperCase()) ||
                          asset.name.toUpperCase().includes((selectedSymbol || '').toUpperCase())
                        )
                        .slice(0, 20)
                        .map((asset) => (
                          <button
                            key={asset.symbol}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                            onMouseDown={() => {
                              setValue('symbol', asset.symbol);
                              setValue('name', asset.name);
                              setValue('type', 'crypto');
                              setIsCryptoSuggestionsOpen(false);
                            }}
                          >
                            {asset.symbol} - {asset.name}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Ativo (ticker)</Label>
                  <Input
                    value={selectedSymbol || ''}
                    onChange={(e) => {
                      const ticker = e.target.value.toUpperCase().trim();
                      setValue('symbol', ticker);
                      setIsMarketSuggestionsOpen(true);

                      const meta = pickAssetMeta(ticker, assets);
                      if (meta.name !== ticker) {
                        setValue('name', meta.name);
                        setValue('type', meta.type);
                        if (investmentMode === 'market' && Number(watch('purchase_price') || 0) <= 0 && typeof meta.lastPrice === 'number' && meta.lastPrice > 0) {
                          setValue('purchase_price', Number(meta.lastPrice.toFixed(2)));
                        }
                      }
                    }}
                    onFocus={() => setIsMarketSuggestionsOpen(true)}
                    onBlur={() => setTimeout(() => setIsMarketSuggestionsOpen(false), 120)}
                    placeholder="Ex: PETR4, VALE3, MXRF11..."
                  />
                  {isMarketSuggestionsOpen && (
                    <div className="rounded-md border border-border bg-popover text-popover-foreground shadow-md max-h-56 overflow-auto">
                      {filteredAssets
                        .filter((asset) =>
                          asset.symbol.toUpperCase().includes((selectedSymbol || '').toUpperCase()) ||
                          asset.name.toUpperCase().includes((selectedSymbol || '').toUpperCase())
                        )
                        .slice(0, 20)
                        .map((asset) => (
                          <button
                            key={asset.symbol}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                            onMouseDown={() => {
                              setValue('symbol', asset.symbol);
                              setValue('name', asset.name);
                              setValue('type', asset.type || inferInvestmentType(asset.symbol));
                              if (investmentMode === 'market' && Number(watch('purchase_price') || 0) <= 0 && asset.lastPrice > 0) {
                                setValue('purchase_price', Number(asset.lastPrice.toFixed(2)));
                              }
                              setIsMarketSuggestionsOpen(false);
                            }}
                          >
                            {asset.symbol} - {asset.name}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              )}
              {errors.symbol && <p className="text-xs text-destructive">{errors.symbol.message}</p>}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{investmentMode === 'crypto' ? 'Quantidade da moeda' : 'Quantidade de cotas'}</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    {...register('quantity', {
                      setValueAs: (value) => {
                        const normalized = String(value ?? '').replace(',', '.');
                        const parsed = Number(normalized);
                        return Number.isFinite(parsed) ? parsed : 0;
                      },
                    })}
                  />
                  {errors.quantity && <p className="text-xs text-destructive">{errors.quantity.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>{investmentMode === 'crypto' ? 'Valor investido' : 'Valor pago por cota'}</Label>
                  <Input
                    inputMode="numeric"
                    placeholder="R$ 0,00"
                    value={(Number(watch('purchase_price') || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '');
                      const value = digits ? parseFloat(digits) / 100 : 0;
                      setValue('purchase_price', value);
                    }}
                  />
                  {errors.purchase_price && <p className="text-xs text-destructive">{errors.purchase_price.message}</p>}
                </div>
              </div>
            </>
          ) : investmentMode === 'cdb' ? (
            <>
              <div className="space-y-2">
                <Label>Banco do CDB</Label>
                <Input
                  value={cdbBankName}
                  onChange={(e) => setValue('cdb_bank_name', e.target.value)}
                  placeholder="Ex: Banco Inter"
                />
                {errors.cdb_bank_name && <p className="text-xs text-destructive">{errors.cdb_bank_name.message}</p>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Indexador</Label>
                  <Select value={cdbIndexer} onValueChange={(value: 'cdi' | 'selic') => setValue('cdb_indexer', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cdi">CDI</SelectItem>
                      <SelectItem value="selic">Selic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Taxa do CDB (% do indexador)</Label>
                  <Input
                    inputMode="decimal"
                    value={watch('cdb_rate_percent') ?? ''}
                    onChange={(e) => setValue('cdb_rate_percent', parseDecimalInput(e.target.value))}
                    placeholder="Ex: 110"
                  />
                  {errors.cdb_rate_percent && <p className="text-xs text-destructive">{errors.cdb_rate_percent.message}</p>}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Valor investido</Label>
                <Input
                  inputMode="numeric"
                  placeholder="R$ 0,00"
                  value={(Number(watch('purchase_price') || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '');
                    const value = digits ? parseFloat(digits) / 100 : 0;
                    setValue('purchase_price', value);
                  }}
                />
                {errors.purchase_price && <p className="text-xs text-destructive">{errors.purchase_price.message}</p>}
              </div>
            </>
          ) : investmentMode === 'other' ? (
            <>
              <div className="space-y-2">
                <Label>Nome do investimento</Label>
                <Input
                  value={watch('name') || ''}
                  onChange={(e) => setValue('name', e.target.value)}
                  placeholder="Ex: Joia, item colecionavel, investimento pessoal"
                />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Valor investido</Label>
                  <Input
                    inputMode="numeric"
                    placeholder="R$ 0,00"
                    value={(Number(watch('initial_value') || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '');
                      const value = digits ? parseFloat(digits) / 100 : 0;
                      setValue('initial_value', value);
                    }}
                  />
                  {errors.initial_value && <p className="text-xs text-destructive">{errors.initial_value.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Valor atual</Label>
                  <Input
                    inputMode="numeric"
                    placeholder="R$ 0,00"
                    value={(Number(watch('current_value') || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '');
                      const value = digits ? parseFloat(digits) / 100 : 0;
                      setValue('current_value', value);
                    }}
                  />
                  {errors.current_value && <p className="text-xs text-destructive">{errors.current_value.message}</p>}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Nome da carta</Label>
                <Input
                  value={watch('name') || ''}
                  onChange={(e) => setValue('name', e.target.value)}
                  placeholder="Ex: Consorcio de veiculo"
                />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Valor da carta</Label>
                <Input
                  inputMode="numeric"
                  placeholder="R$ 0,00"
                  value={(Number(watch('consortium_credit_value') || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '');
                    const value = digits ? parseFloat(digits) / 100 : 0;
                    setValue('consortium_credit_value', value);
                  }}
                />
                {errors.consortium_credit_value && <p className="text-xs text-destructive">{errors.consortium_credit_value.message}</p>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Valor mensal da carta</Label>
                  <Input
                    inputMode="numeric"
                    placeholder="R$ 0,00"
                    value={(Number(watch('consortium_monthly_value') || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '');
                      const value = digits ? parseFloat(digits) / 100 : 0;
                      setValue('consortium_monthly_value', value);
                    }}
                  />
                  {errors.consortium_monthly_value && <p className="text-xs text-destructive">{errors.consortium_monthly_value.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Prazo (meses)</Label>
                  <Input
                    inputMode="numeric"
                    value={watch('consortium_term_months') ?? ''}
                    onChange={(e) => setValue('consortium_term_months', Math.max(0, Number(e.target.value) || 0))}
                  />
                  {errors.consortium_term_months && <p className="text-xs text-destructive">{errors.consortium_term_months.message}</p>}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Foi contemplado?</Label>
                  <Select
                    value={watch('consortium_is_contemplated') ? 'yes' : 'no'}
                    onValueChange={(value) => setValue('consortium_is_contemplated', value === 'yes')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no">Nao</SelectItem>
                      <SelectItem value="yes">Sim</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {watch('consortium_is_contemplated') && (
                  <div className="space-y-2">
                    <Label>Valor contemplado</Label>
                    <Input
                      inputMode="decimal"
                      value={watch('consortium_contemplated_value') ?? ''}
                      onChange={(e) => setValue('consortium_contemplated_value', parseDecimalInput(e.target.value))}
                    />
                    {errors.consortium_contemplated_value && <p className="text-xs text-destructive">{errors.consortium_contemplated_value.message}</p>}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>A carta sera vendida?</Label>
                  <Select
                    value={watch('consortium_will_sell') ? 'yes' : 'no'}
                    onValueChange={(value) => setValue('consortium_will_sell', value === 'yes')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no">Nao</SelectItem>
                      <SelectItem value="yes">Sim</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {watch('consortium_will_sell') && (
                  <div className="space-y-2">
                    <Label>Valor de venda</Label>
                    <Input
                      inputMode="decimal"
                      value={watch('consortium_sale_value') ?? ''}
                      onChange={(e) => setValue('consortium_sale_value', parseDecimalInput(e.target.value))}
                    />
                    {errors.consortium_sale_value && <p className="text-xs text-destructive">{errors.consortium_sale_value.message}</p>}
                  </div>
                )}
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label>Data da compra</Label>
            <Input type="date" {...register('start_date')} />
            {errors.start_date && <p className="text-xs text-destructive">{errors.start_date.message}</p>}
          </div>

          {investmentMode === 'market' && (
            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  if (selectedQuote) {
                    setValue('purchase_price', Number(selectedQuote.toFixed(2)));
                  }
                }}
              >
                Usar hoje
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={isLoadingHistoricalPrice}
                onClick={handleUsePurchaseDayClose}
              >
                {isLoadingHistoricalPrice ? 'Buscando...' : 'Usar fechamento da data'}
              </Button>
            </div>
          )}

          {investmentMode === 'consortium' ? (
            <ConsortiumSummary
              startDate={watch('start_date') || new Date().toISOString().slice(0, 10)}
              creditValue={consortiumCreditValue}
              monthlyValue={consortiumMonthlyValue}
              termMonths={consortiumTermMonths}
              isContemplated={consortiumIsContemplated}
              contemplatedValue={consortiumContemplatedValue}
              willSell={consortiumWillSell}
              saleValue={consortiumSaleValue}
            />
          ) : investmentMode === 'other' ? (
            <ManualInvestmentSummary invested={manualInvestedValue} current={manualCurrentValue} />
          ) : (
            <InvestmentSummary
              mode={investmentMode as InvestmentMode}
              startDate={watch('start_date')}
              cdbIndexer={cdbIndexer}
              cdbRatePercent={cdbRatePercent}
              rates={bcbRates}
              quantity={quantity}
              purchasePrice={purchasePrice}
              quote={selectedQuote}
            />
          )}

          <div className="space-y-2">
            <Label>Observacoes</Label>
            <Textarea {...register('notes')} />
          </div>

          <Button type="submit" className="w-full" disabled={updateInvestment.isPending}>
            {updateInvestment.isPending ? 'Salvando...' : 'Salvar alteracoes'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteInvestmentDialog({
  investment,
  open,
  onOpenChange,
  onDelete,
}: {
  investment: any;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDelete: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir investimento</DialogTitle>
          <DialogDescription>Confirme a exclusao permanente deste investimento.</DialogDescription>
        </DialogHeader>
        <p>Tem certeza que deseja excluir o investimento <b>{investment.name}</b>?</p>
        <div className="flex gap-2 justify-end mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="destructive" onClick={onDelete}>Excluir</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function InvestmentsPage() {
  const navigate = useNavigate();
  const { currentMember, isAuthenticated } = useAuth();
  const { data: investments = [], isLoading } = useInvestments(currentMember?.id);
  const createInvestment = useCreateInvestment();
  const deleteInvestment = useDeleteInvestment();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editDialog, setEditDialog] = useState<{ open: boolean; investment: any | null }>({ open: false, investment: null });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; investment: any | null }>({ open: false, investment: null });
  const [assetSearch, setAssetSearch] = useState('');
  const [isLoadingHistoricalPrice, setIsLoadingHistoricalPrice] = useState(false);
  const [isCryptoSuggestionsOpen, setIsCryptoSuggestionsOpen] = useState(false);
  const [isMarketSuggestionsOpen, setIsMarketSuggestionsOpen] = useState(false);
  const [expandedConsortiumCards, setExpandedConsortiumCards] = useState<Record<string, boolean>>({});
  const { data: bcbRates } = useBcbRates();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<InvestmentFormData>({
    resolver: zodResolver(investmentSchema),
    defaultValues: {
      investment_mode: 'market',
      symbol: '',
      initial_value: 0,
      current_value: 0,
      quantity: 0,
      purchase_price: 0,
      consortium_credit_value: 0,
      consortium_monthly_value: 0,
      consortium_term_months: 0,
      consortium_is_contemplated: false,
      consortium_contemplated_value: 0,
      consortium_will_sell: false,
      consortium_sale_value: 0,
      cdb_bank_name: '',
      cdb_indexer: 'cdi',
      cdb_rate_percent: 0,
      start_date: '',
    },
  });

  const { data: assets = [], isFetching: isFetchingAssets } = useBrapiAssetList(assetSearch);
  const investmentMode = watch('investment_mode');
  const filteredAssets = useMemo(() => filterAssetsByMode(assets, investmentMode as InvestmentMode), [assets, investmentMode]);
  const selectedSymbol = watch('symbol');
  const quantity = Number(watch('quantity') || 0);
  const purchasePrice = Number(watch('purchase_price') || 0);
  const consortiumCreditValue = Number(watch('consortium_credit_value') || 0);
  const consortiumMonthlyValue = Number(watch('consortium_monthly_value') || 0);
  const consortiumTermMonths = Number(watch('consortium_term_months') || 0);
  const consortiumIsContemplated = Boolean(watch('consortium_is_contemplated'));
  const consortiumContemplatedValue = Number(watch('consortium_contemplated_value') || 0);
  const consortiumWillSell = Boolean(watch('consortium_will_sell'));
  const consortiumSaleValue = Number(watch('consortium_sale_value') || 0);
  const manualInvestedValue = Number(watch('initial_value') || 0);
  const manualCurrentValue = Number(watch('current_value') || 0);
  const cdbBankName = watch('cdb_bank_name') || '';
  const cdbIndexer = (watch('cdb_indexer') as 'cdi' | 'selic' | undefined) || 'cdi';
  const cdbRatePercent = Number(watch('cdb_rate_percent') || 0);

  const symbolsForQuote = useMemo(
    () => {
      const symbols = [
        ...investments.flatMap((inv) => getQuoteRequestSymbols(inv.symbol || '', inv.type)),
        ...(selectedSymbol ? getQuoteRequestSymbols(selectedSymbol, investmentMode) : []),
      ].filter((v): v is string => Boolean(v));

      return Array.from(new Set(symbols));
    },
    [investments, selectedSymbol, investmentMode]
  );

  const { data: quoteMap = {}, isFetching: isFetchingQuotes, refetch: refetchQuotes } = useBrapiQuotes(symbolsForQuote);
  const selectedQuote = getQuoteValue(quoteMap, selectedSymbol, investmentMode);

  useEffect(() => {
    if ((investmentMode === 'market' || investmentMode === 'crypto' || investmentMode === 'cdb') && purchasePrice > 0 && (quantity > 0 || investmentMode === 'cdb')) {
      const { invested, current } =
        investmentMode === 'crypto'
          ? calcCryptoValues(quantity, purchasePrice, selectedQuote)
          : investmentMode === 'cdb'
            ? calcCdbValues(watch('start_date') || new Date().toISOString().slice(0, 10), purchasePrice, cdbIndexer, cdbRatePercent, bcbRates)
            : calcPositionValues(quantity, purchasePrice, selectedQuote);
      setValue('initial_value', invested);
      setValue('current_value', current);
    }
  }, [investmentMode, quantity, purchasePrice, selectedQuote, setValue, watch, cdbIndexer, cdbRatePercent, bcbRates]);

  useEffect(() => {
    if (investmentMode === 'consortium' && consortiumMonthlyValue > 0 && consortiumTermMonths > 0 && watch('start_date')) {
      const { invested, current } = calcConsortiumValues(
        watch('start_date'),
        consortiumCreditValue,
        consortiumMonthlyValue,
        consortiumTermMonths,
        consortiumIsContemplated,
        consortiumContemplatedValue,
        consortiumWillSell,
        consortiumSaleValue
      );
      setValue('initial_value', invested);
      setValue('current_value', current);
    }
  }, [
    investmentMode,
    consortiumCreditValue,
    consortiumMonthlyValue,
    consortiumTermMonths,
    consortiumIsContemplated,
    consortiumContemplatedValue,
    consortiumWillSell,
    consortiumSaleValue,
    setValue,
    watch,
  ]);

  const onSubmit = async (data: InvestmentFormData) => {
    if (!currentMember) return;

    try {
      const isSessionValid = await checkSession();
      if (!isSessionValid) {
        toast.error('Sua sessao expirou. Faca login novamente.');
        navigate('/');
        return;
      }

      if (data.investment_mode === 'consortium') {
        const { invested, current } = calcConsortiumValues(
          data.start_date,
          Number(data.consortium_credit_value || 0),
          Number(data.consortium_monthly_value || 0),
          Number(data.consortium_term_months || 0),
          Boolean(data.consortium_is_contemplated),
          Number(data.consortium_contemplated_value || 0),
          Boolean(data.consortium_will_sell),
          Number(data.consortium_sale_value || 0)
        );

        await createInvestment.mutateAsync({
          member_id: currentMember.id,
          name: data.name || 'Carta de credito',
          type: 'consortium',
          symbol: null,
          quantity: null,
          purchase_price: null,
          consortium_credit_value: Number(data.consortium_credit_value || 0),
          consortium_monthly_value: Number(data.consortium_monthly_value || 0),
          consortium_term_months: Number(data.consortium_term_months || 0),
          consortium_is_contemplated: Boolean(data.consortium_is_contemplated),
          consortium_contemplated_value: data.consortium_is_contemplated ? Number(data.consortium_contemplated_value || 0) : null,
          consortium_will_sell: Boolean(data.consortium_will_sell),
          consortium_sale_value: data.consortium_will_sell ? Number(data.consortium_sale_value || 0) : null,
          initial_value: invested,
          current_value: current,
          start_date: data.start_date,
          notes: data.notes,
        });
      } else if (data.investment_mode === 'cdb') {
        const { invested, current } = calcCdbValues(
          data.start_date,
          Number(data.purchase_price || 0),
          (data.cdb_indexer as 'cdi' | 'selic') || 'cdi',
          Number(data.cdb_rate_percent || 0),
          bcbRates
        );

        await createInvestment.mutateAsync({
          member_id: currentMember.id,
          name: `CDB - ${data.cdb_bank_name || 'Banco'}`,
          type: 'cdb',
          symbol: null,
          quantity: null,
          purchase_price: Number(data.purchase_price || 0),
          cdb_bank_name: data.cdb_bank_name || null,
          cdb_indexer: data.cdb_indexer || null,
          cdb_rate_percent: Number(data.cdb_rate_percent || 0),
          consortium_credit_value: null,
          consortium_monthly_value: null,
          consortium_term_months: null,
          consortium_is_contemplated: null,
          consortium_contemplated_value: null,
          consortium_will_sell: null,
          consortium_sale_value: null,
          initial_value: invested,
          current_value: current,
          start_date: data.start_date,
          notes: data.notes,
        });
      } else if (data.investment_mode === 'other') {
        await createInvestment.mutateAsync({
          member_id: currentMember.id,
          name: data.name || 'Outro investimento',
          type: 'other',
          symbol: null,
          quantity: null,
          purchase_price: null,
          cdb_bank_name: null,
          cdb_indexer: null,
          cdb_rate_percent: null,
          consortium_credit_value: null,
          consortium_monthly_value: null,
          consortium_term_months: null,
          consortium_is_contemplated: null,
          consortium_contemplated_value: null,
          consortium_will_sell: null,
          consortium_sale_value: null,
          initial_value: Number(data.initial_value || 0),
          current_value: Number(data.current_value || 0),
          start_date: data.start_date,
          notes: data.notes,
        });
      } else {
        const meta = pickAssetMeta(data.symbol || '', assets);
        const { invested, current } =
          data.investment_mode === 'crypto'
            ? calcCryptoValues(Number(data.quantity || 0), Number(data.purchase_price || 0), selectedQuote)
            : calcPositionValues(Number(data.quantity || 0), Number(data.purchase_price || 0), selectedQuote);

        await createInvestment.mutateAsync({
          member_id: currentMember.id,
          name: meta.name,
          type: data.investment_mode === 'crypto' ? 'crypto' : meta.type,
          symbol: data.symbol || null,
          quantity: data.quantity ?? null,
          purchase_price: data.purchase_price ?? null,
          consortium_credit_value: null,
          consortium_monthly_value: null,
          consortium_term_months: null,
          consortium_is_contemplated: null,
          consortium_contemplated_value: null,
          consortium_will_sell: null,
          consortium_sale_value: null,
          initial_value: invested,
          current_value: current,
          start_date: data.start_date,
          notes: data.notes,
        });
      }

      toast.success('Investimento cadastrado com sucesso!');
      reset({
        investment_mode: 'market',
        symbol: '',
        initial_value: 0,
        current_value: 0,
        quantity: 0,
        purchase_price: 0,
        consortium_credit_value: 0,
        consortium_monthly_value: 0,
        consortium_term_months: 0,
        consortium_is_contemplated: false,
        consortium_contemplated_value: 0,
        consortium_will_sell: false,
        consortium_sale_value: 0,
        cdb_bank_name: '',
        cdb_indexer: 'cdi',
        cdb_rate_percent: 0,
        start_date: '',
        notes: '',
      });
      setAssetSearch('');
      setIsAddDialogOpen(false);
    } catch (error: any) {
      const errorMsg = handleAuthError(error, () => navigate('/'));
      if (errorMsg !== 'Sessao expirada') toast.error(errorMsg);
    }
  };

  const handleUsePurchaseDayClose = async () => {
    if (investmentMode === 'consortium') return;
    if (!selectedSymbol || !watch('start_date')) {
      toast.error('Selecione ativo e data da compra primeiro.');
      return;
    }

    try {
      setIsLoadingHistoricalPrice(true);
      const historical = await fetchBrapiCloseOnDate(selectedSymbol, watch('start_date'));
      setValue('purchase_price', Number(historical.close.toFixed(2)));
      toast.success(`Preco preenchido com fechamento de ${formatDate(historical.usedDate)}.`);
    } catch (error: any) {
      toast.error(error?.message || 'Nao foi possivel carregar o fechamento da data.');
    } finally {
      setIsLoadingHistoricalPrice(false);
    }
  };

  const viewRows = investments.map((investment) => {
    if (investment.type === 'consortium') {
      const { invested, current, gain, gainPct, paidInstallments, remainingInstallments, totalPlanned } = calcConsortiumValues(
        investment.start_date || new Date().toISOString().slice(0, 10),
        Number(investment.consortium_credit_value || 0),
        Number(investment.consortium_monthly_value || 0),
        Number(investment.consortium_term_months || 0),
        Boolean(investment.consortium_is_contemplated),
        Number(investment.consortium_contemplated_value || 0),
        Boolean(investment.consortium_will_sell),
        Number(investment.consortium_sale_value || 0)
      );
      return {
        investment,
        invested,
        current,
        gain,
        gainPct,
        quote: undefined as number | undefined,
        paidInstallments,
        remainingInstallments,
        totalPlanned,
      };
    }

    if (investment.type === 'cdb') {
      const { invested, current, gain, gainPct, benchmarkAnnual } = calcCdbValues(
        investment.start_date || new Date().toISOString().slice(0, 10),
        Number(investment.initial_value || investment.purchase_price || 0),
        (investment.cdb_indexer as 'cdi' | 'selic') || 'cdi',
        Number(investment.cdb_rate_percent || 0),
        bcbRates
      );

      return {
        investment,
        invested,
        current,
        gain,
        gainPct,
        quote: benchmarkAnnual,
        paidInstallments: undefined as number | undefined,
        remainingInstallments: undefined as number | undefined,
        totalPlanned: undefined as number | undefined,
      };
    }

    const rowQuantity = Number(investment.quantity || 0);
    const rowPurchasePrice = Number(investment.purchase_price || 0);
    const invested = investment.type === 'crypto'
      ? Number(investment.initial_value)
      : (rowQuantity > 0 && rowPurchasePrice > 0
          ? Number((rowQuantity * rowPurchasePrice).toFixed(2))
          : Number(investment.initial_value));
    const quote = getQuoteValue(quoteMap, investment.symbol, investment.type);
    const current = quote && rowQuantity > 0
      ? Number((quote * rowQuantity).toFixed(2))
      : Number(investment.current_value);
    const gain = current - invested;
    const gainPct = invested > 0 ? (gain / invested) * 100 : 0;

    return {
      investment,
      invested,
      current,
      gain,
      gainPct,
      quote,
      paidInstallments: undefined as number | undefined,
      remainingInstallments: undefined as number | undefined,
      totalPlanned: undefined as number | undefined,
    };
  });

  const totalValue = viewRows.reduce((sum, row) => sum + row.current, 0);
  const totalInitial = viewRows.reduce((sum, row) => sum + row.invested, 0);
  const totalGain = totalValue - totalInitial;
  const gainPercentage = totalInitial > 0 ? (totalGain / totalInitial) * 100 : 0;

  if (!isAuthenticated) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <PiggyBank className="w-16 h-16 text-primary mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Cadastre seus investimentos</h1>
          <p className="text-muted-foreground mb-6">Faca login para gerenciar seus investimentos</p>
          <Button onClick={() => navigate('/members')}>Ir para membros</Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Desktop Header */}
          <div className="hidden sm:flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
              <PiggyBank className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Investimentos</h1>
              <p className="text-muted-foreground">Acompanhe lucro e prejuizo com cotacao em tempo real</p>
            </div>
          </div>
          {/* Mobile Header Box */}
          <div className="sm:hidden flex flex-col items-center gap-3 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 rounded-xl p-4 border border-blue-200 dark:border-blue-800 shadow-sm w-full">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
                <PiggyBank className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-foreground">Investimentos</h1>
            </div>
            <p className="text-muted-foreground text-center text-sm">Acompanhe lucro e prejuizo com cotacao em tempo real</p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => refetchQuotes()} disabled={isFetchingQuotes}>
              <RefreshCw className={cn('w-4 h-4 mr-2', isFetchingQuotes && 'animate-spin')} />
              Atualizar cotacoes
            </Button>

            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto">
                  <Plus className="w-4 h-4 mr-2" />
                  Novo investimento
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[calc(100%-1rem)] max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Cadastrar investimento</DialogTitle>
                  <DialogDescription>Preencha os dados para cadastrar um novo investimento.</DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Tipo de cadastro</Label>
                    <Select value={investmentMode} onValueChange={(value: InvestmentMode) => setValue('investment_mode', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="market">Ativo de Mercado</SelectItem>
                        <SelectItem value="crypto">Criptomoedas</SelectItem>
                        <SelectItem value="consortium">Consórcio / Carta de Crédito</SelectItem>
                        <SelectItem value="cdb">CDB</SelectItem>
                        <SelectItem value="other">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {investmentMode === 'market' || investmentMode === 'crypto' ? (
                    <>
                      {investmentMode === 'crypto' ? (
                        <div className="space-y-2">
                          <Label>Moeda</Label>
                          <Input
                            value={selectedSymbol || ''}
                            onChange={(e) => {
                              const ticker = e.target.value.toUpperCase().trim();
                              setValue('symbol', ticker);
                              setValue('name', ticker);
                              setValue('type', 'crypto');
                              setIsCryptoSuggestionsOpen(true);
                            }}
                            onFocus={() => setIsCryptoSuggestionsOpen(true)}
                            onBlur={() => setTimeout(() => setIsCryptoSuggestionsOpen(false), 120)}
                            placeholder="Ex: BTC, ETH, ADA..."
                          />
                          {isCryptoSuggestionsOpen && (
                            <div className="rounded-md border border-border bg-popover text-popover-foreground shadow-md max-h-56 overflow-auto">
                              {filteredAssets
                                .filter((asset) =>
                                  asset.symbol.toUpperCase().includes((selectedSymbol || '').toUpperCase()) ||
                                  asset.name.toUpperCase().includes((selectedSymbol || '').toUpperCase())
                                )
                                .slice(0, 20)
                                .map((asset) => (
                                  <button
                                    key={asset.symbol}
                                    type="button"
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                                    onMouseDown={() => {
                                      setValue('symbol', asset.symbol);
                                      setValue('name', asset.name);
                                      setValue('type', 'crypto');
                                      setIsCryptoSuggestionsOpen(false);
                                    }}
                                  >
                                    {asset.symbol} - {asset.name}
                                  </button>
                                ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Label>Ativo (ticker)</Label>
                          <Input
                            value={selectedSymbol || ''}
                            onChange={(e) => {
                              const ticker = e.target.value.toUpperCase().trim();
                              setAssetSearch(ticker);
                              setValue('symbol', ticker);
                              setIsMarketSuggestionsOpen(true);

                              const meta = pickAssetMeta(ticker, assets);
                              if (meta.name !== ticker) {
                                setValue('name', meta.name);
                                setValue('type', meta.type);
                                if (investmentMode === 'market' && Number(watch('purchase_price') || 0) <= 0 && typeof meta.lastPrice === 'number' && meta.lastPrice > 0) {
                                  setValue('purchase_price', Number(meta.lastPrice.toFixed(2)));
                                }
                              }
                            }}
                            onFocus={() => setIsMarketSuggestionsOpen(true)}
                            onBlur={() => setTimeout(() => setIsMarketSuggestionsOpen(false), 120)}
                            placeholder="Ex: PETR4, VALE3, MXRF11..."
                          />
                          {isMarketSuggestionsOpen && (
                            <div className="rounded-md border border-border bg-popover text-popover-foreground shadow-md max-h-56 overflow-auto">
                              {filteredAssets
                                .filter((asset) =>
                                  asset.symbol.toUpperCase().includes((selectedSymbol || '').toUpperCase()) ||
                                  asset.name.toUpperCase().includes((selectedSymbol || '').toUpperCase())
                                )
                                .slice(0, 20)
                                .map((asset) => (
                                  <button
                                    key={asset.symbol}
                                    type="button"
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                                    onMouseDown={() => {
                                      setAssetSearch(asset.symbol);
                                      setValue('symbol', asset.symbol);
                                      setValue('name', asset.name);
                                      setValue('type', asset.type || inferInvestmentType(asset.symbol));
                                      if (investmentMode === 'market' && Number(watch('purchase_price') || 0) <= 0 && asset.lastPrice > 0) {
                                        setValue('purchase_price', Number(asset.lastPrice.toFixed(2)));
                                      }
                                      setIsMarketSuggestionsOpen(false);
                                    }}
                                  >
                                    {asset.symbol} - {asset.name}
                                  </button>
                                ))}
                            </div>
                          )}
                          {isFetchingAssets && <p className="text-xs text-muted-foreground">Buscando ativos...</p>}
                        </div>
                      )}

                      {errors.symbol && <p className="text-xs text-destructive">{errors.symbol.message}</p>}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>{investmentMode === 'crypto' ? 'Quantidade da moeda' : 'Quantidade de cotas'}</Label>
                          <Input
                            type="number"
                            inputMode="decimal"
                            step="any"
                            placeholder="0"
                            {...register('quantity', {
                              setValueAs: (value) => {
                                const normalized = String(value ?? '').replace(',', '.');
                                const parsed = Number(normalized);
                                return Number.isFinite(parsed) ? parsed : 0;
                              },
                            })}
                          />
                          {errors.quantity && <p className="text-xs text-destructive">{errors.quantity.message}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label>{investmentMode === 'crypto' ? 'Valor investido' : 'Valor pago por cota'}</Label>
                          <Input
                            inputMode="numeric"
                            placeholder="R$ 0,00"
                            value={(Number(watch('purchase_price') || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            onChange={(e) => {
                              const digits = e.target.value.replace(/\D/g, '');
                              const value = digits ? parseFloat(digits) / 100 : 0;
                              setValue('purchase_price', value);
                            }}
                          />
                          {errors.purchase_price && <p className="text-xs text-destructive">{errors.purchase_price.message}</p>}
                        </div>
                      </div>
                    </>
                  ) : investmentMode === 'cdb' ? (
                    <>
                      <div className="space-y-2">
                        <Label>Banco do CDB</Label>
                        <Input
                          value={cdbBankName}
                          onChange={(e) => setValue('cdb_bank_name', e.target.value)}
                          placeholder="Ex: Nubank, Inter, Itau..."
                        />
                        {errors.cdb_bank_name && <p className="text-xs text-destructive">{errors.cdb_bank_name.message}</p>}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Indexador</Label>
                          <Select value={cdbIndexer} onValueChange={(value: 'cdi' | 'selic') => setValue('cdb_indexer', value)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="cdi">CDI</SelectItem>
                              <SelectItem value="selic">Selic</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Taxa do CDB (% do indexador)</Label>
                          <Input
                            inputMode="decimal"
                            placeholder="Ex: 110"
                            value={watch('cdb_rate_percent') ?? ''}
                            onChange={(e) => setValue('cdb_rate_percent', parseDecimalInput(e.target.value))}
                          />
                          {errors.cdb_rate_percent && <p className="text-xs text-destructive">{errors.cdb_rate_percent.message}</p>}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Valor investido</Label>
                        <Input
                          inputMode="numeric"
                          placeholder="R$ 0,00"
                          value={(Number(watch('purchase_price') || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          onChange={(e) => {
                            const digits = e.target.value.replace(/\D/g, '');
                            const value = digits ? parseFloat(digits) / 100 : 0;
                            setValue('purchase_price', value);
                          }}
                        />
                        {errors.purchase_price && <p className="text-xs text-destructive">{errors.purchase_price.message}</p>}
                      </div>
                    </>
                  ) : investmentMode === 'other' ? (
                    <>
                      <div className="space-y-2">
                        <Label>Nome do investimento</Label>
                        <Input
                          value={watch('name') || ''}
                          onChange={(e) => setValue('name', e.target.value)}
                          placeholder="Ex: Joia, item colecionavel, investimento pessoal"
                        />
                        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Valor investido</Label>
                          <Input
                            inputMode="numeric"
                            placeholder="R$ 0,00"
                            value={(Number(watch('initial_value') || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            onChange={(e) => {
                              const digits = e.target.value.replace(/\D/g, '');
                              const value = digits ? parseFloat(digits) / 100 : 0;
                              setValue('initial_value', value);
                            }}
                          />
                          {errors.initial_value && <p className="text-xs text-destructive">{errors.initial_value.message}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label>Valor atual</Label>
                          <Input
                            inputMode="numeric"
                            placeholder="R$ 0,00"
                            value={(Number(watch('current_value') || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            onChange={(e) => {
                              const digits = e.target.value.replace(/\D/g, '');
                              const value = digits ? parseFloat(digits) / 100 : 0;
                              setValue('current_value', value);
                            }}
                          />
                          {errors.current_value && <p className="text-xs text-destructive">{errors.current_value.message}</p>}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label>Nome da carta</Label>
                        <Input
                          value={watch('name') || ''}
                          onChange={(e) => setValue('name', e.target.value)}
                          placeholder="Ex: Consorcio de imovel"
                        />
                        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label>Valor da carta</Label>
                        <Input
                          inputMode="numeric"
                          placeholder="R$ 0,00"
                          value={(Number(watch('consortium_credit_value') || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          onChange={(e) => {
                            const digits = e.target.value.replace(/\D/g, '');
                            const value = digits ? parseFloat(digits) / 100 : 0;
                            setValue('consortium_credit_value', value);
                          }}
                        />
                        {errors.consortium_credit_value && <p className="text-xs text-destructive">{errors.consortium_credit_value.message}</p>}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Valor mensal da carta</Label>
                          <Input
                            inputMode="numeric"
                            placeholder="R$ 0,00"
                            value={(Number(watch('consortium_monthly_value') || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            onChange={(e) => {
                              const digits = e.target.value.replace(/\D/g, '');
                              const value = digits ? parseFloat(digits) / 100 : 0;
                              setValue('consortium_monthly_value', value);
                            }}
                          />
                          {errors.consortium_monthly_value && <p className="text-xs text-destructive">{errors.consortium_monthly_value.message}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label>Prazo (meses)</Label>
                          <Input
                            inputMode="numeric"
                            value={watch('consortium_term_months') ?? ''}
                            onChange={(e) => setValue('consortium_term_months', Math.max(0, Number(e.target.value) || 0))}
                          />
                          {errors.consortium_term_months && <p className="text-xs text-destructive">{errors.consortium_term_months.message}</p>}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Foi contemplado?</Label>
                          <Select
                            value={watch('consortium_is_contemplated') ? 'yes' : 'no'}
                            onValueChange={(value) => setValue('consortium_is_contemplated', value === 'yes')}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="no">Nao</SelectItem>
                              <SelectItem value="yes">Sim</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {watch('consortium_is_contemplated') && (
                          <div className="space-y-2">
                            <Label>Valor contemplado</Label>
                            <Input
                              inputMode="decimal"
                              value={watch('consortium_contemplated_value') ?? ''}
                              onChange={(e) => setValue('consortium_contemplated_value', parseDecimalInput(e.target.value))}
                            />
                            {errors.consortium_contemplated_value && <p className="text-xs text-destructive">{errors.consortium_contemplated_value.message}</p>}
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>A carta sera vendida?</Label>
                          <Select
                            value={watch('consortium_will_sell') ? 'yes' : 'no'}
                            onValueChange={(value) => setValue('consortium_will_sell', value === 'yes')}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="no">Nao</SelectItem>
                              <SelectItem value="yes">Sim</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {watch('consortium_will_sell') && (
                          <div className="space-y-2">
                            <Label>Valor de venda</Label>
                            <Input
                              inputMode="decimal"
                              value={watch('consortium_sale_value') ?? ''}
                              onChange={(e) => setValue('consortium_sale_value', parseDecimalInput(e.target.value))}
                            />
                            {errors.consortium_sale_value && <p className="text-xs text-destructive">{errors.consortium_sale_value.message}</p>}
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="start_date">Data da compra</Label>
                    <Input id="start_date" type="date" {...register('start_date')} />
                    {errors.start_date && <p className="text-xs text-destructive">{errors.start_date.message}</p>}
                  </div>

                  {investmentMode === 'market' && (
                    <div className="space-y-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          if (selectedQuote) {
                            setValue('purchase_price', Number(selectedQuote.toFixed(2)));
                          }
                        }}
                      >
                        Usar hoje
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        disabled={isLoadingHistoricalPrice}
                        onClick={handleUsePurchaseDayClose}
                      >
                        {isLoadingHistoricalPrice ? 'Buscando...' : 'Usar fechamento da data'}
                      </Button>
                    </div>
                  )}

                  {investmentMode === 'consortium' ? (
                    <ConsortiumSummary
                      startDate={watch('start_date') || new Date().toISOString().slice(0, 10)}
                      creditValue={consortiumCreditValue}
                      monthlyValue={consortiumMonthlyValue}
                      termMonths={consortiumTermMonths}
                      isContemplated={consortiumIsContemplated}
                      contemplatedValue={consortiumContemplatedValue}
                      willSell={consortiumWillSell}
                      saleValue={consortiumSaleValue}
                    />
                  ) : investmentMode === 'other' ? (
                    <ManualInvestmentSummary invested={manualInvestedValue} current={manualCurrentValue} />
                  ) : (
                    <InvestmentSummary
                      mode={investmentMode as InvestmentMode}
                      startDate={watch('start_date')}
                      cdbIndexer={cdbIndexer}
                      cdbRatePercent={cdbRatePercent}
                      rates={bcbRates}
                      quantity={quantity}
                      purchasePrice={purchasePrice}
                      quote={selectedQuote}
                    />
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="notes">Observacoes</Label>
                    <Textarea id="notes" {...register('notes')} placeholder="Anotacoes sobre o investimento..." />
                  </div>

                  <Button type="submit" className="w-full" disabled={createInvestment.isPending}>
                    {createInvestment.isPending ? 'Cadastrando...' : 'Cadastrar investimento'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-center sm:items-center gap-4 w-full sm:w-auto text-center sm:text-left">
              <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Patrimonio total</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(totalValue)}</p>
              </div>
            </div>
            {totalInitial > 0 && (
              <div className={cn('flex items-center gap-2 px-4 py-2 rounded-lg', totalGain >= 0 ? 'bg-income/10' : 'bg-expense/10')}>
                <TrendingUp className={cn('w-4 h-4', totalGain >= 0 ? 'text-income' : 'text-expense rotate-180')} />
                <span className={cn('font-semibold', totalGain >= 0 ? 'text-income' : 'text-expense')}>
                  {totalGain >= 0 ? '+' : ''}{formatCurrency(totalGain)} ({gainPercentage.toFixed(2)}%)
                </span>
              </div>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2].map((i) => (
              <div key={i} className="glass-card rounded-2xl p-6 animate-pulse">
                <div className="space-y-4">
                  <div className="h-4 w-32 bg-secondary rounded" />
                  <div className="h-8 w-24 bg-secondary rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : investments.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <PiggyBank className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Nenhum investimento cadastrado</h3>
            <p className="text-muted-foreground mb-6">Cadastre investimentos para acompanhar lucro ou prejuizo automaticamente</p>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Cadastrar investimento
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {viewRows.map(({ investment, invested, current, gain, gainPct, quote, paidInstallments, remainingInstallments, totalPlanned }, index) => (
              <div
                key={investment.id}
                className="glass-card rounded-2xl p-6 animate-fade-in hover:shadow-xl transition-shadow relative"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex gap-2 justify-end mb-2">
                  <Button size="icon" variant="ghost" onClick={() => setEditDialog({ open: true, investment })} aria-label="Editar investimento">
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setDeleteDialog({ open: true, investment })} aria-label="Excluir investimento">
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>

                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-foreground">{investment.name}</h3>
                    <p className="text-sm text-muted-foreground">{typeLabels[investment.type] || investment.type}</p>
                    {investment.symbol && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {investment.symbol} {quote ? `- Cotacao: ${formatCurrency(quote)}` : '- Cotacao indisponivel'}
                      </p>
                    )}
                    {investment.type === 'cdb' && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {investment.cdb_bank_name || 'Banco'} - {(investment.cdb_indexer || 'cdi').toUpperCase()} {Number(investment.cdb_rate_percent || 0).toFixed(2)}%
                      </p>
                    )}
                    {investment.type === 'consortium' && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Carta de credito
                      </p>
                    )}
                  </div>
                  {gain !== 0 && (
                    <div className={cn('text-xs font-medium px-2 py-1 rounded-full', gain >= 0 ? 'bg-income/10 text-income' : 'bg-expense/10 text-expense')}>
                      {gain >= 0 ? '+' : ''}{gainPct.toFixed(1)}%
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Valor atual</p>
                    <p className="text-2xl font-bold text-foreground">{formatCurrency(current)}</p>
                  </div>

                  <div className="flex justify-between text-sm pt-2 border-t border-border">
                    <div>
                      <p className="text-muted-foreground">Investido</p>
                      <p className="font-medium">{formatCurrency(invested)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-muted-foreground">Rendimento</p>
                      <p className={cn('font-medium', gain >= 0 ? 'text-income' : 'text-expense')}>
                        {gain >= 0 ? '+' : ''}{formatCurrency(gain)}
                      </p>
                    </div>
                  </div>

                  {investment.type !== 'consortium' && investment.quantity && (
                    <p className="text-xs text-muted-foreground">Quantidade: {Number(investment.quantity).toLocaleString('pt-BR')}</p>
                  )}

                  {investment.type === 'consortium' && (
                    <div className="pt-1">
                      <button
                        type="button"
                        className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setExpandedConsortiumCards((prev) => ({
                          ...prev,
                          [investment.id]: !prev[investment.id],
                        }))}
                      >
                        <span>Detalhes da carta</span>
                        {expandedConsortiumCards[investment.id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  )}

                  {investment.type === 'consortium' && expandedConsortiumCards[investment.id] && (
                    <p className="text-xs text-muted-foreground">
                      Valor da carta: {formatCurrency(Number(investment.consortium_credit_value || 0))}
                    </p>
                  )}

                  {investment.type === 'consortium' && expandedConsortiumCards[investment.id] && (
                    <p className="text-xs text-muted-foreground">
                      Parcela mensal: {formatCurrency(Number(investment.consortium_monthly_value || 0))} •
                      Prazo: {Number(investment.consortium_term_months || 0)} meses •
                      Pagas: {paidInstallments || 0}
                    </p>
                  )}

                  {investment.type === 'consortium' && expandedConsortiumCards[investment.id] && (
                    <p className="text-xs text-muted-foreground">
                      Restantes: {remainingInstallments || 0} • Total previsto: {formatCurrency(Number(totalPlanned || 0))}
                    </p>
                  )}

                  {investment.type === 'consortium' && expandedConsortiumCards[investment.id] && investment.consortium_is_contemplated && (
                    <p className="text-xs text-muted-foreground">
                      Contemplado: {formatCurrency(Number(investment.consortium_contemplated_value || 0))}
                    </p>
                  )}

                  {investment.type === 'consortium' && expandedConsortiumCards[investment.id] && investment.consortium_will_sell && (
                    <p className="text-xs text-muted-foreground">
                      Venda prevista: {formatCurrency(Number(investment.consortium_sale_value || 0))}
                    </p>
                  )}

                  {investment.start_date && (
                    <p className="text-xs text-muted-foreground">Compra em {formatDate(investment.start_date)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editDialog.investment && (
        <EditInvestmentDialog
          investment={editDialog.investment}
          open={editDialog.open}
          onOpenChange={(open) => setEditDialog(open ? { open: true, investment: editDialog.investment } : { open: false, investment: null })}
        />
      )}
      {deleteDialog.investment && (
        <DeleteInvestmentDialog
          investment={deleteDialog.investment}
          open={deleteDialog.open}
          onOpenChange={(open) => setDeleteDialog((v) => ({ ...v, open }))}
          onDelete={async () => {
            await deleteInvestment.mutateAsync(deleteDialog.investment.id);
            setDeleteDialog({ open: false, investment: null });
            toast.success('Investimento excluido!');
          }}
        />
      )}
    </MainLayout>
  );
}
