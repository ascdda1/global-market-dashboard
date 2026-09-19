import { NextResponse } from 'next/server';

const funds = [
  {
    "name": "宝盈纳斯达克100指数A",
    "code": "019736",
    "share": "A"
  },
  {
    "name": "宝盈纳斯达克100指数C",
    "code": "019737",
    "share": "C"
  },
  {
    "name": "万家纳斯达克100指数A",
    "code": "019441",
    "share": "A"
  },
  {
    "name": "万家纳斯达克100指数C",
    "code": "019442",
    "share": "C"
  },
  {
    "name": "汇添富纳斯达克100ETF联接A",
    "code": "018966",
    "share": "A"
  },
  {
    "name": "汇添富纳斯达克100ETF联接E",
    "code": "021773",
    "share": "E"
  },
  {
    "name": "汇添富纳斯达克100ETF联接C",
    "code": "018967",
    "share": "C"
  },
  {
    "name": "南方纳斯达克100指数I",
    "code": "021000",
    "share": "I"
  },
  {
    "name": "国泰纳斯达克100指数",
    "code": "160213",
    "share": "A"
  },
  {
    "name": "建信纳斯达克100指数A",
    "code": "539001",
    "share": "A"
  },
  {
    "name": "景顺长城纳斯达克科技市值加权A",
    "code": "017091",
    "share": "A"
  },
  {
    "name": "景顺长城纳斯达克科技市值加权E",
    "code": "019118",
    "share": "E"
  },
  {
    "name": "景顺长城纳斯达克科技市值加权C",
    "code": "017093",
    "share": "C"
  },
  {
    "name": "摩根标普500指数A",
    "code": "017641",
    "share": "A"
  },
  {
    "name": "天弘标普500指数A",
    "code": "007721",
    "share": "A"
  },
  {
    "name": "大成标普500等权重指数A",
    "code": "096001",
    "share": "A"
  },
  {
    "name": "长信标普100等权重指数",
    "code": "519981",
    "share": "A"
  },
  {
    "name": "汇添富纳斯达克生物科技A",
    "code": "017894",
    "share": "A"
  },
  {
    "name": "华宝标普美国品质消费A",
    "code": "162415",
    "share": "A"
  },
  {
    "name": "景顺长城标普消费精选ETF",
    "code": "159529",
    "share": "ETF"
  },
  {
    "name": "嘉实美国成长股票A",
    "code": "000043",
    "share": "A"
  },
  {
    "name": "华夏纳斯达克100ETF",
    "code": "513300",
    "share": "ETF"
  },
  {
    "name": "广发纳斯达克100ETF",
    "code": "159941",
    "share": "ETF"
  },
  {
    "name": "嘉实纳斯达克100ETF",
    "code": "159501",
    "share": "ETF"
  },
  {
    "name": "易方达纳斯达克100ETF",
    "code": "159696",
    "share": "ETF"
  },
  {
    "name": "富国纳斯达克100ETF",
    "code": "513870",
    "share": "ETF"
  },
  {
    "name": "国泰标普500ETF",
    "code": "159612",
    "share": "ETF"
  },
  {
    "name": "华夏标普500ETF",
    "code": "159655",
    "share": "ETF"
  },
  {
    "name": "南方标普500ETF",
    "code": "513650",
    "share": "ETF"
  },
  {
    "name": "景顺长城全球半导体芯片股票A（QDII-LOF）",
    "code": "501225",
    "share": "LOF-A"
  },
  {
    "name": "大成纳斯达克100ETF联接A",
    "code": "000834",
    "share": "A"
  },
  {
    "name": "大成纳斯达克100ETF联接C",
    "code": "008971",
    "share": "C"
  },
  {
    "name": "广发纳斯达克100ETF联接A",
    "code": "270042",
    "share": "A"
  },
  {
    "name": "广发纳斯达克100ETF联接C",
    "code": "006479",
    "share": "C"
  },
  {
    "name": "华安纳斯达克100ETF联接A",
    "code": "040046",
    "share": "A"
  },
  {
    "name": "南方纳斯达克100指数A",
    "code": "016452",
    "share": "A"
  },
  {
    "name": "华夏纳斯达克100ETF联接A",
    "code": "015299",
    "share": "A"
  },
  {
    "name": "招商纳斯达克100ETF联接A",
    "code": "019547",
    "share": "A"
  },
  {
    "name": "易方达纳斯达克100ETF联接A",
    "code": "161130",
    "share": "A"
  },
  {
    "name": "嘉实纳斯达克100ETF联接A",
    "code": "016532",
    "share": "A"
  },
  {
    "name": "嘉实纳斯达克100ETF联接C",
    "code": "016533",
    "share": "C"
  },
  {
    "name": "嘉实纳斯达克100ETF联接I",
    "code": "021838",
    "share": "I"
  },
  {
    "name": "博时纳斯达克100ETF联接A",
    "code": "016055",
    "share": "A"
  },
  {
    "name": "景顺长城纳指科技ETF",
    "code": "159509",
    "share": "ETF"
  },
  {
    "name": "汇添富纳斯达克生物科技C",
    "code": "017895",
    "share": "C"
  },
  {
    "name": "汇添富纳指生物科技ETF",
    "code": "513290",
    "share": "ETF"
  },
  {
    "name": "广发生物科技指数A",
    "code": "001092",
    "share": "A"
  },
  {
    "name": "易方达标普生物科技A",
    "code": "161127",
    "share": "A"
  },
  {
    "name": "易方达标普信息科技A",
    "code": "161128",
    "share": "A"
  },
  {
    "name": "易方达标普500指数A",
    "code": "161125",
    "share": "A"
  }
] as const;

export async function GET() {
  return NextResponse.json({ funds });
}
