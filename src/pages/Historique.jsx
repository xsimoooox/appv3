import HistoryPage from '../components/HistoryPage';

export default function Historique() {
  return (
    <HistoryPage
      backPath="/contacts"
      subtitle="Historique sourde"
      sessionFilter={(session) => session.type !== 'qr_joined' || session.role !== 'hearing'}
    />
  );
}
