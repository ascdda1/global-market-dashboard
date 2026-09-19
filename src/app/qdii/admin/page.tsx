import './admin.css';
import QdiiAdminClient from './qdii-admin-client';

export const metadata = {
  title: 'QDII 限额管理 | Longview Terminal',
  robots: { index: false, follow: false },
};

export default function QdiiAdminPage() {
  return <QdiiAdminClient />;
}
