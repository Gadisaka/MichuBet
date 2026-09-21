/**
 * Newest unread first (API order). Skip ids already dismissed this session.
 * Hide while the inbox dialog is open.
 */
export function pickPopupNotification(unreadItems, dismissedIds, inboxOpen) {
  if (inboxOpen) return null;
  if (!Array.isArray(unreadItems)) return null;
  return unreadItems.find((n) => n?.id && !dismissedIds.has(n.id)) ?? null;
}
