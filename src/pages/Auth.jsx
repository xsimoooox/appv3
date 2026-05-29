import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  registerAccount,
  loginAccount,
  getAuthErrorMessage,
  checkApiHealth,
} from '../lib/api';
import { initSocket } from '../lib/socket';
import { registerSocketUser } from '../lib/registerSocketUser';
import { clearWakwakUser, getHomeRoute, getWakwakUser, saveWakwakUser } from '../lib/wakwakUser';
import { normalizePhoneNumber } from '../lib/phoneUtils';

const COUNTRY_CODES = [
  { flag: '🇲🇦', label: 'Maroc', code: '+212' },
  { flag: '🇫🇷', label: 'France', code: '+33' },
  { flag: '🇩🇿', label: 'Algérie', code: '+213' },
  { flag: '🇹🇳', label: 'Tunisie', code: '+216' },
  { flag: '🇸🇦', label: 'Arabie saoudite', code: '+966' },
  { flag: '🇦🇪', label: 'Émirats', code: '+971' },
  { flag: '🇬🇧', label: 'Royaume-Uni', code: '+44' },
  { flag: '🇺🇸', label: 'États-Unis', code: '+1' },
];

const NAME_PATTERN = /^[\p{L}\s'-]{3,}$/u;

function RoleBadge({ role }) {
  if (role === 'deaf') {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3.5 py-1.5 rounded-full"
        style={{ background: '#1a1040', color: '#818cf8' }}
      >
        <i className="ti ti-ear-off" style={{ fontSize: 12 }} />
        Personne sourde
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3.5 py-1.5 rounded-full"
      style={{ background: '#0a1e0c', color: '#4ade80' }}
    >
      <i className="ti ti-ear" style={{ fontSize: 12 }} />
      Personne entendante
    </span>
  );
}

export default function Auth() {
  const navigate = useNavigate();
  const existingUser = useMemo(() => getWakwakUser(), []);
  const [step, setStep] = useState('choose');
  const [selectedRole, setSelectedRole] = useState(null);
  const [fullName, setFullName] = useState('');
  const [countryCode, setCountryCode] = useState('+212');
  const [localNumber, setLocalNumber] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [accountExists, setAccountExists] = useState(false);
  const [existingAccountName, setExistingAccountName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [welcomeUser, setWelcomeUser] = useState(null);

  const digitsOnly = localNumber.replace(/\D/g, '');
  const phoneNumber = useMemo(
    () => normalizePhoneNumber(`${countryCode}${digitsOnly}`),
    [countryCode, digitsOnly],
  );

  const nameError =
    fullName.trim().length > 0 && !NAME_PATTERN.test(fullName.trim())
      ? 'Nom trop court (3 caractères minimum)'
      : '';

  const phoneError =
    digitsOnly.length > 0 && digitsOnly.length < 8 ? 'Numéro invalide' : '';

  const passwordError =
    password.length > 0 && password.length < 6 ? 'Mot de passe : 6 caractères minimum' : '';

  const [isLoginMode, setIsLoginMode] = useState(false);

  const isFormValid = isLoginMode
    ? digitsOnly.length >= 8 && password.length >= 6 && !phoneError && !passwordError
    : selectedRole &&
      NAME_PATTERN.test(fullName.trim()) &&
      digitsOnly.length >= 8 &&
      password.length >= 6 &&
      !nameError &&
      !phoneError &&
      !passwordError;

  const showRecap = !isLoginMode && isFormValid;

  const goToForm = (role) => {
    setSelectedRole(role);
    setAccountExists(false);
    setIsLoginMode(false);
    setAuthError('');
    setStep('form');
  };

  const finishAuthSuccess = async (data) => {
    const user = saveWakwakUser({
      ...data.user,
      token: data.token,
      avatar: null,
    });

    initSocket(user);
    await registerSocketUser(user);

    setWelcomeUser(user);
    setStep('welcome');
    setSubmitting(false);
    setAccountExists(false);

    setTimeout(() => {
      navigate(getHomeRoute(user.role), { replace: true });
    }, 1500);
  };

  const handleLogin = async () => {
    if (!password || password.length < 6) {
      setAuthError('Entrez votre mot de passe (6 caractères minimum)');
      return;
    }
    setSubmitting(true);
    setAuthError('');

    try {
      const health = await checkApiHealth();
      if (!health.res.ok || !health.data?.ok) {
        setAuthError(
          'Serveur ou base de données indisponible. Relancez : npm run server',
        );
        setSubmitting(false);
        return;
      }

      const { res, data } = await loginAccount({ phoneNumber, password });

      if (!res.ok) {
        setAuthError(getAuthErrorMessage(res, data));
        setSubmitting(false);
        return;
      }

      await finishAuthSuccess(data);
    } catch {
      setAuthError('Erreur réseau — vérifiez npm run server');
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!isFormValid || submitting) return;
    setSubmitting(true);
    setAuthError('');
    setAccountExists(false);

    try {
      const health = await checkApiHealth();
      if (!health.res.ok || !health.data?.ok) {
        setAuthError(
          'Serveur ou base de données indisponible. Ouvrez un terminal et lancez : npm run server',
        );
        setSubmitting(false);
        return;
      }

      const { res, data } = await registerAccount({
        name: fullName.trim(),
        phoneNumber,
        password,
        role: selectedRole,
      });

      if (!res.ok) {
        if (res.status === 409 || data?.code === 'phone_exists' || data?.existingAccount) {
          setAccountExists(true);
          setExistingAccountName(data?.user?.name || '');
          setAuthError(
            data?.user?.name
              ? `Le compte « ${data.user.name} » existe déjà avec ce numéro. Connectez-vous avec votre mot de passe.`
              : 'Ce numéro est déjà enregistré. Connectez-vous avec votre mot de passe.',
          );
        } else {
          setAuthError(getAuthErrorMessage(res, data));
        }
        setSubmitting(false);
        return;
      }

      await finishAuthSuccess(data);
    } catch {
      setAuthError('Erreur réseau — vérifiez que npm run server est lancé');
      setSubmitting(false);
    }
  };

  const handleContinueSession = async () => {
    if (!existingUser) return;
    setSubmitting(true);
    setAuthError('');

    try {
      initSocket(existingUser);
      await registerSocketUser(existingUser);
      navigate(getHomeRoute(existingUser.role), { replace: true });
    } catch {
      setAuthError('Impossible de se reconnecter au serveur');
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'welcome' && welcomeUser) {
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center px-6 select-none"
        style={{ background: '#0a0a0a' }}
      >
        <div
          className="flex items-center justify-center mb-5"
          style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: '#6366f1',
            animation: 'authCheckPop 600ms ease forwards',
          }}
        >
          <i className="ti ti-check" style={{ fontSize: 36, color: '#fff' }} />
        </div>
        <p className="text-[13px] m-0 mb-1" style={{ color: '#555' }}>
          Bienvenue,
        </p>
        <p className="text-[20px] font-bold m-0 mb-3" style={{ color: '#f0f0f0' }}>
          {welcomeUser.name}
        </p>
        <RoleBadge role={welcomeUser.role} />
        <div className="flex gap-1.5 mt-10">
          <span className="w-2 h-2 rounded-full bg-[#6366f1] animate-blink-1" />
          <span className="w-2 h-2 rounded-full bg-[#6366f1] animate-blink-2" />
          <span className="w-2 h-2 rounded-full bg-[#6366f1] animate-blink-3" />
        </div>
      </div>
    );
  }

  if (step === 'form') {
    return (
      <div
        className="fixed inset-0 overflow-y-auto select-none animate-fade-in"
        style={{ background: '#0a0a0a' }}
      >
        <button
          type="button"
          onClick={() => setStep('choose')}
          className="flex items-center gap-2 border-none bg-transparent cursor-pointer p-4"
          style={{ color: '#6366f1' }}
          aria-label="Retour"
        >
          <i className="ti ti-arrow-left" style={{ fontSize: 20 }} />
        </button>

        <div className="px-5 pb-10 max-w-md mx-auto">
          <div className="flex flex-col items-center mb-4">
            <div
              className="flex items-center justify-center mb-2"
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: '#6366f1',
              }}
            >
              <i className="ti ti-hand-finger" style={{ fontSize: 20, color: '#fff' }} />
            </div>
            {!isLoginMode && selectedRole && <RoleBadge role={selectedRole} />}
          </div>

          <h1 className="text-center text-[18px] font-bold m-0" style={{ color: '#f0f0f0' }}>
            {isLoginMode ? 'Se connecter' : 'Créer votre profil'}
          </h1>
          <p className="text-center text-[12px] m-0 mt-2 mb-6" style={{ color: '#555' }}>
            {isLoginMode ? 'Entrez vos identifiants pour continuer' : 'Entrez vos informations pour commencer'}
          </p>

          <div className="flex flex-col gap-3.5">
            {!isLoginMode && (
              <label className="block">
                <span className="block text-[11px] font-bold mb-1.5" style={{ color: '#888' }}>
                  Nom complet
                </span>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ex: Amina Moussaoui"
                  className="w-full outline-none"
                  style={{
                    background: '#131313',
                    border: `1px solid ${nameError ? '#ef4444' : '#1e1e1e'}`,
                    borderRadius: 10,
                    padding: '13px 14px',
                    fontSize: 14,
                    color: '#f0f0f0',
                  }}
                  onFocus={(e) => {
                    if (!nameError) e.target.style.borderColor = '#6366f1';
                    e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.15)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = nameError ? '#ef4444' : '#1e1e1e';
                    e.target.style.boxShadow = 'none';
                  }}
                />
                {nameError && (
                  <span className="block text-[10px] mt-1" style={{ color: '#ef4444' }}>
                    {nameError}
                  </span>
                )}
              </label>
            )}

            <div>
              <span className="block text-[11px] font-bold mb-1.5" style={{ color: '#888' }}>
                Numéro de téléphone
              </span>
              <span className="block text-[10px] italic mb-1.5" style={{ color: '#444' }}>
                Votre identifiant unique dans l&apos;application
              </span>
              <div className="flex gap-2">
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="outline-none shrink-0"
                  style={{
                    background: '#131313',
                    border: '1px solid #1e1e1e',
                    borderRadius: 10,
                    padding: '13px 10px',
                    width: 96,
                    fontSize: 13,
                    color: '#f0f0f0',
                  }}
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.code}
                    </option>
                  ))}
                </select>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={localNumber}
                  onChange={(e) => setLocalNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="600 000 001"
                  className="flex-1 outline-none min-w-0"
                  style={{
                    background: '#131313',
                    border: `1px solid ${phoneError ? '#ef4444' : '#1e1e1e'}`,
                    borderRadius: 10,
                    padding: '13px 14px',
                    fontSize: 14,
                    color: '#f0f0f0',
                  }}
                />
              </div>
              {phoneError && (
                <span className="block text-[10px] mt-1" style={{ color: '#ef4444' }}>
                  {phoneError}
                </span>
              )}
              <p className="text-[10px] m-0 mt-1.5" style={{ color: '#f59e0b' }}>
                ⚠️ Ce numéro sera votre identifiant permanent. Il ne pourra pas être modifié.
              </p>
            </div>

            <label className="block">
              <span className="block text-[11px] font-bold mb-1.5" style={{ color: '#888' }}>
                Mot de passe
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6 caractères minimum"
                autoComplete="new-password"
                className="w-full outline-none"
                style={{
                  background: '#131313',
                  border: `1px solid ${passwordError ? '#ef4444' : '#1e1e1e'}`,
                  borderRadius: 10,
                  padding: '13px 14px',
                  fontSize: 14,
                  color: '#f0f0f0',
                }}
              />
              {passwordError && (
                <span className="block text-[10px] mt-1" style={{ color: '#ef4444' }}>
                  {passwordError}
                </span>
              )}
            </label>

            {authError && (
              <p className="text-[11px] m-0 text-center" style={{ color: '#ef4444' }}>
                {authError}
              </p>
            )}

            {accountExists && (
              <div
                className="rounded-[10px] px-3.5 py-3 flex flex-col gap-2"
                style={{ background: '#1a1040', border: '1px solid #6366f1' }}
              >
                <p className="text-[12px] m-0" style={{ color: '#c7d2fe' }}>
                  {existingAccountName
                    ? `Compte existant : ${existingAccountName}`
                    : 'Ce numéro a déjà un compte'}
                </p>
                <button
                  type="button"
                  disabled={submitting || password.length < 6}
                  onClick={handleLogin}
                  className="w-full border-none font-bold cursor-pointer"
                  style={{
                    height: 44,
                    borderRadius: 10,
                    fontSize: 12,
                    background: '#6366f1',
                    color: '#fff',
                    opacity: submitting || password.length < 6 ? 0.5 : 1,
                  }}
                >
                  {submitting ? 'Connexion…' : 'Se connecter et continuer'}
                </button>
              </div>
            )}

            {showRecap && (
              <div
                className="rounded-[10px] px-3.5 py-3"
                style={{ background: '#131313', border: '1px solid #1e1e1e' }}
              >
                <p className="text-[12px] m-0 mb-1" style={{ color: '#f0f0f0' }}>
                  👤 {fullName.trim()}
                </p>
                <p className="text-[11px] m-0 mb-2" style={{ color: '#555' }}>
                  {phoneNumber}
                </p>
                <RoleBadge role={selectedRole} />
              </div>
            )}

            <button
              type="button"
              disabled={!isFormValid || submitting}
              onClick={isLoginMode || accountExists ? handleLogin : handleSubmit}
              className="w-full flex items-center justify-center gap-2 border-none font-bold mt-2"
              style={{
                height: 50,
                borderRadius: 12,
                fontSize: 13,
                background: isFormValid && !submitting ? '#6366f1' : '#1a1a2e',
                color: isFormValid && !submitting ? '#fff' : '#333',
                cursor: isFormValid && !submitting ? 'pointer' : 'not-allowed',
              }}
            >
              {submitting ? (
                <span
                  className="inline-block w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin"
                />
              ) : (
                <>
                  {isLoginMode || accountExists ? 'Se connecter' : 'Commencer'}
                  <i className="ti ti-arrow-right" style={{ fontSize: 16 }} />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsLoginMode(!isLoginMode);
                setAuthError('');
                setAccountExists(false);
              }}
              className="w-full border-none cursor-pointer bg-transparent text-[12px] font-semibold mt-3"
              style={{ color: '#6366f1' }}
            >
              {isLoginMode ? "Pas de compte ? Créer un profil" : "Déjà un compte ? Se connecter"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 flex flex-col justify-center px-5 py-8 select-none max-w-md mx-auto"
      style={{ background: '#0a0a0a' }}
    >
      <div className="flex flex-col items-center mb-8">
        <div
          className="flex items-center justify-center mb-4"
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: '#6366f1',
          }}
        >
          <i className="ti ti-hand-finger" style={{ fontSize: 32, color: '#fff' }} />
        </div>
        <h1 className="text-[24px] font-bold m-0" style={{ color: '#f0f0f0' }}>
          WakWak
        </h1>
        <p className="text-[13px] text-center m-0 mt-2 mb-2" style={{ color: '#555' }}>
          Communication sans frontières
        </p>
        <div
          style={{
            width: 40,
            height: 2,
            background: '#6366f1',
            borderRadius: 1,
            marginBottom: 32,
          }}
        />
        <p className="text-[15px] font-bold m-0" style={{ color: '#f0f0f0' }}>
          Qui êtes-vous ?
        </p>
      </div>

      {existingUser && (
        <div className="mx-1 mb-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={handleContinueSession}
            disabled={submitting}
            className="w-full border-none cursor-pointer text-[13px] font-bold"
            style={{
              background: '#6366f1',
              color: '#fff',
              borderRadius: 14,
              padding: '14px 16px',
            }}
          >
            Continuer en tant que {existingUser.name}
          </button>
          <button
            type="button"
            onClick={() => {
              clearWakwakUser();
              window.location.reload();
            }}
            className="w-full border-none cursor-pointer text-[11px] font-semibold bg-transparent"
            style={{ color: '#666' }}
          >
            Changer de compte
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3 mx-1">
        <button
          type="button"
          onClick={() => goToForm('deaf')}
          className="w-full text-left border-none cursor-pointer transition-colors"
          style={{
            background: '#0d0d1a',
            border: '1.5px solid #1a1a40',
            borderRadius: 16,
            padding: '20px 16px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#6366f1';
            e.currentTarget.style.background = '#12122a';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#1a1a40';
            e.currentTarget.style.background = '#0d0d1a';
          }}
        >
          <div className="flex items-center gap-3.5">
            <div
              className="flex items-center justify-center shrink-0"
              style={{
                width: 48,
                height: 48,
                background: '#1a1040',
                borderRadius: 12,
              }}
            >
              <i className="ti ti-ear-off" style={{ fontSize: 24, color: '#818cf8' }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-bold" style={{ color: '#f0f0f0' }}>
                Personne sourde
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: '#555' }}>
                Communication LSF via gants + avatar
              </div>
            </div>
            <i className="ti ti-chevron-right shrink-0" style={{ fontSize: 18, color: '#333' }} />
          </div>
        </button>

        <button
          type="button"
          onClick={() => goToForm('hearing')}
          className="w-full text-left border-none cursor-pointer transition-colors"
          style={{
            background: '#0a1a0a',
            border: '1.5px solid #1a3a1a',
            borderRadius: 16,
            padding: '20px 16px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#16a34a';
            e.currentTarget.style.background = '#0d1f0d';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#1a3a1a';
            e.currentTarget.style.background = '#0a1a0a';
          }}
        >
          <div className="flex items-center gap-3.5">
            <div
              className="flex items-center justify-center shrink-0"
              style={{
                width: 48,
                height: 48,
                background: '#0a1e0c',
                borderRadius: 12,
              }}
            >
              <i className="ti ti-ear" style={{ fontSize: 24, color: '#4ade80' }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-bold" style={{ color: '#f0f0f0' }}>
                Personne entendante
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: '#555' }}>
                Reçoit la traduction LSF en texte + voix
              </div>
            </div>
            <i className="ti ti-chevron-right shrink-0" style={{ fontSize: 18, color: '#333' }} />
          </div>
        </button>
        <button
          type="button"
          onClick={() => {
            setIsLoginMode(true);
            setStep('form');
            setAuthError('');
          }}
          className="w-full border-none cursor-pointer font-bold mt-4"
          style={{
            height: 48,
            background: '#131313',
            border: '1px solid #1e1e1e',
            color: '#818cf8',
            borderRadius: 14,
            fontSize: 13,
          }}
        >
          Déjà un compte ? Se connecter
        </button>
      </div>
    </div>
  );
}
