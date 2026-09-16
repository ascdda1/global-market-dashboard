'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CalendarImportance, CalendarRegion, EconomicCalendarEvent, EconomicCalendarResponse } from './market-data';
import './economic-calendar.css';

type DateFilter = 'today' | 'tomorrow' | 'week';
type ImpactFilter = 'all' | 'high';

const regions: Array<'All' | CalendarRegion> = ['All', 'US', 'Europe', 'China', 'Japan', 'UK'];

function dateKey(offset = 0) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function formatCalendarTime(event: EconomicCalendarEvent) {
  return event.status === 'released' ? `${event.time} · Released` : event.time;
}

function actualTone(event: EconomicCalendarEvent) {
  if (!event.actual || !event.forecast) return '';
  const actual = Number.parseFloat(event.actual.replace(/[^0-9.-]/g, ''));
  const forecast = Number.parseFloat(event.forecast.replace(/[^0-9.-]/g, ''));
  if (!Number.isFinite(actual) || !Number.isFinite(forecast) || actual === forecast) return '';
  return actual > forecast ? 'up' : 'down';
}

function labelForDateFilter(filter: DateFilter) {
  if (filter === 'today') return 'Today';
  if (filter === 'tomorrow') return 'Tomorrow';
  return 'This Week';
}

export default function EconomicCalendar() {
  const [data, setData] = useState<EconomicCalendarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>('week');
  const [regionFilter, setRegionFilter] = useState<'All' | CalendarRegion>('All');
  const [impactFilter, setImpactFilter] = useState<ImpactFilter>('all');

  useEffect(() => {
    let active = true;
    async function loadCalendar() {
      try {
        const response = await fetch('/api/calendar', { cache: 'no-store' });
        if (!response.ok) throw new Error('Calendar API unavailable');
        const nextData = (await response.json()) as EconomicCalendarResponse;
        if (active) setData(nextData);
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadCalendar();
    return () => { active = false; };
  }, []);

  const events = useMemo(() => {
    const today = dateKey();
    const tomorrow = dateKey(1);
    const weekEnd = dateKey(6);
    return (data?.events ?? []).filter((event) => {
      const dateMatches = dateFilter === 'today' ? event.date === today : dateFilter === 'tomorrow' ? event.date === tomorrow : event.date >= today && event.date <= weekEnd;
      const regionMatches = regionFilter === 'All' || event.region === regionFilter;
      const impactMatches = impactFilter === 'all' || event.importance === 'high';
      return dateMatches && regionMatches && impactMatches;
    }).sort((left, right) => `${left.date}${left.time}`.localeCompare(`${right.date}${right.time}`));
  }, [data, dateFilter, regionFilter, impactFilter]);

  return <section className="economic-calendar" id="calendar"><div className="calendar-heading"><div><div className="eyebrow"><span className="live-dot" />ECONOMIC CALENDAR</div><h2>经济日历</h2><p>近期全球重要宏观经济事件</p></div><div className="calendar-meta"><span className={data?.isFallback ? 'calendar-source mock' : 'calendar-source'}>{data?.isFallback ? 'FALLBACK / MOCK' : data?.source ?? 'LOADING'}</span><span>{data ? `Updated ${new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(data.lastUpdated)}` : '正在获取日历'}</span></div></div><div className="calendar-controls"><div className="calendar-tabs">{(['today', 'tomorrow', 'week'] as DateFilter[]).map((filter) => <button className={dateFilter === filter ? 'selected' : ''} key={filter} onClick={() => setDateFilter(filter)} type="button">{labelForDateFilter(filter)}</button>)}</div><div className="calendar-filters"><select aria-label="地区筛选" onChange={(event) => setRegionFilter(event.target.value as 'All' | CalendarRegion)} value={regionFilter}>{regions.map((region) => <option key={region} value={region}>{region === 'All' ? 'All Regions' : region}</option>)}</select><button className={impactFilter === 'high' ? 'impact-selected' : ''} onClick={() => setImpactFilter((filter) => filter === 'all' ? 'high' : 'all')} type="button">{impactFilter === 'high' ? 'High Impact' : 'All Events'}</button></div></div>{(data?.isFallback || error) && <div className="calendar-notice"><span>!</span><p>{error ? '经济日历暂时无法连接，未显示实时事件。' : '当前为结构化 fallback/mock 数据，不是实时经济日历。'}</p></div>}<div className="calendar-table-wrap"><table className="calendar-table"><thead><tr><th>Time</th><th>Country / Region</th><th>Event</th><th>Previous</th><th>Forecast</th><th>Actual</th><th>Impact</th></tr></thead><tbody>{loading && <tr><td colSpan={7} className="calendar-empty">正在加载 Economic Calendar…</td></tr>}{!loading && events.length === 0 && <tr><td colSpan={7} className="calendar-empty">当前筛选条件下没有事件</td></tr>}{events.map((event) => <tr key={event.id}><td><span className="calendar-date">{event.date.slice(5)}</span><span className="calendar-time">{formatCalendarTime(event)}</span></td><td><span className={`region-tag region-${event.region.toLowerCase()}`}>{event.region}</span></td><td><strong>{event.event}</strong><small>{event.source}</small></td><td>{event.previous ?? '—'}</td><td>{event.forecast ?? '—'}</td><td className={actualTone(event)}>{event.actual ?? '—'}</td><td><span className={`impact impact-${event.importance}`}><i />{event.importance}</span></td></tr>)}</tbody></table></div></section>;
}
