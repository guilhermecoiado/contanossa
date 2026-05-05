import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency } from '@/lib/formatters';
import type { Bank, Card, Expense, ExpenseCategory, Income, Member } from '@/types/finance';
import type { FamilyTransfer } from '@/hooks/useFamilyTransfers';

export type FamilyHealthExportFormat = 'csv' | 'pdf';
export type FamilyHealthExportScope = 'incomes' | 'expenses' | 'summary' | 'all';

interface MemberSummary {
  memberName: string;
  income: number;
  expenses: number;
  balance: number;
  contribution: number;
}

interface LentByPersonSummary {
  person: string;
  total: number;
  entries: number;
}

interface LentInstallmentRow {
  person: string;
  description: string;
  date: string;
  installment: string;
  installmentValue: number;
  estimatedTotal: number;
}

interface TopCategorySummary {
  name: string;
  total: number;
}

export interface FamilyHealthExportPayload {
  month: number;
  year: number;
  monthLabel: string;
  currentMemberId?: string | null;
  totalIncome: number;
  totalExpenses: number;
  totalBalance: number;
  totalSavings: number;
  savingsRate: number;
  incomes: Income[];
  expenses: Expense[];
  familyTransfers: FamilyTransfer[];
  members: Member[];
  banks: Bank[];
  cards: Card[];
  categories: ExpenseCategory[];
  memberSummaries: MemberSummary[];
  topCategories: TopCategorySummary[];
}

const APP_NAME = 'ContaNossa';

function safeCsvCell(value: unknown) {
  const text = String(value ?? '');
  const escaped = text.replace(/"/g, '""');
  return `"${escaped}"`;
}

function csvRow(values: unknown[]) {
  return values.map(safeCsvCell).join(',');
}

function getFirstName(fullName: string) {
  const trimmed = (fullName || '').trim();
  if (!trimmed) return 'Não identificado';
  return trimmed.split(/\s+/)[0];
}

function datePtBr(dateLike?: string | null) {
  if (!dateLike) return '-';
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('pt-BR');
}

function downloadBlob(content: BlobPart, fileName: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function resolveMemberName(memberId: string, membersById: Map<string, string>) {
  return getFirstName(membersById.get(memberId) ?? 'Não identificado');
}

function resolveCategoryName(expense: Expense, categoriesById: Map<string, string>) {
  if (expense.custom_category_id && categoriesById.has(expense.custom_category_id)) {
    return categoriesById.get(expense.custom_category_id) as string;
  }
  if (expense.category_id && categoriesById.has(expense.category_id)) {
    return categoriesById.get(expense.category_id) as string;
  }
  return 'Sem categoria';
}

function resolveBankName(bankId: string | null | undefined, banksById: Map<string, string>) {
  if (!bankId) return '-';
  return banksById.get(bankId) ?? '-';
}

function resolveCardName(cardId: string | null | undefined, cardsById: Map<string, string>) {
  if (!cardId) return '-';
  return cardsById.get(cardId) ?? '-';
}

function getLentCardInsights(expenses: Expense[]) {
  const lentExpenses = expenses.filter((expense) => expense.lend_card && expense.lend_to);
  const totalLent = lentExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

  const byPersonMap = new Map<string, LentByPersonSummary>();
  lentExpenses.forEach((expense) => {
    const person = (expense.lend_to || 'Não identificado').trim();
    const current = byPersonMap.get(person) || { person, total: 0, entries: 0 };
    current.total += Number(expense.amount || 0);
    current.entries += 1;
    byPersonMap.set(person, current);
  });

  const byPerson = Array.from(byPersonMap.values()).sort((a, b) => b.total - a.total);

  const installments: LentInstallmentRow[] = lentExpenses
    .filter((expense) => (expense.total_installments || 0) > 1)
    .map((expense) => {
      const totalInstallments = Number(expense.total_installments || 0);
      const installmentLabel = `${expense.installment_number || 0}/${totalInstallments}`;
      const installmentValue = Number(expense.amount || 0);

      return {
        person: (expense.lend_to || 'Não identificado').trim(),
        description: expense.description || 'Sem descrição',
        date: expense.date,
        installment: installmentLabel,
        installmentValue,
        estimatedTotal: Number((installmentValue * totalInstallments).toFixed(2)),
      };
    })
    .sort((a, b) => {
      const personCompare = a.person.localeCompare(b.person);
      if (personCompare !== 0) return personCompare;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

  return {
    hasLentData: lentExpenses.length > 0,
    totalLent,
    byPerson,
    installments,
  };
}

function getTransferReferenceDate(transfer: FamilyTransfer) {
  return transfer.requested_date || transfer.created_at || null;
}

function getValuesBorrowedInsights(
  transfers: FamilyTransfer[],
  currentMemberId: string | null | undefined,
  month: number,
  year: number,
  membersById: Map<string, string>
) {
  if (!currentMemberId) {
    return { hasValues: false, total: 0, byPerson: [] as LentByPersonSummary[] };
  }

  const filtered = transfers.filter((transfer) => {
    if (transfer.creditor_member_id !== currentMemberId) return false;
    if (transfer.status === 'payment_received' || transfer.status === 'rejected') return false;
    const referenceDate = getTransferReferenceDate(transfer);
    if (!referenceDate) return false;
    const date = new Date(referenceDate);
    if (Number.isNaN(date.getTime())) return false;
    return date.getMonth() + 1 === month && date.getFullYear() === year;
  });

  const byPersonMap = new Map<string, LentByPersonSummary>();
  filtered.forEach((transfer) => {
    const person = (
      transfer.debtor?.name ||
      transfer.debtor_name ||
      membersById.get(transfer.debtor_member_id) ||
      'Não identificado'
    ).trim();
    const current = byPersonMap.get(person) || { person, total: 0, entries: 0 };
    current.total += Number(transfer.amount || 0);
    current.entries += 1;
    byPersonMap.set(person, current);
  });

  const byPerson = Array.from(byPersonMap.values()).sort((a, b) => b.total - a.total);
  const total = filtered.reduce((sum, transfer) => sum + Number(transfer.amount || 0), 0);

  return {
    hasValues: filtered.length > 0,
    total,
    byPerson,
  };
}

async function loadLogoAsDataUrl() {
  try {
    const response = await fetch('/piggy-bank-logo.png');
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function buildCsv(scope: FamilyHealthExportScope, payload: FamilyHealthExportPayload) {
  const membersById = new Map(payload.members.map((member) => [member.id, member.name]));
  const banksById = new Map(payload.banks.map((bank) => [bank.id, bank.name]));
  const cardsById = new Map(payload.cards.map((card) => [card.id, card.name]));
  const categoriesById = new Map(payload.categories.map((category) => [category.id, category.name]));
  const lentInsights = getLentCardInsights(payload.expenses);
  const lines: string[] = [];

  lines.push(csvRow([APP_NAME, 'Exportação Saúde da Família']));
  lines.push(csvRow(['Período', payload.monthLabel]));
  lines.push(csvRow(['Data da exportação', new Date().toLocaleString('pt-BR')]));
  lines.push('');

  if (scope === 'summary' || scope === 'all') {
    lines.push(csvRow(['SEÇÃO', 'RESUMO SAÚDE DA FAMÍLIA']));
    lines.push(csvRow(['Métrica', 'Valor']));
    lines.push(csvRow(['Total de Entradas', formatCurrency(payload.totalIncome)]));
    lines.push(csvRow(['Total de Saídas', formatCurrency(payload.totalExpenses)]));
    lines.push(csvRow(['Saldo do Período', formatCurrency(payload.totalBalance)]));
    lines.push(csvRow(['Patrimônio', formatCurrency(payload.totalSavings)]));
    lines.push(csvRow(['Taxa de Poupança', `${payload.savingsRate.toFixed(1)}%`]));
    lines.push('');

    lines.push(csvRow(['SEÇÃO', 'CONTRIBUIÇÃO POR MEMBRO']));
    lines.push(csvRow(['Membro', 'Entradas', 'Saídas', 'Saldo', 'Contribuição na Renda (%)']));
    payload.memberSummaries.forEach((summary) => {
      lines.push(
        csvRow([
          summary.memberName,
          formatCurrency(summary.income),
          formatCurrency(summary.expenses),
          formatCurrency(summary.balance),
          summary.contribution.toFixed(1),
        ])
      );
    });
    lines.push('');

    lines.push(csvRow(['SEÇÃO', 'MAIORES GASTOS POR CATEGORIA']));
    lines.push(csvRow(['Categoria', 'Total']));
    payload.topCategories.forEach((category) => {
      lines.push(csvRow([category.name, formatCurrency(category.total)]));
    });
    lines.push('');

    if (lentInsights.hasLentData) {
      lines.push(csvRow(['SEÇÃO', 'CARTÃO EMPRESTADO']));
      lines.push(csvRow(['Métrica', 'Valor']));
      lines.push(csvRow(['Total de valores emprestados', formatCurrency(lentInsights.totalLent)]));
      lines.push('');

      if (lentInsights.installments.length > 0) {
        lines.push(csvRow(['Parcelamentos de cartão emprestado']));
        lines.push(csvRow(['Pessoa', 'Descrição', 'Data', 'Parcela', 'Valor por Parcela', 'Total Parcelado (estimado)']));
        lentInsights.installments.forEach((item) => {
          lines.push(
            csvRow([
              item.person,
              item.description,
              datePtBr(item.date),
              item.installment,
              formatCurrency(item.installmentValue),
              formatCurrency(item.estimatedTotal),
            ])
          );
        });
        lines.push('');
      }
    }
  }

  if (scope === 'incomes' || scope === 'all') {
    lines.push(csvRow(['SEÇÃO', 'LANÇAMENTOS DE ENTRADAS']));
    lines.push(csvRow(['Data', 'Membro', 'Descrição', 'Banco', 'Cartão', 'Valor', 'Status', 'Data de Realização']));
    payload.incomes.forEach((income) => {
      lines.push(
        csvRow([
          datePtBr(income.date),
          resolveMemberName(income.member_id, membersById),
          income.description || 'Sem descrição',
          resolveBankName(income.bank_id, banksById),
          '-',
          formatCurrency(Number(income.amount || 0)),
          income.is_realized ? 'Realizado' : 'Não realizado',
          datePtBr(income.realized_date || null),
        ])
      );
    });
    lines.push('');
  }

  if (scope === 'expenses' || scope === 'all') {
    lines.push(csvRow(['SEÇÃO', 'LANÇAMENTOS DE SAÍDAS']));
    lines.push(csvRow(['Data', 'Membro', 'Descrição', 'Categoria', 'Banco', 'Cartão', 'Valor', 'Status', 'Recorrente', 'Parcelamento']));
    payload.expenses.forEach((expense) => {
      const installments = expense.total_installments && expense.total_installments > 1
        ? `${expense.installment_number || 0}/${expense.total_installments}`
        : '-';

      lines.push(
        csvRow([
          datePtBr(expense.date),
          resolveMemberName(expense.member_id, membersById),
          expense.description || 'Sem descrição',
          resolveCategoryName(expense, categoriesById),
          resolveBankName(expense.bank_id, banksById),
          resolveCardName(expense.card_id, cardsById),
          formatCurrency(Number(expense.amount || 0)),
          expense.is_realized ? 'Realizado' : 'Não realizado',
          expense.is_recurring ? 'Sim' : 'Não',
          installments,
        ])
      );
    });
    lines.push('');

    if (lentInsights.hasLentData) {
      lines.push(csvRow(['SEÇÃO', 'CARTÃO EMPRESTADO']));
      lines.push(csvRow(['Métrica', 'Valor']));
      lines.push(csvRow(['Total de valores emprestados', formatCurrency(lentInsights.totalLent)]));
      lines.push('');

      if (lentInsights.installments.length > 0) {
        lines.push(csvRow(['Parcelamentos de cartão emprestado']));
        lines.push(csvRow(['Pessoa', 'Descrição', 'Data', 'Parcela', 'Valor por Parcela', 'Total Parcelado (estimado)']));
        lentInsights.installments.forEach((item) => {
          lines.push(
            csvRow([
              item.person,
              item.description,
              datePtBr(item.date),
              item.installment,
              formatCurrency(item.installmentValue),
              formatCurrency(item.estimatedTotal),
            ])
          );
        });
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}

function addPdfHeader(doc: jsPDF, logoDataUrl: string | null, monthLabel: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, pageWidth, 20, 'F');

  if (logoDataUrl) {
    doc.addImage(logoDataUrl, 'PNG', 8, 4.25, 11, 11);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text(APP_NAME, 23, 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Relatório de Exportação • Saúde da Família', 23, 14);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.text(`Período: ${monthLabel}`, pageWidth - 8, 14, { align: 'right' });
}

function addPdfFooter(doc: jsPDF) {
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageNumber = doc.getNumberOfPages();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`${APP_NAME} • Página ${pageNumber}`, pageWidth / 2, pageHeight - 6, { align: 'center' });
}

function drawSectionTitle(doc: jsPDF, title: string, y: number) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(title, 14, y);
}

async function buildPdf(scope: FamilyHealthExportScope, payload: FamilyHealthExportPayload) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const logoDataUrl = await loadLogoAsDataUrl();

  const membersById = new Map(payload.members.map((member) => [member.id, member.name]));
  const banksById = new Map(payload.banks.map((bank) => [bank.id, bank.name]));
  const cardsById = new Map(payload.cards.map((card) => [card.id, card.name]));
  const categoriesById = new Map(payload.categories.map((category) => [category.id, category.name]));
  const lentInsights = getLentCardInsights(payload.expenses);

  const didDrawPage = () => {
    addPdfHeader(doc, logoDataUrl, payload.monthLabel);
    addPdfFooter(doc);
  };

  didDrawPage();

  let cursorY = 28;

  if (scope === 'summary' || scope === 'all') {
    drawSectionTitle(doc, 'Resumo da Saúde da Família', cursorY);
    cursorY += 2;

    autoTable(doc, {
      startY: cursorY + 2,
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255 },
      head: [['Métrica', 'Valor']],
      body: [
        ['Total de Entradas', formatCurrency(payload.totalIncome)],
        ['Total de Saídas', formatCurrency(payload.totalExpenses)],
        ['Saldo do Período', formatCurrency(payload.totalBalance)],
        ['Patrimônio', formatCurrency(payload.totalSavings)],
        ['Taxa de Poupança', `${payload.savingsRate.toFixed(1)}%`],
      ],
      didDrawPage,
    });

    cursorY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? cursorY;
    cursorY += 8;

    drawSectionTitle(doc, 'Contribuição por Membro', cursorY);
    autoTable(doc, {
      startY: cursorY + 2,
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [15, 23, 42], textColor: 255 },
      head: [['Membro', 'Entradas', 'Saídas', 'Saldo', 'Contribuição (%)']],
      body: payload.memberSummaries.map((summary) => [
        summary.memberName,
        formatCurrency(summary.income),
        formatCurrency(summary.expenses),
        formatCurrency(summary.balance),
        summary.contribution.toFixed(1),
      ]),
      didDrawPage,
    });

    cursorY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? cursorY;
    cursorY += 8;

    drawSectionTitle(doc, 'Maiores Gastos por Categoria', cursorY);
    autoTable(doc, {
      startY: cursorY + 2,
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [239, 68, 68], textColor: 255 },
      head: [['Categoria', 'Total']],
      body: payload.topCategories.map((category) => [category.name, formatCurrency(category.total)]),
      didDrawPage,
    });

    cursorY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? cursorY;
    cursorY += 8;

    if (lentInsights.hasLentData) {
      if (cursorY > 220) {
        doc.addPage();
        didDrawPage();
        cursorY = 28;
      }

      drawSectionTitle(doc, 'Cartão Emprestado', cursorY);
      autoTable(doc, {
        startY: cursorY + 2,
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [124, 58, 237], textColor: 255 },
        head: [['Métrica', 'Valor']],
        body: [['Total de valores emprestados', formatCurrency(lentInsights.totalLent)]],
        didDrawPage,
      });

      cursorY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? cursorY;
      cursorY += 6;

      if (lentInsights.installments.length > 0) {
        autoTable(doc, {
          startY: cursorY,
          theme: 'striped',
          styles: { font: 'helvetica', fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [109, 40, 217], textColor: 255 },
          head: [['Pessoa', 'Descrição', 'Data', 'Parcela', 'Valor por Parcela', 'Total Parcelado']],
          body: lentInsights.installments.map((item) => [
            item.person,
            item.description,
            datePtBr(item.date),
            item.installment,
            formatCurrency(item.installmentValue),
            formatCurrency(item.estimatedTotal),
          ]),
          didDrawPage,
        });

        cursorY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? cursorY;
        cursorY += 8;
      }
    }
  }

  if (scope === 'incomes' || scope === 'all') {
    if (cursorY > 220) {
      doc.addPage();
      didDrawPage();
      cursorY = 28;
    }

    drawSectionTitle(doc, 'Lançamentos de Entradas', cursorY);
    autoTable(doc, {
      startY: cursorY + 2,
      theme: 'striped',
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2 },
      columnStyles: {
        0: { fontSize: 7.5 },
        6: { fontSize: 7.5 },
        7: { fontSize: 7.5 },
      },
      headStyles: { fillColor: [22, 163, 74], textColor: 255 },
      head: [['Data', 'Membro', 'Descrição', 'Banco', 'Cartão', 'Valor', 'Status', 'Realização']],
      body: payload.incomes.map((income) => [
        datePtBr(income.date),
        resolveMemberName(income.member_id, membersById),
        income.description || 'Sem descrição',
        resolveBankName(income.bank_id, banksById),
        '-',
        formatCurrency(Number(income.amount || 0)),
        income.is_realized ? 'Realizado' : 'Não realizado',
        datePtBr(income.realized_date || null),
      ]),
      didDrawPage,
    });

    cursorY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? cursorY;
    cursorY += 8;
  }

  if (scope === 'expenses' || scope === 'all') {
    if (cursorY > 220) {
      doc.addPage();
      didDrawPage();
      cursorY = 28;
    }

    drawSectionTitle(doc, 'Lançamentos de Saídas', cursorY);
    autoTable(doc, {
      startY: cursorY + 2,
      theme: 'striped',
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2 },
      columnStyles: {
        0: { fontSize: 7.5 },
        7: { fontSize: 7.5 },
      },
      headStyles: { fillColor: [239, 68, 68], textColor: 255 },
      head: [['Data', 'Membro', 'Descrição', 'Categoria', 'Banco', 'Cartão', 'Valor', 'Status', 'Recorr.', 'Parcela']],
      body: payload.expenses.map((expense) => {
        const installments = expense.total_installments && expense.total_installments > 1
          ? `${expense.installment_number || 0}/${expense.total_installments}`
          : '-';

        return [
          datePtBr(expense.date),
          resolveMemberName(expense.member_id, membersById),
          expense.description || 'Sem descrição',
          resolveCategoryName(expense, categoriesById),
          resolveBankName(expense.bank_id, banksById),
          resolveCardName(expense.card_id, cardsById),
          formatCurrency(Number(expense.amount || 0)),
          expense.is_realized ? 'Realizado' : 'Não realizado',
          expense.is_recurring ? 'Sim' : 'Não',
          installments,
        ];
      }),
      didDrawPage,
    });

    cursorY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? cursorY;
    cursorY += 8;

    if (lentInsights.hasLentData) {
      if (cursorY > 220) {
        doc.addPage();
        didDrawPage();
        cursorY = 28;
      }

      drawSectionTitle(doc, 'Cartão Emprestado', cursorY);
      autoTable(doc, {
        startY: cursorY + 2,
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [124, 58, 237], textColor: 255 },
        head: [['Métrica', 'Valor']],
        body: [['Total de valores emprestados', formatCurrency(lentInsights.totalLent)]],
        didDrawPage,
      });

      cursorY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? cursorY;
      cursorY += 6;

      if (lentInsights.installments.length > 0) {
        autoTable(doc, {
          startY: cursorY,
          theme: 'striped',
          styles: { font: 'helvetica', fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [109, 40, 217], textColor: 255 },
          head: [['Pessoa', 'Descrição', 'Data', 'Parcela', 'Valor por Parcela', 'Total Parcelado']],
          body: lentInsights.installments.map((item) => [
            item.person,
            item.description,
            datePtBr(item.date),
            item.installment,
            formatCurrency(item.installmentValue),
            formatCurrency(item.estimatedTotal),
          ]),
          didDrawPage,
        });
      }
    }
  }

  const fileDate = new Date().toISOString().slice(0, 10);
  doc.save(`contanossa-saude-familia-${fileDate}.pdf`);
}

export async function exportFamilyHealthData(
  format: FamilyHealthExportFormat,
  scope: FamilyHealthExportScope,
  payload: FamilyHealthExportPayload
) {
  if (format === 'csv') {
    const csv = buildCsv(scope, payload);
    const fileDate = new Date().toISOString().slice(0, 10);
    downloadBlob(csv, `contanossa-saude-familia-${fileDate}.csv`, 'text/csv;charset=utf-8;');
    return;
  }

  await buildPdf(scope, payload);
}
