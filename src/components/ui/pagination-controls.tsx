import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationControlsProps {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  hasNext: boolean;
  hasPrev: boolean;
  nextPage: () => void;
  prevPage: () => void;
}

export const PaginationControls = ({
  page,
  totalPages,
  totalItems,
  pageSize,
  hasNext,
  hasPrev,
  nextPage,
  prevPage,
}: PaginationControlsProps) => {
  if (totalPages <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20">
      <span className="text-xs text-muted-foreground">
        {start}–{end} de {totalItems}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={prevPage}
          disabled={!hasPrev}
          className="p-1.5 rounded-md hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs text-muted-foreground px-2">
          {page} / {totalPages}
        </span>
        <button
          onClick={nextPage}
          disabled={!hasNext}
          className="p-1.5 rounded-md hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
