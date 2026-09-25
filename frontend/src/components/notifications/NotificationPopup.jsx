import { useEffect, useRef } from "react";
import AppIcon from "../common/AppIcon";
import { useTranslation } from "../../i18n/LanguageContext.jsx";

/** Above the bet receipt (2147483600) and every other page layer. */
const POPUP_Z_INDEX = 2147483647;

function formatWhen(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function NotificationPopup({ notification, onDismiss }) {
  const { t } = useTranslation();
  const okRef = useRef(null);

  useEffect(() => {
    if (!notification) return undefined;
    const previouslyFocused = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    okRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") onDismiss();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      if (previouslyFocused instanceof HTMLElement) {
        previouslyFocused.focus();
      }
    };
  }, [notification, onDismiss]);

  if (!notification) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/55 p-4 pb-24 sm:pb-4"
      style={{ zIndex: POPUP_Z_INDEX }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-popup-title"
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-transparent bg-[#000000] shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
          <h2
            id="notification-popup-title"
            className="text-sm font-bold uppercase tracking-wide text-[#e8edf8]"
          >
            {t("notifications.title")}
          </h2>
          <button
            type="button"
            onClick={onDismiss}
            aria-label={t("common.close")}
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[rgba(255,255,255,0.72)] hover:bg-[#111111] hover:text-white"
          >
            <AppIcon name="x" size={18} />
          </button>
        </div>

        <div className="px-4 py-4">
          <p className="text-sm font-semibold text-[#e8edf8]">
            {notification.title}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-[rgba(255,255,255,0.72)]">
            {notification.body}
          </p>
          {notification.createdAt ? (
            <p className="mt-2 text-[10px] text-[#6b7a99]">
              {formatWhen(notification.createdAt)}
            </p>
          ) : null}
        </div>

        <div className="flex justify-end border-t border-white/8 px-4 py-3">
          <button
            ref={okRef}
            type="button"
            onClick={onDismiss}
            className="cursor-pointer rounded-xl bg-(--sb-accent-fill) px-4 py-2 text-xs font-bold uppercase tracking-wide text-[#000000] hover:bg-(--sb-accent-fill-hover)"
          >
            {t("notifications.ok")}
          </button>
        </div>
      </div>
    </div>
  );
}
