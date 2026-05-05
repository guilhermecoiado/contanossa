import { useQuery } from '@tanstack/react-query';
import { fetchBrapiAssetList, fetchBrapiQuotes } from '@/lib/brapi';

export function useBrapiAssetList(search?: string) {
  return useQuery({
    queryKey: ['brapi-assets', search],
    queryFn: () => fetchBrapiAssetList(search),
    staleTime: 1000 * 60 * 30,
  });
}

export function useBrapiQuotes(symbols: string[]) {
  return useQuery({
    queryKey: ['brapi-quotes', symbols.slice().sort().join(',')],
    queryFn: () => fetchBrapiQuotes(symbols),
    enabled: symbols.length > 0,
    refetchInterval: 1000 * 60,
    staleTime: 1000 * 20,
  });
}

