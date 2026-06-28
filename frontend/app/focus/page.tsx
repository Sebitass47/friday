'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getTasks, toggleTaskComplete, createTask } from '@/lib/api'
import { Task } from '@/lib/types'

// ─── Types ────────────────────────────────────────────────────────────────────
type BgName = 'lluvia' | 'estrellas' | 'brasas' | 'aurora' | 'cosmos'
type TimerStyle = 'anillo' | 'minimal' | 'tarjeta'
type SoundKey = 'lluvia' | 'cafeteria' | 'trafico' | 'olas' | 'bosque' | 'pajaros' | 'viento' | 'cascada' | 'fuego'
type Phase = 'work' | 'short' | 'long'

interface PomSettings { session: number; shortBreak: number; longBreak: number; cycle: number; goalHours: number }

const DEFAULT_SETTINGS: PomSettings = { session: 25, shortBreak: 5, longBreak: 15, cycle: 4, goalHours: 2 }

const BG_LIST: { key: BgName; label: string }[] = [
  { key: 'lluvia', label: 'Lluvia' },
  { key: 'estrellas', label: 'Estrellas' },
  { key: 'brasas', label: 'Brasas' },
  { key: 'aurora', label: 'Aurora' },
  { key: 'cosmos', label: 'Cosmos' },
]
const SOUND_LIST: { key: SoundKey; label: string }[] = [
  { key: 'lluvia', label: 'Lluvia' }, { key: 'cafeteria', label: 'Cafetería' },
  { key: 'trafico', label: 'Tráfico' }, { key: 'olas', label: 'Olas' },
  { key: 'bosque', label: 'Bosque' }, { key: 'pajaros', label: 'Pájaros' },
  { key: 'viento', label: 'Viento' }, { key: 'cascada', label: 'Cascada' },
  { key: 'fuego', label: 'Fuego' },
]
const LABEL_COLORS: Record<string, string> = {
  Trabajo: '#6B46E5', Personal: '#22c55e', Finanzas: '#f59e0b', Estudio: '#3b82f6',
}
const PHASE_LABEL: Record<Phase, string> = {
  work: 'CONCENTRACIÓN', short: 'DESCANSO CORTO', long: 'DESCANSO LARGO',
}
const ACCENT = '#6B46E5'

// ─── Audio Engine ─────────────────────────────────────────────────────────────
function makeNoiseBuf(ctx: AudioContext): AudioBuffer {
  const sz = ctx.sampleRate * 2
  const b = ctx.createBuffer(1, sz, ctx.sampleRate)
  const d = b.getChannelData(0)
  for (let i = 0; i < sz; i++) d[i] = Math.random() * 2 - 1
  return b
}

interface SoundHandle { gain: GainNode; stop: () => void }

function startAmbient(ctx: AudioContext, key: SoundKey): SoundHandle {
  const master = ctx.createGain()
  master.connect(ctx.destination)
  const stops: Array<() => void> = []

  function noise(lp?: number, hp?: number): AudioNode {
    const src = ctx.createBufferSource()
    src.buffer = makeNoiseBuf(ctx); src.loop = true
    let n: AudioNode = src
    if (hp) { const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp; n.connect(f); n = f }
    if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; n.connect(f); n = f }
    src.start(); stops.push(() => { try { src.stop() } catch {} }); return n
  }

  function addLFO(freq: number, amp: number, target: AudioParam) {
    const o = ctx.createOscillator(); const g = ctx.createGain()
    o.frequency.value = freq; g.gain.value = amp
    o.connect(g); g.connect(target); o.start()
    stops.push(() => { try { o.stop() } catch {} })
  }

  function layer(n: AudioNode, vol: number, lf?: number, la?: number) {
    const g = ctx.createGain(); g.gain.value = vol
    n.connect(g); g.connect(master)
    if (lf !== undefined && la !== undefined) addLFO(lf, la, g.gain)
  }

  switch (key) {
    case 'lluvia':
      layer(noise(1400), 0.55)
      layer(noise(7000, 2500), 0.18)
      break
    case 'cafeteria':
      for (let i = 0; i < 4; i++) layer(noise(650 + i * 80, 70 + i * 30), 0.17, 0.15 + i * 0.1, 0.06)
      break
    case 'trafico':
      layer(noise(180), 0.48)
      layer(noise(650, 130), 0.16, 0.1, 0.12)
      break
    case 'olas':
      layer(noise(380), 0.44, 0.07, 0.34)
      break
    case 'bosque':
      layer(noise(7000, 1200), 0.16, 0.04, 0.07)
      layer(noise(400, 80), 0.11, 0.03, 0.06)
      break
    case 'pajaros': {
      let alive = true
      const chirp = () => {
        if (!alive) return
        const freq = 2800 + Math.random() * 2200, dur = 0.07 + Math.random() * 0.11
        const osc = ctx.createOscillator(); const g = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, ctx.currentTime)
        osc.frequency.linearRampToValueAtTime(freq * (0.85 + Math.random() * 0.3), ctx.currentTime + dur)
        g.gain.setValueAtTime(0, ctx.currentTime)
        g.gain.linearRampToValueAtTime(0.13, ctx.currentTime + 0.01)
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur)
        osc.connect(g); g.connect(master); osc.start(); osc.stop(ctx.currentTime + dur + 0.05)
        setTimeout(chirp, 500 + Math.random() * 2800)
      }
      chirp()
      stops.push(() => { alive = false })
      break
    }
    case 'viento':
      layer(noise(750, 80), 0.3, 0.05, 0.22)
      break
    case 'cascada':
      layer(noise(5000, 280), 0.62)
      break
    case 'fuego':
      layer(noise(320), 0.4)
      layer(noise(2500, 700), 0.06, 4.2, 0.07)
      break
  }

  return { gain: master, stop: () => stops.forEach(f => f()) }
}

// ─── Canvas Backgrounds ────────────────────────────────────────────────────────
function bgLluvia(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext('2d')!
  const W = canvas.width, H = canvas.height
  const drops = Array.from({ length: 200 }, () => ({
    x: Math.random() * W, y: Math.random() * H,
    len: 10 + Math.random() * 22, spd: 9 + Math.random() * 13,
    a: 0.18 + Math.random() * 0.45,
  }))
  let raf = 0
  const draw = () => {
    ctx.fillStyle = 'rgba(8,6,22,0.25)'; ctx.fillRect(0, 0, W, H)
    const g = ctx.createRadialGradient(W * .38, H, 0, W * .38, H, 560)
    g.addColorStop(0, 'rgba(55,15,110,0.08)'); g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
    ctx.lineWidth = 0.8
    for (const d of drops) {
      ctx.globalAlpha = d.a; ctx.strokeStyle = 'rgba(190,210,255,0.85)'
      ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - d.len * .14, d.y + d.len); ctx.stroke()
      d.y += d.spd; d.x -= d.spd * .14
      if (d.y > H + d.len) { d.y = -d.len; d.x = Math.random() * W }
    }
    ctx.globalAlpha = 1; raf = requestAnimationFrame(draw)
  }
  ctx.fillStyle = '#080616'; ctx.fillRect(0, 0, W, H); draw()
  return () => cancelAnimationFrame(raf)
}

function bgEstrellas(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext('2d')!
  const W = canvas.width, H = canvas.height
  const stars = Array.from({ length: 340 }, () => ({
    x: Math.random() * W, y: Math.random() * H,
    r: 0.4 + Math.random() * 1.9,
    ba: 0.3 + Math.random() * 0.7,
    spd: 0.3 + Math.random() * 1.2, ph: Math.random() * Math.PI * 2,
  }))
  let t = 0, raf = 0
  const draw = () => {
    ctx.fillStyle = '#03030c'; ctx.fillRect(0, 0, W, H)
    const nb = (cx: number, cy: number, r: number, col: string) => {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
      g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
    }
    nb(W * .28, H * .38, 420, 'rgba(50,10,120,0.2)')
    nb(W * .74, H * .55, 300, 'rgba(15,35,120,0.15)')
    nb(W * .5, H * .18, 230, 'rgba(80,20,150,0.12)')
    for (const s of stars) {
      const a = s.ba * (0.45 + 0.55 * Math.sin(t * s.spd + s.ph))
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(220,210,255,${a})`
      if (s.r > 1.2) { ctx.shadowBlur = 8; ctx.shadowColor = `rgba(160,130,255,${a * .6})` }
      ctx.fill(); ctx.shadowBlur = 0
    }
    t += 0.007; raf = requestAnimationFrame(draw)
  }
  draw(); return () => cancelAnimationFrame(raf)
}

function bgBrasas(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext('2d')!
  const W = canvas.width, H = canvas.height
  const cols = ['#ff5010', '#ff7830', '#ffaa20', '#ff3800', '#ffcc30']
  const embers = Array.from({ length: 140 }, () => ({
    x: W * .15 + Math.random() * W * .7, y: H + Math.random() * 120,
    vx: (Math.random() - .5) * .9, vy: -(0.6 + Math.random() * 1.7),
    r: 0.6 + Math.random() * 2.8, a: 0.4 + Math.random() * 0.6,
    col: cols[Math.floor(Math.random() * cols.length)],
    life: Math.random(), decay: 0.003 + Math.random() * .006,
  }))
  let raf = 0
  const draw = () => {
    ctx.fillStyle = 'rgba(10,4,1,0.28)'; ctx.fillRect(0, 0, W, H)
    const g = ctx.createRadialGradient(W / 2, H, 0, W / 2, H, 480)
    g.addColorStop(0, 'rgba(180,55,8,0.1)'); g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
    for (const e of embers) {
      e.x += e.vx + Math.sin(e.life * 4) * .35; e.y += e.vy; e.life -= e.decay
      if (e.life <= 0) {
        e.x = W * .15 + Math.random() * W * .7; e.y = H + 10
        e.life = 0.6 + Math.random() * .4; e.vy = -(0.6 + Math.random() * 1.7); e.vx = (Math.random() - .5) * .9
      }
      const sz = e.r * Math.max(0, e.life)
      ctx.beginPath(); ctx.arc(e.x, e.y, sz, 0, Math.PI * 2)
      ctx.fillStyle = e.col; ctx.globalAlpha = e.a * e.life
      ctx.shadowBlur = 12; ctx.shadowColor = e.col; ctx.fill()
      ctx.shadowBlur = 0; ctx.globalAlpha = 1
    }
    raf = requestAnimationFrame(draw)
  }
  ctx.fillStyle = '#0a0401'; ctx.fillRect(0, 0, W, H); draw()
  return () => cancelAnimationFrame(raf)
}

function bgAurora(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext('2d')!
  const W = canvas.width, H = canvas.height
  // 10 fast-moving blobs with vivid colors — more movement, less opacity
  const blobs = [
    { cx: W * .2, cy: H * .35, r: 540, col: [107, 70, 229] as [number, number, number], vx: 1.1, vy: 0.7 },
    { cx: W * .7, cy: H * .18, r: 500, col: [0, 200, 185] as [number, number, number], vx: -0.8, vy: 1.2 },
    { cx: W * .5, cy: H * .65, r: 580, col: [200, 0, 230] as [number, number, number], vx: 0.9, vy: -1.0 },
    { cx: W * .85, cy: H * .75, r: 440, col: [20, 100, 255] as [number, number, number], vx: -1.2, vy: -0.6 },
    { cx: W * .3, cy: H * .82, r: 510, col: [220, 40, 160] as [number, number, number], vx: 0.65, vy: -1.1 },
    { cx: W * .62, cy: H * .42, r: 410, col: [80, 20, 215] as [number, number, number], vx: -1.0, vy: 0.8 },
    { cx: W * .08, cy: H * .6, r: 460, col: [0, 180, 220] as [number, number, number], vx: 1.3, vy: 0.45 },
    { cx: W * .92, cy: H * .38, r: 490, col: [165, 0, 255] as [number, number, number], vx: -0.7, vy: 1.2 },
    { cx: W * .45, cy: H * .08, r: 420, col: [0, 225, 160] as [number, number, number], vx: 0.85, vy: 0.95 },
    { cx: W * .78, cy: H * .92, r: 470, col: [255, 60, 120] as [number, number, number], vx: -0.75, vy: -0.85 },
  ]
  let raf = 0
  const draw = () => {
    ctx.fillStyle = '#060010'; ctx.fillRect(0, 0, W, H)
    for (const b of blobs) {
      b.cx += b.vx; b.cy += b.vy
      if (b.cx < -b.r * .35 || b.cx > W + b.r * .35) b.vx *= -1
      if (b.cy < -b.r * .35 || b.cy > H + b.r * .35) b.vy *= -1
      const [r, g, bl] = b.col
      const grd = ctx.createRadialGradient(b.cx, b.cy, 0, b.cx, b.cy, b.r)
      grd.addColorStop(0, `rgba(${r},${g},${bl},0.15)`)
      grd.addColorStop(.5, `rgba(${r},${g},${bl},0.06)`)
      grd.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H)
    }
    raf = requestAnimationFrame(draw)
  }
  draw(); return () => cancelAnimationFrame(raf)
}

// 3D warp-speed star field with perspective projection
function bgCosmos(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext('2d')!
  const W = canvas.width, H = canvas.height
  const FOCAL = 500, SPEED = 0.0018, N = 650
  interface Star3D { x: number; y: number; z: number; px: number; py: number; purple: boolean }
  const stars: Star3D[] = Array.from({ length: N }, () => {
    const z = 0.05 + Math.random() * .95
    const x = (Math.random() - .5) * 2, y = (Math.random() - .5) * 2
    return { x, y, z, px: x / z * FOCAL + W / 2, py: y / z * FOCAL + H / 2, purple: Math.random() > .7 }
  })
  const clouds = [
    { x: W * .32, y: H * .3, r: 300, c: 'rgba(60,10,150,0.14)' },
    { x: W * .68, y: H * .65, r: 240, c: 'rgba(100,30,190,0.11)' },
    { x: W * .5, y: H * .48, r: 380, c: 'rgba(30,0,90,0.09)' },
    { x: W * .18, y: H * .7, r: 200, c: 'rgba(20,50,120,0.08)' },
  ]
  let raf = 0
  const draw = () => {
    ctx.fillStyle = 'rgba(0,0,6,0.22)'; ctx.fillRect(0, 0, W, H)
    for (const c of clouds) {
      const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r)
      g.addColorStop(0, c.c); g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
    }
    // Center galaxy glow
    const cg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 320)
    cg.addColorStop(0, 'rgba(80,30,180,0.1)'); cg.addColorStop(.6, 'rgba(30,10,70,0.05)'); cg.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = cg; ctx.fillRect(0, 0, W, H)

    for (const s of stars) {
      const ppx = s.px, ppy = s.py
      s.z -= SPEED
      if (s.z <= 0.004) {
        s.z = 0.75 + Math.random() * .25
        s.x = (Math.random() - .5) * 2; s.y = (Math.random() - .5) * 2
        s.px = s.x / s.z * FOCAL + W / 2; s.py = s.y / s.z * FOCAL + H / 2
        continue
      }
      const px = s.x / s.z * FOCAL + W / 2, py = s.y / s.z * FOCAL + H / 2
      if (px < -40 || px > W + 40 || py < -40 || py > H + 40) {
        s.z = 0.75 + Math.random() * .25
        s.x = (Math.random() - .5) * 2; s.y = (Math.random() - .5) * 2
        s.px = s.x / s.z * FOCAL + W / 2; s.py = s.y / s.z * FOCAL + H / 2
        continue
      }
      const cl = 1 - s.z
      const alpha = Math.min(1, cl * 1.9)
      const size = cl * 2.8
      // Trail — line from previous position
      ctx.beginPath(); ctx.moveTo(ppx, ppy); ctx.lineTo(px, py)
      ctx.strokeStyle = s.purple ? `rgba(185,155,255,${alpha * .55})` : `rgba(255,255,255,${alpha * .45})`
      ctx.lineWidth = size * .38; ctx.stroke()
      // Star dot
      ctx.beginPath(); ctx.arc(px, py, Math.max(.2, size), 0, Math.PI * 2)
      ctx.fillStyle = s.purple ? `rgba(200,170,255,${alpha})` : `rgba(255,255,255,${alpha})`
      if (cl > .6) { ctx.shadowBlur = 6; ctx.shadowColor = 'rgba(150,120,255,.5)' }
      ctx.fill(); ctx.shadowBlur = 0
      s.px = px; s.py = py
    }
    raf = requestAnimationFrame(draw)
  }
  ctx.fillStyle = '#000006'; ctx.fillRect(0, 0, W, H); draw()
  return () => cancelAnimationFrame(raf)
}

const BG_RUNNERS: Record<BgName, (c: HTMLCanvasElement) => () => void> = {
  lluvia: bgLluvia, estrellas: bgEstrellas, brasas: bgBrasas, aurora: bgAurora, cosmos: bgCosmos,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
function fmtFocus(s: number) {
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
}
function todayStr() {
  return new Date().toISOString().split('T')[0]
}

// ─── Controls sub-component ───────────────────────────────────────────────────
function Controls({ running, toggle, reset, skip, openSettings }: {
  running: boolean; toggle: () => void; reset: () => void; skip: () => void; openSettings: () => void
}) {
  return (
    <div className="flex items-center gap-3">
      <button onClick={toggle}
        className="flex items-center gap-2 px-7 py-2.5 rounded-full font-semibold text-sm text-white transition-all hover:opacity-90 active:scale-95"
        style={{ background: `linear-gradient(135deg,${ACCENT},#8B5CF6)`, boxShadow: `0 4px 24px ${ACCENT}55` }}
      >
        {running ? '⏸ Pausar' : '▶ Iniciar'}
      </button>
      <button onClick={reset} title="Reiniciar"
        className="w-10 h-10 rounded-full bg-white/[0.07] border border-white/10 text-white/55 hover:bg-white/[0.13] hover:text-white/80 transition-all text-base active:scale-95"
      >↺</button>
      <button onClick={skip} title="Saltar fase"
        className="w-10 h-10 rounded-full bg-white/[0.07] border border-white/10 text-white/55 hover:bg-white/[0.13] hover:text-white/80 transition-all text-base active:scale-95"
      >⇥</button>
      <button onClick={openSettings} title="Ajustes"
        className="w-10 h-10 rounded-full bg-white/[0.07] border border-white/10 text-white/55 hover:bg-white/[0.13] hover:text-white/80 transition-all active:scale-95"
      >
        <span className="text-sm">⚙</span>
      </button>
    </div>
  )
}

// ─── Task card ────────────────────────────────────────────────────────────────
function TaskCard({ task, onToggle }: { task: Task; onToggle: (id: string) => void }) {
  const color = LABEL_COLORS[task.label ?? ''] ?? ACCENT
  return (
    <div className="rounded-xl px-3 py-2.5 transition-all hover:bg-white/[0.04]"
      style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderLeft: `2px solid ${color}55` }}
    >
      <div className="flex items-start gap-2.5">
        <button onClick={() => onToggle(task.id)}
          className="mt-0.5 w-4 h-4 rounded-full border flex-shrink-0 transition-all hover:scale-110 flex items-center justify-center"
          style={task.is_completed
            ? { background: color, borderColor: color }
            : { borderColor: 'rgba(255,255,255,0.3)' }
          }
        >
          {task.is_completed && <span className="text-white text-[7px] leading-none">✓</span>}
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] text-white/80 leading-snug break-words"
            style={task.is_completed ? { textDecoration: 'line-through', opacity: 0.4 } : {}}
          >{task.title}</p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {task.label && LABEL_COLORS[task.label] && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                style={{ background: `${color}22`, color }}>
                {task.label}
              </span>
            )}
            {task.reminder_at && (
              <span className="text-[9px] text-white/30">🕐 {task.reminder_at.slice(11, 16)}</span>
            )}
          </div>
        </div>
        {task.is_starred && <span className="text-[11px] text-yellow-400 flex-shrink-0 mt-0.5">★</span>}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function FocusPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  // Auth
  useEffect(() => {
    if (!localStorage.getItem('token')) router.push('/login')
    else setReady(true)
  }, [router])

  // Background & style
  const [bg, setBg] = useState<BgName>('aurora')
  const [timerStyle, setTimerStyle] = useState<TimerStyle>('anillo')

  // Settings
  const [settings, setSettings] = useState<PomSettings>(DEFAULT_SETTINGS)
  const [draftSettings, setDraftSettings] = useState<PomSettings>(DEFAULT_SETTINGS)
  const [showSettings, setShowSettings] = useState(false)

  // Timer state
  const [phase, setPhase] = useState<Phase>('work')
  const [secs, setSecs] = useState(DEFAULT_SETTINGS.session * 60)
  const [running, setRunning] = useState(false)
  const [sessionsDone, setSessionsDone] = useState(0)
  const [totalFocused, setTotalFocused] = useState(0)

  // UI toggles
  const [showTasks, setShowTasks] = useState(true)
  const [showSounds, setShowSounds] = useState(true)
  const [zen, setZen] = useState(false)

  // Sounds
  const [volumes, setVolumes] = useState<Record<SoundKey, number>>(
    Object.fromEntries(SOUND_LIST.map(s => [s.key, 0])) as Record<SoundKey, number>
  )

  // Tasks
  const [tasks, setTasks] = useState<Task[]>([])
  const [newTitle, setNewTitle] = useState('')
  const [newLabel, setNewLabel] = useState('Trabajo')

  // Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const cleanupBgRef = useRef<(() => void) | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const handlesRef = useRef<Partial<Record<SoundKey, SoundHandle>>>({})
  const justRanOutRef = useRef(false)

  // Sync mutable refs so timer callbacks always read fresh values
  const phaseRef = useRef(phase)
  const sessionsDoneRef = useRef(sessionsDone)
  const settingsRef = useRef(settings)
  const totalFocusedRef = useRef(totalFocused)
  phaseRef.current = phase
  sessionsDoneRef.current = sessionsDone
  settingsRef.current = settings
  totalFocusedRef.current = totalFocused

  // ── Load tasks ──────────────────────────────────────────────────────────────
  const loadTasks = useCallback(async () => {
    try {
      const all = await getTasks({ is_event: false })
      const today = todayStr()
      setTasks(all.filter(t => t.due_date === today && t.recurrence === null))
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { if (ready) loadTasks() }, [ready, loadTasks])

  // ── Canvas background ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!ready || !canvasRef.current) return
    const canvas = canvasRef.current
    canvas.width = window.innerWidth; canvas.height = window.innerHeight
    cleanupBgRef.current?.()
    cleanupBgRef.current = BG_RUNNERS[bg](canvas)
    const onResize = () => {
      canvas.width = window.innerWidth; canvas.height = window.innerHeight
      cleanupBgRef.current?.()
      cleanupBgRef.current = BG_RUNNERS[bg](canvas)
    }
    window.addEventListener('resize', onResize)
    return () => { window.removeEventListener('resize', onResize); cleanupBgRef.current?.() }
  }, [bg, ready])

  // ── Timer logic ─────────────────────────────────────────────────────────────
  const advancePhase = useCallback(() => {
    const p = phaseRef.current
    const done = sessionsDoneRef.current
    const s = settingsRef.current
    const nextDone = p === 'work' ? done + 1 : done
    const nextPhase: Phase = p === 'work'
      ? (nextDone % s.cycle === 0 ? 'long' : 'short')
      : 'work'
    const nextSecs = nextPhase === 'work' ? s.session * 60
      : nextPhase === 'short' ? s.shortBreak * 60
      : s.longBreak * 60
    setPhase(nextPhase)
    setSessionsDone(nextDone)
    setSecs(nextSecs)
    if (p === 'work') setTotalFocused(tf => tf + s.session * 60)
    // Bell
    try {
      const ctx = audioCtxRef.current
      if (ctx && ctx.state !== 'closed') {
        const osc = ctx.createOscillator(); const g = ctx.createGain()
        osc.frequency.value = 880; osc.type = 'sine'
        g.gain.setValueAtTime(0.3, ctx.currentTime)
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2)
        osc.connect(g); g.connect(ctx.destination)
        osc.start(); osc.stop(ctx.currentTime + 1.3)
      }
    } catch { /* ignore */ }
  }, [])

  const advanceRef = useRef(advancePhase)
  advanceRef.current = advancePhase

  // Countdown interval
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      setSecs(prev => {
        if (prev <= 1) { justRanOutRef.current = true; return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [running])

  // Fire phase advance when timer hits 0
  useEffect(() => {
    if (secs === 0 && justRanOutRef.current) {
      justRanOutRef.current = false
      advanceRef.current()
    }
  }, [secs])

  function resetTimer() {
    setRunning(false); setPhase('work')
    setSecs(settings.session * 60); setSessionsDone(0); setTotalFocused(0)
  }
  function skipPhase() { advanceRef.current() }

  // ── Sounds ──────────────────────────────────────────────────────────────────
  function ensureCtx(): AudioContext {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext()
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume()
    return audioCtxRef.current
  }

  function setVolume(key: SoundKey, vol: number) {
    setVolumes(v => ({ ...v, [key]: vol }))
    const ctx = ensureCtx()
    const handle = handlesRef.current[key]
    if (vol > 0) {
      if (!handle) {
        const h = startAmbient(ctx, key)
        h.gain.gain.value = vol
        handlesRef.current[key] = h
      } else {
        handle.gain.gain.value = vol
      }
    } else if (handle) {
      handle.stop()
      try { handle.gain.disconnect() } catch { /* ignore */ }
      delete handlesRef.current[key]
    }
  }

  useEffect(() => {
    return () => {
      Object.values(handlesRef.current).forEach(h => {
        try { h?.stop(); h?.gain.disconnect() } catch { /* ignore */ }
      })
      try { audioCtxRef.current?.close() } catch { /* ignore */ }
    }
  }, [])

  // ── Tasks ───────────────────────────────────────────────────────────────────
  async function doToggle(id: string) {
    try { await toggleTaskComplete(id); await loadTasks() } catch { /* ignore */ }
  }
  async function addTask() {
    if (!newTitle.trim()) return
    try {
      await createTask({ title: newTitle.trim(), label: newLabel, due_date: todayStr(), is_event: false })
      setNewTitle(''); await loadTasks()
    } catch { /* ignore */ }
  }

  // ── Settings ────────────────────────────────────────────────────────────────
  function openSettings() { setDraftSettings({ ...settings }); setShowSettings(true) }
  function applySettings() {
    setSettings(draftSettings); setSecs(draftSettings.session * 60)
    setRunning(false); setShowSettings(false)
  }

  // ── Timer ring ───────────────────────────────────────────────────────────────
  const totalSecs = phase === 'work' ? settings.session * 60
    : phase === 'short' ? settings.shortBreak * 60 : settings.longBreak * 60
  const progress = totalSecs > 0 ? 1 - secs / totalSecs : 0
  const R = 108, CX = 130, CY = 130, SW = 7
  const circumference = 2 * Math.PI * R
  const dashOffset = circumference * (1 - progress)

  const doneTasks = tasks.filter(t => t.is_completed).length
  const pendingTasks = tasks.filter(t => !t.is_completed)
  const completedTasks = tasks.filter(t => t.is_completed)

  if (!ready) return (
    <div className="flex h-screen items-center justify-center bg-[#060010]">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white/60" />
    </div>
  )

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#060010]" style={{ fontFamily: 'system-ui,sans-serif', userSelect: 'none' }}>

      {/* Canvas background */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      {!zen && (
        <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-4">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: ACCENT }}>
                <span className="text-white text-xs font-bold">F</span>
              </div>
              <span className="text-white font-semibold text-sm tracking-wide">espacio focus</span>
            </div>
            {/* BG tabs */}
            <div className="flex items-center gap-1">
              {BG_LIST.map(b => (
                <button key={b.key} onClick={() => setBg(b.key)}
                  className="px-3 py-1 rounded-full text-xs font-medium transition-all"
                  style={bg === b.key
                    ? { background: 'rgba(255,255,255,0.14)', color: '#fff', border: '1px solid rgba(255,255,255,0.22)' }
                    : { color: 'rgba(255,255,255,0.45)', border: '1px solid transparent' }
                  }
                >{b.label}</button>
              ))}
            </div>
          </div>
          {/* Right */}
          <div className="flex items-center gap-2">
            {(['Tareas', 'Sonidos'] as const).map((label, i) => {
              const active = i === 0 ? showTasks : showSounds
              const toggle = i === 0 ? () => setShowTasks(s => !s) : () => setShowSounds(s => !s)
              return (
                <button key={label} onClick={toggle}
                  className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                  style={active
                    ? { background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }
                    : { color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.07)' }
                  }
                >{label}</button>
              )
            })}
            <button onClick={() => setZen(true)}
              className="px-3 py-1.5 rounded-full text-xs text-white/40 border border-white/[0.07] hover:text-white/65 transition-all"
            >zen</button>
          </div>
        </header>
      )}

      {/* Zen exit */}
      {zen && (
        <button onClick={() => setZen(false)}
          className="absolute top-4 right-4 z-20 px-3 py-1.5 rounded-full text-xs text-white/35 border border-white/[0.06] hover:text-white/55 transition-all"
        >salir zen</button>
      )}

      {/* ── Center timer ───────────────────────────────────────────────────── */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10 transition-all duration-300"
        style={{ paddingRight: showTasks && !zen ? '224px' : '0', paddingBottom: showSounds && !zen ? '72px' : '0' }}
      >
        {/* Anillo */}
        {timerStyle === 'anillo' && (
          <div className="flex flex-col items-center gap-5">
            <div className="relative" style={{ filter: 'drop-shadow(0 0 40px rgba(107,70,229,0.25))' }}>
              <svg width="260" height="260">
                {/* Background ring */}
                <circle cx={CX} cy={CY} r={R} fill="rgba(255,255,255,0.02)"
                  stroke="rgba(255,255,255,0.07)" strokeWidth={SW} />
                {/* Progress arc */}
                <circle cx={CX} cy={CY} r={R} fill="none"
                  stroke={ACCENT} strokeWidth={SW + 1} strokeLinecap="round"
                  strokeDasharray={circumference} strokeDashoffset={dashOffset}
                  transform={`rotate(-90 ${CX} ${CY})`}
                  style={{ filter: `drop-shadow(0 0 8px ${ACCENT}99)`, transition: 'stroke-dashoffset .8s linear' }}
                />
                {/* Phase label */}
                <text x={CX} y={112} textAnchor="middle" fill={ACCENT}
                  fontSize="9.5" fontWeight="700" letterSpacing="2.5" style={{ fontFamily: 'system-ui' }}>
                  {PHASE_LABEL[phase]}
                </text>
                {/* Time */}
                <text x={CX} y={149} textAnchor="middle" fill="white"
                  fontSize="44" fontWeight="700" style={{ fontFamily: 'system-ui' }}>
                  {fmt(secs)}
                </text>
                {/* Progress text */}
                <text x={CX} y={168} textAnchor="middle" fill="rgba(255,255,255,0.35)"
                  fontSize="11" style={{ fontFamily: 'system-ui' }}>
                  {fmtFocus(totalFocused)} / {settings.goalHours}h enfocado
                </text>
              </svg>
            </div>
            <Controls running={running} toggle={() => setRunning(r => !r)} reset={resetTimer} skip={skipPhase} openSettings={openSettings} />
          </div>
        )}

        {/* Minimal */}
        {timerStyle === 'minimal' && (
          <div className="flex flex-col items-center gap-4">
            <p className="font-bold tracking-[4px]" style={{ color: ACCENT, fontSize: '11px' }}>{PHASE_LABEL[phase]}</p>
            <p className="font-bold text-white leading-none" style={{ fontSize: 'clamp(72px,9vw,112px)' }}>{fmt(secs)}</p>
            <div className="rounded-full bg-white/[0.08] overflow-hidden" style={{ width: 'clamp(240px,28vw,340px)', height: '3px' }}>
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${progress * 100}%`, background: ACCENT, boxShadow: `0 0 10px ${ACCENT}` }} />
            </div>
            <p className="text-sm text-white/35">{fmtFocus(totalFocused)} / {settings.goalHours}h enfocado</p>
            <Controls running={running} toggle={() => setRunning(r => !r)} reset={resetTimer} skip={skipPhase} openSettings={openSettings} />
          </div>
        )}

        {/* Tarjeta */}
        {timerStyle === 'tarjeta' && (
          <div className="flex flex-col items-center gap-4">
            <div className="rounded-2xl px-8 py-7 flex flex-col items-center gap-3"
              style={{ background: 'rgba(12,8,26,0.72)', border: '1px solid rgba(255,255,255,0.09)', backdropFilter: 'blur(24px)', minWidth: '310px' }}
            >
              <p className="font-bold tracking-[4px]" style={{ color: ACCENT, fontSize: '10px' }}>{PHASE_LABEL[phase]}</p>
              <div className="flex items-center gap-5 mt-1">
                <button onClick={() => !running && setSecs(s => Math.max(60, s - 60))}
                  className="w-10 h-10 rounded-xl bg-white/[0.07] border border-white/10 text-white/65 hover:bg-white/[0.13] transition-all text-xl font-light active:scale-95"
                >−</button>
                <span className="font-bold text-white text-center tabular-nums" style={{ fontSize: '56px', minWidth: '160px' }}>{fmt(secs)}</span>
                <button onClick={() => !running && setSecs(s => s + 60)}
                  className="w-10 h-10 rounded-xl bg-white/[0.07] border border-white/10 text-white/65 hover:bg-white/[0.13] transition-all text-xl font-light active:scale-95"
                >+</button>
              </div>
              <p className="text-sm text-white/35">{fmtFocus(totalFocused)} / {settings.goalHours}h enfocado</p>
            </div>
            <Controls running={running} toggle={() => setRunning(r => !r)} reset={resetTimer} skip={skipPhase} openSettings={openSettings} />
          </div>
        )}
      </div>

      {/* ── Tasks panel ────────────────────────────────────────────────────── */}
      <div className="absolute top-0 right-0 bottom-0 z-20 flex flex-col overflow-hidden transition-all duration-300"
        style={{ width: showTasks && !zen ? '224px' : '0', background: 'rgba(7,5,18,0.68)', backdropFilter: 'blur(18px)', borderLeft: '1px solid rgba(255,255,255,0.05)' }}
      >
        {showTasks && !zen && (
          <div className="flex flex-col h-full" style={{ minWidth: '224px' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-14 pb-3 border-b border-white/[0.05]">
              <span className="text-white text-sm font-semibold">Tareas</span>
              <span className="text-white/30 text-[11px]">{doneTasks} de {tasks.length} hechas</span>
            </div>
            {/* List */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-3 space-y-2" style={{ scrollbarWidth: 'none' }}>
              {tasks.length === 0 && (
                <p className="text-white/25 text-xs text-center pt-6">Sin tareas para hoy</p>
              )}
              {pendingTasks.length > 0 && (
                <>
                  <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest px-1 pb-1">Hoy</p>
                  {pendingTasks.map(t => <TaskCard key={t.id} task={t} onToggle={doToggle} />)}
                </>
              )}
              {completedTasks.length > 0 && (
                <>
                  <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest px-1 pb-1 pt-2">Completadas</p>
                  {completedTasks.map(t => <TaskCard key={t.id} task={t} onToggle={doToggle} />)}
                </>
              )}
            </div>
            {/* Add task */}
            <div className="border-t border-white/[0.05] p-3 space-y-2">
              <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTask()}
                placeholder="Nueva tarea..."
                className="w-full bg-white/[0.06] border border-white/[0.09] rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-white/22 outline-none focus:border-white/20 transition-all"
                style={{ userSelect: 'text' }}
              />
              <div className="flex gap-2">
                <select value={newLabel} onChange={e => setNewLabel(e.target.value)}
                  className="flex-1 min-w-0 bg-white/[0.06] border border-white/[0.09] rounded-lg px-2 py-1.5 text-xs text-white/70 outline-none cursor-pointer"
                  style={{ background: 'rgba(255,255,255,0.06)', colorScheme: 'dark' }}
                >
                  {Object.keys(LABEL_COLORS).map(l => <option key={l} value={l}>{l}</option>)}
                </select>
                <button onClick={addTask}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-base hover:opacity-85 transition-all flex-shrink-0 active:scale-95"
                  style={{ background: ACCENT }}>+</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Sound mixer ────────────────────────────────────────────────────── */}
      {!zen && (
        <div className="absolute bottom-0 left-0 right-0 z-20 transition-all duration-300"
          style={{ transform: showSounds ? 'translateY(0)' : 'translateY(110%)', paddingRight: showTasks ? '224px' : '0' }}
        >
          <div className="mx-4 mb-3 rounded-2xl px-5 py-3"
            style={{ background: 'rgba(8,6,20,0.78)', border: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(20px)' }}
          >
            <div className="overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              <div className="flex gap-6 min-w-max pb-0.5">
                {SOUND_LIST.map(s => (
                  <div key={s.key} className="flex flex-col items-center gap-1.5" style={{ minWidth: '64px' }}>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full transition-all duration-200"
                        style={{ background: volumes[s.key] > 0 ? ACCENT : 'rgba(255,255,255,0.2)', boxShadow: volumes[s.key] > 0 ? `0 0 6px ${ACCENT}` : 'none' }} />
                      <span className="text-[11px] text-white/50">{s.label}</span>
                    </div>
                    <input type="range" min="0" max="1" step="0.01"
                      value={volumes[s.key]}
                      onChange={e => setVolume(s.key, parseFloat(e.target.value))}
                      className="w-full cursor-pointer"
                      style={{ accentColor: ACCENT, height: '3px' }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Settings modal ──────────────────────────────────────────────────── */}
      {showSettings && (
        <div className="absolute inset-0 z-30 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
          onClick={e => e.target === e.currentTarget && setShowSettings(false)}
        >
          <div className="rounded-2xl p-6 w-[390px] max-w-[92vw] max-h-[90vh] overflow-y-auto"
            style={{ background: 'rgba(12,8,26,0.97)', border: '1px solid rgba(255,255,255,0.1)', scrollbarWidth: 'none' }}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-semibold text-base">Ajustes del Pomodoro</h3>
              <button onClick={() => setShowSettings(false)} className="text-white/40 hover:text-white/70 transition-all text-2xl leading-none">×</button>
            </div>

            {/* Session duration */}
            <div className="mb-5">
              <p className="text-xs text-white/45 mb-2.5">Duración de la sesión</p>
              <div className="flex gap-2">
                {[20, 25, 30, 45].map(m => (
                  <button key={m} onClick={() => setDraftSettings(s => ({ ...s, session: m }))}
                    className="flex-1 py-2 rounded-xl text-sm font-medium transition-all active:scale-95"
                    style={draftSettings.session === m
                      ? { background: ACCENT, color: '#fff' }
                      : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.08)' }
                    }
                  >{m} min</button>
                ))}
              </div>
            </div>

            {/* Stepper rows */}
            {([
              { label: 'Descanso corto', sub: 'Entre sesiones', field: 'shortBreak', suffix: 'min', min: 1 },
              { label: 'Descanso largo', sub: 'Para recargar', field: 'longBreak', suffix: 'min', min: 1 },
              { label: 'Sesiones por ciclo', sub: 'Descanso largo cada', field: 'cycle', suffix: '', min: 1 },
              { label: 'Objetivo de hoy', sub: 'Horas a concentrarte', field: 'goalHours', suffix: 'h', min: 1 },
            ] as { label: string; sub: string; field: keyof PomSettings; suffix: string; min: number }[]).map(row => (
              <div key={row.field} className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-white/80">{row.label}</p>
                  <p className="text-xs text-white/35">{row.sub}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setDraftSettings(s => ({ ...s, [row.field]: Math.max(row.min, (s[row.field] as number) - 1) }))}
                    className="w-8 h-8 rounded-lg bg-white/[0.07] border border-white/10 text-white/70 hover:bg-white/[0.13] transition-all text-lg leading-none active:scale-95"
                  >−</button>
                  <span className="text-white text-sm w-14 text-center tabular-nums">
                    {draftSettings[row.field]}{row.suffix ? ` ${row.suffix}` : ''}
                  </span>
                  <button onClick={() => setDraftSettings(s => ({ ...s, [row.field]: (s[row.field] as number) + 1 }))}
                    className="w-8 h-8 rounded-lg bg-white/[0.07] border border-white/10 text-white/70 hover:bg-white/[0.13] transition-all text-lg leading-none active:scale-95"
                  >+</button>
                </div>
              </div>
            ))}

            {/* Timer style */}
            <div className="mb-6">
              <p className="text-xs text-white/45 mb-2.5">Estilo del reloj</p>
              <div className="flex gap-2">
                {(['anillo', 'minimal', 'tarjeta'] as TimerStyle[]).map(s => (
                  <button key={s} onClick={() => setTimerStyle(s)}
                    className="flex-1 py-2 rounded-xl text-sm font-medium transition-all active:scale-95"
                    style={timerStyle === s
                      ? { background: ACCENT, color: '#fff' }
                      : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.08)' }
                    }
                  >{s.charAt(0).toUpperCase() + s.slice(1)}</button>
                ))}
              </div>
            </div>

            <button onClick={applySettings}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ background: ACCENT }}
            >Guardar</button>
          </div>
        </div>
      )}
    </div>
  )
}
