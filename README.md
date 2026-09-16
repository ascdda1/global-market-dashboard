# Global Market Dashboard

A dark, desktop-first global market dashboard for monitoring major market prices, historical charts, U.S. macroeconomic indicators, an economic calendar, market information, and a personal U.S. stock watchlist.

## Features

- Market overview for the S&P 500, Nasdaq, gold, and crude oil.
- Historical price charts for 1D, 1W, 1M, and YTD ranges.
- U.S. Treasury 2Y, 10Y, and 30Y yields.
- BTC/USD and ETH/USD spot data.
- A browser-local watchlist of up to 30 U.S. stock symbols.
- Macro panel for CPI, Core CPI, PCE, Core PCE, nonfarm payrolls, unemployment, GDP, and the effective federal funds rate.
- Economic Calendar with date, region, and impact filters.
- Market News and Key People panels with provider abstractions ready for future data-source replacement.
- Independent server-side fallback handling so a single unavailable source does not prevent the rest of the dashboard from rendering.

## Tech Stack

- Next.js 16 (App Router and Route Handlers)
- React 19
- TypeScript
- Tailwind CSS 4 with project CSS stylesheets
- `fast-xml-parser` for U.S. Treasury XML parsing

## Data Sources

| Area | Current source | API key |
| --- | --- | --- |
| S&P 500, Nasdaq, gold, oil, historical charts | Yahoo Finance | No |
| U.S. stock watchlist and history | Finnhub | Yes |
| U.S. Treasury 2Y / 10Y / 30Y | U.S. Treasury daily yield curve feed | No |
| BTC/USD and ETH/USD, including history | Coinbase Exchange public API | No |
| CPI, Core CPI, payrolls, unemployment | BLS API | Yes |
| PCE, Core PCE, GDP | BEA API | Yes |
| Effective federal funds rate | Federal Reserve Board H.15 | No |
| Economic Calendar | Structured fallback/mock provider | No |
| Market News and Key People | Structured fallback/mock providers | No |

All third-party requests are made from server-side Route Handlers. API keys are never sent to the browser.

## Fallback and Mock Data

Live market and macro sources can be temporarily unavailable because of API limits, missing keys, or network failures. Each source then falls back independently so the rest of the dashboard remains usable. Fallback quote and macro values are labeled as simulated data in the interface.

The Economic Calendar, Market News, and Key People providers are currently explicitly marked `FALLBACK / MOCK`. They demonstrate the final V1 data model and UI only; they are not real-time feeds and must not be interpreted as live news, schedules, or public statements.

## Local Setup

Requirements: Node.js 20 or later and npm.

```bash
npm install
copy .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Create a production build with:

```bash
npm run build
npm run start
```

## Environment Variables

Copy `.env.example` to `.env.local`, then set only the keys you use:

```dotenv
FINNHUB_API_KEY=
BLS_API_KEY=
BEA_API_KEY=
```

`.env.local` is ignored by Git. Do not use `NEXT_PUBLIC_` prefixes for these variables and never commit API keys.

## Project Structure

```text
src/app/
  api/
    market/          Market, Treasury, crypto, history, and macro API
    calendar/        Economic Calendar API
    news/            Market News API
    key-people/      Key People API
  page.tsx           Main dashboard page
  market-data.ts     Shared market, macro, calendar, and information types
  economic-calendar-provider.ts
  information-providers.ts
  economic-calendar.tsx
  market-information.tsx
  *.css              Dashboard and module styles
```

## Future Roadmap

- Replace the explicitly labeled Calendar, News, and Key People fallback/mock providers with licensed, production-appropriate sources.
- Improve source-specific freshness metadata and retry telemetry.
- Add optional user-controlled watchlist persistence beyond browser-local storage.
