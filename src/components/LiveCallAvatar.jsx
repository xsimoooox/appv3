import { useEffect, useMemo, useState } from 'react';

const FRENCH_TO_ALEX = {
  bonjour: 'good',
  salut: 'good',
  merci: 'thank-you',
  toi: 'you',
  vous: 'you',
  pourquoi: 'why',
  quand: 'when',
  parler: 'talk',
  parle: 'talk',
  bien: 'fine',
  bon: 'good',
  bonne: 'good',
  heureux: 'happy',
  heureuse: 'happy',
  désolé: 'sorry',
  desole: 'sorry',
  non: 'no',
  demain: 'tomorrow',
  "aujourd’hui": 'today',
  "aujourd'hui": 'today',
};

function findAlexUrl(db, value) {
  const word = value.toLowerCase().trim();
  const entry = db?.find((item) => (
    item.original.toLowerCase() === word
    || item.synonymes.some((synonym) => synonym.toLowerCase() === word)
  ));
  return entry?.url || '';
}

function buildAlexSequence(text, db) {
  if (!text || !db?.length) return [];
  const sequence = [];
  text.toLowerCase().split(/\s+/).filter(Boolean).forEach((word) => {
    const normalized = word.normalize('NFD').replace(/\p{Diacritic}/gu, '');
    const alexWord = FRENCH_TO_ALEX[word] || FRENCH_TO_ALEX[normalized] || normalized;
    const wordUrl = findAlexUrl(db, alexWord);
    if (wordUrl) {
      sequence.push({ url: wordUrl, label: alexWord });
      return;
    }
  });
  if (sequence.length === 0) {
    const fallbackUrl = findAlexUrl(db, 'talk') || db[0]?.url;
    if (fallbackUrl) sequence.push({ url: fallbackUrl, label: 'talk' });
  }
  return sequence;
}

function buildFrizittaSequence(text, db) {
  if (!text || !db) return [];
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .split('')
    .map((letter) => db[letter])
    .filter(Boolean);
}

export default function LiveCallAvatar({ mode, text, frizittaDb, alexDb }) {
  const sequence = useMemo(
    () => (mode === 'alex'
      ? buildAlexSequence(text, alexDb)
      : buildFrizittaSequence(text, frizittaDb)),
    [mode, text, frizittaDb, alexDb],
  );
  const [index, setIndex] = useState(0);
  const frizittaFallback = useMemo(
    () => buildFrizittaSequence(text, frizittaDb),
    [text, frizittaDb],
  );
  const useAlexVideo = mode === 'alex' && sequence.length > 0;
  const displayedSequence = useAlexVideo ? sequence : frizittaFallback;

  useEffect(() => {
    if (displayedSequence.length < 2) return undefined;
    const delay = useAlexVideo ? 1800 : 650;
    const timer = setInterval(() => {
      setIndex((current) => (current + 1 < displayedSequence.length ? current + 1 : current));
    }, delay);
    return () => clearInterval(timer);
  }, [displayedSequence, useAlexVideo]);

  const current = displayedSequence[Math.min(index, Math.max(0, displayedSequence.length - 1))];
  if (useAlexVideo) {
    return current?.url ? (
      <video
        key={`${current.url}-${index}`}
        src={current.url}
        autoPlay
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 h-full w-full object-cover object-top"
        style={{ zIndex: 10 }}
      />
    ) : null;
  }

  const src = current || frizittaDb?.NEUTRE || '';
  return src ? (
    <img
      key={`${src}-${index}`}
      src={src}
      alt=""
      className="absolute inset-0 h-full w-full object-cover object-top"
      style={{ zIndex: 10 }}
    />
  ) : null;
}
