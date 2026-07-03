interface Props {
  size?: number
  className?: string
}

export default function PlanetIcon({ size = 40, className = '' }: Props) {
  const u = `pi${size}`
  const cx = size / 2
  const cy = size / 2
  const pR = size * 0.26   // slightly smaller planet → more room for rings
  const angle = -16

  // 3 Saturn rings with clear gaps between them
  // ry values: 0.08 / 0.14 / 0.20 → gap of 0.06*size between each
  // strokeWidth intentionally thin so the gap stays visible
  const rings = [
    { ry: size * 0.082, sw: size * 0.022, bOp: 0.45, fOp: 0.70, bClr: '#2d1680', fClr: '#4820b0' },
    { ry: size * 0.140, sw: size * 0.028, bOp: 0.60, fOp: 0.88, bClr: '#3d1a99', fClr: '#6535d8' }, // brightest
    { ry: size * 0.198, sw: size * 0.018, bOp: 0.35, fOp: 0.55, bClr: '#221068', fClr: '#3a1fa0' },
  ]

  return (
    <svg
      width={size} height={size}
      viewBox={`0 0 ${size} ${size}`}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <radialGradient id={`${u}-g`} cx="34%" cy="26%" r="70%">
          <stop offset="0%"   stopColor="#e0d4ff" />
          <stop offset="12%"  stopColor="#b08aff" />
          <stop offset="36%"  stopColor="#8b5cf6" />
          <stop offset="68%"  stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#5b21b6" />
        </radialGradient>
        <radialGradient id={`${u}-s`} cx="30%" cy="22%" r="42%">
          <stop offset="0%"   stopColor="rgba(255,255,255,0.72)" />
          <stop offset="50%"  stopColor="rgba(255,255,255,0.10)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        <clipPath id={`${u}-f`}>
          <rect x={0} y={cy} width={size} height={size} />
        </clipPath>
      </defs>

      {/* Back ring arcs (planet will cover center, showing only sides) */}
      {rings.map(({ ry, sw, bOp, bClr }, i) => (
        <ellipse key={i} cx={cx} cy={cy} rx={size * 0.47} ry={ry}
          fill="none" stroke={bClr} strokeWidth={sw}
          transform={`rotate(${angle} ${cx} ${cy})`}
          opacity={bOp}
        />
      ))}

      {/* Planet */}
      <circle cx={cx} cy={cy} r={pR} fill={`url(#${u}-g)`} />
      <circle cx={cx} cy={cy} r={pR} fill={`url(#${u}-s)`} />

      {/* Front ring arcs (lower half only → appear in front of planet) */}
      {rings.map(({ ry, sw, fOp, fClr }, i) => (
        <ellipse key={i} cx={cx} cy={cy} rx={size * 0.47} ry={ry}
          fill="none" stroke={fClr} strokeWidth={sw * 1.1}
          transform={`rotate(${angle} ${cx} ${cy})`}
          clipPath={`url(#${u}-f)`}
          opacity={fOp}
        />
      ))}
    </svg>
  )
}
