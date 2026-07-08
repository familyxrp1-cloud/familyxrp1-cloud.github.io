export function PenguinMark({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      style={style}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <ellipse cx="32" cy="34" rx="22" ry="26" fill="#0d1c38" />
      <ellipse cx="32" cy="38" rx="14" ry="18" fill="#eaf2ff" />
      <ellipse cx="32" cy="14" rx="16" ry="14" fill="#0d1c38" />
      <ellipse cx="32" cy="17" rx="9" ry="8" fill="#eaf2ff" />
      <circle cx="27.5" cy="15" r="2.6" fill="#0d1c38" />
      <circle cx="36.5" cy="15" r="2.6" fill="#0d1c38" />
      <circle cx="28.3" cy="14.2" r="0.8" fill="#7fe3ff" />
      <circle cx="37.3" cy="14.2" r="0.8" fill="#7fe3ff" />
      <path d="M31 18.5 L34.5 20 L31 21.5 Z" fill="#f4c465" />
      <ellipse cx="14" cy="36" rx="4" ry="9" fill="#0d1c38" />
      <ellipse cx="50" cy="36" rx="4" ry="9" fill="#0d1c38" />
      <path d="M22 56 L26 60 L20 60 Z" fill="#f4c465" />
      <path d="M42 56 L46 60 L38 60 Z" fill="#f4c465" />
    </svg>
  );
}
