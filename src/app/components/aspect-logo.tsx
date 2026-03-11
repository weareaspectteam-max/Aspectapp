interface AspectLogoProps {
  className?: string;
  width?: number | string;
  height?: number | string;
}

export function AspectLogo({ className, width = 'auto', height = 'auto' }: AspectLogoProps) {
  return (
    <svg
      viewBox="0 0 320 80"
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      className={className}
    >
      <defs>
        <linearGradient id="aspect-logo-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#ff8fab" />
          <stop offset="20%"  stopColor="#ffb347" />
          <stop offset="40%"  stopColor="#ffd166" />
          <stop offset="60%"  stopColor="#a8e6cf" />
          <stop offset="80%"  stopColor="#9dd9ea" />
          <stop offset="100%" stopColor="#74b9ff" />
        </linearGradient>
        <filter id="aspect-logo-glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Subtle glow layer */}
      <text
        x="160"
        y="52"
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily="'Arial Black', 'Helvetica Neue', Arial, sans-serif"
        fontWeight="900"
        fontSize="34"
        letterSpacing="6"
        fill="url(#aspect-logo-gradient)"
        opacity="0.25"
        filter="url(#aspect-logo-glow)"
      >
        WE ARE ASPECT
      </text>

      {/* Main text */}
      <text
        x="160"
        y="50"
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily="'Arial Black', 'Helvetica Neue', Arial, sans-serif"
        fontWeight="900"
        fontSize="34"
        letterSpacing="6"
        fill="url(#aspect-logo-gradient)"
      >
        WE ARE ASPECT
      </text>
    </svg>
  );
}
