import { useEffect, useMemo, useState } from "react";
import { fetchHomeHeroBanners } from "../../services/api";
import bannerOne from "../../assets/banners/1772036098011-agent-banner-desktop-size-update.jpg";
import bannerTwo from "../../assets/banners/1768574244238-5427218132788514362.jpg";
import bannerThree from "../../assets/banners/1772806984267-whatsapp-image-2026-03-06-at-18.14.32.jpg";
import bannerFour from "../../assets/banners/3.png"


function HeroBanner() {
  const fallbackBanners = useMemo(
    () => [ bannerFour],
    [],
  );
  const [banners, setBanners] = useState(fallbackBanners);
  const [currentBanner, setCurrentBanner] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchHomeHeroBanners();
        const urls = Array.isArray(data?.urls)
          ? data.urls.filter(
              (u) =>
                typeof u === "string" && u.trim().startsWith("https://"),
            )
          : [];
        if (!cancelled) {
          const next = urls.length > 0 ? urls : fallbackBanners;
          setBanners(next);
          setCurrentBanner(0);
        }
      } catch {
        if (!cancelled) {
          setBanners(fallbackBanners);
          setCurrentBanner(0);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fallbackBanners]);

  useEffect(() => {
    if (banners.length <= 1) return;
    const intervalId = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % banners.length);
    }, 3500);

    return () => clearInterval(intervalId);
  }, [banners.length]);

  return (
    <div className="aspect-1080/300 w-full overflow-hidden rounded-[1.15rem] bg-[#0b1326] shadow-[0_16px_40px_-16px_rgba(0,0,0,0.5)] ring-1 ring-[#3d3f5c]/45 transition-shadow duration-500 hover:shadow-[0_20px_48px_-14px_rgba(56,203,191,0.12)]">
      <img
        src={banners[currentBanner]}
        alt="Promotional banner"
        className="h-full w-full object-contain object-center"
        width={1080}
        height={300}
        decoding="async"
      />
    </div>
  );
}

export default HeroBanner;
