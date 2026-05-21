import AppIcon from "../common/AppIcon";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "../../i18n/LanguageContext.jsx";

function PrimaryNav({ items }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <nav className="flex w-full items-center justify-center overflow-x-auto border-b border-[#1b2842] bg-[#0a1122] px-1 md:gap-2 max-sm:justify-start">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`my-2 flex min-w-[78px] shrink-0 cursor-pointer items-center justify-center gap-1 rounded-[14px] border px-2 py-1 text-[12px] font-semibold ${
            item.path && location.pathname === item.path
              ? "border-(--sb-accent-border) bg-(--sb-accent-surface) text-(--sb-accent-text-on-dark)"
              : "border-transparent bg-transparent text-[#c8d2eb]"
          }`.trim()}
          onClick={() => {
            if (item.path) navigate(item.path);
          }}
        >
          <span
            className={`${item.path && location.pathname === item.path ? "text-(--sb-accent-text-muted)" : "text-[#8fa0c5]"} inline-flex items-center justify-center`}
          >
            <AppIcon name={item.icon} size={14} />
          </span>
          <span>{t(`nav.${item.id}`)}</span>
        </button>
      ))}
    </nav>
  );
}

export default PrimaryNav;
