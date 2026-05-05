import { useQuery } from '@tanstack/react-query';
import { fetchLatestBcbRates } from '@/lib/bcb';

export function useBcbRates() {
  return useQuery({
    queryKey: ['bcb-rates', 'v2'],
    queryFn: fetchLatestBcbRates,
    staleTime: 1000 * 60 * 30,
    refetchInterval: 1000 * 60 * 60,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
}

