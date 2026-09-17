'use client';

import { useEffect, useMemo, useState } from 'react';
import { getCalendarEventLabel, moduleLabels, tableLabels } from './bilingual-labels';
import type { CalendarImportance, CalendarRegion, EconomicCalendarEvent, EconomicCalendarResponse } from './market-data';
import './economic-calendar.css';

type DateFilter = 'today' | 'tomorrow' | 'week';
type ImpactFilter = 'all' | 'high';

const regions: Array<'All' | CalendarRegion> = ['All', 'US', 'Europe', 'China', 'Japan', 'UK'];

function dateKey(offset = 0) { const date = new Date(); date.setUTCHours(0, 0, 0, 0); date.setUTCDate(date.getUTCDate() + offset); return date.toISOString().slice(0, 10); }
function formatTime(event: EconomicCalendarEvent) { return event.status === 'released' ? `${event.time} · Released` : event.time; }
function dateLabel(filter: DateFilter) { return filter === 'today' ? 'Today / 今日' : filter === 'tomorrow' ? 'Tomorrow / 明日' : 'This Week / 本周'; }
function TableHeader({ label }: { label: { en: string; zh: string } }) { return <span className="calendar-table-heading"><span>{label.en}</span><small>{label.zh}</small></span>; }

export default function EconomicCalendar({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<EconomicCalendarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>('week');
  const [regionFilter, setRegionFilter] = useState<'All' | CalendarRegion>('All');
  const [impactFilter, setImpactFilter] = useState<ImpactFilter>('all');
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadCalendar() {
      try {
        const response = await fetch('/api/calendar', { cache: 'no-store' });
        if (!response.ok) throw new Error('Calendar API unavailable');
        const nextData = (await response.json()) as EconomicCalendarResponse;
        if (active) setData(nextData);
      } catch { if (active) setError(true); }
      finally { if (active) setLoading(false); }
    }
    void loadCalendar();
    return () => { active = false; };
  }, []);

  const events = useMemo(() => {
    const today = dateKey(); const tomorrow = dateKey(1); const weekEnd = dateKey(6);
    return (data?.events ?? []).filter((event) => {
      const dateMatches = dateFilter === 'today' ? event.date === today : dateFilter === 'tomorrow' ? event.date === tomorrow : event.date >= today && event.date <= weekEnd;
      return dateMatches && (regionFilter === 'All' || event.region === regionFilter) && (impactFilter === 'all' || event.importance === 'high');
    }).sort((left, right) => `${left.date}${left.time}`.localeCompare(`${right.date}${right.time}`));
  }, [data, dateFilter, regionFilter, impactFilter]);

  const visibleEvents = compact && !showAll ? events.slice(0, 4) : events;
  const meta = data?.isFallback ? 'FALLBACK / MOCK' : data?.source ?? 'LOADING';

  return <section className={`economic-calendar terminal-panel${compact ? ' compact-calendar' : ''}`} id="calendar"><div className="panel-heading"><div><span className="panel-icon" aria-hidden="true">▧</span><div className="bilingual-text"><span>{moduleLabels.economicCalendar.en}</span><small>{moduleLabels.economicCalendar.zh}</small></div></div><button className="view-more" onClick={() => setShowAll((value) => !value)} type="button"><span>{showAll ? 'Collapse' : 'View More'}</span><small>{showAll ? '收起' : '查看更多'}</small><b>→</b></button></div><div className="calendar-toolbar"><div className="calendar-tabs">{(['today', 'tomorrow', 'week'] as DateFilter[]).map((filter) => <button className={dateFilter === filter ? 'selected' : ''} key={filter} onClick={() => { setDateFilter(filter); setShowAll(false); }} type="button">{dateLabel(filter)}</button>)}</div><div className="calendar-filters"><select aria-label="Region filter" onChange={(event) => { setRegionFilter(event.target.value as 'All' | CalendarRegion); setShowAll(false); }} value={regionFilter}>{regions.map((region) => <option key={region} value={region}>{region === 'All' ? 'All Regions / 全部地区' : region}</option>)}</select><button className={impactFilter === 'high' ? 'impact-selected' : ''} onClick={() => { setImpactFilter((filter) => filter === 'all' ? 'high' : 'all'); setShowAll(false); }} type="button">{impactFilter === 'high' ? 'High / 高影响' : 'All / 全部'}</button></div></div>{(data?.isFallback || error) && <div className="panel-notice"><span>!</span>{error ? 'Calendar unavailable — no real-time events are shown.' : 'Structured fallback/mock calendar data — not a live feed.'}</div>}<div className="calendar-table-wrap"><table className="calendar-table"><thead><tr><th><TableHeader label={tableLabels.time} /></th><th><TableHeader label={tableLabels.event} /></th><th><TableHeader label={tableLabels.country} /></th><th><TableHeader label={tableLabels.impact} /></th></tr></thead><tbody>{loading && <tr><td colSpan={4} className="calendar-empty">Loading Economic Calendar…</td></tr>}{!loading && visibleEvents.length === 0 && <tr><td colSpan={4} className="calendar-empty">No events for this filter.</td></tr>}{visibleEvents.map((event) => { const label = getCalendarEventLabel(event.event); return <tr key={event.id}><td><span className="calendar-time">{formatTime(event)}</span></td><td className="calendar-event-label"><strong>{label.en}</strong><small>{label.zh}</small></td><td><span className={`region-tag region-${event.region.toLowerCase()}`}>{event.region}</span></td><td><span className={`impact impact-${event.importance}`}><i />{event.importance}</span></td></tr>; })}</tbody></table></div><div className="panel-source"><span className={data?.isFallback || error ? 'source-badge fallback' : 'source-badge'}>{meta}</span>{data && <small>Updated {new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(data.lastUpdated)}</small>}</div></section>;
}
