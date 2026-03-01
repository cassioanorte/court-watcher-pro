import { useState, useMemo } from "react";

interface UsePaginationOptions<T> {
  data: T[];
  pageSize?: number;
}

export function usePagination<T>({ data, pageSize = 50 }: UsePaginationOptions<T>) {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const paginatedData = useMemo(
    () => data.slice((safePage - 1) * pageSize, safePage * pageSize),
    [data, safePage, pageSize]
  );

  const goToPage = (p: number) => setPage(Math.max(1, Math.min(p, totalPages)));
  const nextPage = () => goToPage(safePage + 1);
  const prevPage = () => goToPage(safePage - 1);

  // Reset page when data changes significantly
  const resetPage = () => setPage(1);

  return {
    paginatedData,
    page: safePage,
    totalPages,
    pageSize,
    totalItems: data.length,
    goToPage,
    nextPage,
    prevPage,
    resetPage,
    hasNext: safePage < totalPages,
    hasPrev: safePage > 1,
  };
}
