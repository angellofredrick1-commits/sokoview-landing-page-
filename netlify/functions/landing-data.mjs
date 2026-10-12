// GET /api/landing
// Reads the two public Supabase functions on the server and returns them as one
// JSON payload for the landing page. The Supabase key never reaches the browser.
//
// Environment variables (Netlify → Site configuration → Environment variables):
//   SUPABASE_URL       e.g. https://iwzgkhncmsodfccwatht.supabase.co
//   SUPABASE_ANON_KEY  the project's public anon / publishable key (NOT the service key)

const TOP_N = 10;

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
    const [market, growth] = await Promise.all([
      rpc("market_snapshot"),
      // Only stocks that have risen since Jan 2025, best first, top 10.
      rpc("growth_since_jan_2025", `?pct_change=gt.0&order=pct_change.desc&limit=${TOP_N}`),
    ]);
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

function json(body, status, cacheControl, cdnCacheControl) {
  const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": cacheControl };
  if (cdnCacheControl) headers["Netlify-CDN-Cache-Control"] = cdnCacheControl;
  return new Response(JSON.stringify(body), { status, headers });
}

export const config = { path: "/api/landing" };
