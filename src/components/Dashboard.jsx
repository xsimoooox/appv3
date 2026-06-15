import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  CirclePlus,
  Clock3,
  Download,
  Edit3,
  Eye,
  Info,
  LogOut,
  Menu,
  Phone,
  RefreshCw,
  Settings,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react';
import BrandLogo from './BrandLogo';
import { useCallSystemContext } from '../context/CallSystemContext';
import { getVoxManusUser } from '../lib/voxmanusUser';
import { performLogout } from '../lib/logoutSession';

const notificationStyles = {
  success: { icon: CheckCircle2, className: 'vox-notice--success' },
  error: { icon: AlertCircle, className: 'vox-notice--error' },
  info: { icon: Info, className: 'vox-notice--info' },
  warning: { icon: AlertCircle, className: 'vox-notice--warning' },
};

function readList(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function formatDate(value) {
  if (!value) return 'Aujourd’hui';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function ToastStack({ notifications, onDismiss }) {
  return (
    <div className="vox-toast-stack" aria-live="polite" aria-label="Notifications">
      {notifications.map((notice) => {
        const config = notificationStyles[notice.type] || notificationStyles.info;
        const Icon = config.icon;
        return (
          <div key={notice.id} className={`vox-toast ${config.className}`} role="status">
            <Icon size={19} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <strong>{notice.title}</strong>
              {notice.message && <span>{notice.message}</span>}
            </div>
            <button type="button" onClick={() => onDismiss(notice.id)} aria-label="Fermer la notification">
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function StatusBadge({ status }) {
  const normalized = String(status || 'completed').toLowerCase();
  const classes = normalized.includes('fail') || normalized.includes('error')
    ? 'vox-status vox-status--error'
    : normalized.includes('pend') || normalized.includes('attente')
      ? 'vox-status vox-status--pending'
      : normalized.includes('inactive')
        ? 'vox-status vox-status--neutral'
        : 'vox-status vox-status--success';
  const label = normalized.includes('fail') || normalized.includes('error')
    ? 'Échec'
    : normalized.includes('pend') || normalized.includes('attente')
      ? 'En attente'
      : normalized.includes('inactive')
        ? 'Inactif'
        : 'Terminé';
  return <span className={classes}>{label}</span>;
}

export default function Dashboard({ role = 'deaf' }) {
  const navigate = useNavigate();
  const { onlineContacts, disconnectSocket } = useCallSystemContext();
  const [user, setUser] = useState(() => getVoxManusUser());
  const [contacts, setContacts] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [notices, setNotices] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(5);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [editName, setEditName] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const homePrefix = role === 'hearing' ? '/entendant' : '';
  const settingsPath = `${homePrefix}/parametres`;
  const contactsPath = `${homePrefix}/contacts`;
  const historyPath = `${homePrefix}/historique`;
  const rencontrePath = `${homePrefix}/rencontre`;

  const pushNotice = useCallback((title, type = 'info', message = '') => {
    const id = `${Date.now()}-${Math.random()}`;
    const notice = { id, title, message, type, time: 'À l’instant', unread: true };
    setNotices((current) => [notice, ...current].slice(0, 12));
    setToasts((current) => [...current, notice].slice(-4));
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 4500);
  }, []);

  const loadData = useCallback((showFeedback = false) => {
    setContacts(readList('voxmanus_contacts'));
    setSessions(readList('sessions').reverse());
    setUser(getVoxManusUser());
    setLoading(false);
    if (showFeedback) pushNotice('Données actualisées', 'success', 'Les informations les plus récentes sont affichées.');
  }, [pushNotice]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadData();
      pushNotice('Données chargées', 'info', 'Votre espace VoxManus est prêt.');
    }, 500);
    const onStorage = () => loadData();
    const onAppNotice = (event) => {
      const detail = event.detail || {};
      pushNotice(detail.title || 'Nouvelle donnée reçue', detail.type || 'info', detail.message || '');
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('voxmanus-user-changed', onStorage);
    window.addEventListener('voxmanus-notification', onAppNotice);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('voxmanus-user-changed', onStorage);
      window.removeEventListener('voxmanus-notification', onAppNotice);
    };
  }, [loadData, pushNotice]);

  const activityRows = useMemo(
    () => sessions.map((session, index) => ({
      ...session,
      id: session.id || `${session.startTime || 'session'}-${index}`,
      name: session.contactName || session.partnerName || (session.type?.includes('qr') ? 'Rencontre QR' : 'Session LSF'),
      dateLabel: session.date || formatDate(session.startTime),
      status: session.status || 'completed',
    })),
    [sessions],
  );

  const onlineCount = Object.values(onlineContacts || {}).filter((value) => value === 'online').length;
  const unreadCount = notices.filter((notice) => notice.unread).length;
  const completedCount = activityRows.filter((row) => !String(row.status).match(/pending|fail|error/i)).length;

  const stats = [
    { label: 'Contacts', value: contacts.length, icon: Users, tone: 'blue', detail: `${onlineCount} en ligne` },
    { label: 'Sessions', value: activityRows.length, icon: Activity, tone: 'orange', detail: 'Activité récente' },
    { label: 'Terminées', value: completedCount, icon: CheckCircle2, tone: 'green', detail: 'Sessions réussies' },
    { label: 'Alertes', value: unreadCount, icon: Bell, tone: 'red', detail: 'À consulter' },
  ];

  const markNoticeRead = (id) => {
    setNotices((current) => current.map((notice) => (
      notice.id === id ? { ...notice, unread: false } : notice
    )));
  };

  const dismissNotice = (id) => {
    setNotices((current) => current.filter((notice) => notice.id !== id));
    setToasts((current) => current.filter((notice) => notice.id !== id));
  };

  const refreshData = async () => {
    setRefreshing(true);
    await new Promise((resolve) => window.setTimeout(resolve, 500));
    loadData(true);
    setRefreshing(false);
  };

  const generateReport = () => {
    const payload = {
      generatedAt: new Date().toISOString(),
      user: { name: user?.name, phoneNumber: user?.phoneNumber, role: user?.role },
      stats: { contacts: contacts.length, sessions: activityRows.length, completed: completedCount },
      recentActivity: activityRows,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `voxmanus-report-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    pushNotice('Rapport généré', 'success', 'Le rapport a été téléchargé.');
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const updatedRows = activityRows.filter((row) => row.id !== deleteTarget.id);
    localStorage.setItem('sessions', JSON.stringify([...updatedRows].reverse()));
    setSessions(updatedRows);
    setDeleteTarget(null);
    pushNotice('Activité supprimée', 'success');
  };

  const saveEdit = () => {
    if (!editTarget || !editName.trim()) return;
    const updatedRows = activityRows.map((row) => (
      row.id === editTarget.id ? { ...row, contactName: editName.trim(), name: editName.trim() } : row
    ));
    localStorage.setItem('sessions', JSON.stringify([...updatedRows].reverse()));
    setSessions(updatedRows);
    setEditTarget(null);
    pushNotice('Activité mise à jour', 'success');
  };

  return (
    <div className="vox-dashboard">
      <ToastStack notifications={toasts} onDismiss={dismissNotice} />

      <header className="vox-topbar">
        <BrandLogo compact hideText />
        <div className="vox-topbar__title">
          <strong>Tableau de bord</strong>
          <span>{role === 'hearing' ? 'Espace personne entendante' : 'Espace communication LSF'}</span>
        </div>
        <div className="vox-topbar__actions">
          <button
            type="button"
            className="vox-icon-button"
            onClick={() => setNotices((current) => current.map((notice) => ({ ...notice, unread: false })))}
            aria-label={`${unreadCount} notifications non lues`}
          >
            <Bell size={20} />
            {unreadCount > 0 && <span className="vox-badge">{unreadCount}</span>}
          </button>
          <div className="relative">
            <button
              type="button"
              className="vox-profile-button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-label="Ouvrir le menu utilisateur"
            >
              <span>{user?.avatar ? <img src={user.avatar} alt="" /> : (user?.name || 'VM').slice(0, 2).toUpperCase()}</span>
              <ChevronDown size={15} />
            </button>
            {menuOpen && (
              <div className="vox-profile-menu">
                <button type="button" onClick={() => navigate(settingsPath)}><User size={16} /> Profil</button>
                <button type="button" onClick={() => navigate(settingsPath)}><Settings size={16} /> Paramètres</button>
                <button type="button" className="text-[#E53935]" onClick={() => performLogout(navigate, disconnectSocket)}><LogOut size={16} /> Déconnexion</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="vox-dashboard__main">
        <section className="vox-welcome">
          <div>
            <span className="vox-eyebrow">Votre espace VoxManus</span>
            <h1 className="text-white">Bienvenue, {user?.name?.split(' ')[0] || 'utilisateur'} !</h1>
            <p>Votre communication reste fluide, accessible et à portée de main.</p>
          </div>
          <div className="vox-welcome__graphic" aria-hidden="true">
            <img src="/voxmanus-logo.png" alt="" />
          </div>
        </section>

        <section aria-labelledby="overview-title">
          <div className="vox-section-heading">
            <div><span className="vox-eyebrow">Vue d’ensemble</span><h2 id="overview-title">Aujourd’hui</h2></div>
            <button type="button" className="vox-button vox-button--outline" onClick={refreshData} disabled={refreshing}>
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Actualisation…' : 'Actualiser'}
            </button>
          </div>
          <div className="vox-stats-grid">
            {loading ? [0, 1, 2, 3].map((item) => <div key={item} className="vox-stat-card vox-skeleton" />) : stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <article key={stat.label} className={`vox-stat-card vox-stat-card--${stat.tone}`}>
                  <span className="vox-stat-card__icon"><Icon size={21} /></span>
                  <strong>{stat.value}</strong>
                  <span>{stat.label}</span>
                  <small>{stat.detail}</small>
                </article>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="actions-title">
          <div className="vox-section-heading">
            <div><span className="vox-eyebrow">Raccourcis</span><h2 id="actions-title">Actions rapides</h2></div>
          </div>
          <div className="vox-quick-actions">
            <button type="button" className="vox-button vox-button--primary" onClick={() => navigate(`${contactsPath}/add`)}><CirclePlus size={17} /> Ajouter un contact</button>
            <button type="button" className="vox-button vox-button--blue" onClick={() => navigate(rencontrePath)}><Phone size={17} /> Nouvelle rencontre</button>
            <button type="button" className="vox-button vox-button--blue" onClick={generateReport}><Download size={17} /> Générer un rapport</button>
            <button type="button" className="vox-button vox-button--outline" onClick={() => navigate(historyPath)}><Eye size={17} /> Voir tout</button>
          </div>
        </section>

        <div className="vox-dashboard-grid">
          <section className="vox-panel" aria-labelledby="notifications-title">
            <div className="vox-panel__header">
              <div><span className="vox-eyebrow">Temps réel</span><h2 id="notifications-title">Notifications</h2></div>
              <span className="vox-count">{unreadCount}</span>
            </div>
            <div className="vox-notification-feed">
              {notices.length === 0 ? (
                <div className="vox-empty"><Bell size={24} /><strong>Aucune notification</strong><span>Les nouvelles alertes apparaîtront ici.</span></div>
              ) : notices.map((notice) => {
                const config = notificationStyles[notice.type] || notificationStyles.info;
                const Icon = config.icon;
                return (
                  <article key={notice.id} className={`vox-feed-item ${config.className} ${notice.unread ? 'is-unread' : ''}`}>
                    <Icon size={18} />
                    <div><strong>{notice.title}</strong><span>{notice.message || notice.time}</span></div>
                    <div className="vox-feed-item__actions">
                      {notice.unread && <button type="button" onClick={() => markNoticeRead(notice.id)} aria-label="Marquer comme lu"><Check size={15} /></button>}
                      <button type="button" onClick={() => dismissNotice(notice.id)} aria-label="Supprimer"><X size={15} /></button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="vox-panel vox-panel--activity" aria-labelledby="activity-title">
            <div className="vox-panel__header">
              <div><span className="vox-eyebrow">Historique</span><h2 id="activity-title">Activité récente</h2></div>
              <button type="button" className="vox-link-button" onClick={() => navigate(historyPath)}>Tout afficher</button>
            </div>
            {loading ? <div className="vox-table-skeleton vox-skeleton" /> : activityRows.length === 0 ? (
              <div className="vox-empty"><Clock3 size={24} /><strong>Aucune activité récente</strong><span>Vos appels et rencontres apparaîtront ici.</span></div>
            ) : (
              <>
                <div className="vox-table-wrap">
                  <table className="vox-table">
                    <thead><tr><th>Nom</th><th>Date</th><th>Statut</th><th aria-label="Actions" /></tr></thead>
                    <tbody>
                      {activityRows.slice(0, visibleCount).map((row) => (
                        <tr key={row.id}>
                          <td><strong>{row.name}</strong><span>{row.type || 'Communication LSF'}</span></td>
                          <td>{row.dateLabel}</td>
                          <td><StatusBadge status={row.status} /></td>
                          <td>
                            <div className="vox-row-actions">
                              <button type="button" onClick={() => navigate(historyPath)} aria-label={`Voir ${row.name}`}><Eye size={15} /></button>
                              <button type="button" onClick={() => { setEditTarget(row); setEditName(row.name); }} aria-label={`Modifier ${row.name}`}><Edit3 size={15} /></button>
                              <button type="button" className="is-danger" onClick={() => setDeleteTarget(row)} aria-label={`Supprimer ${row.name}`}><Trash2 size={15} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {visibleCount < activityRows.length && (
                  <button type="button" className="vox-button vox-button--outline w-full mt-3" onClick={() => setVisibleCount((count) => count + 5)}>
                    <Menu size={16} /> Charger plus
                  </button>
                )}
              </>
            )}
          </section>
        </div>
      </main>

      <footer className="vox-footer">
        <strong>VoxManus</strong>
        <span>Version 1.0.0</span>
        <span>© 2026 VoxManus. Tous droits réservés.</span>
        <div><button type="button" onClick={() => pushNotice('Centre d’aide', 'info', 'Le support VoxManus vous répondra bientôt.')}>Aide</button><button type="button" onClick={() => navigate(settingsPath)}>Confidentialité</button><button type="button" onClick={() => navigate(settingsPath)}>Conditions</button></div>
      </footer>

      {(deleteTarget || editTarget) && (
        <div className="vox-modal-backdrop" role="presentation">
          <div className="vox-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            {deleteTarget ? (
              <>
                <span className="vox-modal__danger-icon"><Trash2 size={22} /></span>
                <h2 id="modal-title">Supprimer cette activité ?</h2>
                <p>Cette action retirera « {deleteTarget.name} » de l’historique.</p>
                <div className="vox-modal__actions">
                  <button type="button" className="vox-button vox-button--outline" onClick={() => setDeleteTarget(null)}>Annuler</button>
                  <button type="button" className="vox-button vox-button--danger" onClick={confirmDelete}>Supprimer</button>
                </div>
              </>
            ) : (
              <>
                <h2 id="modal-title">Modifier l’activité</h2>
                <label className="vox-field"><span>Nom</span><input value={editName} onChange={(event) => setEditName(event.target.value)} autoFocus /></label>
                <div className="vox-modal__actions">
                  <button type="button" className="vox-button vox-button--outline" onClick={() => setEditTarget(null)}>Annuler</button>
                  <button type="button" className="vox-button vox-button--primary" disabled={!editName.trim()} onClick={saveEdit}>Enregistrer</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
