interface Props {
  size?: number
  className?: string
}

export default function PlanetIcon({ size = 40, className = '' }: Props) {
  const u = `pi${size}`
  const cx = size / 2
  const cy = size / 2
  const pR = size * 0.285
  const angle = -16

  // 3 rings with clearly distinct ry so they're visibly separate
  // [rx, ry, strokeWidth, backOpacity, frontOpacity, backColor, frontColor]
  const rings: [number, number, number, number, number, string, string][] = [
    [size * 0.46, size * 0.095, size * 0.018, 0.50, 0.75, '#2e1580', '#4a22b8'],
    [size * 0.46, size * 0.130, size * 0.013, 0.60, 0.85, '#3d1a99', '#6030cc'],  // brightest
    [size * 0.46, size * 0.165, size * 0.010, 0.35, 0.55, '#251270', '#3a1fa0'],
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
          <stop offset="0%"   stopColor="rgba(255,255,255,0.70)" />
          <stop offset="50%"  stopColor="rgba(255,255,255,0.10)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        {/* Clip lower half → front arcs appear on top of planet */}
        <clipPath id={`${u}-f`}>
          <rect x={0} y={cy} width={size} height={size} />
        </clipPath>
      </defs>

      {/* Back ring arcs (planet will cover their center portion) */}
      {rings.map(([rx, ry, sw, backOp, , backColor], i) => (
        <ellipse key={i} cx={cx} cy={cy} rx={rx} ry={ry}
          fill="none" stroke={backColor} strokeWidth={sw}
          transform={`rotate(${angle} ${cx} ${cy})`}
          opacity={backOp}
        />
      ))}

      {/* Planet sphere */}
      <circle cx={cx} cy={cy} r={pR} fill={`url(#${u}-g)`} />
      {/* Specular highlight */}
      <circle cx={cx} cy={cy} r={pR} fill={`url(#${u}-s)`} />

      {/* Front ring arcs (clipped to lower half, drawn on top of planet) */}
      {rings.map(([rx, ry, sw, , frontOp, , frontColor], i) => (
        <ellipse key={i} cx={cx} cy={cy} rx={rx} ry={ry}
          fill="none" stroke={frontColor} strokeWidth={sw * 1.15}
          transform={`rotate(${angle} ${cx} ${cy})`}
          clipPath={`url(#${u}-f)`}
          opacity={frontOp}
        />
      ))}
    </svg>
  )
}
