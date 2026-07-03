interface Props {
  size?: number
  className?: string
}

export default function PlanetIcon({ size = 40, className = '' }: Props) {
  const u = `pi${size}`
  const cx = size / 2
  const cy = size / 2
  const pR = size * 0.27
  const angle = -18

  // All rings share the same ry/rx ratio → they look co-planar (same flat disc)
  // The gap between rings comes from different rx, not different ry
  const FLAT = 0.19  // ry = rx * FLAT
  const rings = [
    { rx: size * 0.42, sw: size * 0.019, bOp: 0.48, fOp: 0.72 },
    { rx: size * 0.50, sw: size * 0.026, bOp: 0.62, fOp: 0.92 }, // main bright ring
    { rx: size * 0.57, sw: size * 0.016, bOp: 0.36, fOp: 0.56 },
  ].map(r => ({ ...r, ry: r.rx * FLAT }))

  return (
    <svg
      width={size} height={size}
      viewBox={`0 0 ${size} ${size}`}
      xmlns="http://www.w3.org/2000/svg"
      overflow="visible"
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

      {/* Back arcs — planet will cover the center portion */}
      {rings.map(({ rx, ry, sw, bOp }, i) => (
        <ellipse key={i} cx={cx} cy={cy} rx={rx} ry={ry}
          fill="none" stroke="#6030c8" strokeWidth={sw}
          transform={`rotate(${angle} ${cx} ${cy})`}
          opacity={bOp}
        />
      ))}

      {/* Planet */}
      <circle cx={cx} cy={cy} r={pR} fill={`url(#${u}-g)`} />
      <circle cx={cx} cy={cy} r={pR} fill={`url(#${u}-s)`} />

      {/* Front arcs — clipped to lower half, drawn on top of planet */}
      {rings.map(({ rx, ry, sw, fOp }, i) => (
        <ellipse key={i} cx={cx} cy={cy} rx={rx} ry={ry}
          fill="none" stroke="#a080ff" strokeWidth={sw * 1.1}
          transform={`rotate(${angle} ${cx} ${cy})`}
          clipPath={`url(#${u}-f)`}
          opacity={fOp}
        />
      ))}
    </svg>
  )
}
