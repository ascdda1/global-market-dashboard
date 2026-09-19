import QdiiClient from './qdii-client';
import './qdii.css';

export const metadata = {
  title: 'QDII 场内/场外基金 | Longview Terminal',
  description: 'QDII基金费率、基准、跟踪误差与申购额度研究列表',
};

export default function QdiiPage() {
  return <QdiiClient />;
}
