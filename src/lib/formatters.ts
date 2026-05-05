// Calcula o número de meses inteiros entre duas datas (data final - data inicial)
export function calculateRemainingMonths(startDate: string | Date | null | undefined, endDate: string | Date | null | undefined): number | null {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
  let months = (end.getFullYear() - start.getFullYear()) * 12;
  months += end.getMonth() - start.getMonth();
  // Se o dia do mês final for menor que o inicial, desconta 1 mês
  if (end.getDate() < start.getDate()) months--;
  return months >= 0 ? months : 0;
}
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatDate(date: string | Date): string {
  let d: Date;
  if (typeof date === 'string') {
    // Strings no formato "YYYY-MM-DD" são interpretadas como UTC pelo construtor.
    // Forçar parse local adicionando horário local explícito.
    const plain = date.split('T')[0]; // pega só a parte da data caso venha com timestamp
    const [year, month, day] = plain.split('-').map(Number);
    d = new Date(year, month - 1, day);
  } else {
    d = date;
  }
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

export function formatMonth(month: number, year: number): string {
  const date = new Date(year, month - 1, 1);
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function getMonthName(month: number): string {
  const date = new Date(2024, month - 1, 1);
  return new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(date);
}

export function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export function getHealthStatus(balance: number, income: number): 'excellent' | 'good' | 'warning' | 'danger' {
  if (income === 0) return 'warning';
  const ratio = balance / income;
  
  if (ratio >= 0.3) return 'excellent';
  if (ratio >= 0.1) return 'good';
  if (ratio >= 0) return 'warning';
  return 'danger';
}

export function getHealthColor(status: 'excellent' | 'good' | 'warning' | 'danger'): string {
  switch (status) {
    case 'excellent': return 'text-emerald-500';
    case 'good': return 'text-blue-500';
    case 'warning': return 'text-amber-500';
    case 'danger': return 'text-rose-500';
  }
}

export function getHealthLabel(status: 'excellent' | 'good' | 'warning' | 'danger'): string {
  switch (status) {
    case 'excellent': return 'Excelente';
    case 'good': return 'Bom';
    case 'warning': return 'Atenção';
    case 'danger': return 'Crítico';
  }
}
