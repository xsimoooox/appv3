export default function BrandLogo({ compact = false, inverse = false, hideText = false, markSize = 48, className = '' }) {
  return (
    <div className={`vox-brand ${compact ? 'vox-brand--compact' : ''} ${className}`}>
      <span
        className={`vox-brand__mark ${inverse ? 'vox-brand__mark--inverse' : ''}`}
        style={{ width: markSize, height: Math.round(markSize * 0.8) }}
      >
        <img src="/voxmanus-logo.png" alt="Logo" aria-hidden="true" />
      </span>
      {!hideText && <span className={inverse ? 'text-white' : 'text-[#0000B4]'}>VoxManus</span>}
    </div>
  );
}
