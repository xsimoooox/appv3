import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Copy,
  Download,
  FileText,
  Filter,
  Heart,
  History,
  Mic2,
  MoreVertical,
  Play,
  Search,
  Sparkles,
  Trash2,
  ToggleRight,
  X,
  Zap,
} from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';

const DATE_FILTERS = [
  { id: 'all', label: 'Toutes' },
  { id: 'today', label: 'Aujourd’hui' },
  { id: 'yesterday', label: 'Hier' },
  { id: '7days', label: '7 derniers jours' },
  { id: '30days', label: '30 derniers jours' },
  { id: 'custom', label: 'Personnalisé' },
];

const TYPE_FILTERS = [
  { id: 'all', label: 'Tous' },
  { id: 'voice', label: 'Commandes vocales' },
  { id: 'transcription', label: 'Transcriptions' },
  { id: 'ia', label: 'Conversations IA' },
  { id: 'task', label: 'Tâches exécutées' },
];

const STATUS_FILTERS = [
  { id: 'all', label: 'Tous' },
  { id: 'success', label: 'Réussi' },
  { id: 'failed', label: 'Échoué' },
  { id: 'pending', label: 'En attente' },
];

const STATUS_META = {
  success: { label: '✓ Réussi', classes: 'bg-emerald-100 text-emerald-700' },
  failed: { label: '✗ Échoué', classes: 'bg-rose-100 text-rose-700' },
  pending: { label: '⏳ En cours', classes: 'bg-amber-100 text-amber-700' },
};

const TYPE_META = {
  voice: { icon: Mic2, label: 'Commandes vocales', color: 'bg-[#F0F4FF] text-[#1E40AF]' },
  transcription: { icon: FileText, label: 'Transcriptions', color: 'bg-[#EFF6FF] text-[#2563EB]' },
  ia: { icon: Zap, label: 'Conversations IA', color: 'bg-[#F3F4F6] text-[#3F3F46]' },
  task: { icon: Sparkles, label: 'Tâches exécutées', color: 'bg-[#ECFDF5] text-[#166534]' },
};

function isSameDay(dateA, dateB) {
  const a = new Date(dateA);
  const b = new Date(dateB);
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function isYesterday(date) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return isSameDay(date, yesterday);
}

function isThisWeek(date) {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  return diff <= 7 * 24 * 60 * 60 * 1000 && diff > 24 * 60 * 60 * 1000 && !isYesterday(date);
}

function groupLabelForDate(date) {
  if (isSameDay(date, new Date())) return 'Aujourd’hui';
  if (isYesterday(date)) return 'Hier';
  if (isThisWeek(date)) return 'Cette semaine';
  return 'Plus ancien';
}

function formatTimestamp(date) {
  const now = new Date();
  if (isSameDay(date, now)) {
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function toDurationLabel(seconds) {
  if (!seconds && seconds !== 0) return '—';
  if (seconds >= 60) {
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return `${minutes} min${rest ? ` ${rest} sec` : ''}`;
  }
  return `${seconds} sec`;
}

function safeText(value) {
  return typeof value === 'string' ? value : '';
}

function parseSession(session) {
  const timestamp = session.startTime
    ? new Date(session.startTime)
    : session.endTime
      ? new Date(session.endTime)
      : new Date();

  const messages = Array.isArray(session.messages) ? session.messages : [];
  const firstMessage = messages.find((message) => typeof message.content === 'string');
  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
  const voiceMessage = messages.find((message) => message.type === 'voice');
  const signMessage = messages.find((message) => message.type === 'sign');

  let typeKey = 'ia';
  if (voiceMessage) typeKey = 'voice';
  else if (signMessage) typeKey = 'transcription';
  else if (session.type === 'task') typeKey = 'task';

  const title = session.contactName || session.partnerName || TYPE_META[typeKey].label || 'Historique';
  const text = safeText(firstMessage?.content) || session.note || session.contactName || 'Commande ou conversation enregistrée';
  const result = safeText(lastMessage?.content) || 'Aperçu non disponible';
  const durationLabel = toDurationLabel(session.duration || session.durationSec || 0);
  const timeLabel = formatTimestamp(timestamp);
  const statusKey = session.status || (messages.length === 0 ? 'pending' : 'success');
  const status = STATUS_META[statusKey] ? STATUS_META[statusKey].label : STATUS_META.success.label;
  const audioAvailable = Boolean(voiceMessage || session.type === 'qr_code' || session.type === 'qr_joined');

  return {
    id: session.id || `${timestamp.getTime()}-${Math.random()}`,
    title,
    typeKey,
    typeLabel: TYPE_META[typeKey].label,
    statusKey: STATUS_META[statusKey] ? statusKey : 'success',
    statusLabel: status,
    text,
    result,
    timestamp,
    timeLabel,
    durationLabel,
    audioAvailable,
    metadata: {
      Date: timestamp.toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' }),
      Durée: durationLabel,
      Langue: session.language || 'Français',
      Appareil: session.device || 'Appareil inconnu',
      Source: session.type || 'Historique local',
    },
    raw: session,
  };
}

function generateCsv(entries) {
  const header = ['Titre', 'Type', 'Statut', 'Horodatage', 'Durée', 'Texte', 'Aperçu'];
  const rows = entries.map((entry) => [
    entry.title,
    entry.typeLabel,
    entry.statusLabel,
    entry.timestamp.toLocaleString('fr-FR'),
    entry.durationLabel,
    entry.text,
    entry.result,
  ]);
  const escape = (value) => {
    const text = String(value || '');
    return `"${text.replace(/"/g, '""')}"`;
  };
  return [header, ...rows].map((row) => row.map(escape).join(';')).join('\r\n');
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function HistoryPage({ backPath = '/contacts', subtitle = 'Toutes vos sessions et commandes', sessionFilter = null }) {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [dateFilter, setDateFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [itemMenuOpen, setItemMenuOpen] = useState(null);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [historyEnabled, setHistoryEnabled] = useState(() => localStorage.getItem('historyRecordingEnabled') !== 'false');
  const [confirmAction, setConfirmAction] = useState(null);
  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('historyFavorites') || '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('sessions') || '[]');
      const normalized = Array.isArray(saved) ? saved : [];
      const filtered = sessionFilter ? normalized.filter(sessionFilter) : normalized;
      setSessions(filtered.reverse());
    } catch {
      setSessions([]);
    }
  }, [sessionFilter]);

  const entries = useMemo(
    () => sessions.map(parseSession).sort((a, b) => b.timestamp - a.timestamp),
    [sessions],
  );

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const query = search.trim().toLowerCase();
      if (query) {
        const source = `${entry.title} ${entry.text} ${entry.result}`.toLowerCase();
        if (!source.includes(query)) return false;
      }

      if (typeFilter !== 'all' && entry.typeKey !== typeFilter) return false;
      if (statusFilter !== 'all' && entry.statusKey !== statusFilter) return false;

      if (dateFilter !== 'all') {
        const now = new Date();
        const diffDays = Math.floor((now - entry.timestamp) / (1000 * 60 * 60 * 24));
        if (dateFilter === 'today' && !isSameDay(entry.timestamp, now)) return false;
        if (dateFilter === 'yesterday' && !isYesterday(entry.timestamp)) return false;
        if (dateFilter === '7days' && diffDays > 7) return false;
        if (dateFilter === '30days' && diffDays > 30) return false;
        if (dateFilter === 'custom') {
          if (customFrom) {
            const fromDate = new Date(customFrom);
            fromDate.setHours(0, 0, 0, 0);
            if (entry.timestamp < fromDate) return false;
          }
          if (customTo) {
            const toDate = new Date(customTo);
            toDate.setHours(23, 59, 59, 999);
            if (entry.timestamp > toDate) return false;
          }
        }
      }

      return true;
    });
  }, [entries, search, typeFilter, statusFilter, dateFilter, customFrom, customTo]);

  const groupedEntries = useMemo(() => {
    return filteredEntries.reduce((groups, entry) => {
      const label = groupLabelForDate(entry.timestamp);
      if (!groups[label]) groups[label] = [];
      groups[label].push(entry);
      return groups;
    }, {});
  }, [filteredEntries]);

  const groupOrder = ['Aujourd’hui', 'Hier', 'Cette semaine', 'Plus ancien'];
  const orderedGroups = groupOrder.filter((label) => groupedEntries[label]);

  const [collapsedGroups, setCollapsedGroups] = useState({});

  const toggleGroup = (label) => {
    setCollapsedGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const resetFilters = () => {
    setSearch('');
    setDateFilter('all');
    setTypeFilter('all');
    setStatusFilter('all');
    setCustomFrom('');
    setCustomTo('');
  };

  const handleDeleteEntry = (id) => {
    const updated = sessions.filter((session) => session.id !== id);
    localStorage.setItem('sessions', JSON.stringify(updated));
    setSessions(updated);
    setItemMenuOpen(null);
  };

  const handleToggleFavorite = (id) => {
    const next = favorites.includes(id)
      ? favorites.filter((fav) => fav !== id)
      : [...favorites, id];
    setFavorites(next);
    localStorage.setItem('historyFavorites', JSON.stringify(next));
    setItemMenuOpen(null);
  };

  const handleExport = (format) => {
    if (!entries.length) return;
    if (format === 'json') {
      downloadFile(
        'historique.json',
        JSON.stringify(
          entries.map((entry) => ({
            titre: entry.title,
            type: entry.typeLabel,
            statut: entry.statusLabel,
            horodatage: entry.timestamp.toLocaleString('fr-FR'),
            duree: entry.durationLabel,
            texte: entry.text,
            apercu: entry.result,
          })),
          null,
          2,
        ),
        'application/json',
      );
      setMenuOpen(false);
      return;
    }
    if (format === 'csv') {
      downloadFile('historique.csv', generateCsv(entries), 'text/csv;charset=utf-8;');
      setMenuOpen(false);
      return;
    }
    if (format === 'pdf') {
      window.print();
      setMenuOpen(false);
      return;
    }
  };

  const handleClearAll = () => {
    if (!sessions.length) return;
    setConfirmAction({ type: 'all' });
    setMenuOpen(false);
  };

  const confirmDeletion = () => {
    if (confirmAction?.type === 'all') {
      localStorage.removeItem('sessions');
      setSessions([]);
    }
    setConfirmAction(null);
  };

  const handleCopyText = async (entry) => {
    try {
      await navigator.clipboard.writeText(entry.text);
    } catch {
      /* ignore */
    }
    setItemMenuOpen(null);
  };

  const openDetail = (entry) => {
    setSelectedEntry(entry);
    setShowFilters(false);
  };

  const handleToggleRecording = () => {
    const next = !historyEnabled;
    setHistoryEnabled(next);
    localStorage.setItem('historyRecordingEnabled', next ? 'true' : 'false');
  };

  const itemGroups = orderedGroups.map((groupLabel) => ({
    label: groupLabel,
    items: groupedEntries[groupLabel],
  }));

  const hasRawSessions = sessions.length > 0;
  const showNoResults = hasRawSessions && filteredEntries.length === 0;

  return (
    <div className="w-full max-w-md mx-auto min-h-screen bg-[#F0F0F0] px-4 pt-4 pb-[92px] text-slate-950">
      <div className="flex items-center justify-between gap-3 mb-4">
        <button
          type="button"
          onClick={() => navigate(backPath)}
          className="w-10 h-10 rounded-2xl border border-slate-200 bg-white text-slate-700 flex items-center justify-center shadow-sm"
          aria-label="Retour"
        >
          <ArrowLeft size={18} />
        </button>

        <div className="flex-1 min-w-0">
          <h1 className="text-[15px] font-extrabold">Historique</h1>
          <p className="text-[11px] text-slate-500 mt-1 leading-tight">{subtitle}</p>
        </div>

        <div className="flex gap-2 items-center relative">
          <button
            type="button"
            onClick={() => setShowFilters((prev) => !prev)}
            className="w-10 h-10 rounded-2xl border border-slate-200 bg-white text-slate-700 flex items-center justify-center shadow-sm"
            aria-label="Ouvrir les filtres"
          >
            <Filter size={18} />
          </button>

          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="w-10 h-10 rounded-2xl border border-slate-200 bg-white text-slate-700 flex items-center justify-center shadow-sm"
            aria-label="Options"
          >
            <MoreVertical size={18} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-52 rounded-[24px] border border-slate-200 bg-white shadow-lg ring-1 ring-slate-900/5 z-20 overflow-hidden">
              <button
                type="button"
                onClick={() => handleExport('json')}
                className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
              >
                <Download size={16} /> Exporter JSON
              </button>
              <button
                type="button"
                onClick={() => handleExport('csv')}
                className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
              >
                <FileText size={16} /> Exporter CSV
              </button>
              <button
                type="button"
                onClick={() => handleExport('pdf')}
                className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
              >
                <History size={16} /> Exporter PDF
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <Trash2 size={16} /> Tout effacer
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="relative mb-4">
        <div className="relative rounded-[24px] bg-white border border-slate-200 shadow-sm overflow-hidden flex items-center">
          <div className="pointer-events-none absolute left-4 text-slate-400">
            <Search size={16} />
          </div>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher par mot-clé"
            className="w-full rounded-[24px] border-none bg-transparent py-3 pl-11 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
        </div>
      </div>

      <div className="mb-4 rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleExport('json')}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#0000B4] px-3 py-2 text-xs font-semibold text-white shadow-sm"
            >
              <Download size={14} /> Exporter
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700"
            >
              <Trash2 size={14} /> Effacer tout
            </button>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
            <ToggleRight size={16} className={historyEnabled ? 'text-[#0000B4]' : 'text-slate-500'} />
            <span>{historyEnabled ? 'Historique activé' : 'Historique désactivé'}</span>
          </div>
        </div>
      </div>

      <div className={`mb-4 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm transition-all ${showFilters ? 'max-h-[520px] py-4' : 'max-h-0 py-0'}`}>
        {showFilters && (
          <div className="space-y-4 px-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400 mb-3">Par date</p>
              <div className="flex flex-wrap gap-2">
                {DATE_FILTERS.map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setDateFilter(filter.id)}
                    className={`rounded-full px-3 py-2 text-[11px] font-semibold ${dateFilter === filter.id ? 'bg-[#0000B4] text-white' : 'bg-slate-100 text-slate-700'}`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
              {dateFilter === 'custom' && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col text-[11px] text-slate-500">
                    Du
                    <input
                      type="date"
                      value={customFrom}
                      onChange={(event) => setCustomFrom(event.target.value)}
                      className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900"
                    />
                  </label>
                  <label className="flex flex-col text-[11px] text-slate-500">
                    Au
                    <input
                      type="date"
                      value={customTo}
                      onChange={(event) => setCustomTo(event.target.value)}
                      className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900"
                    />
                  </label>
                </div>
              )}
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400 mb-3">Par type</p>
              <div className="flex flex-wrap gap-2">
                {TYPE_FILTERS.map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setTypeFilter(filter.id)}
                    className={`rounded-full px-3 py-2 text-[11px] font-semibold ${typeFilter === filter.id ? 'bg-[#0000B4] text-white' : 'bg-slate-100 text-slate-700'}`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400 mb-3">Par statut</p>
              <div className="flex flex-wrap gap-2">
                {STATUS_FILTERS.map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setStatusFilter(filter.id)}
                    className={`rounded-full px-3 py-2 text-[11px] font-semibold ${statusFilter === filter.id ? 'bg-[#0000B4] text-white' : 'bg-slate-100 text-slate-700'}`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={resetFilters}
                className="rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-[12px] font-semibold text-slate-700"
              >
                Réinitialiser les filtres
              </button>
            </div>
          </div>
        )}
      </div>

      {showNoResults ? (
        <div className="rounded-[28px] border border-slate-200 bg-white p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-[#eef2ff] text-[#1e40af]">
            <Search size={24} />
          </div>
          <p className="text-sm font-semibold text-slate-900">Aucun résultat trouvé pour « {search} »</p>
          <p className="mt-2 text-xs text-slate-500">Essayez un autre mot-clé ou réinitialisez les filtres.</p>
        </div>
      ) : !hasRawSessions ? (
        <div className="rounded-[28px] border border-slate-200 bg-white p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-[#f3f4f6] text-[#52525b]">
            <History size={24} />
          </div>
          <h2 className="text-base font-extrabold text-slate-900">Aucun historique pour le moment</h2>
          <p className="mt-2 text-sm text-slate-500">Vos conversations et commandes sauvegardées s’afficheront ici.</p>
          <button
            type="button"
            onClick={() => navigate(backPath)}
            className="mt-6 inline-flex items-center justify-center rounded-full bg-[#0000B4] px-4 py-3 text-sm font-semibold text-white shadow-sm"
          >
            Commencer une conversation
          </button>
        </div>
      ) : (
        <div className="space-y-5 pb-8">
          {itemGroups.map((group) => (
            <section key={group.label} className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
              <button
                type="button"
                onClick={() => toggleGroup(group.label)}
                className="flex w-full items-center justify-between gap-3 text-left text-sm font-semibold text-slate-900"
              >
                <span>{group.label}</span>
                <span className="inline-flex items-center gap-2 text-slate-500">
                  {group.items.length} éléments
                  <ChevronDown size={16} className={`${collapsedGroups[group.label] ? 'rotate-180' : 'rotate-0'} transition-transform`} />
                </span>
              </button>

              {!collapsedGroups[group.label] && (
                <div className="mt-4 space-y-3">
                  {group.items.map((entry) => {
                    const Icon = TYPE_META[entry.typeKey]?.icon || FileText;
                    return (
                      <div
                        key={entry.id}
                        className="group relative overflow-hidden rounded-[24px] border border-slate-200 bg-[#fcfcfd] p-4 shadow-sm transition hover:shadow-md"
                        onClick={() => openDetail(entry)}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`flex h-12 w-12 items-center justify-center rounded-3xl ${TYPE_META[entry.typeKey]?.color || 'bg-slate-100 text-slate-700'}`}>
                            <Icon size={20} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <p className="max-w-[70%] text-sm font-semibold text-slate-950 truncate">{entry.title}</p>
                              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold ${STATUS_META[entry.statusKey].classes}`}>
                                {entry.statusLabel}
                              </span>
                            </div>
                            <p className="mt-2 text-[12px] leading-tight text-slate-600 line-clamp-2">{entry.text}</p>
                            <p className="mt-2 text-[11px] text-slate-500">{entry.result}</p>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="inline-flex items-center gap-1">
                              <Calendar size={14} /> {entry.timeLabel}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <CheckCircle2 size={14} /> {entry.durationLabel}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {entry.audioAvailable && (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                }}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 transition hover:bg-slate-200"
                                aria-label="Réécouter"
                              >
                                <Play size={16} />
                              </button>
                            )}

                            <div className="relative">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setItemMenuOpen((prev) => (prev === entry.id ? null : entry.id));
                                }}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 transition hover:bg-slate-200"
                                aria-label="Ouvrir les actions"
                              >
                                <MoreVertical size={16} />
                              </button>

                              {itemMenuOpen === entry.id && (
                                <div className="absolute right-0 top-full z-10 mt-2 w-48 rounded-[24px] border border-slate-200 bg-white p-2 shadow-lg">
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setSelectedEntry(entry);
                                      setItemMenuOpen(null);
                                    }}
                                    className="w-full rounded-[20px] px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                                  >
                                    Rejouer
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleCopyText(entry);
                                    }}
                                    className="w-full rounded-[20px] px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                                  >
                                    <span className="inline-flex items-center gap-2"><Copy size={14} /> Copier le texte</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setItemMenuOpen(null);
                                    }}
                                    className="w-full rounded-[20px] px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                                  >
                                    Refaire la commande
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleDeleteEntry(entry.id);
                                    }}
                                    className="w-full rounded-[20px] px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
                                  >
                                    Supprimer
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleToggleFavorite(entry.id);
                                    }}
                                    className="w-full rounded-[20px] px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                                  >
                                    {favorites.includes(entry.id) ? 'Retirer des favoris' : 'Marquer comme favori'}
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      {selectedEntry && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 px-4 py-6 backdrop-blur-sm">
          <div className="mx-auto max-w-2xl overflow-hidden rounded-[32px] bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">Détail de l’entrée</p>
                <h2 className="mt-2 text-lg font-extrabold text-slate-950">{selectedEntry.title}</h2>
                <p className="mt-1 text-sm text-slate-500">{selectedEntry.typeLabel} • {selectedEntry.timeLabel}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEntry(null)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700"
                aria-label="Fermer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-5 px-5 py-5">
              <div className="space-y-3 rounded-[28px] border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Transcription complète</p>
                <p className="text-sm leading-6 text-slate-800">{selectedEntry.text}</p>
              </div>

              <div className="space-y-3 rounded-[28px] border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Réponse complète</p>
                <p className="text-sm leading-6 text-slate-800">{selectedEntry.result}</p>
              </div>

              <div className="space-y-3 rounded-[28px] border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Lecteur audio</p>
                    <p className="mt-2 text-sm text-slate-700">{selectedEntry.audioAvailable ? 'Enregistrement disponible' : 'Aucun audio enregistré'}</p>
                  </div>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-full bg-[#0000B4] px-3 py-2 text-sm font-semibold text-white"
                  >
                    <Play size={14} /> Rejouer
                  </button>
                </div>
                <div className="rounded-3xl bg-slate-200 p-3">
                  <div className="h-2 overflow-hidden rounded-full bg-slate-300">
                    <div className="h-full w-3/4 rounded-full bg-[#0000B4]" />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                    <span>Waveform</span>
                    <span>{selectedEntry.durationLabel}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {Object.entries(selectedEntry.metadata).map(([label, value]) => (
                  <div key={label} className="rounded-[24px] border border-slate-200 bg-white p-3 text-sm">
                    <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400">{label}</p>
                    <p className="mt-2 text-sm text-slate-700">{value}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedEntry(null)}
                  className="inline-flex items-center gap-2 rounded-full bg-[#0000B4] px-4 py-3 text-sm font-semibold text-white"
                >
                  <Play size={16} /> Rejouer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const csv = `Titre: ${selectedEntry.title}\nType: ${selectedEntry.typeLabel}\nStatut: ${selectedEntry.statusLabel}\nDate: ${selectedEntry.metadata.Date}\nDurée: ${selectedEntry.durationLabel}\n\n${selectedEntry.text}`;
                    downloadFile('historique-detail.txt', csv, 'text/plain;charset=utf-8;');
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
                >
                  <Download size={16} /> Télécharger l’audio
                </button>
                <button
                  type="button"
                  onClick={() => handleCopyText(selectedEntry)}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
                >
                  <Copy size={16} /> Copier le texte
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmAction({ type: 'delete', id: selectedEntry.id });
                  }}
                  className="inline-flex items-center gap-2 rounded-full bg-rose-100 px-4 py-3 text-sm font-semibold text-rose-700"
                >
                  <Trash2 size={16} /> Supprimer
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
                >
                  <Heart size={16} /> Signaler un problème
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={confirmAction?.type === 'all' ? 'Effacer tout l’historique ?' : 'Supprimer cette entrée ?'}
        message={confirmAction?.type === 'all'
          ? 'Toutes les entrées sauvegardées seront supprimées définitivement.'
          : 'Cette entrée sera retirée définitivement de votre historique.'}
        confirmLabel={confirmAction?.type === 'all' ? 'Tout effacer' : 'Supprimer'}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => {
          if (confirmAction?.type === 'delete') {
            handleDeleteEntry(confirmAction.id);
            setSelectedEntry(null);
          } else {
            confirmDeletion();
          }
        }}
      />
    </div>
  );
}

export default HistoryPage;
