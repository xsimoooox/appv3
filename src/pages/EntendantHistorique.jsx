import HistoryPage from '../components/HistoryPage';

export default function EntendantHistorique() {
  return (
    <HistoryPage
      backPath="/entendant/contacts"
      subtitle="Historique entendant"
      sessionFilter={(session) => session.role === 'hearing' || session.type === 'qr_joined' || !session.type}
    />
  );
}
