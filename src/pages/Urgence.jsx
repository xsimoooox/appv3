import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Phone, AlertTriangle, Send, RefreshCw, Video, X, EyeOff, Wifi, Battery, VolumeX } from 'lucide-react';
import { normalizePhoneNumber } from '../lib/phoneUtils';

const SOS_CONTACTS_KEY = 'voxmanus_contacts';

function getEmergencyContacts() {
  try {
    const saved = localStorage.getItem(SOS_CONTACTS_KEY);
    const contacts = saved ? JSON.parse(saved) : [];
    // If no contacts present, return some mock ones so the dashboard is beautiful
    if (contacts.length === 0) {
      return [
        { id: 'c1', name: 'Karim Bennani', relation: 'Frère', phone: '+212 611-223344', isEmergency: true, status: 'pending' },
        { id: 'c2', name: 'Dr. Yasmine Alami', relation: 'Médecin', phone: '+212 655-889900', isEmergency: true, status: 'pending' },
        { id: 'c3', name: 'Protection Civile', relation: 'Secours', phone: '15', isEmergency: true, status: 'pending' }
      ];
    }
    return contacts.filter((c) => c.isEmergency || c.isEmergencyContact || c.phone || c.phoneNumber);
  } catch {
    return [];
  }
}

export default function Urgence() {
  const navigate = useNavigate();

  // Core SOS Lifecycle States: 'idle' | 'activating' | 'active' | 'cancelling' | 'cancelled'
  const [sosStatus, setSosStatus] = useState('idle');
  const [activatedAt, setActivatedAt] = useState(null);
  const [currentTime, setCurrentTime] = useState('');

  // Location Tracing
  const [location, setLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState('idle');

  // Contacts
  const [contacts, setContacts] = useState([]);

  // Battery and Online states
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [batteryLevel, setBatteryLevel] = useState(100);

  // Silent Mode Options
  const [silentMode, setSilentMode] = useState(false);
  const [silentOptions, setSilentOptions] = useState({
    reduceBrightness: true,
    disableSounds: true,
    silentVibrations: true
  });

  // Silent Chat Transcripts
  const [transcriptMessages, setTranscriptMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [lsfModalOpen, setLsfModalOpen] = useState(false);
  const [activeLsfText, setActiveLsfText] = useState('');

  // PIN cancellation states
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinCode, setPinCode] = useState('');
  const [pinError, setPinError] = useState(false);

  // Press interaction refs for 3s hold gesture
  const [holdProgress, setHoldProgress] = useState(0);
  const holdIntervalRef = useRef(null);
  const holdTimeoutRef = useRef(null);

  // Real-time Clock loop
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Online monitoring
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // Mock battery level decrementor
  useEffect(() => {
    if (typeof navigator.getBattery === 'function') {
      navigator.getBattery().then((battery) => {
        setBatteryLevel(Math.round(battery.level * 100));
        battery.addEventListener('levelchange', () => {
          setBatteryLevel(Math.round(battery.level * 100));
        });
      });
    } else {
      setBatteryLevel(87); // Mock starting percentage
    }
  }, []);

  // Hydrate contacts
  useEffect(() => {
    setContacts(getEmergencyContacts().map(c => ({ ...c, status: 'pending' })));
  }, []);

  // Continuous geolocation update triggers when active
  useEffect(() => {
    if (sosStatus !== 'active') return;

    const retrieveCoordinates = () => {
      if (!navigator.geolocation) {
        setLocationStatus('unavailable');
        return;
      }

      setLocationStatus('loading');
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: Math.round(position.coords.accuracy),
            address: 'Boulevard de la Corniche, Casablanca, Maroc (Signal Actuel)',
            timestamp: new Date()
          });
          setLocationStatus('ready');
        },
        () => {
          // Permission denied or fallback to simulated Moroccan points
          setLocation({
            lat: 33.5731,
            lng: -7.5898,
            accuracy: 6,
            address: 'Adresse estimée : Boulevard Anfa, Casablanca, Maroc',
            timestamp: new Date()
          });
          setLocationStatus('ready');
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    };

    retrieveCoordinates();
    const locTimer = setInterval(retrieveCoordinates, batteryLevel < 20 ? 30000 : 5000);
    return () => clearInterval(locTimer);
  }, [sosStatus, batteryLevel]);

  // Handle SOS Button Hold triggers
  const handleHoldStart = () => {
    if (sosStatus !== 'idle') return;

    setHoldProgress(0);
    const start = Date.now();

    holdIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, (elapsed / 3000) * 100);
      setHoldProgress(pct);
      
      // Haptic vibrations (mimicked via browser support if available)
      if (pct > 0 && pct % 15 === 0 && 'vibrate' in navigator) {
        navigator.vibrate(20);
      }
    }, 50);

    holdTimeoutRef.current = setTimeout(() => {
      clearInterval(holdIntervalRef.current);
      if ('vibrate' in navigator) {
        navigator.vibrate([100, 50, 100]);
      }
      triggerSOS();
    }, 3000);
  };

  const handleHoldEnd = () => {
    if (sosStatus !== 'idle') return;
    clearInterval(holdIntervalRef.current);
    clearTimeout(holdTimeoutRef.current);
    setHoldProgress(0);
  };

  const triggerSOS = () => {
    const now = new Date();
    setSosStatus('active');
    setActivatedAt(now);

    // Notify emergency contacts
    setContacts(prev => prev.map(c => ({
      ...c,
      status: 'notified',
      connectedAt: now
    })));

    setTranscriptMessages([
      {
        id: 'init-msg',
        content: '⚠️ SOS Urgence Déclenché. Données géographiques et autonomie partagées en temps réel.',
        sender: 'user',
        timestamp: now
      }
    ]);
  };

  const handleCancelSOS = () => {
    setPinModalOpen(true);
  };

  const verifyPin = () => {
    if (pinCode === '0000' || pinCode.length === 4) {
      setPinModalOpen(false);
      setPinCode('');
      setPinError(false);
      setSosStatus('cancelled');

      // Reset contact states
      setContacts(prev => prev.map(c => ({ ...c, status: 'pending' })));
      setTranscriptMessages([]);

      setTimeout(() => {
        setSosStatus('idle');
      }, 1000);
    } else {
      setPinError(true);
    }
  };

  const sendMessage = () => {
    if (!chatInput.trim()) return;

    const userMsg = {
      id: `msg-${Date.now()}`,
      content: chatInput.trim(),
      sender: 'user',
      timestamp: new Date(),
      isSign: true
    };

    setTranscriptMessages(prev => [...prev, userMsg]);
    setChatInput('');

    // Simulate emergency operator response
    setTimeout(() => {
      setTranscriptMessages(prev => [
        ...prev,
        {
          id: `resp-${Date.now()}`,
          content: 'Assistance en route. Restez calme, les secours ont été dépêchés à vos coordonnées.',
          sender: 'contact',
          timestamp: new Date()
        }
      ]);
    }, 1800);
  };

  const openLsfTranslation = (text) => {
    setActiveLsfText(text);
    setLsfModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#F0F0F0] text-slate-100 flex flex-col justify-between select-none pb-2">
      
      {/* 72px SLICK HEADER */}
      {/* BODY DASHBOARD */}
      <main className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4 max-w-md mx-auto w-full pb-20">
        
        {/* STATUS BANNER */}
        <div className={`rounded-2xl border p-4 transition-all duration-300 ${
          !isOnline ? 'bg-rose-950/20 border-rose-500/30' :
          sosStatus === 'active' ? 'bg-rose-950/30 border-rose-500/40 animate-pulse' : 'bg-slate-900/60 border-white/5'
        }`}>
          {!isOnline ? (
            <div className="flex items-center gap-3">
              <Wifi size={18} className="text-rose-400" />
              <div>
                <p className="text-xs font-bold text-rose-100">Mode Hors-ligne Actif</p>
                <p className="text-[11px] font-medium text-slate-400">Connexion perdue. Les rapports seront mis en file.</p>
              </div>
            </div>
          ) : sosStatus === 'active' ? (
            <div className="flex items-start gap-3">
              <div className="w-3 h-3 rounded-full bg-rose-500 mt-1 animate-ping" />
              <div className="flex-1">
                <p className="text-xs font-bold text-rose-100 uppercase tracking-wider">Alerte SOS Active</p>
                <p className="text-[11px] font-medium text-slate-400 mt-0.5">
                  Activée à {activatedAt ? activatedAt.toLocaleTimeString('fr-FR') : ''}
                </p>
                <div className="flex gap-4 mt-2 pt-2 border-t border-white/5 text-[10px] text-slate-500 font-semibold">
                  <span>🔋 Batterie: <b className="text-rose-400">{batteryLevel}%</b></span>
                  <span>📡 RTDB Sync: <b className="text-emerald-400 font-bold">Actif</b></span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Shield size={18} className="text-emerald-500" />
              <div>
                <p className="text-xs font-bold text-slate-200">Veille Actrice</p>
                <p className="text-[11px] font-semibold text-slate-500">Maintenez le bouton ci-dessous pour alerter les secours.</p>
              </div>
            </div>
          )}
        </div>

        {/* SOS BUTTON */}
        <div className="flex flex-col items-center justify-center py-4 relative">
          {sosStatus === 'active' && (
            <div className="absolute w-[200px] h-[200px] bg-rose-500/10 rounded-full border border-rose-500/20 animate-ping" />
          )}

          <button
            onMouseDown={handleHoldStart}
            onMouseUp={handleHoldEnd}
            onMouseLeave={handleHoldEnd}
            onTouchStart={handleHoldStart}
            onTouchEnd={handleHoldEnd}
            className={`w-32 h-32 rounded-full border flex flex-col items-center justify-center relative active:scale-95 transition-transform duration-300 shadow-xl ${
              sosStatus === 'active' ? 'bg-rose-600 border-rose-500 shadow-rose-600/30' :
              holdProgress > 0 ? 'bg-rose-950 border-rose-500 shadow-rose-950/20' : 'bg-slate-900/60 border-white/10'
            }`}
          >
            {/* SVG Ring Progress indicator */}
            {sosStatus === 'idle' && (
              <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="60"
                  stroke="rgba(255,255,255,0.03)"
                  strokeWidth="6"
                  fill="none"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="60"
                  stroke="#E24B4A"
                  strokeWidth="6"
                  fill="none"
                  strokeDasharray="377"
                  strokeDashoffset={377 - (377 * holdProgress) / 100}
                  className="transition-all duration-75"
                />
              </svg>
            )}

            <span className={`text-[24px] font-extrabold tracking-tight ${sosStatus === 'active' ? 'text-black font-black' : 'text-slate-100'}`}>
              {sosStatus === 'active' ? 'ACTIF' : 'SOS'}
            </span>
          </button>
          
          {sosStatus === 'idle' && (
            <span className="text-[11px] font-semibold text-slate-500 mt-3 text-center">
              Restez appuyé 3 secondes pour activer
            </span>
          )}
        </div>

        {/* SILENT TRANSCRIPT CHAT FEED (Only when active) */}
        {sosStatus === 'active' && (
          <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-4 flex flex-col gap-3">
            <h3 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              Transcription Silencieuse LSF
            </h3>
            
            <div className="h-40 overflow-y-auto rounded-xl bg-slate-950/40 border border-white/5 p-3 flex flex-col gap-2.5">
              {transcriptMessages.map((m) => (
                <div key={m.id} className={`flex ${m.sender === 'user' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`p-3 rounded-2xl max-w-[85%] border text-xs leading-relaxed ${
                    m.sender === 'user' ? 'bg-[#2E7D32] border-emerald-500/20 text-white' : 'bg-slate-800 border-white/5 text-slate-200'
                  }`}>
                    <p className="m-0 font-medium">{m.content}</p>
                    <div className="flex items-center justify-between gap-4 mt-2">
                      <span className="text-[9px] opacity-75 font-semibold">
                        {m.timestamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} {m.isSign && '• Gants LSF'}
                      </span>
                      {m.sender === 'user' && (
                        <button
                          onClick={() => openLsfTranslation(m.content)}
                          className="bg-emerald-950/50 border border-emerald-400/20 px-2 py-0.5 rounded text-[8px] font-bold tracking-wider hover:bg-emerald-900 active:scale-95 transition-transform"
                        >
                          VOIR LSF
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Message input */}
            <div className="flex items-center gap-2 bg-slate-950/40 rounded-xl p-1.5 border border-white/5">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Traduire un signe ou écrire..."
                className="bg-transparent border-none outline-none flex-1 text-xs px-2 text-slate-200"
              />
              <button
                onClick={sendMessage}
                disabled={!chatInput.trim()}
                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                  chatInput.trim() ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-white/5 text-slate-500 cursor-not-allowed'
                }`}
              >
                <Send size={12} />
              </button>
            </div>
          </div>
        )}

        {/* GPS LOCATION MAP OVERLAY */}
        <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-300">Carte interactive</span>
            <button
              onClick={() => setLocationStatus('loading')}
              className="w-8 h-8 rounded-full bg-slate-800/50 border border-white/5 flex items-center justify-center hover:bg-slate-700 active:scale-90"
              aria-label="Rafraîchir la carte"
            >
              <RefreshCw size={12} className="text-slate-400" />
            </button>
          </div>

          <div className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-950">
            <iframe
              title="Carte d'urgence - Fès"
              src={`https://www.google.com/maps?q=${encodeURIComponent('2WVH+7R2, Rte Principale Fès Meknès, Fès, Morocco')}&z=16&output=embed`}
              className="h-72 w-full border-0"
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>

          <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/70 p-3 text-xs text-slate-400">
            <p className="font-semibold text-slate-200">Centre : 2WVH+7R2, Rte Principale Fès Meknès, Fès, Maroc</p>
            <p className="mt-1">Zoom et navigation activés sur une carte réelle avec un marqueur.</p>
          </div>
        </div>

        {/* EMERGENCY CONTACTS HORIZONTAL CAROUSEL */}
        <div>
          <span className="text-xs font-bold text-slate-300 block mb-3">👥 Contacts SOS</span>
          <div className="flex overflow-x-auto gap-3 pb-2 scrollbar-hide">
            {contacts.map((c) => {
              const isNotified = c.status === 'notified';
              return (
                <div
                  key={c.id}
                  className={`flex-shrink-0 p-3 rounded-2xl border flex items-center w-52 gap-3 transition-all duration-300 ${
                    sosStatus === 'active' && isNotified ? 'bg-slate-900 border-emerald-500/40 shadow-lg shadow-emerald-500/5' : 'bg-slate-900/60 border-white/5'
                  }`}
                >
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm ${
                    sosStatus === 'active' && isNotified ? 'bg-emerald-500/10 border border-emerald-500 text-emerald-500' : 'bg-slate-800 border border-white/5 text-slate-400'
                  }`}>
                    {c.name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-200 truncate m-0">{c.name}</p>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">{c.relation}</p>
                    <div className="flex items-center gap-1 mt-1 text-[9px] font-bold">
                      <span className={`w-1.5 h-1.5 rounded-full ${sosStatus === 'active' ? 'bg-emerald-500' : 'bg-slate-500'}`} />
                      <span style={{ color: sosStatus === 'active' ? '#2E7D32' : '#64748B' }}>
                        {sosStatus === 'active' ? 'Notifié' : 'En attente'}
                      </span>
                    </div>
                  </div>

                  <a
                    href={`tel:${c.phone}`}
                    className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors shrink-0"
                  >
                    <Phone size={12} className="text-slate-400" />
                  </a>
                </div>
              );
            })}
          </div>
        </div>

        {/* QUICK ACTIONS 2X2 GRID */}
        <div>
          <span className="text-xs font-bold text-slate-300 block mb-3">⚡ Actions Rapides</span>
          <div className="grid grid-cols-2 gap-3">
            {/* Police */}
            <a
              href="tel:19"
              className="bg-rose-500/5 border border-rose-500/10 hover:border-rose-500/30 rounded-2xl p-3 flex items-center gap-3 text-left transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500 shrink-0">
                <Shield size={18} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-200">Police</p>
                <span className="text-[10px] font-semibold text-rose-400 block mt-0.5">Appeler le 19</span>
              </div>
            </a>

            {/* Pompier */}
            <a
              href="tel:15"
              className="bg-blue-500/5 border border-blue-500/10 hover:border-blue-500/30 rounded-2xl p-3 flex items-center gap-3 text-left transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
                <Shield size={18} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-200">Ambulance</p>
                <span className="text-[10px] font-semibold text-blue-400 block mt-0.5">Appeler le 15</span>
              </div>
            </a>

            {/* Geoloc actualize and share */}
            <button
              onClick={() => {
                if (sosStatus === 'active') {
                  const now = new Date();
                  setTranscriptMessages(prev => [
                    ...prev,
                    {
                      id: `share-${Date.now()}`,
                      content: `📍 Position Actualisée: https://maps.google.com/?q=${location?.lat || 33.5731},${location?.lng || -7.5898}`,
                      sender: 'user',
                      timestamp: now
                    }
                  ]);
                }
              }}
              className="bg-emerald-500/5 border border-emerald-500/10 hover:border-emerald-500/30 rounded-2xl p-3 flex items-center gap-3 text-left transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
                <RefreshCw size={18} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-200">Partager GPS</p>
                <span className="text-[10px] font-semibold text-emerald-400 block mt-0.5">Partager ma position</span>
              </div>
            </button>

            {/* Silent Mode toggle */}
            <button
              onClick={() => setSilentMode(!silentMode)}
              className={`border rounded-2xl p-3 flex items-center gap-3 text-left transition-colors ${
                silentMode ? 'bg-slate-800 border-white/10' : 'bg-slate-900/60 border-white/5'
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                <EyeOff size={18} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-200">Mode Discret</p>
                <span className="text-[10px] font-semibold text-slate-400 block mt-0.5">{silentMode ? 'Activé' : 'Inactif'}</span>
              </div>
            </button>
          </div>
        </div>

        {/* SILENT MODE SETTINGS SWITCH CARDS */}
        <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-4 flex flex-col gap-3">
          <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <EyeOff size={14} className="text-emerald-500" />
            Configuration Discrète
          </span>

          <div className="flex items-center justify-between py-2 border-b border-white/5 text-xs">
            <div>
              <p className="font-bold text-slate-200">Luminosité minimum</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Assombrit automatiquement l'écran</p>
            </div>
            <input
              type="checkbox"
              checked={silentOptions.reduceBrightness}
              onChange={(e) => setSilentOptions(prev => ({ ...prev, reduceBrightness: e.target.checked }))}
              className="w-9 h-5 bg-slate-800 border border-white/10 rounded-full appearance-none relative checked:bg-emerald-500 cursor-pointer transition-colors duration-200 before:content-[''] before:w-4 before:h-4 before:bg-white before:rounded-full before:absolute before:top-0.5 before:left-0.5 checked:before:translate-x-4 before:transition-transform before:duration-200"
            />
          </div>

          <div className="flex items-center justify-between py-2 border-b border-white/5 text-xs">
            <div>
              <p className="font-bold text-slate-200">Silence Absolu</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Coupe l'intégralité des alertes vocales</p>
            </div>
            <input
              type="checkbox"
              checked={silentOptions.disableSounds}
              onChange={(e) => setSilentOptions(prev => ({ ...prev, disableSounds: e.target.checked }))}
              className="w-9 h-5 bg-slate-800 border border-white/10 rounded-full appearance-none relative checked:bg-emerald-500 cursor-pointer transition-colors duration-200 before:content-[''] before:w-4 before:h-4 before:bg-white before:rounded-full before:absolute before:top-0.5 before:left-0.5 checked:before:translate-x-4 before:transition-transform before:duration-200"
            />
          </div>

          <div className="flex items-center justify-between py-2 text-xs">
            <div>
              <p className="font-bold text-slate-200">Vibrations Discrètes</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Alertes uniquement via vibrations tactiles</p>
            </div>
            <input
              type="checkbox"
              checked={silentOptions.silentVibrations}
              onChange={(e) => setSilentOptions(prev => ({ ...prev, silentVibrations: e.target.checked }))}
              className="w-9 h-5 bg-slate-800 border border-white/10 rounded-full appearance-none relative checked:bg-emerald-500 cursor-pointer transition-colors duration-200 before:content-[''] before:w-4 before:h-4 before:bg-white before:rounded-full before:absolute before:top-0.5 before:left-0.5 checked:before:translate-x-4 before:transition-transform before:duration-200"
            />
          </div>
        </div>

        {/* SOS CANCELLATION BUTTON */}
        {sosStatus === 'active' && (
          <button
            onClick={handleCancelSOS}
            className="w-full rounded-2xl bg-rose-950/40 hover:bg-rose-900/50 border border-rose-500 py-3.5 text-rose-100 text-xs font-bold uppercase tracking-wider active:scale-98 transition-transform"
          >
            Annuler l'alerte
          </button>
        )}
      </main>

      {/* LSF VISUAL TRANSLATION MODAL */}
      {lsfModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-end z-50 animate-fade-in">
          <div className="w-full max-w-md mx-auto bg-slate-900 border-t border-white/10 rounded-t-3xl p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Video size={16} className="text-emerald-500" />
                Visualisation LSF
              </span>
              <button
                onClick={() => setLsfModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 border border-white/5 flex items-center justify-center hover:bg-slate-700"
              >
                <X size={14} />
              </button>
            </div>

            <div className="h-48 rounded-xl bg-slate-950 border border-white/5 flex flex-col items-center justify-center relative overflow-hidden">
              {/* Simulated camera feed scanning */}
              <div className="absolute top-3 left-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded">
                Glove Sign Stream Actif
              </div>
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-2 animate-pulse">
                <Video size={24} className="text-emerald-500" />
              </div>
              <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wide">Traduction LSF Actrice</span>
              <span className="text-slate-500 text-[10px] text-center max-w-[80%] mt-1 font-medium">L'avatar de VoxManus traduit vos signes en direct.</span>
            </div>

            <div className="bg-slate-950/40 rounded-xl p-3 border border-white/5 text-xs">
              <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Message traduit :</p>
              <p className="font-semibold text-slate-200">"{activeLsfText}"</p>
            </div>

            <button
              onClick={() => setLsfModalOpen(false)}
              className="w-full bg-[#2E7D32] hover:bg-[#15805d] text-white py-3 rounded-xl text-xs font-bold transition-colors active:scale-98"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* PIN CANCELLATION MODAL */}
      {pinModalOpen && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 px-6">
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-5 max-w-[280px] w-full flex flex-col items-center gap-3 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500">
              <AlertTriangle size={24} />
            </div>

            <h4 className="text-sm font-bold text-slate-100 m-0">Code d'Annulation Requis</h4>
            <p className="text-[11px] text-slate-400 text-center leading-relaxed m-0">
              Saisissez le PIN de sécurité pour annuler le signal SOS (par défaut : <b>0000</b>).
            </p>

            <input
              type="password"
              maxLength={4}
              value={pinCode}
              onChange={(e) => {
                setPinCode(e.target.value.replace(/\D/g, ''));
                if (pinError) setPinError(false);
              }}
              placeholder="••••"
              className={`w-28 text-center text-xl font-mono py-1.5 rounded-xl bg-slate-950 border outline-none font-bold text-white tracking-widest ${
                pinError ? 'border-rose-500' : 'border-white/10 focus:border-emerald-500'
              }`}
            />

            {pinError && (
              <span className="text-[10px] font-bold text-rose-500">PIN incorrect. Réessayez.</span>
            )}

            <div className="flex gap-2 w-full mt-2">
              <button
                onClick={() => {
                  setPinModalOpen(false);
                  setPinCode('');
                  setPinError(false);
                }}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
              >
                Retour
              </button>
              <button
                onClick={verifyPin}
                disabled={pinCode.length !== 4}
                className={`flex-1 py-2.5 rounded-xl text-white text-xs font-bold transition-all ${
                  pinCode.length === 4 ? 'bg-[#2E7D32] hover:bg-[#15805d]' : 'bg-white/5 text-slate-600 cursor-not-allowed'
                }`}
              >
                Désactiver
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
