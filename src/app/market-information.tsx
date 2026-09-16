'use client';

import { useEffect, useMemo, useState } from 'react';
import type { KeyPeopleResponse, KeyPersonUpdate, MarketNewsItem, MarketNewsResponse, NewsCategory } from './market-data';
import './market-information.css';

const categories: Array<'All' | NewsCategory> = ['All', 'Markets', 'Macro', 'AI & Tech', 'Semiconductors', 'Crypto', 'China'];

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(timestamp);
}

function SourceNote({ source, isFallback, updatedAt }: { source?: string; isFallback?: boolean; updatedAt?: number }) {
  return <div className="information-meta"><span className={isFallback ? 'information-source mock' : 'information-source'}>{isFallback ? 'FALLBACK / MOCK' : source ?? 'LOADING'}</span>{updatedAt && <span>Updated {formatTime(updatedAt)}</span>}</div>;
}

function NewsRow({ item }: { item: MarketNewsItem }) {
  return <a className="news-row" href={item.url} rel="noreferrer" target="_blank"><div className="news-time">{formatTime(item.publishedAt)}</div><span className={`news-category category-${item.category.toLowerCase().replace(/[^a-z]+/g, '-')}`}>{item.category}</span><div className="news-copy"><strong>{item.title}</strong>{item.summary && <p>{item.summary}</p>}<small>{item.source}</small></div><span className="news-open" aria-hidden="true">↗</span></a>;
}

function PersonCard({ item }: { item: KeyPersonUpdate }) {
  const initials = item.person.split(' ').map((part) => part[0]).join('').slice(0, 2);
  return <a className="person-card" href={item.url} rel="noreferrer" target="_blank"><div className="person-top"><div className="person-avatar">{initials}</div><div><strong>{item.person}</strong><span>{item.role}</span></div><em>{item.category}</em></div><div className="person-update"><h3>{item.headline}</h3>{item.summary && <p>{item.summary}</p>}</div><div className="person-footer"><span>{item.source}</span><span>·</span><span>{formatTime(item.publishedAt)}</span></div></a>;
}

export default function MarketInformation() {
  const [newsData, setNewsData] = useState<MarketNewsResponse | null>(null);
  const [peopleData, setPeopleData] = useState<KeyPeopleResponse | null>(null);
  const [newsError, setNewsError] = useState(false);
  const [peopleError, setPeopleError] = useState(false);
  const [category, setCategory] = useState<'All' | NewsCategory>('All');

  useEffect(() => {
    let active = true;
    void fetch('/api/news', { cache: 'no-store' }).then(async (response) => {
      if (!response.ok) throw new Error('News API unavailable');
      return response.json() as Promise<MarketNewsResponse>;
    }).then((data) => { if (active) setNewsData(data); }).catch(() => { if (active) setNewsError(true); });
    void fetch('/api/key-people', { cache: 'no-store' }).then(async (response) => {
      if (!response.ok) throw new Error('Key People API unavailable');
      return response.json() as Promise<KeyPeopleResponse>;
    }).then((data) => { if (active) setPeopleData(data); }).catch(() => { if (active) setPeopleError(true); });
    return () => { active = false; };
  }, []);

  const filteredNews = useMemo(() => (newsData?.items ?? []).filter((item) => category === 'All' || item.category === category), [newsData, category]);

  return <section className="market-information" id="information"><div className="information-heading"><div><div className="eyebrow"><span className="live-dot" />MARKET INFORMATION</div><h2>市场资讯与关键人物</h2><p>信息源架构已就绪；当前展示明确标记的 fallback/mock 数据。</p></div></div><div className="information-grid"><div className="information-panel news-panel"><div className="panel-heading"><div><h3>Market News</h3><span>GLOBAL MARKET INFORMATION</span></div><SourceNote isFallback={newsData?.isFallback || newsError} source={newsData?.source} updatedAt={newsData?.lastUpdated} /></div><div className="news-filters">{categories.map((item) => <button className={category === item ? 'selected' : ''} key={item} onClick={() => setCategory(item)} type="button">{item}</button>)}</div>{(newsData?.isFallback || newsError) && <div className="information-notice">{newsError ? 'Market News 暂时无法加载。' : '当前为 fallback/mock feed，不是实时新闻。'}</div>}<div className="news-list">{!newsData && !newsError && <p className="information-empty">正在加载 Market News…</p>}{filteredNews.map((item) => <NewsRow item={item} key={item.id} />)}{newsData && filteredNews.length === 0 && <p className="information-empty">当前分类没有资讯</p>}</div></div><div className="information-panel people-panel"><div className="panel-heading"><div><h3>Key People</h3><span>PUBLIC MARKET-RELEVANT INFORMATION</span></div><SourceNote isFallback={peopleData?.isFallback || peopleError} source={peopleData?.source} updatedAt={peopleData?.lastUpdated} /></div>{(peopleData?.isFallback || peopleError) && <div className="information-notice">{peopleError ? 'Key People 暂时无法加载。' : '当前为 fallback/mock feed，不是实时人物动态。'}</div>}<div className="people-list">{!peopleData && !peopleError && <p className="information-empty">正在加载 Key People…</p>}{peopleData?.items.map((item) => <PersonCard item={item} key={item.id} />)}</div></div></div></section>;
}
