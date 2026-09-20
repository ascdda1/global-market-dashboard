'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';

type Fund = {
  name: string;
  code: string;
  category: string;
  wrapper: '场外申赎' | '场内交易';
  structure: '指数型' | '主动型';
  share: string;
  benchmark: string;
  description: string;
  management: number;
  custody: number;
  service: number;
  total: number;
  trackingError?: string;
  alipay?: string;
  direct?: string;
  updated: string;
};

const funds: Fund[] = [
  {name:'宝盈纳斯达克100指数A',code:'019736',category:'纳指100',wrapper:'场外申赎',structure:'指数型',share:'A',benchmark:'NASDAQ-100 Index',description:'跟踪纳斯达克市场100家大型非金融公司，成长与科技权重较高。',management:.50,custody:.15,service:0,total:.65,trackingError:'1.64%',alipay:'200元/日',direct:'待更新',updated:'2026-09-19'},
  {name:'宝盈纳斯达克100指数C',code:'019737',category:'纳指100',wrapper:'场外申赎',structure:'指数型',share:'C',benchmark:'NASDAQ-100 Index',description:'与A类持仓一致，免申购费但持续收取销售服务费。',management:.50,custody:.15,service:.25,total:.90,trackingError:'1.65%',alipay:'200元/日',direct:'待更新',updated:'2026-09-19'},
  {name:'万家纳斯达克100指数A',code:'019441',category:'纳指100',wrapper:'场外申赎',structure:'指数型',share:'A',benchmark:'NASDAQ-100 Index',description:'被动跟踪纳斯达克100，集中于大型科技、通信与消费成长公司。',management:.50,custody:.15,service:0,total:.65,trackingError:'2.08%',alipay:'100元/日',direct:'待更新',updated:'2026-09-19'},
  {name:'万家纳斯达克100指数C',code:'019442',category:'纳指100',wrapper:'场外申赎',structure:'指数型',share:'C',benchmark:'NASDAQ-100 Index',description:'与A类同一组合，以销售服务费替代前端申购费。',management:.50,custody:.15,service:.20,total:.85,trackingError:'待更新',alipay:'100元/日',direct:'待更新',updated:'2026-09-19'},
  {name:'汇添富纳斯达克100ETF联接A',code:'018966',category:'纳指100',wrapper:'场外申赎',structure:'指数型',share:'A',benchmark:'NASDAQ-100 Index',description:'主要通过目标ETF跟踪纳斯达克100，适合作为长期核心指数仓。',management:.50,custody:.15,service:0,total:.65,trackingError:'1.74%',alipay:'低额度',direct:'1000元/日',updated:'2026-09-19'},
  {name:'汇添富纳斯达克100ETF联接E',code:'021773',category:'纳指100',wrapper:'场外申赎',structure:'指数型',share:'E',benchmark:'NASDAQ-100 Index',description:'与A/C类同一底层组合，免申购费并收取较低销售服务费。',management:.50,custody:.15,service:.10,total:.75,trackingError:'1.74%',alipay:'待更新',direct:'1000元/日',updated:'2026-09-19'},
  {name:'汇添富纳斯达克100ETF联接C',code:'018967',category:'纳指100',wrapper:'场外申赎',structure:'指数型',share:'C',benchmark:'NASDAQ-100 Index',description:'与A类持仓一致，适合短期申赎但长期费率高于A/E。',management:.50,custody:.15,service:.40,total:1.05,trackingError:'待更新',alipay:'待更新',direct:'1000元/日',updated:'2026-09-19'},
  {name:'南方纳斯达克100指数I',code:'021000',category:'纳指100',wrapper:'场外申赎',structure:'指数型',share:'I',benchmark:'NASDAQ-100 Index',description:'特殊销售份额，跟踪纳斯达克100，当前销售服务费优惠后成本较低。',management:.50,custody:.15,service:.01,total:.66,trackingError:'待更新',alipay:'—',direct:'200元/日',updated:'2026-09-19'},
  {name:'国泰纳斯达克100指数',code:'160213',category:'纳指100',wrapper:'场外申赎',structure:'指数型',share:'A',benchmark:'NASDAQ-100 Index',description:'老牌纳指100指数QDII，历史较长但固定费率高于新一代产品。',management:.80,custody:.25,service:0,total:1.05,trackingError:'1.10%',alipay:'100元/日',direct:'待更新',updated:'2026-09-19'},
  {name:'建信纳斯达克100指数A',code:'539001',category:'纳指100',wrapper:'场外申赎',structure:'指数型',share:'A',benchmark:'NASDAQ-100 Index',description:'被动跟踪纳斯达克100，当前费率和可申购额度均不占优势。',management:.80,custody:.20,service:0,total:1.00,trackingError:'2.24%',alipay:'10元/日',direct:'待更新',updated:'2026-09-19'},
  {name:'景顺长城纳斯达克科技市值加权A',code:'017091',category:'纳指科技',wrapper:'场外申赎',structure:'指数型',share:'A',benchmark:'NASDAQ Technology Market Cap Weighted Index',description:'聚焦纳斯达克科技板块，较普通纳指100拥有更纯粹的科技暴露。',management:.80,custody:.20,service:0,total:1.00,trackingError:'2.76%',alipay:'合计300元/日',direct:'合计1500元/日',updated:'2026-09-19'},
  {name:'景顺长城纳斯达克科技市值加权E',code:'019118',category:'纳指科技',wrapper:'场外申赎',structure:'指数型',share:'E',benchmark:'NASDAQ Technology Market Cap Weighted Index',description:'与A类同一科技指数，免申购费但持续收取较低销售服务费。',management:.80,custody:.20,service:.20,total:1.20,trackingError:'待更新',alipay:'合计300元/日',direct:'合计1500元/日',updated:'2026-09-19'},
  {name:'景顺长城纳斯达克科技市值加权C',code:'017093',category:'纳指科技',wrapper:'场外申赎',structure:'指数型',share:'C',benchmark:'NASDAQ Technology Market Cap Weighted Index',description:'同一科技指数的C类份额，免申购费但长期持续费率更高。',management:.80,custody:.20,service:.40,total:1.40,trackingError:'2.77%',alipay:'合计300元/日',direct:'合计1500元/日',updated:'2026-09-19'},
  {name:'摩根标普500指数A',code:'017641',category:'标普500',wrapper:'场外申赎',structure:'指数型',share:'A',benchmark:'S&P 500 Index',description:'覆盖500家大型上市公司，行业分散，是大盘核心指数暴露。',management:.50,custody:.15,service:0,total:.65,trackingError:'1.63%',alipay:'10元/日',direct:'待更新',updated:'2026-09-19'},
  {name:'天弘标普500指数A',code:'007721',category:'标普500',wrapper:'场外申赎',structure:'指数型',share:'A',benchmark:'S&P 500 Index',description:'跟踪标普500，覆盖科技、金融、消费、医疗等大型行业龙头。',management:.60,custody:.20,service:0,total:.80,trackingError:'待更新',alipay:'100元/日',direct:'待更新',updated:'2026-09-19'},
  {name:'大成标普500等权重指数A',code:'096001',category:'标普500等权',wrapper:'场外申赎',structure:'指数型',share:'A',benchmark:'S&P 500 Equal Weight Index',description:'标普500成分股近似等权配置，降低超大市值公司的集中影响。',management:1.00,custody:.20,service:0,total:1.20,trackingError:'待更新',alipay:'100元/日',direct:'1000元/日',updated:'2026-09-19'},
  {name:'长信标普100等权重指数',code:'519981',category:'标普100等权',wrapper:'场外申赎',structure:'指数型',share:'A',benchmark:'S&P 100 Equal Weight Index',description:'跟踪标普100大型公司等权组合，与标普500等权并非同一指数。',management:1.10,custody:.20,service:0,total:1.30,trackingError:'待更新',alipay:'100元/日',direct:'待更新',updated:'2026-09-19'},
  {name:'汇添富纳斯达克生物科技A',code:'017894',category:'生物科技',wrapper:'场外申赎',structure:'指数型',share:'A',benchmark:'NASDAQ Biotechnology Index',description:'集中于生物制药、创新药与生命科学公司，行业波动较高。',management:.50,custody:.15,service:0,total:.65,trackingError:'1.85%',alipay:'100元/日',direct:'待更新',updated:'2026-09-19'},
  {name:'华宝标普美国品质消费A',code:'162415',category:'消费',wrapper:'场内交易',structure:'指数型',share:'A',benchmark:'Consumer Discretionary Select Sector Index',description:'聚焦可选消费龙头，重仓电商、汽车、家居零售与连锁消费公司。',management:1.00,custody:.20,service:0,total:1.20,trackingError:'待更新',alipay:'场外可申购',direct:'待更新',updated:'2026-09-19'},
  {name:'景顺长城标普消费精选ETF',code:'159529',category:'消费',wrapper:'场内交易',structure:'指数型',share:'ETF',benchmark:'S&P 500 Consumer Select 15/60 Index',description:'同时覆盖可选消费与必需消费龙头，兼顾成长与防御型消费暴露。',management:.50,custody:.20,service:0,total:.70,trackingError:'待更新',alipay:'—',direct:'—',updated:'2026-09-19'},
  {name:'嘉实美国成长股票A',code:'000043',category:'主动成长',wrapper:'场外申赎',structure:'主动型',share:'A',benchmark:'Russell 1000 Growth Index ×95% + Cash ×5%',description:'主动配置大型成长公司，重点覆盖科技、消费与创新行业龙头。',management:1.20,custody:.20,service:0,total:1.40,trackingError:'不适用',alipay:'100元/日',direct:'高额度',updated:'2026-09-19'},
  {name:'华夏纳斯达克100ETF',code:'513300',category:'纳指100',wrapper:'场内交易',structure:'指数型',share:'ETF',benchmark:'NASDAQ-100 Index',description:'场内交易的纳指100指数工具，需额外关注实时溢价率。',management:.60,custody:.20,service:0,total:.80,trackingError:'待更新',alipay:'—',direct:'—',updated:'2026-09-19'},
  {name:'广发纳斯达克100ETF',code:'159941',category:'纳指100',wrapper:'场内交易',structure:'指数型',share:'ETF',benchmark:'NASDAQ-100 Index',description:'规模较大的场内纳指100ETF，流动性较好但费率相对偏高。',management:.80,custody:.20,service:0,total:1.00,trackingError:'1.03%',alipay:'—',direct:'—',updated:'2026-09-19'},
  {name:'嘉实纳斯达克100ETF',code:'159501',category:'纳指100',wrapper:'场内交易',structure:'指数型',share:'ETF',benchmark:'NASDAQ-100 Index',description:'低费率场内纳指100ETF，交易时需结合实时折溢价观察。',management:.50,custody:.10,service:0,total:.60,trackingError:'待更新',alipay:'—',direct:'—',updated:'2026-09-19'},
  {name:'易方达纳斯达克100ETF',code:'159696',category:'纳指100',wrapper:'场内交易',structure:'指数型',share:'ETF',benchmark:'NASDAQ-100 Index',description:'低费率场内纳指100指数工具，适合比较溢价与成交活跃度。',management:.50,custody:.10,service:0,total:.60,trackingError:'待更新',alipay:'—',direct:'—',updated:'2026-09-19'},
  {name:'富国纳斯达克100ETF',code:'513870',category:'纳指100',wrapper:'场内交易',structure:'指数型',share:'ETF',benchmark:'NASDAQ-100 Index',description:'场内低费率纳指100ETF，可与同指数产品横向比较成本与溢价。',management:.50,custody:.10,service:0,total:.60,trackingError:'待更新',alipay:'—',direct:'—',updated:'2026-09-19'},
  {name:'国泰标普500ETF',code:'159612',category:'标普500',wrapper:'场内交易',structure:'指数型',share:'ETF',benchmark:'S&P 500 Index',description:'场内标普500ETF，覆盖大型公司并提供跨行业核心市场暴露。',management:.60,custody:.15,service:0,total:.75,trackingError:'1.03%',alipay:'—',direct:'—',updated:'2026-09-19'},
  {name:'华夏标普500ETF',code:'159655',category:'标普500',wrapper:'场内交易',structure:'指数型',share:'ETF',benchmark:'S&P 500 Index',description:'被动跟踪标普500，场内交易时需同时观察基金溢价。',management:.60,custody:.15,service:0,total:.75,trackingError:'待更新',alipay:'—',direct:'—',updated:'2026-09-19'},
  {name:'南方标普500ETF',code:'513650',category:'标普500',wrapper:'场内交易',structure:'指数型',share:'ETF',benchmark:'S&P 500 Index',description:'场内标普500工具，用于低成本获取大型公司指数暴露。',management:.60,custody:.15,service:0,total:.75,trackingError:'待更新',alipay:'—',direct:'—',updated:'2026-09-19'},
  {name:'景顺长城全球半导体芯片股票A（QDII-LOF）',code:'501225',category:'全球芯片',wrapper:'场内交易',structure:'主动型',share:'LOF-A',benchmark:'半导体芯片产业主题',description:'通过境内外股票与ETF配置全球半导体产业链，覆盖设计、制造、设备与存储。',management:1.20,custody:.20,service:0,total:1.40,trackingError:'不适用',alipay:'场外可申购',direct:'待更新',updated:'2026-09-19'},
  {name:'大成纳斯达克100ETF联接A',code:'000834',category:'纳指100',wrapper:'场外申赎',structure:'指数型',share:'A',benchmark:'NASDAQ-100 Index',description:'老牌纳指100联接基金，通过目标ETF获取大型成长与科技公司暴露。',management:.80,custody:.20,service:0,total:1.00,trackingError:'1.00%',alipay:'10元/日',direct:'待更新',updated:'2026-09-20'},
  {name:'大成纳斯达克100ETF联接C',code:'008971',category:'纳指100',wrapper:'场外申赎',structure:'指数型',share:'C',benchmark:'NASDAQ-100 Index',description:'与A类同一底层组合，免申购费但持续收取销售服务费。',management:.80,custody:.20,service:.40,total:1.40,trackingError:'1.01%',alipay:'10元/日',direct:'待更新',updated:'2026-09-20'},
  {name:'广发纳斯达克100ETF联接A',code:'270042',category:'纳指100',wrapper:'场外申赎',structure:'指数型',share:'A',benchmark:'NASDAQ-100 Index',description:'历史较长、规模较大的纳指100联接基金，适合观察长期跟踪效率。',management:.80,custody:.20,service:0,total:1.00,trackingError:'1.03%',alipay:'2元/日',direct:'待更新',updated:'2026-09-20'},
  {name:'广发纳斯达克100ETF联接C',code:'006479',category:'纳指100',wrapper:'场外申赎',structure:'指数型',share:'C',benchmark:'NASDAQ-100 Index',description:'与A类同一底层组合，适合比较不同份额长期成本与跟踪表现。',management:.80,custody:.20,service:.40,total:1.40,trackingError:'1.02%',alipay:'待更新',direct:'待更新',updated:'2026-09-20'},
  {name:'华安纳斯达克100ETF联接A',code:'040046',category:'纳指100',wrapper:'场外申赎',structure:'指数型',share:'A',benchmark:'NASDAQ-100 Index',description:'成立时间较早的纳指100联接产品，长期跟踪记录较完整。',management:.80,custody:.20,service:0,total:1.00,trackingError:'1.00%',alipay:'10元/日',direct:'待更新',updated:'2026-09-20'},
  {name:'南方纳斯达克100指数A',code:'016452',category:'纳指100',wrapper:'场外申赎',structure:'指数型',share:'A',benchmark:'NASDAQ-100 Index',description:'被动跟踪纳指100，覆盖大型科技、通信与消费成长公司。',management:.50,custody:.15,service:0,total:.65,trackingError:'1.42%',alipay:'10元/日',direct:'待更新',updated:'2026-09-20'},
  {name:'华夏纳斯达克100ETF联接A',code:'015299',category:'纳指100',wrapper:'场外申赎',structure:'指数型',share:'A',benchmark:'NASDAQ-100 Index',description:'通过目标ETF跟踪纳指100，可与同类产品比较费率和误差。',management:.60,custody:.20,service:0,total:.80,trackingError:'2.43%',alipay:'暂停/低额度',direct:'待更新',updated:'2026-09-20'},
  {name:'招商纳斯达克100ETF联接A',code:'019547',category:'纳指100',wrapper:'场外申赎',structure:'指数型',share:'A',benchmark:'NASDAQ-100 Index',description:'跟踪纳指100的大型成长组合，适合横向比较新产品跟踪效率。',management:.50,custody:.15,service:0,total:.65,trackingError:'1.74%',alipay:'待更新',direct:'待更新',updated:'2026-09-20'},
  {name:'易方达纳斯达克100ETF联接A',code:'161130',category:'纳指100',wrapper:'场外申赎',structure:'指数型',share:'A',benchmark:'NASDAQ-100 Index',description:'QDII-LOF联接基金，长期跟踪纳指100，历史记录较完整。',management:.80,custody:.20,service:0,total:1.00,trackingError:'1.43%',alipay:'暂停/低额度',direct:'待更新',updated:'2026-09-20'},
  {name:'嘉实纳斯达克100ETF联接A',code:'016532',category:'纳指100',wrapper:'场外申赎',structure:'指数型',share:'A',benchmark:'NASDAQ-100 Index',description:'通过嘉实纳指100ETF获取指数暴露，适合比较不同联接基金效率。',management:.50,custody:.10,service:0,total:.60,trackingError:'1.49%',alipay:'暂停',direct:'待更新',updated:'2026-09-20'},
  {name:'嘉实纳斯达克100ETF联接C',code:'016533',category:'纳指100',wrapper:'场外申赎',structure:'指数型',share:'C',benchmark:'NASDAQ-100 Index',description:'与A类同一底层组合，适合比较销售服务费对长期收益的影响。',management:.50,custody:.10,service:.20,total:.80,trackingError:'1.49%',alipay:'暂停',direct:'待更新',updated:'2026-09-20'},
  {name:'嘉实纳斯达克100ETF联接I',code:'021838',category:'纳指100',wrapper:'场外申赎',structure:'指数型',share:'I',benchmark:'NASDAQ-100 Index',description:'特殊销售份额，同样跟踪纳指100，适合比较不同渠道成本。',management:.50,custody:.10,service:.10,total:.70,trackingError:'1.51%',alipay:'暂停',direct:'待更新',updated:'2026-09-20'},
  {name:'博时纳斯达克100ETF联接A',code:'016055',category:'纳指100',wrapper:'场外申赎',structure:'指数型',share:'A',benchmark:'NASDAQ-100 Index',description:'通过目标ETF跟踪纳指100，提供另一组费率与误差对照。',management:.50,custody:.15,service:0,total:.65,trackingError:'1.45%',alipay:'暂停',direct:'待更新',updated:'2026-09-20'},
  {name:'景顺长城纳指科技ETF',code:'159509',category:'纳指科技',wrapper:'场内交易',structure:'指数型',share:'ETF',benchmark:'NASDAQ Technology Market Cap Weighted Index',description:'直接跟踪纳指科技市值加权指数，科技暴露比普通纳指100更集中。',management:.80,custody:.20,service:0,total:1.00,trackingError:'0.04%（近1月）',alipay:'—',direct:'—',updated:'2026-09-20'},
  {name:'汇添富纳斯达克生物科技C',code:'017895',category:'生物科技',wrapper:'场外申赎',structure:'指数型',share:'C',benchmark:'NASDAQ Biotechnology Index',description:'与A类同一纳指生物科技组合，免申购费但持续收取销售服务费。',management:.50,custody:.15,service:.40,total:1.05,trackingError:'1.85%',alipay:'100元/日',direct:'待更新',updated:'2026-09-20'},
  {name:'汇添富纳指生物科技ETF',code:'513290',category:'生物科技',wrapper:'场内交易',structure:'指数型',share:'ETF',benchmark:'NASDAQ Biotechnology Index',description:'场内直接跟踪纳指生物科技指数，覆盖大型创新药与生命科学公司。',management:.50,custody:.15,service:0,total:.65,trackingError:'1.33%',alipay:'—',direct:'—',updated:'2026-09-20'},
  {name:'广发生物科技指数A',code:'001092',category:'生物科技',wrapper:'场外申赎',structure:'指数型',share:'A',benchmark:'NASDAQ Biotechnology Index',description:'跟踪纳指生物科技指数，覆盖生物制药、基因技术与生命科学公司。',management:.80,custody:.20,service:0,total:1.00,trackingError:'1.76%',alipay:'10元/日',direct:'待更新',updated:'2026-09-20'},
  {name:'易方达标普生物科技A',code:'161127',category:'生物科技',wrapper:'场外申赎',structure:'指数型',share:'A',benchmark:'S&P Biotechnology Select Industry Index',description:'等权色彩更强的生物科技指数暴露，与纳指生科指数构成明显不同。',management:.80,custody:.20,service:0,total:1.00,trackingError:'3.74%',alipay:'待更新',direct:'待更新',updated:'2026-09-20'},
  {name:'易方达标普信息科技A',code:'161128',category:'纳指科技',wrapper:'场外申赎',structure:'指数型',share:'A',benchmark:'S&P 500 Information Technology Index',description:'跟踪大型信息科技公司，偏向软件、芯片和IT服务龙头。',management:.80,custody:.20,service:0,total:1.00,trackingError:'待更新',alipay:'待更新',direct:'待更新',updated:'2026-09-20'},
  {name:'易方达标普500指数A',code:'161125',category:'标普500',wrapper:'场外申赎',structure:'指数型',share:'A',benchmark:'S&P 500 Index',description:'覆盖大型上市公司，作为标准市值加权大盘指数基准工具。',management:.80,custody:.20,service:0,total:1.00,trackingError:'待更新',alipay:'待更新',direct:'待更新',updated:'2026-09-20'}
];

const cats = ['全部','纳指100','标普500','标普500等权','标普100等权','纳指科技','生物科技','消费','全球芯片','主动成长'];

type LimitOverride = { fund_code:string; share_class:string; distributor_limit:string|null; direct_limit:string|null; updated_at:string };
type PerformancePeriod = { returnPct:number|null; series:{date:string;value:number}[] };
type RiskStats = { maxDrawdownPct:number|null; recoveryDays:number|null; recoveryStatus:'recovered'|'unrecovered'|'not_applicable'; sharpe:number|null };
type PerformanceRow = { code:string; latest:string|null; scale:string|null; scaleDate:string|null; ytd:PerformancePeriod; y1:PerformancePeriod; y3:PerformancePeriod; y5:PerformancePeriod; risk3y:RiskStats };
type HoldingRow = { code:string; name:string; weight:number|null };
type HoldingsResponse = { code:string; disclosureDate:string|null; holdings:HoldingRow[]; source:string; unavailable?:boolean };

function ReturnValue({value}:{value:number|null|undefined}) {
  if (value == null) return <span className="perf-na">不适用</span>;
  const cls = value > 0 ? 'perf-up' : value < 0 ? 'perf-down' : 'perf-flat';
  return <span className={cls}>{value > 0 ? '+' : ''}{value.toFixed(2)}%</span>;
}

function RiskNumber({ value, kind }: { value:number|null|undefined; kind:'drawdown'|'sharpe' }) {
  if (value == null) return <span className="perf-na">不适用</span>;
  const cls = kind === 'drawdown' ? 'risk-drawdown' : value > 0 ? 'risk-positive' : value < 0 ? 'risk-negative' : 'risk-neutral';
  return <span className={cls}>{kind === 'drawdown' ? `${value.toFixed(2)}%` : value.toFixed(2)}</span>;
}

function displayTrackingError(f: Fund) {
  if (f.structure === '主动型') return '不适用';
  if (f.trackingError && f.trackingError !== '待更新') return f.trackingError;
  return '待补充';
}

export default function QdiiClient({ embedded = false }: { embedded?: boolean } = {}) {
  const keepQdiiAtTop = () => {
    if (!embedded) return;
    requestAnimationFrame(() => {
      document.getElementById('qdii')?.scrollIntoView({ block: 'start', behavior: 'auto' });
    });
  };
  const [category, setCategory] = useState('全部');
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'场外基金'|'场内ETF'>('场外基金');
  const [sortKey, setSortKey] = useState<'fee'|'ytd'|'y1'|'y3'|'y5'|'scale'|'tracking'|'drawdown'|'sharpe'>('fee');
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('asc');
  const [limitOverrides, setLimitOverrides] = useState<Record<string, LimitOverride>>({});
  const [performance, setPerformance] = useState<Record<string, PerformanceRow>>({});
  const [expandedHolding, setExpandedHolding] = useState<string|null>(null);
  const [holdings, setHoldings] = useState<Record<string, HoldingsResponse>>({});
  const [holdingLoading, setHoldingLoading] = useState<string|null>(null);

  const toggleHoldings = async (code:string) => {
    if (expandedHolding === code) {
      setExpandedHolding(null);
      return;
    }
    setExpandedHolding(code);
    if (holdings[code]) return;
    setHoldingLoading(code);
    try {
      const response = await fetch(`/api/qdii/holdings?code=${encodeURIComponent(code)}`, { cache:'no-store' });
      const json = await response.json() as HoldingsResponse;
      setHoldings(current => ({ ...current, [code]: json }));
    } catch {
      setHoldings(current => ({ ...current, [code]: { code, disclosureDate:null, holdings:[], source:'Eastmoney / 天天基金公开持仓', unavailable:true } }));
    } finally {
      setHoldingLoading(current => current === code ? null : current);
    }
  };
  useEffect(() => {
    let active = true;
    void fetch('/api/qdii/limits', { cache: 'no-store' })
      .then(r => r.json())
      .then((j: { limits?: LimitOverride[] }) => {
        if (!active) return;
        setLimitOverrides(Object.fromEntries((j.limits ?? []).map(row => [`${row.fund_code}::${row.share_class}`, row])));
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);
  useEffect(() => {
    let active = true;
    const codes = [...new Set(funds.map(f=>f.code))].join(',');
    void fetch(`/api/qdii/performance?codes=${encodeURIComponent(codes)}`, { cache:'no-store' })
      .then(r=>r.json())
      .then((j:{funds?:PerformanceRow[]})=>{
        if (!active) return;
        setPerformance(Object.fromEntries((j.funds ?? []).map(row=>[row.code,row])));
      })
      .catch(()=>{});
    return () => { active = false; };
  }, []);
  const rows = useMemo(() => {
    const visible = funds.filter(f =>
      (view === '场外基金' ? f.wrapper === '场外申赎' : f.wrapper === '场内交易') &&
      !(view === '场外基金' && f.structure === '指数型' && f.share === 'C') &&
      (category==='全部'||f.category===category) &&
      (!query || (f.name+f.code+f.benchmark).toLowerCase().includes(query.toLowerCase()))
    );

    const metric = (f: Fund) => {
      const p = performance[f.code];
      if (sortKey === 'fee') return f.total;
      if (sortKey === 'ytd') return p?.ytd.returnPct ?? null;
      if (sortKey === 'y1') return p?.y1.returnPct ?? null;
      if (sortKey === 'y3') return p?.y3.returnPct ?? null;
      if (sortKey === 'y5') return p?.y5.returnPct ?? null;
      if (sortKey === 'scale') {
        const m = p?.scale?.match(/[0-9.]+/);
        return m ? Number(m[0]) : null;
      }
      if (sortKey === 'drawdown') return p?.risk3y.maxDrawdownPct ?? null;
      if (sortKey === 'sharpe') return p?.risk3y.sharpe ?? null;
      if (sortKey === 'tracking') {
        const m = displayTrackingError(f).match(/[0-9.]+/);
        return m ? Number(m[0]) : null;
      }
      return null;
    };

    return visible.sort((a,b) => {
      const av = metric(a), bv = metric(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return sortDir === 'asc' ? av-bv : bv-av;
    });
  }, [category, query, view, sortKey, sortDir, performance]);

  const Root = embedded ? 'div' : 'main';
  return <Root className={`qdii-page${embedded ? ' qdii-embedded' : ''}`}>
    <header className="qdii-header">
      <div>{!embedded && <a href="/" className="qdii-back">← Longview Terminal</a>}<h1>QDII 场内 / 场外基金</h1><p>费率 · 历史收益 · 跟踪误差 · 份额类别 · 申购额度</p></div>
      <div className="qdii-updated"><b>额度更新时间</b><span>2026-09-19</span><small>每周人工校验</small></div>
    </header>

    <section className="qdii-summary">
      <article><small>精选基金</small><strong>{funds.length}</strong><span>精选研究池</span></article>
      <article><small>场外申赎</small><strong>{funds.filter(f=>f.wrapper==='场外申赎').length}</strong><span>指数型仅展示 A/E/I</span></article>
      <article><small>场内交易</small><strong>{funds.filter(f=>f.wrapper==='场内交易').length}</strong><span>ETF / LOF</span></article>
      <article><small>最低固定费率</small><strong>{Math.min(...funds.map(f=>f.total)).toFixed(2)}%</strong><span>管理+托管+服务</span></article>
    </section>

    <section className="qdii-panel">
      <div className="qdii-view-tabs">
        <button className={view==='场外基金'?'active':''} onClick={()=>{setView('场外基金');keepQdiiAtTop();}}>场外基金</button>
        <button className={view==='场内ETF'?'active':''} onClick={()=>{setView('场内ETF');if(sortKey==='tracking')setSortKey('fee');keepQdiiAtTop();}}>场内 ETF / LOF</button>
      </div>
      {view==='场外基金' && <div className="qdii-share-note">长期持有通常优先关注 A 类等低持续费率份额；为减少同一指数产品的重复展示，本页指数型基金默认隐藏 C 类，仅保留 A / E / I 等更适合长期比较的份额。</div>}
      <div className="qdii-tabs">{cats.map(c=><button key={c} className={category===c?'active':''} onClick={()=>{setCategory(c);keepQdiiAtTop();}}>{c}</button>)}</div>
      <div className="qdii-tools">
        <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜索基金名称 / 代码 / 指数" />
        <select value={sortKey} onChange={e=>setSortKey(e.target.value as typeof sortKey)}>
          <option value="fee">按固定费率</option>
          <option value="ytd">按 YTD</option>
          <option value="y1">按 1Y</option>
          <option value="y3">按 3Y</option>
          <option value="y5">按 5Y</option>
          <option value="scale">按总规模</option>
          {view==='场外基金' && <option value="tracking">按跟踪误差</option>}
          <option value="drawdown">按最大回撤</option>
          <option value="sharpe">按夏普比率</option>
        </select>
        <select value={sortDir} onChange={e=>setSortDir(e.target.value as typeof sortDir)}>
          <option value="desc">从高到低</option>
          <option value="asc">从低到高</option>
        </select>
      </div>
      <div className="qdii-table-wrap">
        <table className="qdii-table">
          <thead><tr><th>基金 / 代码</th><th>交易方式</th><th>管理方式</th><th>份额</th><th>跟踪指数 / 比较基准</th><th>持仓解释</th><th>总规模</th><th>YTD</th><th>1Y</th><th>3Y</th><th>5Y</th><th>近3年最大回撤</th><th>修复时长</th><th>近3年夏普</th><th>固定费率</th>{view==='场外基金' && <><th>跟踪误差</th><th>支付宝/代销</th><th>基金App直销</th></>}<th>前十大持仓</th></tr></thead>
          <tbody>{rows.map(f=><Fragment key={f.code+f.share}><tr>
            <td><strong>{f.name}</strong><small>{f.code}</small></td>
            <td><span className={`venue-badge ${f.wrapper==='场内交易'?'on-exchange':'off-exchange'}`}>{f.wrapper}</span></td>
            <td><span className="qdii-tag">{f.structure}</span></td>
            <td><b>{f.share}</b></td>
            <td><strong>{f.benchmark}</strong><small>{f.category}</small></td>
            <td className="qdii-desc">{f.description}</td>
            <td><strong>{performance[f.code]?.scale ?? '—'}</strong><small>{performance[f.code]?.scaleDate ?? '最新披露'}</small></td>
            <td><ReturnValue value={performance[f.code]?.ytd.returnPct}/></td>
            <td><ReturnValue value={performance[f.code]?.y1.returnPct}/></td>
            <td><ReturnValue value={performance[f.code]?.y3.returnPct}/></td>
            <td><ReturnValue value={performance[f.code]?.y5.returnPct}/></td>
            <td><RiskNumber value={performance[f.code]?.risk3y.maxDrawdownPct} kind="drawdown"/><small>峰值至谷底</small></td>
            <td><strong>{performance[f.code]?.risk3y.recoveryStatus === 'not_applicable' || performance[f.code]?.risk3y.recoveryDays == null ? '不适用' : `${performance[f.code]!.risk3y.recoveryDays!}天`}</strong><small>{performance[f.code]?.risk3y.recoveryStatus === 'unrecovered' ? '尚未修复·截至最新净值' : performance[f.code]?.risk3y.recoveryStatus === 'recovered' ? '谷底→重回前高' : '历史不足3年'}</small></td>
            <td><RiskNumber value={performance[f.code]?.risk3y.sharpe} kind="sharpe"/><small>年化·无风险利率按0%</small></td>
            <td><strong className={f.total<=.70?'low-fee':''}>{f.total.toFixed(2)}%</strong><small>{f.management.toFixed(2)} + {f.custody.toFixed(2)} + {f.service.toFixed(2)}</small></td>
            {view==='场外基金' && <>
              <td><strong>{displayTrackingError(f)}</strong><small>{f.structure === '主动型' ? '主动基金不适用' : (f.trackingError && f.trackingError !== '待更新' ? '真实已录入' : '等待真实数据')}</small></td>
              {(() => { const override = limitOverrides[`${f.code}::${f.share}`]; return <>
                <td><strong>{override?.distributor_limit ?? f.alipay ?? '待更新'}</strong><small>{override?.updated_at ?? f.updated}</small></td>
                <td><strong>{override?.direct_limit ?? f.direct ?? '待更新'}</strong><small>{override?.updated_at ?? f.updated}</small></td>
              </>; })()}
            </>}
            <td><button className={`holdings-toggle${expandedHolding===f.code?' active':''}`} onClick={()=>void toggleHoldings(f.code)}>{expandedHolding===f.code?'收起':'查看持仓'}</button></td>
          </tr>
          {expandedHolding===f.code && <tr className="holdings-row"><td colSpan={view==='场外基金' ? 19 : 16}>
            <div className="holdings-panel">
              <div className="holdings-head"><div><strong>前十大持仓</strong><small>{holdings[f.code]?.disclosureDate ? `披露日期：${holdings[f.code].disclosureDate}` : '读取最新公开披露'}</small></div><span>{holdings[f.code]?.source ?? 'Eastmoney / 天天基金公开持仓'}</span></div>
              {holdingLoading===f.code ? <div className="holdings-state">正在读取最新公开持仓…</div> :
               holdings[f.code]?.holdings?.length ? <div className="holdings-grid">{holdings[f.code].holdings.map((h,index)=><div className="holding-card" key={h.code+h.name+index}><b>{index+1}</b><div><strong>{h.name}</strong><small>{h.code || '—'}</small></div><em>{h.weight == null ? '—' : `${h.weight.toFixed(2)}%`}</em></div>)}</div> :
               <div className="holdings-state">暂无可用的最新公开前十大持仓数据。</div>}
            </div>
          </td></tr>}
          </Fragment>)}</tbody>
        </table>
      </div>
      <div className="qdii-risk-note"><strong>风险指标说明</strong><span><b>最大回撤：</b>近3年内从某个历史高点跌到随后最低点的最大跌幅，越接近0通常代表下行更温和。</span><span><b>修复时长：</b>从最大回撤谷底开始，到净值重新回到回撤前高点所需的自然日；若仍未回到前高，则显示“尚未修复”并统计至最新净值日。</span><span><b>夏普比率：</b>衡量每承担1单位波动获得多少风险调整后收益；数值越高通常越好。这里统一使用近3年日频净值、252交易日年化，并将无风险利率设为0%以便横向比较。</span></div>
      <footer className="qdii-note">YTD/1Y/3Y/5Y 读取公开阶段收益数据，为严格对应区间的累计收益；成立时间不足对应区间时直接显示“不适用”，不会使用较短历史代替。指数型场外基金默认隐藏 C 类份额，以减少重复并突出长期持有常用的 A/E/I 份额。跟踪误差仅显示真实已录入数据；未录入的指数基金显示“待补充”，不再使用任何估算值。最大回撤、修复时长与夏普比率统一采用近3年净值序列，历史不足3年显示“不适用”。限额以实际销售渠道下单页为准；费率为固定运作费口径（管理费 + 托管费 + 销售服务费），不含一次性申购/赎回费用。</footer>
    </section>
  </Root>;
}
