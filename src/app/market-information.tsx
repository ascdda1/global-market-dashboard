'use client';

import { useEffect, useMemo, useState } from 'react';
import { getKeyPersonRoleLabel, moduleLabels } from './bilingual-labels';
import type { KeyPeopleResponse, KeyPersonUpdate, MarketNewsItem, MarketNewsResponse, NewsCategory } from './market-data';
import './market-information.css';

const categories: Array<'All' | NewsCategory> = ['All', 'Markets', 'Macro', 'AI & Tech', 'Semiconductors', 'Crypto', 'China'];
function formatTime(timestamp: number) { return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(timestamp); }

function NewsRow({ item }: { item: MarketNewsItem }) {
  return <a className="news-row" href={item.url} rel="noreferrer" target="_blank"><time>{formatTime(item.publishedAt)}</time><div><strong>{item.title}</strong>{item.summary && <p>{item.summary}</p>}<small>{item.source} · {item.category}</small></div></a>;
}

function PersonRow({ item }: { item: KeyPersonUpdate }) {
  const initials = item.person.split(' ').map((part) => part[0]).join('').slice(0, 2);
  const role = getKeyPersonRoleLabel(item.person, item.role);
  return <a className="person-row" href={item.url} rel="noreferrer" target="_blank"><span className="person-avatar">{initials}</span><div><strong>{item.person}</strong><small>{role.en}<em>{role.zh}</em></small></div><div className="person-update"><span>{item.headline}</span><time>{new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(item.publishedAt)}</time></div></a>;
}

export default function MarketInformation({ compact = false }: { compact?: boolean }) {
  const [newsData, setNewsData] = useState<MarketNewsResponse | null>(null);
  const [peopleData, setPeopleData] = useState<KeyPeopleResponse | null>(null);
  const [newsError, setNewsError] = useState(false);
  const [peopleError, setPeopleError] = useState(false);
  const [category, setCategory] = useState<'All' | NewsCategory>('All');
  const [showAllNews, setShowAllNews] = useState(false);
  const [showAllPeople, setShowAllPeople] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch('/api/news', { cache: 'no-store' }).then(async (response) => { if (!response.ok) throw new Error('News API unavailable'); return response.json() as Promise<MarketNewsResponse>; }).then((data) => { if (active) setNewsData(data); }).catch(() => { if (active) setNewsError(true); });
    void fetch('/api/key-people', { cache: 'no-store' }).then(async (response) => { if (!response.ok) throw new Error('Key People API unavailable'); return response.json() as Promise<KeyPeopleResponse>; }).then((data) => { if (active) setPeopleData(data); }).catch(() => { if (active) setPeopleError(true); });
    return () => { active = false; };
  }, []);

  const filteredNews = useMemo(() => (newsData?.items ?? []).filter((item) => category === 'All' || item.category === category), [newsData, category]);
  const visibleNews = compact && !showAllNews ? filteredNews.slice(0, 4) : filteredNews;
  const visiblePeople = compact && !showAllPeople ? (peopleData?.items ?? []).slice(0, 4) : peopleData?.items ?? [];

  return <><section className="market-information terminal-panel news-panel" id="news"><div className="panel-heading"><div><span className="panel-icon" aria-hidden="true">▤</span><div><h2>Latest News</h2><p>{moduleLabels.marketNews.zh}</p></div></div><button className="view-more" onClick={() => setShowAllNews((value) => !value)} type="button">{showAllNews ? 'Collapse' : 'View More'} <span>→</span></button></div><div className="news-filters">{categories.map((item) => <button className={category === item ? 'selected' : ''} key={item} onClick={() => { setCategory(item); setShowAllNews(false); }} type="button">{item}</button>)}</div>{(newsData?.isFallback || newsError) && <div className="panel-notice"><span>!</span>{newsError ? 'News unavailable.' : 'Fallback/mock news — not a live feed.'}</div>}<div className="news-list">{!newsData && !newsError && <p className="information-empty">Loading Market News…</p>}{visibleNews.map((item) => <NewsRow item={item} key={item.id} />)}{newsData && visibleNews.length === 0 && <p className="information-empty">No news in this category.</p>}</div><div className="panel-source"><span className={newsData?.isFallback || newsError ? 'source-badge fallback' : 'source-badge'}>{newsData?.isFallback || newsError ? 'FALLBACK / MOCK' : newsData?.source ?? 'LOADING'}</span>{newsData?.lastUpdated && <small>Updated {formatTime(newsData.lastUpdated)}</small>}</div></section><section className="market-information terminal-panel people-panel" id="people"><div className="panel-heading"><div><span className="panel-icon" aria-hidden="true">♙</span><div><h2>{moduleLabels.keyPeople.en}</h2><p>{moduleLabels.keyPeople.zh}</p></div></div><button className="view-more" onClick={() => setShowAllPeople((value) => !value)} type="button">{showAllPeople ? 'Collapse' : 'View More'} <span>→</span></button></div>{(peopleData?.isFallback || peopleError) && <div className="panel-notice"><span>!</span>{peopleError ? 'Key People unavailable.' : 'Fallback/mock public-information feed.'}</div>}<div className="people-list">{!peopleData && !peopleError && <p className="information-empty">Loading Key People…</p>}{visiblePeople.map((item) => <PersonRow item={item} key={item.id} />)}</div><div className="panel-source"><span className={peopleData?.isFallback || peopleError ? 'source-badge fallback' : 'source-badge'}>{peopleData?.isFallback || peopleError ? 'FALLBACK / MOCK' : peopleData?.source ?? 'LOADING'}</span>{peopleData?.lastUpdated && <small>Updated {formatTime(peopleData.lastUpdated)}</small>}</div></section></>;
}
