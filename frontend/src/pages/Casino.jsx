import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageContainer from "../components/layout/PageContainer";
import PrimaryNav from "../components/layout/PrimaryNav";
import SiteFooter from "../components/layout/SiteFooter";
import TopHeader from "../components/layout/TopHeader";
import MobileBottomBar from "../components/layout/MobileBottomBar";
import AppIcon from "../components/common/AppIcon";
import LogoImg from "../components/common/LogoImg";
import GameFrame from "../components/casino/GameFrame";
import { topHeaderData, topNavItems } from "../data/homepageData";
import { useTranslation } from "../i18n/LanguageContext.jsx";
import {
  fetchCasinoGames,
  fetchInoutDemoLaunchUrl,
  fetchInoutLaunchUrl,
  hasAuthToken,
} from "../services/api";

function GameCard({ game, onPlay, onDemo, t }) {
  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-white/8 bg-gradient-to-br from-[#111111]/92 to-[#000000]/92 transition-all hover:ring-1 hover:ring-(--sb-accent-fill)/40">
      <div className="relative aspect-square w-full overflow-hidden bg-[#0a0a0a]">
        {game.iconUrl ? (
          <LogoImg
            src={game.iconUrl}
            alt={game.title}
            size={256}
            className="h-full w-full"
            rounded="rounded-none"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[#3a3a3a]">
            <AppIcon name="gamepad" size={40} />
          </div>
        )}
        {game.rtp ? (
          <span className="absolute right-1.5 top-1.5 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold text-(--sb-accent-fill)">
            RTP {game.rtp}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-2.5">
        <h3 className="truncate text-[13px] font-semibold text-[#f6f9ff]">
          {game.title}
        </h3>
        <div className="mt-auto grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => onPlay(game)}
            className="cursor-pointer rounded-xl border-0 bg-(--sb-accent-fill) px-2 py-1.5 text-[12px] font-bold text-[#000000] transition-all hover:brightness-110"
          >
            {t("casino.play")}
          </button>
          <button
            type="button"
            onClick={() => onDemo(game)}
            className="cursor-pointer rounded-xl border border-white/12 bg-transparent px-2 py-1.5 text-[12px] font-semibold text-[#ffffff] transition-all hover:bg-[#111111]"
          >
            {t("casino.demo")}
          </button>
        </div>
      </div>
    </div>
  );
}

function Casino() {
  const { t, language } = useTranslation();
  const navigate = useNavigate();

  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [frame, setFrame] = useState(null);
  const [launching, setLaunching] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    fetchCasinoGames({ signal: ac.signal })
      .then((list) => {
        setGames(list);
        setError(null);
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setError(err.message || "Failed to load games");
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, []);

  const handlePlay = useCallback(
    async (game) => {
      if (!hasAuthToken()) {
        navigate("/login");
        return;
      }
      if (launching) return;
      setLaunching(true);
      try {
        const url = await fetchInoutLaunchUrl(game.gameMode, { lang: language });
        setFrame({ url, title: game.title });
      } catch (err) {
        setError(err.message || "Failed to launch game");
      } finally {
        setLaunching(false);
      }
    },
    [launching, language, navigate],
  );

  const handleDemo = useCallback(
    async (game) => {
      if (launching) return;
      setLaunching(true);
      try {
        const url = await fetchInoutDemoLaunchUrl(game.gameMode, language);
        setFrame({ url, title: game.title });
      } catch (err) {
        setError(err.message || "Failed to launch demo");
      } finally {
        setLaunching(false);
      }
    },
    [launching, language],
  );

  return (
    <PageContainer>
      <div className="sticky top-0 z-50">
        <TopHeader data={topHeaderData} />
        <PrimaryNav items={topNavItems} />
      </div>

      <div className="mx-auto w-full max-w-6xl px-2 pt-2 sm:px-3">
        <div className="animate-deposit-panel px-1 pt-1">
          <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[rgba(255,255,255,0.72)]">
            {t("casino.eyebrow")}
          </p>
          <h1 className="m-0 bg-gradient-to-r from-[#ffffff] via-[#ffe8a3] to-[#ffffff] bg-clip-text text-xl font-black tracking-tight text-transparent sm:text-2xl">
            {t("casino.title")}
          </h1>
        </div>

        {error ? (
          <div className="mx-1 mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center px-4 py-24 text-[rgba(255,255,255,0.72)]">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#F6AF01] border-t-transparent" />
            <span className="ml-3 text-sm font-semibold">
              {t("casino.loading")}
            </span>
          </div>
        ) : games.length === 0 ? (
          <div className="mx-1 mb-3 mt-3 rounded-[1.25rem] bg-gradient-to-br from-[#111111]/88 to-[#000000]/92 px-4 py-14 text-center">
            <p className="m-0 text-sm font-medium text-[rgba(255,255,255,0.72)]">
              {t("casino.empty")}
            </p>
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-3 pb-6 md:grid-cols-3 lg:grid-cols-4">
            {games.map((game) => (
              <GameCard
                key={game.gameMode}
                game={game}
                onPlay={handlePlay}
                onDemo={handleDemo}
                t={t}
              />
            ))}
          </div>
        )}
      </div>

      <SiteFooter />
      <MobileBottomBar />
      <div className="h-16 lg:hidden" />

      {frame ? (
        <GameFrame
          url={frame.url}
          title={frame.title}
          onClose={() => setFrame(null)}
        />
      ) : null}
    </PageContainer>
  );
}

export default Casino;
