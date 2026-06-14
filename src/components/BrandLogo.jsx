export default function BrandLogo({ compact = false, inverse = false, className = '' }) {
  return (
    <div className={`vox-brand ${compact ? 'vox-brand--compact' : ''} ${className}`}>
      <span className={`vox-brand__mark ${inverse ? 'vox-brand__mark--inverse' : ''}`}>
        <img src="/voxmanus-logo.png" alt="" aria-hidden="true" />
      </span>
      <span className={inverse ? 'text-white' : 'text-[#0000B4]'}>VoxManus</span>
    </div>
  );
}
