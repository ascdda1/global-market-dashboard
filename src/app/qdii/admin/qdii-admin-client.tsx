'use client';

import { useEffect, useState } from 'react';

type Override = {
  fund_code: string;
  share_class: string;
  distributor_limit: string | null;
  direct_limit: string | null;
  updated_at: string;
};

export default function QdiiAdminClient() {
  const [secret, setSecret] = useState('');
  const [fundCode, setFundCode] = useState('');
  const [shareClass, setShareClass] = useState('A');
  const [distributorLimit, setDistributorLimit] = useState('');
  const [directLimit, setDirectLimit] = useState('');
  const [updatedAt, setUpdatedAt] = useState(new Date().toISOString().slice(0,10));
  const [rows, setRows] = useState<Override[]>([]);
  const [state, setState] = useState('');

  async function load() {
    const r = await fetch('/api/qdii/limits', { cache: 'no-store' });
    const j = await r.json();
    setRows(j.limits ?? []);
  }

  useEffect(() => { void load(); }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setState('保存中…');
    const r = await fetch('/api/qdii/limits', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ fundCode, shareClass, distributorLimit, directLimit, updatedAt }),
    });
    if (!r.ok) {
      setState(r.status === 401 ? '密钥不正确' : '保存失败');
      return;
    }
    setState('已保存，前台刷新后立即生效');
    setDistributorLimit('');
    setDirectLimit('');
    await load();
  }

  return <main className="admin-shell">
    <header><a href="/qdii">← 返回 QDII</a><h1>QDII 限额管理</h1><p>仅维护动态申购额度，不修改基金静态资料。</p></header>
    <form onSubmit={save} className="admin-form">
      <label>管理密钥<input type="password" value={secret} onChange={e=>setSecret(e.target.value)} required /></label>
      <label>基金代码<input value={fundCode} onChange={e=>setFundCode(e.target.value)} placeholder="019736" required /></label>
      <label>份额类别<input value={shareClass} onChange={e=>setShareClass(e.target.value)} placeholder="A / C / E / I / ETF" required /></label>
      <label>支付宝 / 代销额度<input value={distributorLimit} onChange={e=>setDistributorLimit(e.target.value)} placeholder="200元/日、暂停、不限额…" /></label>
      <label>基金 App 直销额度<input value={directLimit} onChange={e=>setDirectLimit(e.target.value)} placeholder="1000元/日、暂停、不限额…" /></label>
      <label>更新时间<input type="date" value={updatedAt} onChange={e=>setUpdatedAt(e.target.value)} required /></label>
      <button type="submit">保存限额</button><span>{state}</span>
    </form>
    <section className="admin-list">
      <h2>已覆盖的动态数据</h2>
      <div className="admin-table-wrap"><table><thead><tr><th>代码</th><th>份额</th><th>支付宝/代销</th><th>App直销</th><th>更新</th></tr></thead>
      <tbody>{rows.map(r=><tr key={r.fund_code+r.share_class}><td>{r.fund_code}</td><td>{r.share_class}</td><td>{r.distributor_limit || '—'}</td><td>{r.direct_limit || '—'}</td><td>{r.updated_at}</td></tr>)}</tbody></table></div>
    </section>
  </main>;
}
