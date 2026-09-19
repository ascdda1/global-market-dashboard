# Changelog

This file records major product iterations for the Longview / Global Market Dashboard project.

## 2026-09-20 — QDII Research Expansion

### Added
- Dedicated `/qdii` research page for on-exchange and off-exchange QDII funds.
- Curated universe expanded from 30 to 50 funds.
- Coverage focused on Nasdaq-100, S&P 500, S&P equal-weight variants, Nasdaq technology, biotechnology, consumer, semiconductor/chip, and selected active strategies.
- Fund-level comparison fields for benchmark, trading venue, strategy type, share class, recurring fees, tracking error, distributor purchase limit, fund-app direct limit, and quota update date.
- Search, category filtering, venue filtering, and low-fee visual highlighting.
- Short plain-language exposure descriptions for every research item.

### Improved
- Added directly comparable recurring-cost structure: management fee + custody fee + sales service fee.
- Added publicly available tracking-error values where the disclosure period is clear.
- Marked short-window tracking-error values explicitly when they are not annualized.
- Kept unknown quota and tracking-error values as pending instead of estimating them.

### Fixed
- Corrected the Invesco Great Wall Nasdaq Technology C-share fund code from the USD share class to the RMB C-share code.
- Replaced the placeholder global semiconductor entry with a real QDII-LOF fund.
- Added a direct QDII entry in the main dashboard navigation.

## 2026-09-19 — QDII V1

### Added
- Initial 30-fund QDII comparison table.
- On-exchange / off-exchange classification.
- ETF / LOF / A / C / E / I share-class labels.
- Benchmark and recurring-fee comparison.
- Distributor and fund-app direct purchase-limit fields.
- Weekly manual quota-update timestamp.

## V1 — Global Market Dashboard

### Added
- Major global equity indices, gold, oil, Bitcoin, and U.S. Treasury yields.
- Personal stock and ETF watchlists.
- Historical market charts.
- U.S. macroeconomic indicators.
- Economic calendar, market information, and key-people modules.
- DCA simulation backed by Supabase when configured.
- Responsive desktop/mobile UI.
- Server-side Route Handlers and source-specific fallback logic.

### Architecture
- Next.js 16, React 19, TypeScript, Tailwind CSS 4.
- Server-side market data aggregation with Yahoo Finance, Alpaca, Coinbase, U.S. Treasury, BLS, BEA, and Federal Reserve data sources.
