interface Props {
  size?: number
  className?: string
}

export default function PlanetIcon({ size = 40, className = '' }: Props) {
  const u = `pi${size}`
  const cx = size / 2
  const cy = size / 2
  const pR = size * 0.28
  const ringRx = size * 0.445
  const angle = -18

  // Ring configs: [ry, strokeWidth, backOpacity, frontOpacity]
  const rings: [number, number, number, number][] = [
    [size * 0.086, size * 0.014, 0.55, 0.80],
    [size * 0.097, size * 0.010, 0.40, 0.60],
    [size * 0.109, size * 0.008, 0.28, 0.42],
  ]

  return (
    <svg
      width={size} height={size}
      viewBox={`0 0 ${size} ${size}`}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        {/* 3D glossy planet gradient */}
        <radialGradient id={`${u}-g`} cx="34%" cy="26%" r="70%">
          <stop offset="0%"   stopColor="#ddd0ff" />
          <stop offset="14%"  stopColor="#a87fff" />
          <stop offset="38%"  stopColor="#8b5cf6" />
          <stop offset="70%"  stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#5b21b6" />
        </radialGradient>
        {/* Specular highlight */}
        <radialGradient id={`${u}-s`} cx="30%" cy="22%" r="40%">
          <stop offset="0%"   stopColor="rgba(255,255,255,0.65)" />
          <stop offset="55%"  stopColor="rgba(255,255,255,0.08)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        {/* Clip: lower half = front of planet */}
        <clipPath id={`${u}-f`}>
          <rect x={0} y={cy} width={size} height={size} />
        </clipPath>
      </defs>

      {/* Back rings (drawn before planet — planet covers them) */}
      {rings.map(([ry, sw, backOp], i) => (
        <ellipse key={i} cx={cx} cy={cy} rx={ringRx} ry={ry}
          fill="none" stroke="#3b1a8c" strokeWidth={sw}
          transform={`rotate(${angle} ${cx} ${cy})`}
          opacity={backOp}
        />
      ))}

      {/* Planet */}
      <circle cx={cx} cy={cy} r={pR} fill={`url(#${u}-g)`} />
      {/* Specular */}
      <circle cx={cx} cy={cy} r={pR} fill={`url(#${u}-s)`} />

      {/* Front rings (clipped to lower half — appear in front of planet) */}
      {rings.map(([ry, sw, , frontOp], i) => (
        <ellipse key={i} cx={cx} cy={cy} rx={ringRx} ry={ry}
          fill="none" stroke="#5b21b6" strokeWidth={sw * 1.2}
          transform={`rotate(${angle} ${cx} ${cy})`}
          clipPath={`url(#${u}-f)`}
          opacity={frontOp}
        />
      ))}
    </svg>
  )
}
