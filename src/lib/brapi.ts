const BRAPI_BASE_URL = import.meta.env.VITE_BRAPI_BASE_URL || 'https://brapi.dev/api';
const BRAPI_TOKEN = import.meta.env.VITE_BRAPI_TOKEN;
const COINMARKETCAP_PROXY_URL = import.meta.env.VITE_COINMARKETCAP_PROXY_URL;

type BrapiQuoteResult = {
  symbol: string;
  shortName?: string;
  longName?: string;
  regularMarketPrice?: number;
  historicalDataPrice?: Array<Record<string, unknown>>;
  historicalData?: Array<Record<string, unknown>>;
  prices?: Array<Record<string, unknown>>;
};

type BrapiQuoteResponse = {
  results?: BrapiQuoteResult[];
};

type CoinMarketCapQuoteItem = {
  quote?: {
    BRL?: {
      price?: number;
    };
  };
};

type CoinMarketCapQuoteResponse = {
  data?: Record<string, CoinMarketCapQuoteItem | CoinMarketCapQuoteItem[]>;
};

type CoinGeckoMarketItem = {
  symbol?: string;
  current_price?: number;
};

type HistoricalCloseResult = {
  close: number;
  usedDate: string;
};

type BrapiAssetListItem = {
  stock: string;
  name: string;
  close: number;
  type?: string;
};

type BrapiAssetListResponse = {
  stocks?: BrapiAssetListItem[];
};

function buildBrapiUrl(path: string, params?: Record<string, string | number | undefined>) {
  const url = new URL(`${BRAPI_BASE_URL}${path}`);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && `${value}`.length > 0) {
        url.searchParams.set(key, String(value));
      }
    });
  }

  if (BRAPI_TOKEN) {
    url.searchParams.set('token', BRAPI_TOKEN);
  }

  return url.toString();
}

async function brapiFetch<T>(path: string, params?: Record<string, string | number | undefined>) {
  const response = await fetch(buildBrapiUrl(path, params));
  if (!response.ok) {
    throw new Error(`Erro ao consultar brapi.dev (${response.status})`);
  }

  return (await response.json()) as T;
}

export type InvestmentAsset = {
  symbol: string;
  name: string;
  lastPrice: number;
  type?: string;
};

const FALLBACK_ASSETS: InvestmentAsset[] = [
  { symbol: 'PETR4', name: 'Petrobras PN', lastPrice: 0, type: 'stocks' },
  { symbol: 'VALE3', name: 'Vale ON', lastPrice: 0, type: 'stocks' },
  { symbol: 'ITUB4', name: 'Itau Unibanco PN', lastPrice: 0, type: 'stocks' },
  { symbol: 'B3SA3', name: 'B3 ON', lastPrice: 0, type: 'stocks' },
  { symbol: 'BOVA11', name: 'iShares Ibovespa', lastPrice: 0, type: 'fii' },
  { symbol: 'MXRF11', name: 'Maxi Renda FII', lastPrice: 0, type: 'fii' },
  { symbol: 'BTC', name: 'Bitcoin', lastPrice: 0, type: 'crypto' },
  { symbol: 'ETH', name: 'Ethereum', lastPrice: 0, type: 'crypto' },
  { symbol: 'SOL', name: 'Solana', lastPrice: 0, type: 'crypto' },
  { symbol: 'XRP', name: 'XRP', lastPrice: 0, type: 'crypto' },
];

function filterFallbackAssets(search?: string) {
  const term = (search || '').trim().toUpperCase();
  if (!term) return FALLBACK_ASSETS;

  return FALLBACK_ASSETS.filter(
    (asset) =>
      asset.symbol.toUpperCase().includes(term) ||
      asset.name.toUpperCase().includes(term)
  );
}

function normalizeCryptoSymbol(symbol: string) {
  const normalized = symbol.toUpperCase().trim();
  if (!normalized) return '';
  if (normalized.endsWith('-BRL')) return normalized.replace('-BRL', '');
  if (normalized.endsWith('-USD')) return normalized.replace('-USD', '');
  if (normalized.endsWith('-USDT')) return normalized.replace('-USDT', '');
  if (normalized.endsWith('BRL') && normalized.length > 3) return normalized.slice(0, -3);
  if (normalized.endsWith('USD') && normalized.length > 3) return normalized.slice(0, -3);
  if (normalized.endsWith('USDT') && normalized.length > 4) return normalized.slice(0, -4);
  return normalized;
}

function isBrlPairSymbol(symbol: string) {
  const normalized = symbol.toUpperCase().trim();
  return normalized.includes('-BRL') || normalized.endsWith('BRL');
}

function isLikelyCryptoSymbol(symbol: string) {
  const normalized = symbol.toUpperCase().trim();
  if (!normalized) return false;
  if (normalized.includes('-BRL') || normalized.includes('-USD') || normalized.includes('-USDT')) return true;
  if (/\d/.test(normalized)) return false;
  return /^[A-Z]{2,12}(BRL|USD|USDT)?$/.test(normalized);
}

export async function fetchBrapiAssetList(search?: string): Promise<InvestmentAsset[]> {
  try {
    const data = await brapiFetch<BrapiAssetListResponse>('/quote/list', {
      sortBy: 'symbol',
      sortOrder: 'asc',
      ...(search ? { search } : {}),
    });

    const mapped = (data.stocks || []).map((asset) => ({
      symbol: asset.stock,
      name: asset.name,
      lastPrice: Number(asset.close || 0),
      type: asset.type,
    }));

    if (mapped.length > 0) return mapped;
    return filterFallbackAssets(search);
  } catch {
    return filterFallbackAssets(search);
  }
}

export async function fetchBrapiQuotes(symbols: string[]): Promise<Record<string, number>> {
  const uniqueSymbols = Array.from(new Set(symbols.filter(Boolean)));
  if (uniqueSymbols.length === 0) return {};

  const map: Record<string, number> = {};

  const marketSymbols = uniqueSymbols.filter((symbol) => !isLikelyCryptoSymbol(symbol));
  const cryptoSymbols = uniqueSymbols.filter((symbol) => isLikelyCryptoSymbol(symbol));

  if (marketSymbols.length > 0) {
    const data = await brapiFetch<BrapiQuoteResponse>(`/quote/${marketSymbols.join(',')}`);
    for (const quote of data.results || []) {
      if (quote.symbol && typeof quote.regularMarketPrice === 'number') {
        map[quote.symbol] = quote.regularMarketPrice;
      }
    }
  }

  if (cryptoSymbols.length > 0) {
    const normalizedCryptoSymbols = Array.from(
      new Set(cryptoSymbols.map((symbol) => normalizeCryptoSymbol(symbol)).filter(Boolean))
    );

    let cryptoMap: Record<string, number> = {};

    if (COINMARKETCAP_PROXY_URL) {
      try {
        const response = await fetch(
          `${COINMARKETCAP_PROXY_URL}?symbol=${normalizedCryptoSymbols.join(',')}&convert=BRL`
        );

        if (response.ok) {
          const data = (await response.json()) as CoinMarketCapQuoteResponse;
          for (const symbol of normalizedCryptoSymbols) {
            const raw = data.data?.[symbol];
            const item = Array.isArray(raw) ? raw[0] : raw;
            const price = item?.quote?.BRL?.price;
            if (typeof price === 'number') {
              cryptoMap[symbol] = price;
            }
          }
        }
      } catch {
        // Se CoinMarketCap falhar, tenta fallback no bloco abaixo.
      }
    }

    // Fallback primario no front para cripto: CoinGecko (suporta CORS no navegador).
    if (Object.keys(cryptoMap).length === 0) {
      try {
        const response = await fetch(
          `https://api.coingecko.com/api/v3/coins/markets?vs_currency=brl&symbols=${normalizedCryptoSymbols.join(',').toLowerCase()}`
        );
        if (response.ok) {
          const data = (await response.json()) as CoinGeckoMarketItem[];
          for (const item of data || []) {
            const symbol = (item.symbol || '').toUpperCase();
            const price = item.current_price;
            if (symbol && typeof price === 'number') {
              cryptoMap[symbol] = price;
              cryptoMap[`${symbol}-BRL`] = price;
              cryptoMap[`${symbol}BRL`] = price;
            }
          }
        }
      } catch {
        // Tenta fallback com brapi no bloco abaixo.
      }
    }

    if (Object.keys(cryptoMap).length === 0) {
      try {
        const fallbackSymbols = Array.from(new Set(cryptoSymbols));
        const fallbackData = await brapiFetch<BrapiQuoteResponse>(`/quote/${fallbackSymbols.join(',')}`);
        for (const quote of fallbackData.results || []) {
          if (quote.symbol && typeof quote.regularMarketPrice === 'number') {
            // Evita usar cotacao de simbolo "solto" (ex: ETH) em mercado errado.
            if (!isBrlPairSymbol(quote.symbol)) continue;
            const base = normalizeCryptoSymbol(quote.symbol);
            cryptoMap[base] = quote.regularMarketPrice;
            cryptoMap[quote.symbol.toUpperCase()] = quote.regularMarketPrice;
            cryptoMap[`${base}-BRL`] = quote.regularMarketPrice;
            cryptoMap[`${base}BRL`] = quote.regularMarketPrice;
          }
        }
      } catch {
        // Sem fallback adicional.
      }
    }

    for (const originalSymbol of cryptoSymbols) {
      const base = normalizeCryptoSymbol(originalSymbol);
      const price = cryptoMap[base];
      if (typeof price === 'number') {
        map[originalSymbol] = price;
        map[base] = price;
        map[`${base}-BRL`] = price;
        map[`${base}BRL`] = price;
      }
    }
  }

  return map;
}

function chooseRangeFromDate(targetDate: Date) {
  const now = new Date();
  const diffDays = Math.max(1, Math.ceil((now.getTime() - targetDate.getTime()) / 86400000));

  if (diffDays <= 5) return '5d';
  if (diffDays <= 30) return '1mo';
  if (diffDays <= 90) return '3mo';
  if (diffDays <= 180) return '6mo';
  if (diffDays <= 365) return '1y';
  if (diffDays <= 365 * 2) return '2y';
  if (diffDays <= 365 * 5) return '5y';
  if (diffDays <= 365 * 10) return '10y';
  return 'max';
}

function parsePointDate(point: Record<string, unknown>) {
  const raw = point.date ?? point.datetime ?? point.timestamp;
  if (typeof raw === 'number') {
    const ms = raw > 1_000_000_000_000 ? raw : raw * 1000;
    return new Date(ms);
  }
  if (typeof raw === 'string') return new Date(raw);
  return null;
}

function parsePointClose(point: Record<string, unknown>) {
  const raw = point.close ?? point.adjustedClose ?? point.adjClose ?? point.regularMarketPrice;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export async function fetchBrapiCloseOnDate(symbol: string, isoDate: string): Promise<HistoricalCloseResult> {
  const targetDate = new Date(isoDate);
  if (Number.isNaN(targetDate.getTime())) {
    throw new Error('Data invalida para busca historica');
  }

  const range = chooseRangeFromDate(targetDate);
  const data = await brapiFetch<BrapiQuoteResponse>(`/quote/${symbol}`, { range, interval: '1d' });
  const result = data.results?.[0];
  const points = (result?.historicalDataPrice || result?.historicalData || result?.prices || []) as Array<Record<string, unknown>>;

  const parsed = points
    .map((point) => {
      const date = parsePointDate(point);
      const close = parsePointClose(point);
      if (!date || close === null) return null;
      return { date, close };
    })
    .filter((item): item is { date: Date; close: number } => Boolean(item))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (parsed.length === 0) {
    throw new Error('Nao foi possivel obter historico para o ativo selecionado');
  }

  const targetMs = targetDate.getTime();
  let selected = parsed[0];

  for (const point of parsed) {
    if (point.date.getTime() <= targetMs) {
      selected = point;
    } else {
      break;
    }
  }

  return {
    close: selected.close,
    usedDate: selected.date.toISOString().slice(0, 10),
  };
}
