import { QueryClient } from '@tanstack/react-query'

/** Ilova bo'ylab yagona so'rovlar keshi (komponentdan tashqaridagi amallar ham yangilay olishi uchun) */
export const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: true, retry: 1 } } })
