export default function LegalDisclaimer() {
  return (
    <footer className="legal-disclaimer" aria-label="Disclaimer">
      <div className="legal-disclaimer__eyebrow">
        <span>个人项目 · 金融数据可视化</span>
        <small>Personal project · Financial data visualization · Not an investment advisory service</small>
      </div>

      <div className="legal-disclaimer__copy">
        <p>
          Longview Terminal 为个人开发的金融市场数据可视化与技术演示项目，仅供信息展示、学习研究及作品展示使用。
          本站内容不构成任何证券、基金、期货、数字资产或其他金融产品的投资建议、投资咨询、交易建议、收益承诺或招揽。
          市场数据来自第三方数据服务及公开信息，可能存在延迟、遗漏或误差，请以相关交易所、发行人及官方数据源为准。
          历史表现不代表未来收益；模拟与回测结果仅供说明。
        </p>
        <p>
          Longview Terminal is a personal financial-data visualization and software demonstration project.
          Nothing on this site constitutes investment advice, securities advisory services, a recommendation, solicitation,
          trading instruction, or guarantee of returns. Third-party market data may be delayed, incomplete, or inaccurate;
          verify material information against official sources. Past performance does not guarantee future results, and
          simulations or backtests are illustrative only.
        </p>
      </div>

      <div className="legal-disclaimer__meta">
        <span>Data sources vary by instrument and may include Alpaca, U.S. Treasury, FRED, Yahoo Finance and Tencent.</span>
        <span>Charts powered by TradingView Lightweight Charts</span>
      </div>
    </footer>
  );
}
