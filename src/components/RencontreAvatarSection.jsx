import AvatarStage from './AvatarStage';
import AlexStage from './AlexStage';
import LiveCallAvatar from './LiveCallAvatar';

/**
 * Section avatar identique à Rencontre.jsx (cadre + Frizitta / Alex centrés).
 */
export default function RencontreAvatarSection({
  modeAvatar,
  frizittaDb,
  alexDb,
  currentLetterUrl,
  videoARef,
  videoBRef,
  activeVideo,
  liveText = '',
  overlay = null,
  children,
}) {
  const frizittaSrc =
    currentLetterUrl || (frizittaDb ? frizittaDb.NEUTRE || '' : '');

  return (
    <div className="rencontre-avatar-section">
      <div
        className={`avatar-container${
          modeAvatar === 'alex'
            ? ' avatar-container--alex'
            : ' avatar-container--frizitta'
        }`}
      >
        <div className="avatar-inner">
          {liveText && (
            <LiveCallAvatar
              key={`${modeAvatar}-${liveText}`}
              mode={modeAvatar}
              text={liveText}
              frizittaDb={frizittaDb}
              alexDb={alexDb}
            />
          )}
          {!liveText && modeAvatar === 'frizitta' && (
            <div
              className="flex h-full w-full items-center justify-center overflow-hidden"
              id="frizitta-player"
            >
              <AvatarStage src={frizittaSrc} />
            </div>
          )}

          {!liveText && modeAvatar === 'alex' && (
            <div className="flex h-full w-full items-center justify-center">
              <AlexStage
                videoARef={videoARef}
                videoBRef={videoBRef}
                activeVideo={activeVideo}
              />
            </div>
          )}
          {overlay}
        </div>
      </div>
      {children}
    </div>
  );
}
