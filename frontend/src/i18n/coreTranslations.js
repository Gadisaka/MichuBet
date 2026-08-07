/** @typedef {'en' | 'am'} AppLanguage */

export const LANGUAGE_STORAGE_KEY = "michotbet_ui_lang";

export const SUPPORTED_LANGUAGES = /** @type {const} */ (["en", "am"]);

/**
 * @param {unknown} value
 * @returns {value is AppLanguage}
 */
export function isAppLanguage(value) {
  return value === "en" || value === "am";
}

/**
 * Nested translation maps for core UI (EN / አማርኛ).
 * Keys use dot notation in `t('segment.key')`.
 */
export const translations = Object.freeze({
  en: Object.freeze({
    nav: Object.freeze({
      home: "HOME",
      live: "LIVE",
      games: "MORE",
      fastKeno: "KENO",
      aviator: "AVIATOR",
      chickenRoad: "CHICKEN ROAD 2",
      chickenCoin: "CHICKEN COIN",
      bingo: "BINGO",
      megaBlock: "MEGA BLOCK",
    }),
    categories: Object.freeze({
      title: "Top games",
      pinned: "Pinned",
      inout: "InOut",
      chickenRoad: "Chicken Road 2",
      chickenCoin: "Chicken Coin",
      aviator: "Aviator",
      bingo: "Bingo",
      megaBlock: "Mega Block",
      fastKeno: "Keno",
      allGames: "All games",
    }),
    casino: Object.freeze({
      eyebrow: "Casino",
      title: "Play instant games",
      play: "Play",
      demo: "Demo",
      loading: "Loading games…",
      empty: "No games available right now.",
      loginRequired: "Please log in to play for real.",
      instantEyebrow: "Instant",
      instantTitle: "Keno, Aviator & Bingo",
      kenoName: "Keno",
      aviatorName: "Aviator",
      bingoName: "Bingo",
      inoutEyebrow: "Featured",
      inoutTitle: "InOut casino",
    }),
    header: Object.freeze({
      searchPlaceholder: "Search events",
      searchAria: "Search",
      deposit: "DEPOSIT",
      login: "LOGIN",
      register: "REGISTER",
      telegram: "Telegram",
      languageMenu: "Language",
      langEnglish: "English — United Kingdom",
      langAmharic: "አማርኛ — Ethiopia",
      notifications: "Notifications",
    }),
    notifications: Object.freeze({
      title: "Notifications",
      loading: "Loading…",
      empty: "No notifications yet.",
      markAllRead: "Mark all read",
      new: "New",
    }),
    common: Object.freeze({
      close: "Close",
      closeMenu: "Close menu",
      accountMenu: "Account menu",
      helpLegalNav: "Help and legal",
      clear: "Clear",
      goToNextDay: "Show fixtures for",
    }),
    menu: Object.freeze({
      title: "Menu",
      accountTitle: "Account",
      betHistory: "Bet history",
      deposit: "Deposit",
      withdraw: "Withdraw",
      transactionHistory: "Transaction history",
      checkTicket: "Check ticket",
      profile: "Profile",
      signOut: "Sign out",
      messages: "Messages",
      myProfile: "My profile",
      myBets: "My bets",
      balance: "Balance",
      transaction: "Transaction",
    }),
    mobileBar: Object.freeze({
      leagues: "LEAGUES",
      live: "Live",
      menu: "Menu",
      games: "GAMES",
      deposit: "DEPOSIT",
      slip: "SLIP",
      betSlip: "Bet Slip",
    }),
    footer: Object.freeze({
      tagline: "Your trusted online betting platform",
      sports: "Sports",
      games: "Games",
      promotions: "Promotions",
      cashbackRules: "Cashback Rules",
      deposit: "Deposit",
      rightsReserved: "All rights reserved.",
      ageNotice: "Must be 21+ to play.",
      gambleResponsibly: "Gamble responsibly.",
    }),
    age: Object.freeze({
      badge: "21+",
      playersOnly: "For players 21 years and older only.",
    }),
    pagination: Object.freeze({
      prev: "Prev",
      next: "Next",
      aria: "Match list pages",
    }),
    sidebar: Object.freeze({
      infoSection: "Info",
      searchClubsPlaceholder: "Search clubs…",
      searchButton: "Search",
      searchClubsAria: "Search by club name",
      filterByTime: "Filter by time",
      dateWithGames: "Date (with games)",
      noFixtures: "No fixtures",
      selectDay: "Select day…",
    }),
    time: Object.freeze({
      today: "Today",
      tomorrow: "Tomorrow",
      hour1h: "1H",
      hour3h: "3H",
      hour12h: "12H",
    }),
    days: Object.freeze({
      sun: "Sun",
      mon: "Mon",
      tue: "Tue",
      wed: "Wed",
      thu: "Thu",
      fri: "Fri",
      sat: "Sat",
    }),
    infoPage: Object.freeze({
      faq: "FAQ",
      "how-to-play": "How to play",
      "cashback-rules": "Cashback Rules",
      "privacy-policy": "Privacy Policy",
      "terms-and-conditions": "Terms and conditions",
      "contact-us": "Contact Us",
    }),
    article: Object.freeze({
      backHome: "Back to home",
      loading: "Loading…",
      emptyTopic: "No content published yet for this topic.",
    }),
  }),
  am: Object.freeze({
    nav: Object.freeze({
      home: "መነሻ",
      live: "ቀጥታ",
      games: "ተጨማሪ",
      fastKeno: "ኬኖ",
      aviator: "አቪያተር",
      chickenRoad: "ቺክን ሮድ 2",
      chickenCoin: "ቺክን ኮይን",
      bingo: "ቢንጎ",
      megaBlock: "ሜጋ ብሎክ",
    }),
    categories: Object.freeze({
      title: "ተመራጭ ጨዋታዎች",
      pinned: "ተለጥፏል",
      inout: "InOut",
      chickenRoad: "ቺክን ሮድ 2",
      chickenCoin: "ቺክን ኮይን",
      aviator: "አቪያተር",
      bingo: "ቢንጎ",
      megaBlock: "ሜጋ ብሎክ",
      fastKeno: "ኬኖ",
      allGames: "ሁሉም ጨዋታዎች",
    }),
    casino: Object.freeze({
      eyebrow: "ካዚኖ",
      title: "ፈጣን ጨዋታዎችን ይጫወቱ",
      play: "ተጫወት",
      demo: "ሙከራ",
      loading: "ጨዋታዎችን በመጫን ላይ…",
      empty: "አሁን ምንም ጨዋታ የለም።",
      loginRequired: "በእውነተኛ ገንዘብ ለመጫወት እባክዎ ይግቡ።",
      instantEyebrow: "ፈጣን",
      instantTitle: "ኬኖ፣ አቪያተር እና ቢንጎ",
      kenoName: "ኬኖ",
      aviatorName: "አቪያተር",
      bingoName: "ቢንጎ",
      inoutEyebrow: "ተመራጭ",
      inoutTitle: "የInOut ካዚኖ",
    }),
    header: Object.freeze({
      searchPlaceholder: "ክስተቶችን ፈልግ",
      searchAria: "ፈልግ",
      deposit: "ዲፖዚት",
      login: "ግባ",
      register: "ይመዝገቡ",
      telegram: "ቴሌግራም",
      languageMenu: "ቋንቋ",
      langEnglish: "እንግሊዝኛ — ዩናይትድ ኪንግደም",
      langAmharic: "አማርኛ — ኢትዮጵያ",
      notifications: "ማሳወቂያዎች",
    }),
    notifications: Object.freeze({
      title: "ማሳወቂያዎች",
      loading: "በመጫን ላይ…",
      empty: "እስካሁን ማሳወቂያ የለም።",
      markAllRead: "ሁሉንም እንደተነበበ ምልክት አድርግ",
      new: "አዲስ",
    }),
    common: Object.freeze({
      close: "ዝጋ",
      closeMenu: "ምናሌ ዝጋ",
      accountMenu: "መለያ ምናሌ",
      helpLegalNav: "እገዛ እና ህጎች",
      clear: "አጽዳ",
      goToNextDay: "ለዚህ ቀን ጨዋታዎችን አሳይ",
    }),
    menu: Object.freeze({
      title: "ምናሌ",
      accountTitle: "መለያ",
      betHistory: "የውርርዶች ታሪክ",
      deposit: "ዲፖዚት",
      withdraw: "ገንዘብ ማማውጣት",
      transactionHistory: "ግብይት ታሪክ",
      checkTicket: "ቲኬት ይፈትሹ",
      profile: "መገለጫ",
      signOut: "ውጣ",
      messages: "መልዕክቶች",
      myProfile: "የእኔ መገለጫ",
      myBets: "የእኔ ውርርዶች",
      balance: "ባላንስ",
      transaction: "ግብይት",
    }),
    mobileBar: Object.freeze({
      leagues: "ሊጎች",
      live: "ቀጥታ",
      menu: "ምናሌ",
      games: "ጨዋታዎች",
      deposit: "ዲፖዚት",
      slip: "ቁራጭ",
      betSlip: "የውርርድ ቁራጭ",
    }),
    footer: Object.freeze({
      tagline: "የተማመኑ የመስመር ላይ ውርርድ መድረክ",
      sports: "ስፖርት",
      games: "ጨዋታዎች",
      promotions: "ማስተዋወቂያዎች",
      cashbackRules: "የካሽባክ ደንቦች",
      deposit: "ዲፖዚት",
      rightsReserved: "ሁሉም መብቶች የተጠበቁ ናቸው።",
      ageNotice: "ለመጫወት 21+ መሆን አለቦት።",
      gambleResponsibly: "በሃላፊነት ይጫወቱ።",
    }),
    age: Object.freeze({
      badge: "21+",
      playersOnly: "ለ21 ዓመት እና ከዚያ በላይ ተጫዋቾች ብቻ።",
    }),
    pagination: Object.freeze({
      prev: "ቀዳሚ",
      next: "ቀጣይ",
      aria: "የጨዋታ ዝርዝር ገጾች",
    }),
    sidebar: Object.freeze({
      infoSection: "መረጃ",
      searchClubsPlaceholder: "ክለቦችን ፈልግ…",
      searchButton: "ፈልግ",
      searchClubsAria: "በክለብ ስም ፈልግ",
      filterByTime: "ጊዜ ማጣሪያ",
      dateWithGames: "ቀን (ጨዋታ ያለበት)",
      noFixtures: "ጨዋታ የለም",
      selectDay: "ቀን ይምረጡ…",
    }),
    time: Object.freeze({
      today: "ዛሬ",
      tomorrow: "ነገ",
      hour1h: "1H",
      hour3h: "3H",
      hour12h: "12H",
    }),
    days: Object.freeze({
      sun: "እሑድ",
      mon: "ሰኞ",
      tue: "ማክሰኞ",
      wed: "ረቡዕ",
      thu: "ሐሙስ",
      fri: "አርብ",
      sat: "ቅዳሜ",
    }),
    infoPage: Object.freeze({
      faq: "ተደጋጋሚ ጥያቄዎች",
      "how-to-play": "እንዴት ይጫወታል",
      "cashback-rules": "የካሽባክ ደንቦች",
      "privacy-policy": "የግላዊነት ፖሊሲ",
      "terms-and-conditions": "ውሎች እና ሁኔታዎች",
      "contact-us": "እኛን ያግኙ",
    }),
    article: Object.freeze({
      backHome: "ወደ መነሻ ተመለስ",
      loading: "በመጫን ላይ…",
      emptyTopic: "ለዚህ ርዕስ እስካሁን ይዘት የለም።",
    }),
  }),
});

/**
 * Label for sportsbook time/calendar options (see `labelKey` from `buildSportsbookTimeOptions`).
 *
 * @param {{ label?: string, labelKey?: string | null }} [option]
 * @param {(path: string, fallback?: string) => string} t
 * @returns {string}
 */
export function timeOptionDisplayLabel(option, t) {
  if (!option) return "";
  if (option.labelKey) return t(option.labelKey, option.label ?? "");
  return option.label ?? "";
}

/**
 * @param {Record<string, unknown>} obj
 * @param {string} path dot-separated
 * @returns {string | undefined}
 */
function getByPath(obj, path) {
  const parts = path.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object" || !(p in cur)) return undefined;
    cur = /** @type {Record<string, unknown>} */ (cur)[p];
  }
  return typeof cur === "string" ? cur : undefined;
}

/**
 * @param {AppLanguage} lang
 * @param {string} path
 * @param {string} [fallback]
 * @returns {string}
 */
export function translate(lang, path, fallback = path) {
  const map = translations[lang];
  const enMap = translations.en;
  return getByPath(map, path) ?? getByPath(enMap, path) ?? fallback;
}
