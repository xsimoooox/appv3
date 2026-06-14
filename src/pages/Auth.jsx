import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  registerAccount,
  loginAccount,
  getAuthErrorMessage,
} from '../lib/api';
import { initSocket } from '../lib/socket';
import { registerSocketUser } from '../lib/registerSocketUser';
import { clearVoxManusUser, getHomeRoute, getVoxManusUser, saveVoxManusUser } from '../lib/voxmanusUser';
import { normalizePhoneNumber } from '../lib/phoneUtils';
import BrandLogo from '../components/BrandLogo';

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
        style={{ background: '#EEEEFF', color: '#0000B4' }}
      >
        <i className="ti ti-ear-off" style={{ fontSize: 12 }} />
        Personne sourde
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3.5 py-1.5 rounded-full"
      style={{ background: '#EAF5EB', color: '#2E7D32' }}
    >
      <i className="ti ti-ear" style={{ fontSize: 12 }} />
      Personne entendante
    </span>
  );
}

export default function Auth() {
  const navigate = useNavigate();
  const existingUser = useMemo(() => getVoxManusUser(), []);
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
    const user = saveVoxManusUser({
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
      const { res, data } = await loginAccount({ phoneNumber, password });

      if (!res.ok) {
        setAuthError(getAuthErrorMessage(res, data));
        setSubmitting(false);
        return;
      }

      await finishAuthSuccess(data);
    } catch {
      setAuthError('Erreur réseau — vérifiez votre connexion internet');
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!isFormValid || submitting) return;
    setSubmitting(true);
    setAuthError('');
    setAccountExists(false);

    try {
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
      setAuthError('Erreur réseau — vérifiez votre connexion internet');
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
        style={{ background: '#F0F0F0' }}
      >
        <div
          className="flex items-center justify-center mb-5"
          style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: '#0000B4',
            animation: 'authCheckPop 600ms ease forwards',
          }}
        >
          <i className="ti ti-check" style={{ fontSize: 36, color: '#fff' }} />
        </div>
        <p className="text-[13px] m-0 mb-1" style={{ color: '#666680' }}>
          Bienvenue,
        </p>
        <p className="text-[20px] font-bold m-0 mb-3" style={{ color: '#16163A' }}>
          {welcomeUser.name}
        </p>
        <RoleBadge role={welcomeUser.role} />
        <div className="flex gap-1.5 mt-10">
          <span className="w-2 h-2 rounded-full bg-[#0000B4] animate-blink-1" />
          <span className="w-2 h-2 rounded-full bg-[#0000B4] animate-blink-2" />
          <span className="w-2 h-2 rounded-full bg-[#0000B4] animate-blink-3" />
        </div>
      </div>
    );
  }

  if (step === 'form') {
    return (
      <div
        className="fixed inset-0 overflow-y-auto select-none animate-fade-in"
        style={{ background: '#F0F0F0' }}
      >
        <button
          type="button"
          onClick={() => setStep('choose')}
          className="flex items-center gap-2 border-none bg-transparent cursor-pointer p-4"
          style={{ color: '#0000B4' }}
          aria-label="Retour"
        >
          <i className="ti ti-arrow-left" style={{ fontSize: 20 }} />
        </button>

        <div className="px-5 pb-10 max-w-md mx-auto">
          <div className="flex flex-col items-center mb-4">
            <BrandLogo compact className="mb-2" />
            {!isLoginMode && selectedRole && <RoleBadge role={selectedRole} />}
          </div>

          <h1 className="text-center text-[18px] font-bold m-0" style={{ color: '#16163A' }}>
            {isLoginMode ? 'Se connecter' : 'Créer votre profil'}
          </h1>
          <p className="text-center text-[12px] m-0 mt-2 mb-6" style={{ color: '#666680' }}>
            {isLoginMode ? 'Entrez vos identifiants pour continuer' : 'Entrez vos informations pour commencer'}
          </p>

          <div className="flex flex-col gap-3.5">
            {!isLoginMode && (
              <label className="block">
                <span className="block text-[11px] font-bold mb-1.5" style={{ color: '#666680' }}>
                  Nom complet
                </span>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ex: Amina Moussaoui"
                  className="w-full outline-none"
                  style={{
                    background: '#FFFFFF',
                    border: `1px solid ${nameError ? '#E53935' : '#D9D9E8'}`,
                    borderRadius: 10,
                    padding: '13px 14px',
                    fontSize: 14,
                    color: '#16163A',
                  }}
                  onFocus={(e) => {
                    if (!nameError) e.target.style.borderColor = '#0000B4';
                    e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.15)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = nameError ? '#E53935' : '#D9D9E8';
                    e.target.style.boxShadow = 'none';
                  }}
                />
                {nameError && (
                  <span className="block text-[10px] mt-1" style={{ color: '#E53935' }}>
                    {nameError}
                  </span>
                )}
              </label>
            )}

            <div>
              <span className="block text-[11px] font-bold mb-1.5" style={{ color: '#666680' }}>
                Numéro de téléphone
              </span>
              <span className="block text-[10px] italic mb-1.5" style={{ color: '#878787' }}>
                Votre identifiant unique dans l&apos;application
              </span>
              <div className="flex gap-2">
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="outline-none shrink-0"
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #D9D9E8',
                    borderRadius: 10,
                    padding: '13px 10px',
                    width: 96,
                    fontSize: 13,
                    color: '#16163A',
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
                    background: '#FFFFFF',
                    border: `1px solid ${phoneError ? '#E53935' : '#D9D9E8'}`,
                    borderRadius: 10,
                    padding: '13px 14px',
                    fontSize: 14,
                    color: '#16163A',
                  }}
                />
              </div>
              {phoneError && (
                <span className="block text-[10px] mt-1" style={{ color: '#E53935' }}>
                  {phoneError}
                </span>
              )}
              <p className="text-[10px] m-0 mt-1.5" style={{ color: '#D25A1E' }}>
                ⚠️ Ce numéro sera votre identifiant permanent. Il ne pourra pas être modifié.
              </p>
            </div>

            <label className="block">
              <span className="block text-[11px] font-bold mb-1.5" style={{ color: '#666680' }}>
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
                  background: '#FFFFFF',
                  border: `1px solid ${passwordError ? '#E53935' : '#D9D9E8'}`,
                  borderRadius: 10,
                  padding: '13px 14px',
                  fontSize: 14,
                  color: '#16163A',
                }}
              />
              {passwordError && (
                <span className="block text-[10px] mt-1" style={{ color: '#E53935' }}>
                  {passwordError}
                </span>
              )}
            </label>

            {authError && (
              <p className="text-[11px] m-0 text-center" style={{ color: '#E53935' }}>
                {authError}
              </p>
            )}

            {accountExists && (
              <div
                className="rounded-[10px] px-3.5 py-3 flex flex-col gap-2"
                style={{ background: '#EEEEFF', border: '1px solid #0000B4' }}
              >
                <p className="text-[12px] m-0" style={{ color: '#000096' }}>
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
                    background: '#0000B4',
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
                style={{ background: '#FFFFFF', border: '1px solid #D9D9E8' }}
              >
                <p className="text-[12px] m-0 mb-1" style={{ color: '#16163A' }}>
                  👤 {fullName.trim()}
                </p>
                <p className="text-[11px] m-0 mb-2" style={{ color: '#666680' }}>
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
                background: isFormValid && !submitting ? '#0000B4' : '#D9D9E8',
                color: isFormValid && !submitting ? '#fff' : '#878787',
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
              style={{ color: '#0000B4' }}
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
      style={{ background: '#F0F0F0' }}
    >
      <div className="flex flex-col items-center mb-8">
        <BrandLogo className="mb-1" />
        <p className="text-[13px] text-center m-0 mt-2 mb-2" style={{ color: '#666680' }}>
          Communication sans frontières
        </p>
        <div
          style={{
            width: 40,
            height: 2,
            background: '#0000B4',
            borderRadius: 1,
            marginBottom: 32,
          }}
        />
        <p className="text-[15px] font-bold m-0" style={{ color: '#16163A' }}>
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
              background: '#0000B4',
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
              clearVoxManusUser();
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
            background: '#FFFFFF',
            border: '1.5px solid #000096',
            borderRadius: 16,
            padding: '20px 16px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#0000B4';
            e.currentTarget.style.background = '#EEEEFF';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#000096';
            e.currentTarget.style.background = '#FFFFFF';
          }}
        >
          <div className="flex items-center gap-3.5">
            <div
              className="flex items-center justify-center shrink-0"
              style={{
                width: 48,
                height: 48,
                background: '#EEEEFF',
                borderRadius: 12,
              }}
            >
              <i className="ti ti-ear-off" style={{ fontSize: 24, color: '#0000B4' }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-bold" style={{ color: '#16163A' }}>
                Personne sourde
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: '#666680' }}>
                Communication LSF via gants + avatar
              </div>
            </div>
            <i className="ti ti-chevron-right shrink-0" style={{ fontSize: 18, color: '#878787' }} />
          </div>
        </button>

        <button
          type="button"
          onClick={() => goToForm('hearing')}
          className="w-full text-left border-none cursor-pointer transition-colors"
          style={{
            background: '#FFFFFF',
            border: '1.5px solid #000096',
            borderRadius: 16,
            padding: '20px 16px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#2E7D32';
            e.currentTarget.style.background = '#F0F0F0';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#000096';
            e.currentTarget.style.background = '#FFFFFF';
          }}
        >
          <div className="flex items-center gap-3.5">
            <div
              className="flex items-center justify-center shrink-0"
              style={{
                width: 48,
                height: 48,
                background: '#EAF5EB',
                borderRadius: 12,
              }}
            >
              <i className="ti ti-ear" style={{ fontSize: 24, color: '#2E7D32' }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-bold" style={{ color: '#16163A' }}>
                Personne entendante
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: '#666680' }}>
                Reçoit la traduction LSF en texte + voix
              </div>
            </div>
            <i className="ti ti-chevron-right shrink-0" style={{ fontSize: 18, color: '#878787' }} />
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
            background: '#FFFFFF',
            border: '1px solid #D9D9E8',
            color: '#0000B4',
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
