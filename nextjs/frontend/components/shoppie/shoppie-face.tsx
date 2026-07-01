import type { ShoppieExpression } from '@/types/shoppie-expression';

interface ShoppieFaceProps {
  expression: ShoppieExpression;
}

const INK = '#1e1b4b';

function Eyes({ expression }: ShoppieFaceProps) {
  if (expression === 'cheerful') {
    return (
      <>
        <path
          d="M 24 44 Q 32 36 40 44"
          fill="none"
          stroke={INK}
          strokeWidth="3.5"
          strokeLinecap="round"
          opacity="0.85"
        />
        <path
          d="M 60 44 Q 68 36 76 44"
          fill="none"
          stroke={INK}
          strokeWidth="3.5"
          strokeLinecap="round"
          opacity="0.85"
        />
      </>
    );
  }

  if (expression === 'wink') {
    return (
      <>
        <path
          d="M 25 42 Q 32 48 39 42"
          fill="none"
          stroke={INK}
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.85"
        />
        <ellipse cx="68" cy="42" rx="7" ry="9" fill={INK} opacity="0.85" />
        <ellipse cx="70" cy="40" rx="2.5" ry="3" fill="white" opacity="0.9" />
      </>
    );
  }

  if (expression === 'loading') {
    return (
      <>
        <ellipse cx="30" cy="38" rx="6" ry="7" fill={INK} opacity="0.85" />
        <ellipse cx="70" cy="38" rx="6" ry="7" fill={INK} opacity="0.85" />
        <ellipse cx="31" cy="36" rx="2" ry="2.5" fill="white" opacity="0.9" />
        <ellipse cx="71" cy="36" rx="2" ry="2.5" fill="white" opacity="0.9" />
        <path
          d="M 28 32 Q 32 28 36 32"
          fill="none"
          stroke={INK}
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.5"
        />
        <path
          d="M 64 32 Q 68 28 72 32"
          fill="none"
          stroke={INK}
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.5"
        />
      </>
    );
  }

  if (expression === 'curious') {
    return (
      <>
        <ellipse cx="33" cy="40" rx="7" ry="8" fill={INK} opacity="0.85" />
        <ellipse cx="67" cy="42" rx="7" ry="9" fill={INK} opacity="0.85" />
        <ellipse cx="35" cy="38" rx="2.5" ry="3" fill="white" opacity="0.9" />
        <ellipse cx="69" cy="40" rx="2.5" ry="3" fill="white" opacity="0.9" />
        <path
          d="M 22 34 Q 30 30 38 34"
          fill="none"
          stroke={INK}
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.55"
        />
      </>
    );
  }

  if (expression === 'excited') {
    return (
      <>
        <ellipse cx="32" cy="41" rx="8" ry="10" fill={INK} opacity="0.85" />
        <ellipse cx="68" cy="41" rx="8" ry="10" fill={INK} opacity="0.85" />
        <ellipse cx="34" cy="39" rx="3" ry="3.5" fill="white" opacity="0.95" />
        <ellipse cx="70" cy="39" rx="3" ry="3.5" fill="white" opacity="0.95" />
        <circle cx="28" cy="45" r="1.5" fill="white" opacity="0.6" />
        <circle cx="72" cy="45" r="1.5" fill="white" opacity="0.6" />
      </>
    );
  }

  if (expression === 'shy') {
    return (
      <>
        <ellipse cx="34" cy="43" rx="6" ry="7" fill={INK} opacity="0.8" />
        <ellipse cx="66" cy="43" rx="6" ry="7" fill={INK} opacity="0.8" />
        <ellipse cx="35" cy="41" rx="2" ry="2.5" fill="white" opacity="0.85" />
        <ellipse cx="67" cy="41" rx="2" ry="2.5" fill="white" opacity="0.85" />
      </>
    );
  }

  // happy, listening (eyes same; mouth differs)
  return (
    <>
      <ellipse cx="32" cy="42" rx="7" ry="9" fill={INK} opacity="0.85" />
      <ellipse cx="68" cy="42" rx="7" ry="9" fill={INK} opacity="0.85" />
      <ellipse cx="34" cy="40" rx="2.5" ry="3" fill="white" opacity="0.9" />
      <ellipse cx="70" cy="40" rx="2.5" ry="3" fill="white" opacity="0.9" />
    </>
  );
}

function Mouth({ expression }: ShoppieFaceProps) {
  switch (expression) {
    case 'listening':
      return <ellipse cx="50" cy="58" rx="6" ry="8" fill={INK} opacity="0.7" />;
    case 'loading':
      return (
        <ellipse cx="50" cy="60" rx="4" ry="5" fill="none" stroke={INK} strokeWidth="2.5" opacity="0.65" />
      );
    case 'excited':
      return (
        <path
          d="M 38 56 Q 50 70 62 56 Q 50 64 38 56"
          fill={INK}
          opacity="0.75"
        />
      );
    case 'cheerful':
      return (
        <path
          d="M 32 57 Q 50 76 68 57"
          fill="none"
          stroke={INK}
          strokeWidth="4"
          strokeLinecap="round"
          opacity="0.8"
        />
      );
    case 'wink':
      return (
        <path
          d="M 36 59 Q 50 70 64 59"
          fill="none"
          stroke={INK}
          strokeWidth="3.5"
          strokeLinecap="round"
          opacity="0.8"
        />
      );
    case 'curious':
      return <ellipse cx="50" cy="60" rx="5" ry="6" fill={INK} opacity="0.65" />;
    case 'shy':
      return (
        <path
          d="M 40 60 Q 50 66 60 60"
          fill="none"
          stroke={INK}
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.7"
        />
      );
    default:
      return (
        <path
          d="M 34 58 Q 50 72 66 58"
          fill="none"
          stroke={INK}
          strokeWidth="3.5"
          strokeLinecap="round"
          opacity="0.75"
        />
      );
  }
}

function Blush({ expression }: ShoppieFaceProps) {
  const opacity =
    expression === 'shy' || expression === 'excited'
      ? 0.5
      : expression === 'cheerful' || expression === 'wink'
        ? 0.42
        : 0.35;

  return (
    <>
      <ellipse cx="22" cy="52" rx="8" ry="5" fill="#fda4af" opacity={opacity} />
      <ellipse cx="78" cy="52" rx="8" ry="5" fill="#fda4af" opacity={opacity} />
    </>
  );
}

export function ShoppieFace({ expression }: ShoppieFaceProps) {
  return (
    <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" aria-hidden="true">
      <Eyes expression={expression} />
      <Mouth expression={expression} />
      <Blush expression={expression} />
    </svg>
  );
}
