(function () {
  function emptyMonth(label) {
    return {
      label: label,
      shop_wagered: 0,
      shop_payout: 0,
      shop_cancel: 0,
      shop_wagered_n: 0,
      shop_payout_n: 0,
      online_wagered: 0,
      online_payout: 0,
      online_cancel: 0,
      online_wagered_n: 0,
      online_payout_n: 0,
      casino_wagered: 0,
      casino_payout: 0,
      casino_wagered_n: 0,
      casino_payout_n: 0,
      days: {},
    };
  }
  function emptyDay() {
    return {
      shop_wagered: 0,
      shop_payout: 0,
      shop_cancel: 0,
      online_wagered: 0,
      online_payout: 0,
      online_cancel: 0,
      casino_wagered: 0,
      casino_payout: 0,
    };
  }
  function eatMonth(d) {
    const t = new Date(d.getTime() + 3 * 3600 * 1000);
    return t.getUTCFullYear() + "-" + String(t.getUTCMonth() + 1).padStart(2, "0");
  }
  function eatDay(d) {
    const t = new Date(d.getTime() + 3 * 3600 * 1000);
    return t.toISOString().slice(0, 10);
  }
  function sportsSettlementTicketId(tx) {
    const t = String(tx.type || "");
    const r = String(tx.reference || "");
    if (t === "PAYOUT" && r.indexOf("win-settlement:") === 0) {
      return r.slice("win-settlement:".length);
    }
    if (t === "PAYOUT" && r.indexOf("ticket:") === 0) {
      return r.slice("ticket:".length);
    }
    if (t === "BONUS" && r.indexOf("cashback-payout:") === 0) {
      return r.slice("cashback-payout:".length);
    }
    if (t === "BONUS" && r.indexOf("bonus:cashback:") === 0) {
      return r.slice("bonus:cashback:".length);
    }
    return null;
  }
  function classify(tx, wt) {
    const t = String(tx.type || "");
    const r = String(tx.reference || "");
    if (wt === "CASHIER") {
      if (t === "BET" && r.indexOf("ticket-print:") === 0) return "shop_wagered";
      if (t === "PAYOUT" && r.indexOf("ticket:") === 0) return "shop_payout";
      if (t === "BONUS" && r.indexOf("cashback-payout:") === 0) return "shop_payout";
      if (t === "DEPOSIT" && r.indexOf("cancel-refund") === 0) return "shop_cancel";
      if (t === "DEPOSIT" && r.indexOf("void-refund") === 0) return "shop_cancel";
      return null;
    }
    if (wt === "PLAYER") {
      if (r.indexOf("inout:") === 0 || r.indexOf("mrx:") === 0) {
        if (t === "BET") return "casino_wagered";
        if (t === "PAYOUT") return "casino_payout";
        return null;
      }
      if (t === "BET") return "online_wagered";
      if (t === "PAYOUT" && r.indexOf("ticket:") === 0) return "online_payout";
      if (t === "BONUS" && r.indexOf("bonus:cashback:") === 0) return "online_payout";
      if (t === "CASHOUT") return "online_payout";
      if (t === "DEPOSIT" && r.indexOf("bet-refund:") === 0) return "online_cancel";
      if (t === "DEPOSIT" && r.indexOf("void-refund:") === 0) return "online_cancel";
      return null;
    }
    return null;
  }
  function round2(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
  }
  function summarize(b) {
    const shopW = round2(b.shop_wagered - b.shop_cancel);
    const shopP = round2(b.shop_payout);
    const onlineSportsW = round2(b.online_wagered - b.online_cancel);
    const onlineSportsP = round2(b.online_payout);
    const casinoW = round2(b.casino_wagered);
    const casinoP = round2(b.casino_payout);
    const onlineW = round2(onlineSportsW + casinoW);
    const onlineP = round2(onlineSportsP + casinoP);
    const days = Object.keys(b.days)
      .sort()
      .map(function (d) {
        const x = b.days[d];
        const sw = round2(x.shop_wagered - x.shop_cancel);
        const sp = round2(x.shop_payout);
        const ow = round2(x.online_wagered - x.online_cancel + x.casino_wagered);
        const op = round2(x.online_payout + x.casino_payout);
        return {
          date: d,
          shopWagered: sw,
          shopPayout: sp,
          shopProfit: round2(sw - sp),
          onlineWagered: ow,
          onlinePayout: op,
          onlineProfit: round2(ow - op),
          totalWagered: round2(sw + ow),
          totalPayout: round2(sp + op),
          totalProfit: round2(sw + ow - sp - op),
        };
      });
    return {
      label: b.label,
      shop: {
        wagered: shopW,
        payout: shopP,
        profit: round2(shopW - shopP),
        bets: b.shop_wagered_n,
        pays: b.shop_payout_n,
      },
      onlineSports: {
        wagered: onlineSportsW,
        payout: onlineSportsP,
        profit: round2(onlineSportsW - onlineSportsP),
        bets: b.online_wagered_n,
        pays: b.online_payout_n,
      },
      onlineCasino: {
        wagered: casinoW,
        payout: casinoP,
        profit: round2(casinoW - casinoP),
        bets: b.casino_wagered_n,
        pays: b.casino_payout_n,
      },
      online: {
        wagered: onlineW,
        payout: onlineP,
        profit: round2(onlineW - onlineP),
      },
      total: {
        wagered: round2(shopW + onlineW),
        payout: round2(shopP + onlineP),
        profit: round2(shopW + onlineW - shopP - onlineP),
      },
      days: days,
    };
  }

  const start = ISODate("2026-05-31T21:00:00.000Z");
  const end = ISODate("2026-08-28T20:59:59.999Z");
  const walletTypeById = {};
  db.wallets.find({}, { wallet_type: 1 }).forEach(function (w) {
    walletTypeById[String(w._id)] = w.wallet_type;
  });
  const settledByTicketId = {};
  db.tickets.find({ settled_at: { $ne: null } }, { settled_at: 1 }).forEach(function (t) {
    settledByTicketId[String(t._id)] = t.settled_at;
  });
  const months = {
    "2026-06": emptyMonth("June 2026"),
    "2026-07": emptyMonth("July 2026"),
    "2026-08": emptyMonth("August 2026"),
  };

  db.transactions.find({
    $or: [
      { created_at: { $gte: start, $lte: end } },
      { type: "PAYOUT", reference: /^win-settlement:/ },
      { type: "PAYOUT", reference: /^ticket:/ },
      { type: "BONUS", reference: /^cashback-payout:/ },
      { type: "BONUS", reference: /^bonus:cashback:/ },
    ],
  }).forEach(function (tx) {
    const wt = walletTypeById[String(tx.wallet_id)] || "";
    const key = classify(tx, wt);
    if (!key) return;
    const ticketId = sportsSettlementTicketId(tx);
    let when = tx.created_at;
    if (ticketId) {
      // Sports payouts follow ticket.settled_at. Run backfillTicketSettledAt.js
      // first so older wins are not dropped.
      when = settledByTicketId[ticketId] || null;
      if (!when) return;
    }
    if (when < start || when > end) return;
    const m = eatMonth(when);
    const bucket = months[m];
    if (!bucket) return;
    const amt = Number(tx.amount) || 0;
    bucket[key] += amt;
    if (key.indexOf("_wagered") > 0 || key.indexOf("_payout") > 0) {
      bucket[key + "_n"] += 1;
    }
    const day = eatDay(when);
    if (!bucket.days[day]) bucket.days[day] = emptyDay();
    bucket.days[day][key] += amt;
  });

  print(
    JSON.stringify({
      timezone: "Africa/Addis_Ababa (UTC+3)",
      generatedAt: new Date().toISOString(),
      months: ["2026-06", "2026-07", "2026-08"].map(function (k) {
        return summarize(months[k]);
      }),
    }),
  );
})();
