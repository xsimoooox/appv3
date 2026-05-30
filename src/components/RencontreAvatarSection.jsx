import AvatarStage from './AvatarStage';
import AlexStage from './AlexStage';

/**
 * Section avatar identique à Rencontre.jsx (cadre + Frizitta / Alex centrés).
 */
export default function RencontreAvatarSection({
  modeAvatar,
  frizittaDb,
  currentLetterUrl,
  videoARef,
  videoBRef,
  activeVideo,
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
          {modeAvatar === 'frizitta' && (
            <div
              className="flex h-full w-full items-center justify-center overflow-hidden"
              id="frizitta-player"
            >
              <AvatarStage src={frizittaSrc} />
            </div>
          )}

          {modeAvatar === 'alex' && (
            <div className="flex h-full w-full items-center justify-center">
              <AlexStage
                videoARef={videoARef}
                videoBRef={videoBRef}
                activeVideo={activeVideo}
              />
            </div>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
