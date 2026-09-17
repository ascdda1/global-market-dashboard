import type { Metadata } from 'next';
import './globals.css';
import './bilingual.css';
import './dashboard-polish.css';

export const metadata: Metadata = {
  title: 'Global Markets | 全球市场看板',
  description: '全球主要市场行情与自动定投模拟看板',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
