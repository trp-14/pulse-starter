'use client';

const WINDOW = 5;

/** Up to five page numbers centred on the current page. */
export function pageWindow(page: number, totalPages: number): number[] {
  const start = Math.max(1, Math.min(page - Math.floor(WINDOW / 2), totalPages - WINDOW + 1));
  const end = Math.min(totalPages, start + WINDOW - 1);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

interface OrdersPaginationProps {
  page: number;
  totalPages: number;
  disabled: boolean;
  onPage: (page: number) => void;
}

export function OrdersPagination({ page, totalPages, disabled, onPage }: OrdersPaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Orders pages">
      <button type="button" className="btn" disabled={disabled || page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </button>
      <ol className="pagination-pages">
        {pageWindow(page, totalPages).map((number) => (
          <li key={number}>
            <button
              type="button"
              className={number === page ? 'btn-gloss pagination-page' : 'btn pagination-page'}
              aria-current={number === page ? 'page' : undefined}
              aria-label={`Page ${number}`}
              disabled={disabled}
              onClick={() => onPage(number)}
            >
              {number}
            </button>
          </li>
        ))}
      </ol>
      <button type="button" className="btn" disabled={disabled || page >= totalPages} onClick={() => onPage(page + 1)}>
        Next
      </button>
    </nav>
  );
}
