import AppIcon from "../common/AppIcon";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "../../i18n/LanguageContext.jsx";

function PrimaryNav({ items }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <nav className="flex w-full items-center justify-center overflow-x-auto border-b border-white/10 bg-[#000000] px-1 md:gap-2 max-sm:justify-start">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`my-2 flex min-w-[78px] shrink-0 cursor-pointer items-center justify-center gap-1 rounded-[14px] border px-2 py-1 text-[12px] font-semibold ${
            item.path && location.pathname === item.path
              ? "border-transparent bg-[#F6AF01] text-[#000000]"
              : "border-transparent bg-transparent text-[#ffffff]"
          }`.trim()}
          onClick={() => {
            if (item.path) navigate(item.path);
          }}
        >
          <span
            className={`${item.path && location.pathname === item.path ? "text-[#000000]" : "text-[rgba(255,255,255,0.72)]"} inline-flex items-center justify-center`}
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
