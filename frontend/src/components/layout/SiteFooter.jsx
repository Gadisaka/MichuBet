import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AppIcon from "../common/AppIcon";
import AgeRestrictionNotice from "../common/AgeRestrictionNotice";
import { topHeaderData } from "../../data/homepageData";
import { fetchPlayerInfoPages } from "../../services/api";
import { pickTelegramContactFromPages } from "../../utils/telegramContact";
import { useTranslation } from "../../i18n/LanguageContext.jsx";

const footerNav = [
  { key: "sports", to: "/" },
  { key: "games", to: "/live" },
  { key: "promotions", to: "/info/how-to-play" },
  { key: "deposit", to: "/deposit" },
];

function SiteFooter() {
  const { t } = useTranslation();
  const [telegram, setTelegram] = useState(null);
  const brand = topHeaderData.brand || "Michotbet";
  const year = new Date().getFullYear();

  useEffect(() => {
    let cancelled = false;
    fetchPlayerInfoPages()
      .then((data) => {
        if (cancelled) return;
        setTelegram(
          pickTelegramContactFromPages(data?.pages, data?.telegramHref),
        );
      })
      .catch(() => {
        if (!cancelled) setTelegram(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <footer className="mt-4 border-t border-white/10 bg-[#000000] px-4 pb-6 pt-8">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center">
        <p className="m-0 text-sm font-medium text-[rgba(255,255,255,0.72)]">
          {t("footer.tagline")}
        </p>

        {telegram?.link ? (
          <a
            href={telegram.link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[#229ED9] text-white shadow-[0_6px_20px_rgba(34,158,217,0.35)] transition-transform hover:scale-105"
            aria-label={t("header.telegram")}
          >
            {telegram.logo ? (
              <img
                src={telegram.logo}
                alt=""
                className="h-6 w-6 rounded-full object-cover"
              />
            ) : (
              <AppIcon name="send" size={20} strokeWidth={2} />
            )}
          </a>
        ) : null}

        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          {footerNav.map((item) => (
            <Link
              key={item.key}
              to={item.to}
              className="text-sm font-semibold text-[rgba(255,255,255,0.78)] no-underline transition-colors hover:text-[#ffffff]"
            >
              {t(`footer.${item.key}`)}
            </Link>
          ))}
        </nav>

        <AgeRestrictionNotice className="max-w-md" />

        <p className="m-0 max-w-lg text-[11px] leading-relaxed text-[rgba(255,255,255,0.45)]">
          © {year} {brand}. {t("footer.rightsReserved")}{" "}
          {t("footer.ageNotice")} {t("footer.gambleResponsibly")}
        </p>
      </div>
    </footer>
  );
}

export default SiteFooter;
