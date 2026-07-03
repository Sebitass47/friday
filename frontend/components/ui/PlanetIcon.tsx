interface Props {
  size?: number
  className?: string
}

export default function PlanetIcon({ size = 40, className = '' }: Props) {
  const id = `tOrb-${size}`
  const cx = size / 2
  const cy = size / 2
  const planetR = size * 0.3
  const ringRx = size * 0.46
  const ringRy = size * 0.094
  const sw = size * 0.022

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <radialGradient id={id} cx="36%" cy="30%" r="72%">
          <stop offset="0%"   stopColor="#e2d6ff" />
          <stop offset="32%"  stopColor="#8a5cf5" />
          <stop offset="72%"  stopColor="#5a34c9" />
          <stop offset="100%" stopColor="#241065" />
        </radialGradient>
      </defs>
      {/* glow */}
      <ellipse cx={cx} cy={cy} rx={planetR * 1.7} ry={planetR * 1.7} fill="#5a34c9" opacity="0.18" />
      {/* ring */}
      <ellipse
        cx={cx} cy={cy}
        rx={ringRx} ry={ringRy}
        fill="none"
        stroke="#8a5cf5"
        strokeWidth={sw}
        transform={`rotate(-14 ${cx} ${cy})`}
        opacity="0.9"
      />
      {/* planet */}
      <circle cx={cx} cy={cy} r={planetR} fill={`url(#${id})`} />
    </svg>
  )
}
