// GET /api/landing
// Reads the two public Supabase functions on the server and returns them as one
// JSON payload for the landing page. The Supabase key never reaches the browser.
//
// The latest close for each stock is then taken from the DSE's own price API,
// because the Supabase capture can lag a day behind (it stores the previous
// session's quote under today's date). Any stock the DSE doesn't answer for
// keeps its Supabase figures.
//
// Environment variables (Netlify → Site configuration → Environment variables):
//   SUPABASE_URL       e.g. https://YOUR-PROJECT-REF.supabase.co
//   SUPABASE_ANON_KEY  the project's public anon / publishable key (NOT the service key)

const TOP_N = 10;
const DSE_PRICES = "https://dse.co.tz/api/get/market/prices/for/range/duration";

export default async () => {
  const base = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.SUPABASE_ANON_KEY;
  if (!base || !key) {
    return json({ error: "Missing SUPABASE_URL or SUPABASE_ANON_KEY" }, 500, "no-store");
  }

  const rpc = (fn, query = "") =>
    fetch(`${base}/rest/v1/rpc/${fn}${query}`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: "{}",
      signal: AbortSignal.timeout(8000),
    }).then(async (r) => {
      if (!r.ok) throw new Error(`${fn}: ${r.status} ${await r.text()}`);
      return r.json();
    });

  try {
    const [snapshot, growthRows] = await Promise.all([
      rpc("market_snapshot"),
      // Only stocks that have risen since Jan 2025, best first, top 10.
      rpc("growth_since_jan_2025", `?pct_change=gt.0&order=pct_change.desc&limit=${TOP_N}`),
    ]);
    const official = await dseCloses(snapshot.map((m) => m.symbol));
    const market = snapshot.map((m) => {
      const d = official.get(m.symbol);
      return d && d.trade_date >= m.trade_date ? { ...m, ...d } : m;
    });
    const growth = growthRows
      .map((g) => {
        const d = official.get(g.symbol);
        if (!d || d.trade_date < g.latest_date) return g;
        const pct = (d.close / Number(g.start_close) - 1) * 100;
        return { ...g, latest_date: d.trade_date, latest_close: d.close, pct_change: Math.round(pct * 100) / 100 };
      })
      .sort((a, b) => b.pct_change - a.pct_change);
    return json(
      { market, growth, generated_at: new Date().toISOString() },
      200,
      // Browser: 5 min. Netlify CDN: 15 min, then serve stale for up to a day while refreshing.
      "public, max-age=300",
      "public, s-maxage=900, stale-while-revalidate=86400"
    );
  } catch (err) {
    console.error(err);
    return json({ error: "Market data is temporarily unavailable" }, 502, "no-store");
  }
};

// Latest official close per symbol from the DSE, with the change from the
// previous session. Symbols that fail or return nothing are simply left out.
async function dseCloses(symbols) {
  const results = await Promise.allSettled(
    symbols.map((sym) =>
      fetch(`${DSE_PRICES}?security_code=${encodeURIComponent(sym)}&days=7`, {
        headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (Sokoview landing)" },
        signal: AbortSignal.timeout(6000),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          const rows = (j && j.success && Array.isArray(j.data) ? j.data : [])
            .filter((r) => Number(r.closing_price) > 0)
            .sort((a, b) => a.trade_date.localeCompare(b.trade_date));
          if (!rows.length) return null;
          const last = rows[rows.length - 1];
          const close = Number(last.closing_price);
          const prev = rows.length > 1 ? Number(rows[rows.length - 2].closing_price) : close;
          const change = close - prev;
          return [sym, {
            close,
            change,
            pct_change: prev ? Math.round((change / prev) * 1e6) / 1e4 : 0,
            traded: Number(last.volume) > 0,
            trade_date: last.trade_date.slice(0, 10),
            source: "dse",
          }];
        })
    )
  );
  const KEY = process.env.SUPABASE_SERVICE_KEY;
const dseRows = market.filter(m => m.source === 'dse');
if (KEY && dseRows.length) {
  await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/ingest_dse_closes`, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload: dseRows }),
  }).catch(() => {});
}return new Map(results.filter((r) => r.status === "fulfilled" && r.value).map((r) => r.value));
}
  return new Response(JSON.stringify(body), { status, headers });
}

export const config = { path: "/api/landing" };
