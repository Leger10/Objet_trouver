import { useState } from "react";

const PAGE_SIZE = 10;

export function usePaginate(items, pageSize = PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const shown = items.slice(0, page * pageSize);
  const hasMore = shown.length < items.length;
  return {
    shown,
    hasMore,
    total: items.length,
    nextPage: () => setPage((p) => p + 1),
    resetPage: () => setPage(1),
  };
}

export function ListFooter({ shown, total, hasMore, nextPage }) {
  if (!hasMore) return null;
  return (
    <button
      onClick={nextPage}
      className="mt-3 w-full rounded-2xl border border-border bg-card py-3 text-sm font-bold text-muted-foreground active:scale-[0.98]"
    >
      Voir plus ({shown.length}/{total})
    </button>
  );
}

export function EmptyState({ text }) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-8 text-center">
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
