const INK = '#1e1b4b';
const BLUSH = '#fda4af';

interface ShoppieAppIconProps {
  size: number;
}

export function ShoppieAppIcon({ size }: ShoppieAppIconProps) {
  return (
    <div
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #22d3ee 0%, #a855f7 52%, #ec4899 100%)',
        borderRadius: '50%',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: size * 0.12,
          borderRadius: '50%',
          background: 'linear-gradient(to bottom, rgba(255,255,255,0.28), rgba(255,255,255,0))',
        }}
      />
      <svg
        viewBox="0 0 100 100"
        width={size * 0.88}
        height={size * 0.88}
        style={{ position: 'relative', display: 'block' }}
      >
        <ellipse cx="22" cy="52" rx="8" ry="5" fill={BLUSH} opacity="0.35" />
        <ellipse cx="78" cy="52" rx="8" ry="5" fill={BLUSH} opacity="0.35" />
        <ellipse cx="32" cy="42" rx="7" ry="9" fill={INK} opacity="0.85" />
        <ellipse cx="68" cy="42" rx="7" ry="9" fill={INK} opacity="0.85" />
        <ellipse cx="34" cy="40" rx="2.5" ry="3" fill="white" opacity="0.9" />
        <ellipse cx="70" cy="40" rx="2.5" ry="3" fill="white" opacity="0.9" />
        <path
          d="M 34 58 Q 50 72 66 58"
          fill="none"
          stroke={INK}
          strokeWidth="3.5"
          strokeLinecap="round"
          opacity="0.75"
        />
      </svg>
    </div>
  );
}
