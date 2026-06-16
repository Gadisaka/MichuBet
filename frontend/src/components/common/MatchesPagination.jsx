import { getVisiblePageNumbers } from "../../utils/pagination";
import { useTranslation } from "../../i18n/LanguageContext.jsx";

function MatchesPagination({ page, totalPages, onPageChange, className = "" }) {
  const { t } = useTranslation();

  if (totalPages <= 1) return null;

  const pages = getVisiblePageNumbers(page, totalPages);

  return (
    <nav
      className={`flex flex-wrap items-center justify-center gap-2 px-2 py-4 ${className}`.trim()}
      aria-label={t("pagination.aria")}
    >
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="rounded-full border border-white/12 bg-[#111111] px-4 py-2 text-xs font-semibold text-[rgba(255,255,255,0.85)] transition-colors hover:bg-[#1a1a1a] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {t("pagination.prev")}
      </button>

      {pages.map((pageNum) => {
        const active = pageNum === page;
        return (
          <button
            key={pageNum}
            type="button"
            onClick={() => onPageChange(pageNum)}
            aria-current={active ? "page" : undefined}
            className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-colors ${
              active
                ? "bg-red-600 text-white shadow-[0_4px_14px_rgba(220,38,38,0.35)]"
                : "border border-white/12 bg-[#111111] text-[rgba(255,255,255,0.85)] hover:bg-[#1a1a1a]"
            }`}
          >
            {pageNum}
          </button>
        );
      })}

      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="rounded-full border border-white/12 bg-[#111111] px-4 py-2 text-xs font-semibold text-[rgba(255,255,255,0.85)] transition-colors hover:bg-[#1a1a1a] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {t("pagination.next")}
      </button>
    </nav>
  );
}

export default MatchesPagination;
