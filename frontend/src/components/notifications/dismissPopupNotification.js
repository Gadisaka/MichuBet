/**
 * Hide immediately, then persist read. If mark-read fails, the popup can show again.
 */
export async function dismissPopupNotification({
  id,
  dismissedIds,
  markRead,
}) {
  if (!id) return { marked: false };
  dismissedIds.add(id);
  try {
    await markRead(id);
    return { marked: true };
  } catch {
    dismissedIds.delete(id);
    return { marked: false };
  }
}
