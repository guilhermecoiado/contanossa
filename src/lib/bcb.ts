type BcbRatePoint = {
  data: string;
  valor: string;
};

function toAnnualPercentFromDailyPercent(dailyPercent: number) {
  return (Math.pow(1 + dailyPercent / 100, 252) - 1) * 100;
}

function parseBcbRate(value: string) {
  if (!value) return undefined;
  const normalized = value.includes(',') ? value.replace(/\./g, '').replace(',', '.') : value;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function fetchBcbSeriesLastValue(series: number) {
  const response = await fetch(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${series}/dados/ultimos/1?formato=json`);
  if (!response.ok) throw new Error(`Erro ao consultar Banco Central (${response.status})`);

  const data = (await response.json()) as BcbRatePoint[];
  const latest = data?.[0];
  return latest ? parseBcbRate(latest.valor) : undefined;
}

export type BcbRates = {
  cdi?: number;
  selic?: number;
};

export async function fetchLatestBcbRates(): Promise<BcbRates> {
  // SGS 12: CDI diário (% a.d.) / SGS 432: Meta Selic (% a.a.)
  const [cdi, selic] = await Promise.allSettled([
    fetchBcbSeriesLastValue(12),
    fetchBcbSeriesLastValue(432),
  ]);

  const cdiValue = cdi.status === 'fulfilled' ? cdi.value : undefined;
  const cdiAnnual =
    typeof cdiValue === 'number'
      ? (cdiValue < 1 ? toAnnualPercentFromDailyPercent(cdiValue) : cdiValue)
      : undefined;

  return {
    cdi: cdiAnnual,
    selic: selic.status === 'fulfilled' ? selic.value : undefined,
  };
}
