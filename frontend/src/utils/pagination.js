export const MATCHES_PAGE_SIZE = 30;

export function getTotalPages(itemCount, pageSize = MATCHES_PAGE_SIZE) {
  if (!itemCount || itemCount <= 0) return 1;
  return Math.ceil(itemCount / pageSize);
}

export function slicePageItems(items, page, pageSize = MATCHES_PAGE_SIZE) {
  const list = Array.isArray(items) ? items : [];
  const totalPages = getTotalPages(list.length, pageSize);
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    items: list.slice(start, start + pageSize),
    page: safePage,
    totalPages,
    totalItems: list.length,
  };
}

/** Up to `max` page buttons centered on the current page. */
export function getVisiblePageNumbers(currentPage, totalPages, max = 5) {
  if (totalPages <= 1) return [1];
  if (totalPages <= max) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  let start = Math.max(1, currentPage - Math.floor(max / 2));
  let end = start + max - 1;
  if (end > totalPages) {
    end = totalPages;
    start = end - max + 1;
  }
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}
