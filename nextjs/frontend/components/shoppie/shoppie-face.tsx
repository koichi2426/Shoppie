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
          d="M 19 44 Q 27 36 35 44"
          fill="none"
          stroke={INK}
          strokeWidth="3.5"
          strokeLinecap="round"
          opacity="0.85"
        />
        <path
          d="M 65 44 Q 73 36 81 44"
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
          d="M 20 42 Q 27 48 34 42"
          fill="none"
          stroke={INK}
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.85"
        />
        <ellipse cx="73" cy="42" rx="7" ry="9" fill={INK} opacity="0.85" />
        <ellipse cx="75" cy="40" rx="2.5" ry="3" fill="white" opacity="0.9" />
      </>
    );
  }

  if (expression === 'loading') {
    return (
      <>
        <ellipse cx="25" cy="38" rx="6" ry="7" fill={INK} opacity="0.85" />
        <ellipse cx="75" cy="38" rx="6" ry="7" fill={INK} opacity="0.85" />
        <ellipse cx="26" cy="36" rx="2" ry="2.5" fill="white" opacity="0.9" />
        <ellipse cx="76" cy="36" rx="2" ry="2.5" fill="white" opacity="0.9" />
        <path
          d="M 23 32 Q 27 28 31 32"
          fill="none"
          stroke={INK}
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.5"
        />
        <path
          d="M 69 32 Q 73 28 77 32"
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
        <ellipse cx="28" cy="40" rx="7" ry="8" fill={INK} opacity="0.85" />
        <ellipse cx="72" cy="42" rx="7" ry="9" fill={INK} opacity="0.85" />
        <ellipse cx="30" cy="38" rx="2.5" ry="3" fill="white" opacity="0.9" />
        <ellipse cx="74" cy="40" rx="2.5" ry="3" fill="white" opacity="0.9" />
        <path
          d="M 17 34 Q 25 30 33 34"
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
        <ellipse cx="27" cy="41" rx="8" ry="10" fill={INK} opacity="0.85" />
        <ellipse cx="73" cy="41" rx="8" ry="10" fill={INK} opacity="0.85" />
        <ellipse cx="29" cy="39" rx="3" ry="3.5" fill="white" opacity="0.95" />
        <ellipse cx="75" cy="39" rx="3" ry="3.5" fill="white" opacity="0.95" />
        <circle cx="23" cy="45" r="1.5" fill="white" opacity="0.6" />
        <circle cx="77" cy="45" r="1.5" fill="white" opacity="0.6" />
      </>
    );
  }

  if (expression === 'shy') {
    return (
      <>
        <ellipse cx="29" cy="43" rx="6" ry="7" fill={INK} opacity="0.8" />
        <ellipse cx="71" cy="43" rx="6" ry="7" fill={INK} opacity="0.8" />
        <ellipse cx="30" cy="41" rx="2" ry="2.5" fill="white" opacity="0.85" />
        <ellipse cx="72" cy="41" rx="2" ry="2.5" fill="white" opacity="0.85" />
      </>
    );
  }

  if (expression === 'blink') {
    return (
      <>
        <path d="M 20 42 Q 27 44 34 42" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" opacity="0.85" />
        <path d="M 66 42 Q 73 44 80 42" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" opacity="0.85" />
      </>
    );
  }

  if (expression === 'sleepy') {
    return (
      <>
        <path d="M 21 43 Q 27 40 33 43" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" opacity="0.8" />
        <path d="M 67 43 Q 73 40 79 43" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" opacity="0.8" />
      </>
    );
  }

  if (expression === 'surprised') {
    return (
      <>
        <ellipse cx="27" cy="40" rx="9" ry="11" fill={INK} opacity="0.9" />
        <ellipse cx="73" cy="40" rx="9" ry="11" fill={INK} opacity="0.9" />
        <ellipse cx="29" cy="38" rx="3" ry="3.5" fill="white" opacity="0.95" />
        <ellipse cx="75" cy="38" rx="3" ry="3.5" fill="white" opacity="0.95" />
      </>
    );
  }

  if (expression === 'lookLeft') {
    return (
      <>
        <ellipse cx="24" cy="42" rx="7" ry="9" fill={INK} opacity="0.85" />
        <ellipse cx="58" cy="42" rx="7" ry="9" fill={INK} opacity="0.85" />
        <ellipse cx="25" cy="40" rx="2.5" ry="3" fill="white" opacity="0.9" />
        <ellipse cx="59" cy="40" rx="2.5" ry="3" fill="white" opacity="0.9" />
      </>
    );
  }

  if (expression === 'lookRight') {
    return (
      <>
        <ellipse cx="42" cy="42" rx="7" ry="9" fill={INK} opacity="0.85" />
        <ellipse cx="76" cy="42" rx="7" ry="9" fill={INK} opacity="0.85" />
        <ellipse cx="43" cy="40" rx="2.5" ry="3" fill="white" opacity="0.9" />
        <ellipse cx="77" cy="40" rx="2.5" ry="3" fill="white" opacity="0.9" />
      </>
    );
  }

  // happy, listening
  return (
    <>
      <ellipse cx="27" cy="42" rx="7" ry="9" fill={INK} opacity="0.85" />
      <ellipse cx="73" cy="42" rx="7" ry="9" fill={INK} opacity="0.85" />
      <ellipse cx="29" cy="40" rx="2.5" ry="3" fill="white" opacity="0.9" />
      <ellipse cx="75" cy="40" rx="2.5" ry="3" fill="white" opacity="0.9" />
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
    case 'sleepy':
      return <ellipse cx="50" cy="62" rx="7" ry="5" fill="none" stroke={INK} strokeWidth="2.5" opacity="0.6" />;
    case 'surprised':
      return <ellipse cx="50" cy="60" rx="7" ry="9" fill={INK} opacity="0.7" />;
    case 'blink':
      return (
        <path
          d="M 38 59 Q 50 67 62 59"
          fill="none"
          stroke={INK}
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.75"
        />
      );
    case 'lookLeft':
    case 'lookRight':
      return (
        <path
          d="M 36 59 Q 50 68 64 59"
          fill="none"
          stroke={INK}
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.75"
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
