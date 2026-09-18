'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { assetLabels } from '../bilingual-labels';
import type { ApiQuote } from '../market-data';

type AssetChoice = { symbol: string; type: 'Stock' | 'ETF' };
type Position = { symbol: string; type: 'Stock' | 'ETF'; buyPrice: number; shares: number };
type Frequency = 'weekly' | 'biweekly' | 'monthly';
type Plan = { id: string; symbol: string; startDate: string; amount: number; frequency: Frequency };
type Execution = {
  planId: string;
  symbol: string;
  scheduledDate: string;
  executionDate: string;
  amount: number;
  price: number;
  shares: number;
};
type PlanSummary = {
  planId: string;
  symbol: string;
  executedCount: number;
  invested: number;
  nextScheduledDate: string;
  nextState: 'future' | 'waiting-close' | 'scheduled';
  lastExecutionDate?: string;
};
type SettlementResponse = {
  executions?: Execution[];
  plans?: PlanSummary[];
  asOf?: string;
  source?: string;
  priceBasis?: string;
  error?: string;
};

const storageKey = 'longview-portfolio-simulator-v1';
const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
const decimal = (value: number, digits = 6) => value.toLocaleString('en-US', { maximumFractionDigits: digits });
const percent = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

function localDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function frequencyLabel(value: Frequency) {
  if (value === 'weekly') return '每周 / Weekly';
  if (value === 'biweekly') return '每两周 / Biweekly';
  return '每月 / Monthly';
}

function stateLabel(value: PlanSummary['nextState']) {
  if (value === 'waiting-close') return '等待真实收盘价 / Waiting for close';
  if (value === 'scheduled') return '待下个交易日执行 / Awaiting trading day';
  return '未来计划 / Future';
}

function safeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export default function PortfolioSimulator({ supported }: { supported: AssetChoice[] }) {
  const today = useMemo(() => localDate(), []);
  const [positions, setPositions] = useState<Position[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [quotes, setQuotes] = useState<Record<string, ApiQuote>>({});
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [planSummaries, setPlanSummaries] = useState<PlanSummary[]>([]);
  const [settlementMeta, setSettlementMeta] = useState<{ asOf?: string; source?: string; priceBasis?: string }>({});
  const [settling, setSettling] = useState(false);
  const [settlementError, setSettlementError] = useState('');
  const [formError, setFormError] = useState('');

  const [positionSymbol, setPositionSymbol] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [shares, setShares] = useState('');
  const [editingSymbol, setEditingSymbol] = useState('');

  const [planSymbol, setPlanSymbol] = useState('');
  const [planDate, setPlanDate] = useState(today);
  const [planAmount, setPlanAmount] = useState('200');
  const [frequency, setFrequency] = useState<Frequency>('weekly');

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) ?? 'null') as { positions?: Position[]; plans?: Plan[] } | null;
      if (saved?.positions && Array.isArray(saved.positions)) {
        setPositions(saved.positions.flatMap((item) => {
          const type = item?.type === 'ETF' ? 'ETF' : item?.type === 'Stock' ? 'Stock' : null;
          const symbol = typeof item?.symbol === 'string' ? item.symbol.toUpperCase() : '';
          const price = safeNumber(item?.buyPrice);
          const quantity = safeNumber(item?.shares);
          return type && symbol && price && quantity ? [{ symbol, type, buyPrice: price, shares: quantity }] : [];
        }));
      }
      if (saved?.plans && Array.isArray(saved.plans)) {
        setPlans(saved.plans.flatMap((item) => {
          const frequencyValue = item?.frequency;
          const validFrequency = frequencyValue === 'weekly' || frequencyValue === 'biweekly' || frequencyValue === 'monthly';
          const id = typeof item?.id === 'string' ? item.id : '';
          const symbol = typeof item?.symbol === 'string' ? item.symbol.toUpperCase() : '';
          const startDate = typeof item?.startDate === 'string' ? item.startDate : '';
          const amount = safeNumber(item?.amount);
          return id && symbol && /^\d{4}-\d{2}-\d{2}$/.test(startDate) && amount && validFrequency
            ? [{ id, symbol, startDate, amount, frequency: frequencyValue }]
            : [];
        }));
      }
    } catch {
      // A corrupt local simulation should not block the DCA page.
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(storageKey, JSON.stringify({ positions, plans }));
  }, [hydrated, plans, positions]);

  useEffect(() => {
    if (!planSymbol && positions[0]) setPlanSymbol(positions[0].symbol);
  }, [planSymbol, positions]);

  const symbols = useMemo(() => [...new Set(positions.map((item) => item.symbol))], [positions]);
  const symbolsKey = symbols.join(',');

  useEffect(() => {
    if (!symbolsKey) {
      setQuotes({});
      return;
    }

    let cancelled = false;
    let inFlight = false;
    const load = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const response = await fetch(`/api/market/quotes?symbols=${encodeURIComponent(symbolsKey)}`, { cache: 'no-store' });
        if (!response.ok) return;
        const payload = await response.json() as { quotes?: Record<string, ApiQuote> };
        if (!cancelled) setQuotes((current) => ({ ...current, ...(payload.quotes ?? {}) }));
      } finally {
        inFlight = false;
      }
    };

    void load();
    const timer = window.setInterval(() => void load(), 3_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [symbolsKey]);

  const reconcilePlans = useCallback(async () => {
    if (!hydrated) return;
    if (!plans.length) {
      setExecutions([]);
      setPlanSummaries([]);
      setSettlementMeta({});
      setSettlementError('');
      return;
    }

    setSettling(true);
    setSettlementError('');
    try {
      const response = await fetch('/api/portfolio/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plans }),
      });
      const payload = await response.json() as SettlementResponse;
      if (!response.ok || payload.error) throw new Error(payload.error ?? 'Unable to reconcile scheduled purchases.');
      setExecutions(payload.executions ?? []);
      setPlanSummaries(payload.plans ?? []);
      setSettlementMeta({ asOf: payload.asOf, source: payload.source, priceBasis: payload.priceBasis });
    } catch (error) {
      setSettlementError(error instanceof Error ? error.message : 'Scheduled purchases are temporarily unavailable.');
    } finally {
      setSettling(false);
    }
  }, [hydrated, plans]);

  useEffect(() => {
    void reconcilePlans();
    const timer = window.setInterval(() => void reconcilePlans(), 5 * 60_000);
    return () => window.clearInterval(timer);
  }, [reconcilePlans]);

  const executionBySymbol = useMemo(() => {
    const grouped = new Map<string, Execution[]>();
    for (const execution of executions) {
      grouped.set(execution.symbol, [...(grouped.get(execution.symbol) ?? []), execution]);
    }
    return grouped;
  }, [executions]);

  const rows = useMemo(() => positions.map((position) => {
    const additions = executionBySymbol.get(position.symbol) ?? [];
    const autoShares = additions.reduce((sum, item) => sum + item.shares, 0);
    const autoCost = additions.reduce((sum, item) => sum + item.amount, 0);
    const baseCost = position.buyPrice * position.shares;
    const totalShares = position.shares + autoShares;
    const totalCost = baseCost + autoCost;
    const averageCost = totalShares > 0 ? totalCost / totalShares : 0;
    const currentPrice = quotes[position.symbol]?.value;
    const marketValue = typeof currentPrice === 'number' ? currentPrice * totalShares : null;
    const profit = marketValue === null ? null : marketValue - totalCost;
    const returnPercent = profit === null || totalCost <= 0 ? null : profit / totalCost * 100;
    return {
      ...position,
      baseCost,
      autoShares,
      autoCost,
      totalShares,
      totalCost,
      averageCost,
      currentPrice,
      marketValue,
      profit,
      returnPercent,
    };
  }), [executionBySymbol, positions, quotes]);

  const totals = useMemo(() => {
    const totalCost = rows.reduce((sum, row) => sum + row.totalCost, 0);
    const allPriced = rows.length > 0 && rows.every((row) => row.marketValue !== null);
    const marketValue = rows.reduce((sum, row) => sum + (row.marketValue ?? 0), 0);
    const profit = allPriced ? marketValue - totalCost : null;
    return {
      totalCost,
      marketValue: allPriced ? marketValue : null,
      profit,
      returnPercent: profit === null || totalCost <= 0 ? null : profit / totalCost * 100,
      autoInvested: executions.reduce((sum, item) => sum + item.amount, 0),
      missingQuotes: rows.filter((row) => row.marketValue === null).length,
    };
  }, [executions, rows]);

  function submitPosition(event: React.FormEvent) {
    event.preventDefault();
    const symbol = positionSymbol.trim().toUpperCase();
    const choice = supported.find((item) => item.symbol === symbol);
    const price = Number(buyPrice);
    const quantity = Number(shares);

    if (!choice) return setFormError('请选择 My Stocks / My ETFs 中的标的。 / Choose a supported stock or ETF.');
    if (!Number.isFinite(price) || price <= 0) return setFormError('买入价必须大于 0。 / Buy price must be positive.');
    if (!Number.isFinite(quantity) || quantity <= 0) return setFormError('持仓数量必须大于 0，可输入小数。 / Shares must be positive; decimals are supported.');
    if (!editingSymbol && positions.some((item) => item.symbol === symbol)) return setFormError(`${symbol} 已存在，请直接编辑该持仓。`);

    const next = { symbol, type: choice.type, buyPrice: price, shares: quantity } satisfies Position;
    setPositions((current) => editingSymbol
      ? current.map((item) => item.symbol === editingSymbol ? next : item)
      : [...current, next]
    );

    if (editingSymbol && editingSymbol !== symbol) {
      setPlans((current) => current.map((plan) => plan.symbol === editingSymbol ? { ...plan, symbol } : plan));
    }

    setEditingSymbol('');
    setPositionSymbol('');
    setBuyPrice('');
    setShares('');
    setFormError('');
  }

  function editPosition(position: Position) {
    setEditingSymbol(position.symbol);
    setPositionSymbol(position.symbol);
    setBuyPrice(String(position.buyPrice));
    setShares(String(position.shares));
    setFormError('');
  }

  function removePosition(symbol: string) {
    setPositions((current) => current.filter((item) => item.symbol !== symbol));
    setPlans((current) => current.filter((plan) => plan.symbol !== symbol));
    if (editingSymbol === symbol) {
      setEditingSymbol('');
      setPositionSymbol('');
      setBuyPrice('');
      setShares('');
    }
  }

  function submitPlan(event: React.FormEvent) {
    event.preventDefault();
    const symbol = planSymbol.trim().toUpperCase();
    const amount = Number(planAmount);
    if (!positions.some((item) => item.symbol === symbol)) return setFormError('请先建立该标的的当前持仓。 / Add the current position first.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(planDate) || planDate < today) return setFormError('新定投计划只能从今天或未来日期开始。 / New schedules must start today or later.');
    if (!Number.isFinite(amount) || amount <= 0) return setFormError('定投金额必须大于 0。 / Investment amount must be positive.');

    setPlans((current) => [...current, {
      id: crypto.randomUUID(),
      symbol,
      startDate: planDate,
      amount,
      frequency,
    }]);
    setFormError('');
  }

  function clearAll() {
    if (!window.confirm('确定清空全部持仓模拟与定投计划？ / Clear all simulated holdings and schedules?')) return;
    setPositions([]);
    setPlans([]);
    setExecutions([]);
    setPlanSummaries([]);
    setEditingSymbol('');
    setPositionSymbol('');
    setBuyPrice('');
    setShares('');
  }

  const latestExecutions = useMemo(() => [...executions].sort((a, b) => b.executionDate.localeCompare(a.executionDate)).slice(0, 20), [executions]);

  return (
    <section className="portfolio-simulator" id="portfolio-simulator">
      <header className="portfolio-simulator-heading">
        <div>
          <span className="portfolio-kicker">PORTFOLIO SIMULATOR</span>
          <h2>持仓模拟</h2>
          <p>输入当前仓位，并让未来定投按真实交易日收盘价自动计入模拟账户。</p>
          <small>Track a simulated portfolio with live P&amp;L and scheduled purchases executed at real daily closes.</small>
        </div>
        <div className="portfolio-heading-actions">
          <button className="portfolio-refresh" disabled={settling} onClick={() => void reconcilePlans()} type="button">
            <b>{settling ? '同步中…' : '同步收盘价'}</b><small>{settling ? 'Reconciling…' : 'Reconcile closes'}</small>
          </button>
          {(positions.length > 0 || plans.length > 0) && <button className="portfolio-clear" onClick={clearAll} type="button">清空模拟</button>}
        </div>
      </header>

      <div className="portfolio-privacy-note">
        <b>本地持仓模拟</b>
        <span>买入价与持仓数量仅保存在当前浏览器；服务器只根据 Ticker 与定投计划查询市场数据。</span>
        <small>Base position data stays in this browser. Scheduled purchases use real Alpaca daily closes and live quotes.</small>
      </div>

      <div className="portfolio-summary-grid">
        <article><span>总成本<small>Total Cost</small></span><strong>{money(totals.totalCost)}</strong></article>
        <article><span>当前市值<small>Market Value</small></span><strong>{totals.marketValue === null ? '—' : money(totals.marketValue)}</strong></article>
        <article><span>账户盈亏<small>Total P&amp;L</small></span><strong className={totals.profit === null ? '' : totals.profit >= 0 ? 'up' : 'down'}>{totals.profit === null ? '—' : money(totals.profit)}</strong></article>
        <article><span>收益率<small>Return</small></span><strong className={totals.returnPercent === null ? '' : totals.returnPercent >= 0 ? 'up' : 'down'}>{totals.returnPercent === null ? '—' : percent(totals.returnPercent)}</strong></article>
        <article><span>自动加仓<small>Auto Invested</small></span><strong>{money(totals.autoInvested)}</strong></article>
      </div>
      {totals.missingQuotes > 0 && <div className="portfolio-inline-warning">有 {totals.missingQuotes} 个持仓暂未取得实时行情，账户总市值与盈亏暂不汇总。</div>}

      <div className="portfolio-form-grid">
        <form className="portfolio-entry-card" onSubmit={submitPosition}>
          <div className="portfolio-card-title">
            <div><b>{editingSymbol ? '编辑当前持仓' : '录入当前持仓'}</b><small>{editingSymbol ? 'Edit Position' : 'Add Current Position'}</small></div>
            {editingSymbol && <button type="button" onClick={() => { setEditingSymbol(''); setPositionSymbol(''); setBuyPrice(''); setShares(''); }}>取消</button>}
          </div>
          <label><span>Ticker</span><input disabled={Boolean(editingSymbol)} list="portfolio-symbols" onChange={(event) => setPositionSymbol(event.target.value.toUpperCase())} placeholder="例如 NVDA / QQQM" required value={positionSymbol} /></label>
          <datalist id="portfolio-symbols">{supported.filter((item) => !positions.some((position) => position.symbol === item.symbol) || item.symbol === editingSymbol).map((item) => <option key={item.symbol} value={item.symbol}>{assetLabels[item.symbol]?.zh ?? item.type}</option>)}</datalist>
          <div className="portfolio-two-fields">
            <label><span>买入均价 <small>Base Buy Price</small></span><div className="portfolio-money-input"><i>$</i><input min="0.000001" onChange={(event) => setBuyPrice(event.target.value)} required step="0.000001" type="number" value={buyPrice} /></div></label>
            <label><span>持仓数量 <small>Shares</small></span><input min="0.000001" onChange={(event) => setShares(event.target.value)} required step="0.000001" type="number" value={shares} /></label>
          </div>
          <button className="portfolio-primary-button" type="submit">{editingSymbol ? '保存持仓 / Save' : '加入持仓 / Add Position'}</button>
        </form>

        <form className="portfolio-entry-card" onSubmit={submitPlan}>
          <div className="portfolio-card-title"><div><b>自动定投加仓</b><small>Scheduled Investment</small></div></div>
          <label><span>标的 <small>Asset</small></span><select disabled={!positions.length} onChange={(event) => setPlanSymbol(event.target.value)} required value={planSymbol}>{positions.length ? positions.map((item) => <option key={item.symbol} value={item.symbol}>{item.symbol} · {assetLabels[item.symbol]?.zh ?? item.type}</option>) : <option value="">请先录入持仓</option>}</select></label>
          <div className="portfolio-two-fields">
            <label><span>开始日期 <small>Start Date</small></span><input min={today} onChange={(event) => setPlanDate(event.target.value)} required type="date" value={planDate} /></label>
            <label><span>每次金额 <small>Amount</small></span><div className="portfolio-money-input"><i>$</i><input min="0.01" onChange={(event) => setPlanAmount(event.target.value)} required step="0.01" type="number" value={planAmount} /></div></label>
          </div>
          <label><span>频率 <small>Frequency</small></span><select onChange={(event) => setFrequency(event.target.value as Frequency)} value={frequency}><option value="weekly">每周 / Weekly</option><option value="biweekly">每两周 / Biweekly</option><option value="monthly">每月 / Monthly</option></select></label>
          <button className="portfolio-primary-button" disabled={!positions.length} type="submit">建立计划 / Create Schedule</button>
        </form>
      </div>

      {formError && <div className="portfolio-error">{formError}</div>}
      {settlementError && <div className="portfolio-error">{settlementError}</div>}

      {rows.length > 0 && (
        <>
          <div className="portfolio-subheading"><div><h3>当前账户</h3><small>Live Portfolio</small></div><span>实时价格约每 3 秒刷新</span></div>
          <div className="portfolio-table-wrap">
            <table className="portfolio-table">
              <thead><tr><th>标的<br /><small>Asset</small></th><th>基础持仓<br /><small>Base Shares</small></th><th>自动加仓<br /><small>Auto Shares</small></th><th>总持仓<br /><small>Total Shares</small></th><th>平均成本<br /><small>Avg Cost</small></th><th>当前价格<br /><small>Live Price</small></th><th>市值<br /><small>Market Value</small></th><th>盈亏<br /><small>P&amp;L</small></th><th>收益率<br /><small>Return</small></th><th>仓位<br /><small>Weight</small></th><th /></tr></thead>
              <tbody>
                {rows.map((row) => {
                  const weight = row.marketValue !== null && totals.marketValue ? row.marketValue / totals.marketValue * 100 : null;
                  return <tr key={row.symbol}>
                    <td><b>{row.symbol}</b><small>{assetLabels[row.symbol]?.zh ?? row.type}</small></td>
                    <td>{decimal(row.shares)}</td>
                    <td>{decimal(row.autoShares)}</td>
                    <td><b>{decimal(row.totalShares)}</b></td>
                    <td>{money(row.averageCost)}</td>
                    <td>{row.currentPrice ? money(row.currentPrice) : '—'}</td>
                    <td>{row.marketValue === null ? '—' : money(row.marketValue)}</td>
                    <td className={row.profit === null ? '' : row.profit >= 0 ? 'up' : 'down'}>{row.profit === null ? '—' : money(row.profit)}</td>
                    <td className={row.returnPercent === null ? '' : row.returnPercent >= 0 ? 'up' : 'down'}>{row.returnPercent === null ? '—' : percent(row.returnPercent)}</td>
                    <td>{weight === null ? '—' : `${weight.toFixed(1)}%`}</td>
                    <td><div className="portfolio-row-actions"><button onClick={() => editPosition(row)} type="button">编辑</button><button onClick={() => removePosition(row.symbol)} type="button">删除</button></div></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {plans.length > 0 && (
        <>
          <div className="portfolio-subheading"><div><h3>自动定投计划</h3><small>Scheduled Investments</small></div><span>到期后按真实交易日收盘价计入</span></div>
          <div className="portfolio-plan-grid">
            {plans.map((plan) => {
              const summary = planSummaries.find((item) => item.planId === plan.id);
              return <article className="portfolio-plan-card" key={plan.id}>
                <div className="portfolio-plan-top"><div><b>{plan.symbol}</b><small>{assetLabels[plan.symbol]?.zh ?? 'Stock / ETF'}</small></div><button aria-label={`Remove ${plan.symbol} schedule`} onClick={() => setPlans((current) => current.filter((item) => item.id !== plan.id))} type="button">×</button></div>
                <dl><div><dt>每次投入</dt><dd>{money(plan.amount)}</dd></div><div><dt>频率</dt><dd>{frequencyLabel(plan.frequency)}</dd></div><div><dt>开始</dt><dd>{plan.startDate}</dd></div><div><dt>已执行</dt><dd>{summary?.executedCount ?? 0} 次 · {money(summary?.invested ?? 0)}</dd></div><div><dt>下一计划日</dt><dd>{summary?.nextScheduledDate ?? plan.startDate}</dd></div></dl>
                <span className={`portfolio-plan-state ${summary?.nextState ?? 'future'}`}>{summary ? stateLabel(summary.nextState) : settling ? '同步中…' : '等待同步'}</span>
              </article>;
            })}
          </div>
        </>
      )}

      {latestExecutions.length > 0 && (
        <>
          <div className="portfolio-subheading"><div><h3>自动加仓记录</h3><small>Executed Purchases</small></div><span>最近 {latestExecutions.length} 笔</span></div>
          <div className="portfolio-table-wrap">
            <table className="portfolio-table portfolio-execution-table">
              <thead><tr><th>标的</th><th>计划日<br /><small>Scheduled</small></th><th>实际执行日<br /><small>Execution</small></th><th>投入金额<br /><small>Amount</small></th><th>真实收盘价<br /><small>Close</small></th><th>新增数量<br /><small>Shares</small></th></tr></thead>
              <tbody>{latestExecutions.map((item) => <tr key={`${item.planId}:${item.scheduledDate}`}><td><b>{item.symbol}</b></td><td>{item.scheduledDate}</td><td>{item.executionDate}</td><td>{money(item.amount)}</td><td>{money(item.price)}</td><td>{decimal(item.shares)}</td></tr>)}</tbody>
            </table>
          </div>
        </>
      )}

      <div className="portfolio-method-note">
        <b>计算规则</b>
        <span>平均成本 =（初始持仓成本 + 已执行自动加仓金额）÷ 总持仓数量；账户盈亏使用当前实时行情估值。</span>
        <span>定投计划日若为周末/休市日，则顺延至下一真实交易日；当天尚未形成日线收盘价时保持待执行状态，不使用盘中价格代替收盘价。</span>
        <small>{settlementMeta.priceBasis ?? 'Scheduled purchases use real daily closes; live quotes are used only for current valuation.'}</small>
      </div>
    </section>
  );
}
