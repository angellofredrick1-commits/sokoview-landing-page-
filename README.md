# Sokoview landing page (standalone)

A static landing page plus one Netlify function. The page shows:

- **"What if you'd invested last year?"** – the hero calculator, using the 10 DSE stocks that have risen most since January 2025, shown in random order.
- **Live market strip** – every DSE stock's latest close and % change, auto-scrolling.
- **"[Weekday] on the DSE"** – top gainers and losers at the last close.

All market data comes live from Supabase, read on the server, so no key ever reaches the browser.

```
index.html        page markup
styles.css        all styles (light + dark themes)
app.js            renders the data, calculator, theme toggle, FAQ
logos/            company logos (SYMBOL.png)
data/fallback.json  snapshot used only if the live function fails
netlify/functions/landing-data.mjs   GET /api/landing → Supabase
netlify.toml      Netlify settings
```

## How the data flows

```
Browser ──GET /api/landing──▶ Netlify function ──▶ Supabase
                                 (cached 15 min)     rpc market_snapshot()
                                                     rpc growth_since_jan_2025()
```

Both Supabase functions are read-only and already exist in the
**Sokoview Data Capture** project. Your tables stay locked; the functions
expose only market prices.

## Deploy (about 10 minutes)

### 1. Put the code on GitHub

```bash
cd sokoview-site
git init -b main
git add -A
git status            # .env must NOT appear in this list
git commit -m "Sokoview landing page"
gh repo create sokoview-landing --private --source=. --push
```

(Without the GitHub CLI: create an empty repo on github.com, then
`git remote add origin <url>` and `git push -u origin main`.)

### 2. Connect it to Netlify

1. Netlify → **Add new site → Import an existing project** → pick the repo.
2. Build settings are read from `netlify.toml`. Leave the build command empty.
3. Before deploying, open **Site configuration → Environment variables** and add:

| Key | Value |
|---|---|
| `SUPABASE_URL` | `https://YOUR-PROJECT-REF.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase → Project Settings → **API keys** → the *anon* / *publishable* key |

Use the **anon / publishable** key only. Never the `service_role` key.

4. Deploy. Check `https://<your-site>.netlify.app/api/landing` returns JSON
   with `market` (28 stocks) and `growth` (10 stocks).

### 3. Point a domain at it (optional)

Netlify → **Domain management** → add e.g. `try.sokoview.co.tz`, and create
the CNAME record Netlify shows you at your DNS provider. When you're happy,
move `sokoview.co.tz` itself over.

## Test locally

```bash
npm i -g netlify-cli
cp .env.example .env          # paste the anon key into .env
netlify dev                   # opens http://localhost:8888
```

## Common changes

- **Add a logo:** drop `SYMBOL.png` (square, ~160×160) into `logos/`, then add
  the symbol to `LOGOS` at the top of `app.js`.
- **Change the amounts:** edit `AMOUNTS` / `AMOUNT_LABELS` in `app.js`.
- **Change the default stock:** edit `DEFAULT_STOCK` in `app.js`.
- **Change how many stocks appear in the grid:** edit `TOP_N` in the function.
- **Cache time:** the `Netlify-CDN-Cache-Control` value in the function
  (`s-maxage=900` = 15 minutes).

## Refresh the fallback snapshot

The fallback only shows if the function is down. To refresh it, run this in
the Supabase SQL editor and paste the result into `data/fallback.json`:

```sql
select json_build_object(
  'market', (select json_agg(m) from public.market_snapshot() m),
  'growth', (select json_agg(g) from (
     select * from public.growth_since_jan_2025()
     where pct_change > 0 order by pct_change desc limit 10) g),
  'generated_at', now());
```

## Notes

- Calculator figures are price change only (no dividends, fees or taxes),
  as the page states. NMB's January 2025 price is adjusted for its 10-for-1
  split on 26 Aug 2026.
- Sign-in links go to `https://sokoview.co.tz/auth/login` and sign-up to
  `/auth/register`. Check these match your app.
- Logos are included for all 10 current stocks. If a new stock enters the
  grid, it shows a ticker badge until you add its logo.
