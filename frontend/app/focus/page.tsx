'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getTasks, toggleTaskComplete, createTask, updateTask } from '@/lib/api'
import { Task } from '@/lib/types'
import Sidebar from '@/components/layout/Sidebar'
import { useSidebar } from '@/components/layout/SidebarContext'

// ─── Types ────────────────────────────────────────────────────────────────────
type BgName = 'lluvia' | 'brasas' | 'aurora' | 'cosmos' | 'mar' | 'planeta' | 'tunel'
type TimerStyle = 'anillo' | 'minimal' | 'tarjeta'
type SoundKey = 'lluvia' | 'cafeteria' | 'trafico' | 'olas' | 'bosque' | 'pajaros' | 'viento' | 'cascada' | 'fuego'
type Phase = 'work' | 'short' | 'long'

interface PomSettings { session: number; shortBreak: number; longBreak: number; cycle: number; goalHours: number }

const DEFAULT_SETTINGS: PomSettings = { session: 25, shortBreak: 5, longBreak: 15, cycle: 4, goalHours: 2 }

const BG_LIST: { key: BgName; label: string }[] = [
  { key: 'lluvia', label: 'Lluvia' },
  { key: 'brasas', label: 'Brasas' },
  { key: 'aurora', label: 'Aurora' },
  { key: 'cosmos', label: 'Cosmos' },
  { key: 'mar', label: 'Mar' },
  { key: 'planeta', label: 'Planeta' },
  { key: 'tunel', label: 'Túnel' },
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

// ── Mar — ocean night with perspective waves, moon & moonlight column ──────────
function bgMar(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext('2d')!
  const W = canvas.width, H = canvas.height
  const HORIZON = H * 0.40
  const stars = Array.from({ length: 170 }, () => ({
    x: Math.random() * W, y: Math.random() * HORIZON * 0.96,
    r: 0.3 + Math.random() * 1.3, a: 0.25 + Math.random() * 0.75, ph: Math.random() * Math.PI * 2,
  }))
  const MX = W * 0.68, MY = HORIZON * 0.27
  let t = 0, raf = 0
  const draw = () => {
    // Sky
    const skyG = ctx.createLinearGradient(0, 0, 0, HORIZON)
    skyG.addColorStop(0, '#000812'); skyG.addColorStop(0.65, '#010b1e'); skyG.addColorStop(1, '#051530')
    ctx.fillStyle = skyG; ctx.fillRect(0, 0, W, HORIZON + 2)
    // Stars
    for (const s of stars) {
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(220,215,255,${s.a * (0.55 + 0.45 * Math.sin(t * .55 + s.ph))})`; ctx.fill()
    }
    // Moon glow
    const mGlow = ctx.createRadialGradient(MX, MY, 0, MX, MY, 100)
    mGlow.addColorStop(0, 'rgba(215,205,150,0.18)'); mGlow.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = mGlow; ctx.fillRect(0, 0, W, HORIZON)
    // Moon
    ctx.beginPath(); ctx.arc(MX, MY, 20, 0, Math.PI * 2); ctx.fillStyle = '#ddd5b2'; ctx.fill()
    ctx.beginPath(); ctx.arc(MX + 6, MY - 3, 17, 0, Math.PI * 2); ctx.fillStyle = '#ccc5a0'; ctx.fill()
    // Water base
    const waterG = ctx.createLinearGradient(0, HORIZON, 0, H)
    waterG.addColorStop(0, '#04122c'); waterG.addColorStop(0.35, '#030d20'); waterG.addColorStop(1, '#010810')
    ctx.fillStyle = waterG; ctx.fillRect(0, HORIZON, W, H - HORIZON)
    // Moonlight trapezoid
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(MX - 7, HORIZON); ctx.lineTo(MX + 7, HORIZON)
    ctx.lineTo(W / 2 + W * .12, H); ctx.lineTo(W / 2 - W * .12, H)
    ctx.closePath()
    const mlG = ctx.createLinearGradient(0, HORIZON, 0, H)
    mlG.addColorStop(0, 'rgba(200,185,110,0.2)'); mlG.addColorStop(.5, 'rgba(140,125,70,0.08)'); mlG.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = mlG; ctx.fill(); ctx.restore()
    // Perspective waves
    const N = 58
    for (let i = 0; i < N; i++) {
      const frac = i / N
      const y = HORIZON + (H - HORIZON) * Math.pow(frac, 1.35)
      const amp = 0.4 + frac * 4.8, freq = 0.02 - frac * 0.014, spd = 0.5 + frac * 1.6
      const alpha = 0.04 + frac * 0.25
      ctx.beginPath(); ctx.moveTo(0, y)
      for (let x = 0; x <= W; x += 3) {
        const wy = y + Math.sin(x * freq + t * spd + frac * 9) * amp
          + Math.sin(x * freq * .65 - t * spd * .55 + frac * 4) * amp * .38
        ctx.lineTo(x, wy)
      }
      ctx.strokeStyle = `rgba(75,115,185,${alpha})`; ctx.lineWidth = 0.4 + frac * .75; ctx.stroke()
    }
    // Horizon blend
    const hG = ctx.createLinearGradient(0, HORIZON - 12, 0, HORIZON + 22)
    hG.addColorStop(0, 'rgba(0,0,0,0)'); hG.addColorStop(.5, 'rgba(35,75,150,0.12)'); hG.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = hG; ctx.fillRect(0, HORIZON - 12, W, 34)
    t += 0.012; raf = requestAnimationFrame(draw)
  }
  ctx.fillStyle = '#000812'; ctx.fillRect(0, 0, W, H); draw()
  return () => cancelAnimationFrame(raf)
}

// ── Planeta — gas giant with rings, atmosphere glow, star field ────────────────
function bgPlaneta(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext('2d')!
  const W = canvas.width, H = canvas.height
  const PR = Math.min(W, H) * 0.27, PX = W * 0.52, PY = H * 0.44
  const stars = Array.from({ length: 300 }, () => ({
    x: Math.random() * W, y: Math.random() * H,
    r: 0.3 + Math.random() * 1.5, a: 0.2 + Math.random() * 0.8, ph: Math.random() * Math.PI * 2,
  }))
  let t = 0, raf = 0
  const draw = () => {
    ctx.fillStyle = '#000008'; ctx.fillRect(0, 0, W, H)
    // Stars (skip inside planet)
    for (const s of stars) {
      const dx = s.x - PX, dy = s.y - PY
      if (dx * dx + dy * dy < (PR + 25) * (PR + 25)) continue
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(210,205,255,${s.a * (0.5 + 0.5 * Math.sin(t * .4 + s.ph))})`; ctx.fill()
    }
    // Back ring (behind planet)
    ctx.save(); ctx.translate(PX, PY); ctx.scale(1, 0.26)
    for (let r = 0; r < Math.PI; r += Math.PI) {  // only top arc = behind
      ctx.beginPath(); ctx.arc(0, 0, PR * 1.72, Math.PI, 0)
      ctx.strokeStyle = 'rgba(120,160,220,0.18)'; ctx.lineWidth = PR * 0.22 / 0.26; ctx.stroke()
      ctx.beginPath(); ctx.arc(0, 0, PR * 1.5, Math.PI, 0)
      ctx.strokeStyle = 'rgba(140,180,240,0.25)'; ctx.lineWidth = PR * 0.07 / 0.26; ctx.stroke()
    }
    ctx.restore()
    // Planet base circle
    ctx.save(); ctx.beginPath(); ctx.arc(PX, PY, PR, 0, Math.PI * 2); ctx.clip()
    // Deep space-blue base
    const base = ctx.createLinearGradient(PX - PR, PY - PR, PX + PR, PY + PR)
    base.addColorStop(0, '#0a1c60'); base.addColorStop(.3, '#102580'); base.addColorStop(.5, '#1535a0')
    base.addColorStop(.65, '#0e2278'); base.addColorStop(1, '#071240')
    ctx.fillStyle = base; ctx.fillRect(PX - PR, PY - PR, PR * 2, PR * 2)
    // Animated horizontal cloud bands
    for (let b = 0; b < 9; b++) {
      const by = PY - PR + (b / 8) * PR * 2
      const bh = PR * 0.11
      const xShift = Math.sin(t * 0.15 + b * 0.8) * PR * 0.04
      const alpha = 0.05 + 0.07 * Math.abs(Math.sin(b * 1.3 + t * 0.1))
      ctx.fillStyle = `rgba(${b % 2 === 0 ? '60,100,210' : '30,55,150'},${alpha})`
      ctx.fillRect(PX - PR + xShift, by, PR * 2, bh)
    }
    // Storm oval
    const sx = PX - PR * .18 + Math.sin(t * .25) * PR * .08, sy = PY + PR * .18
    ctx.beginPath(); ctx.ellipse(sx, sy, PR * .2, PR * .1, t * .04, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(160,210,255,0.12)'; ctx.lineWidth = 3; ctx.stroke()
    // Terminator shadow (darker right-to-left gradient)
    const shadow = ctx.createRadialGradient(PX - PR * .35, PY, 0, PX + PR * .1, PY, PR * 1.2)
    shadow.addColorStop(0, 'rgba(0,0,0,0)'); shadow.addColorStop(.65, 'rgba(0,0,0,0)')
    shadow.addColorStop(1, 'rgba(0,0,20,0.82)')
    ctx.fillStyle = shadow; ctx.fillRect(PX - PR, PY - PR, PR * 2, PR * 2)
    ctx.restore()
    // Atmosphere glow
    const atm = ctx.createRadialGradient(PX, PY, PR * 0.9, PX, PY, PR * 1.22)
    atm.addColorStop(0, 'rgba(60,110,255,0.22)'); atm.addColorStop(.5, 'rgba(40,80,200,0.1)'); atm.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = atm; ctx.beginPath(); ctx.arc(PX, PY, PR * 1.22, 0, Math.PI * 2); ctx.fill()
    // Front ring (in front of planet — bottom arc only)
    ctx.save(); ctx.translate(PX, PY); ctx.scale(1, 0.26)
    ctx.save(); ctx.beginPath(); ctx.rect(-PR * 2.5, 0, PR * 5, PR * 3 / 0.26); ctx.clip()
    ctx.beginPath(); ctx.arc(0, 0, PR * 1.72, 0, Math.PI)
    ctx.strokeStyle = 'rgba(130,175,235,0.28)'; ctx.lineWidth = PR * 0.22 / 0.26; ctx.stroke()
    ctx.beginPath(); ctx.arc(0, 0, PR * 1.5, 0, Math.PI)
    ctx.strokeStyle = 'rgba(160,200,255,0.35)'; ctx.lineWidth = PR * 0.07 / 0.26; ctx.stroke()
    ctx.restore(); ctx.restore()
    t += 0.007; raf = requestAnimationFrame(draw)
  }
  ctx.fillStyle = '#000008'; ctx.fillRect(0, 0, W, H); draw()
  return () => cancelAnimationFrame(raf)
}

// ── Túnel — hexagonal warp corridor with neon glow ────────────────────────────
function bgTunel(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext('2d')!
  const W = canvas.width, H = canvas.height
  const CX = W / 2, CY = H / 2
  const maxR = Math.sqrt(W * W + H * H) * 0.62
  const N_SEG = 22
  let t = 0, raf = 0

  function hexPath(r: number, rot: number) {
    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i + rot
      const x = CX + r * Math.cos(a), y = CY + r * Math.sin(a)
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    }
    ctx.closePath()
  }

  const draw = () => {
    ctx.fillStyle = 'rgba(2,0,10,0.35)'; ctx.fillRect(0, 0, W, H)
    const speed = 0.28
    for (let i = N_SEG; i >= 0; i--) {
      const frac = ((i + t * speed) % N_SEG) / N_SEG
      const r = frac * maxR + 4
      if (r < 2) continue
      const alpha = (1 - frac) * 0.75
      const hue = 255 + frac * 50   // purple → indigo
      const lum = 55 + (1 - frac) * 25
      hexPath(r, frac * Math.PI / 8 + t * 0.08)
      ctx.strokeStyle = `hsla(${hue},80%,${lum}%,${alpha})`
      ctx.lineWidth = Math.max(0.4, (1 - frac) * 3.5)
      ctx.shadowBlur = (1 - frac) * 18; ctx.shadowColor = `hsla(${hue},90%,70%,${alpha})`
      ctx.stroke()
      // Inner fill for closest segments
      if (frac < 0.15) {
        ctx.fillStyle = `hsla(${hue},60%,20%,${(0.15 - frac) * 0.3})`; ctx.fill()
      }
    }
    ctx.shadowBlur = 0
    // Center vortex glow
    const cg = ctx.createRadialGradient(CX, CY, 0, CX, CY, 120)
    cg.addColorStop(0, 'rgba(140,80,255,0.18)'); cg.addColorStop(.4, 'rgba(80,40,200,0.08)'); cg.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = cg; ctx.fillRect(0, 0, W, H)
    t += 0.016; raf = requestAnimationFrame(draw)
  }
  ctx.fillStyle = '#02000a'; ctx.fillRect(0, 0, W, H); draw()
  return () => cancelAnimationFrame(raf)
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
  lluvia: bgLluvia, brasas: bgBrasas, aurora: bgAurora, cosmos: bgCosmos,
  mar: bgMar, planeta: bgPlaneta, tunel: bgTunel,
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
function TaskCard({ task, onToggle, onClick }: { task: Task; onToggle: (id: string) => void; onClick: (t: Task) => void }) {
  const color = LABEL_COLORS[task.label ?? ''] ?? ACCENT
  return (
    <div
      onClick={() => onClick(task)}
      className="group flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-all"
      style={{
        background: 'rgba(255,255,255,0.02)',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}
    >
      {/* Circle toggle */}
      <button
        onClick={e => { e.stopPropagation(); onToggle(task.id) }}
        className="flex-shrink-0 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center transition-all"
        style={task.is_completed
          ? { background: color, borderColor: color }
          : { borderColor: 'rgba(255,255,255,0.25)', background: 'transparent' }
        }
      >
        {task.is_completed && <span className="text-white text-[8px] leading-none">✓</span>}
      </button>
      {/* Content */}
      <div className="flex-1 min-w-0">
        <p
          className="text-[12.5px] font-medium leading-snug truncate"
          style={task.is_completed
            ? { textDecoration: 'line-through', color: 'rgba(255,255,255,0.3)' }
            : { color: 'rgba(255,255,255,0.85)' }
          }
        >{task.title}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {task.label && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
              style={{ background: `${color}20`, color }}>
              {task.label}
            </span>
          )}
          {task.reminder_at && (
            <span className="text-[9px] text-white/30">🕐 {task.reminder_at.slice(11, 16)}</span>
          )}
          {task.subtasks && task.subtasks.length > 0 && (
            <span className="text-[9px] text-white/25">
              {task.subtasks.filter(s => s.is_completed).length}/{task.subtasks.length}
            </span>
          )}
        </div>
      </div>
      {/* Star */}
      <span className="flex-shrink-0 text-[13px] ml-1" style={{ color: task.is_starred ? '#facc15' : 'rgba(255,255,255,0.15)' }}>
        {task.is_starred ? '★' : '☆'}
      </span>
    </div>
  )
}

// ── Task Detail Modal ──────────────────────────────────────────────────────────
function TaskDetail({
  task, onClose, onToggle, onToggleStar,
}: {
  task: Task
  onClose: () => void
  onToggle: (id: string) => void
  onToggleStar: (id: string, starred: boolean) => void
}) {
  const color = LABEL_COLORS[task.label ?? ''] ?? ACCENT
  const completedSubs = task.subtasks?.filter(s => s.is_completed).length ?? 0
  const totalSubs = task.subtasks?.length ?? 0
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm rounded-2xl p-5 flex flex-col gap-4"
        style={{ background: 'rgba(20,15,40,0.92)', border: '1px solid rgba(255,255,255,0.1)', borderLeft: `3px solid ${color}` }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <button
              onClick={() => onToggle(task.id)}
              className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all"
              style={task.is_completed
                ? { background: color, borderColor: color }
                : { borderColor: 'rgba(255,255,255,0.3)' }
              }
            >
              {task.is_completed && <span className="text-white text-[9px]">✓</span>}
            </button>
            <h3
              className="text-[15px] font-semibold leading-snug"
              style={task.is_completed
                ? { textDecoration: 'line-through', color: 'rgba(255,255,255,0.4)' }
                : { color: 'rgba(255,255,255,0.9)' }
              }
            >{task.title}</h3>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => onToggleStar(task.id, !task.is_starred)}
              className="text-[18px] transition-transform hover:scale-110"
              style={{ color: task.is_starred ? '#facc15' : 'rgba(255,255,255,0.2)' }}
            >{task.is_starred ? '★' : '☆'}</button>
            <button onClick={onClose} className="text-white/30 hover:text-white/70 text-xl leading-none transition-colors">×</button>
          </div>
        </div>
        {/* Meta */}
        <div className="flex flex-wrap gap-2">
          {task.label && (
            <span className="text-[10px] font-bold px-2 py-1 rounded-lg"
              style={{ background: `${color}22`, color }}>
              {task.label}
            </span>
          )}
          {task.due_date && (
            <span className="text-[10px] px-2 py-1 rounded-lg text-white/50"
              style={{ background: 'rgba(255,255,255,0.05)' }}>
              📅 {task.due_date}
              {task.due_time && ` · ${task.due_time.slice(0, 5)}`}
            </span>
          )}
          {task.reminder_at && (
            <span className="text-[10px] px-2 py-1 rounded-lg text-white/50"
              style={{ background: 'rgba(255,255,255,0.05)' }}>
              🔔 {task.reminder_at.slice(11, 16)}
            </span>
          )}
        </div>
        {/* Notes */}
        {task.notes && (
          <p className="text-[12px] text-white/50 leading-relaxed bg-white/[0.03] rounded-xl px-3 py-2.5">{task.notes}</p>
        )}
        {/* Subtasks */}
        {totalSubs > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">
              Subtareas · {completedSubs}/{totalSubs}
            </p>
            {task.subtasks.map(sub => (
              <div key={sub.id} className="flex items-center gap-2.5 px-1">
                <div
                  className="w-3.5 h-3.5 rounded-full border flex-shrink-0 flex items-center justify-center"
                  style={sub.is_completed ? { background: color, borderColor: color } : { borderColor: 'rgba(255,255,255,0.2)' }}
                >
                  {sub.is_completed && <span className="text-[6px] text-white">✓</span>}
                </div>
                <span className="text-[12px]"
                  style={sub.is_completed ? { textDecoration: 'line-through', color: 'rgba(255,255,255,0.3)' } : { color: 'rgba(255,255,255,0.7)' }}>
                  {sub.title}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function FocusPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const { open: navOpen, toggle: toggleNav } = useSidebar()

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

  // UI toggles — tasks default closed on mobile, open on desktop
  const [showTasks, setShowTasks] = useState(false)
  const [showSounds, setShowSounds] = useState(true)
  const [zen, setZen] = useState(false)

  useEffect(() => {
    if (window.innerWidth >= 1024) setShowTasks(true)
  }, [])

  // Sounds
  const [volumes, setVolumes] = useState<Record<SoundKey, number>>(
    Object.fromEntries(SOUND_LIST.map(s => [s.key, 0])) as Record<SoundKey, number>
  )

  // Tasks
  const [tasks, setTasks] = useState<Task[]>([])
  const [newTitle, setNewTitle] = useState('')
  const [newLabel, setNewLabel] = useState('Trabajo')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

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
  const loadTasks = useCallback(async (): Promise<Task[] | null> => {
    try {
      const all = await getTasks({ is_event: false })
      const today = todayStr()
      const filtered = all.filter(t => t.due_date === today && t.recurrence === null)
      setTasks(filtered)
      return filtered
    } catch { return null }
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
    try {
      await toggleTaskComplete(id)
      const fresh = await loadTasks()
      if (fresh) setSelectedTask(prev => prev?.id === id ? (fresh.find(t => t.id === id) ?? null) : prev)
    } catch { /* ignore */ }
  }
  async function addTask() {
    if (!newTitle.trim()) return
    try {
      await createTask({ title: newTitle.trim(), label: newLabel, due_date: todayStr(), is_event: false })
      setNewTitle(''); await loadTasks()
    } catch { /* ignore */ }
  }

  async function toggleStar(id: string, starred: boolean) {
    try {
      await updateTask(id, { is_starred: starred })
      setTasks(prev => prev.map(t => t.id === id ? { ...t, is_starred: starred } : t))
      setSelectedTask(prev => prev?.id === id ? { ...prev, is_starred: starred } : prev)
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

      {/* Nav sidebar — overlays on focus page; focus page has its own ☰ in header */}
      <Sidebar hideExternalToggle />

      {/* Canvas background */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* ── Header — z-50 so it always sits above every panel ──────────────── */}
      {!zen && (
        <header className="fixed top-0 right-0 z-50 flex items-center justify-between px-4 py-2.5 transition-all duration-300" style={{ left: navOpen ? '240px' : '0' }}>
          <div className="flex items-center gap-2 flex-shrink-0 mr-2">
            {/* Nav toggle — only when sidebar is closed */}
            {!navOpen && (
              <button onClick={toggleNav}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-white/50 hover:text-white/80 transition-all"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}
                title="Abrir navegación"
              >
                <span className="text-sm">☰</span>
              </button>
            )}
          </div>
          {/* BG tabs — scrollable on small screens */}
          <div className="overflow-x-auto flex-1 mr-3" style={{ scrollbarWidth: 'none' }}>
            <div className="flex items-center gap-1 min-w-max">
              {BG_LIST.map(b => (
                <button key={b.key} onClick={() => setBg(b.key)}
                  className="px-3 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap"
                  style={bg === b.key
                    ? { background: 'rgba(255,255,255,0.14)', color: '#fff', border: '1px solid rgba(255,255,255,0.22)' }
                    : { color: 'rgba(255,255,255,0.45)', border: '1px solid transparent' }
                  }
                >{b.label}</button>
              ))}
            </div>
          </div>
          {/* Right controls */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button onClick={() => setShowTasks(s => !s)}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
              style={showTasks
                ? { background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }
                : { color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.07)' }
              }
            >Tareas</button>
            <button onClick={() => setShowSounds(s => !s)}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
              style={showSounds
                ? { background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }
                : { color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.07)' }
              }
            >Sonidos</button>
            <button onClick={() => setZen(true)}
              className="px-3 py-1.5 rounded-full text-xs text-white/40 border border-white/[0.07] hover:text-white/65 transition-all"
            >Zen</button>
          </div>
        </header>
      )}

      {/* Zen exit */}
      {zen && (
        <button onClick={() => setZen(false)}
          className="fixed top-4 right-4 z-50 px-3 py-1.5 rounded-full text-xs text-white/35 border border-white/[0.06] hover:text-white/55 transition-all"
        >Salir Zen</button>
      )}

      {/* ── Center timer — no padding shifts, panel is floating ────────────── */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10"
        style={{ paddingBottom: showSounds && !zen ? '80px' : '0', paddingTop: !zen ? '48px' : '0', transition: 'padding .3s' }}
      >
        {/* Anillo */}
        {timerStyle === 'anillo' && (
          <div className="flex flex-col items-center gap-5">
            <div style={{ filter: 'drop-shadow(0 0 40px rgba(107,70,229,0.25))' }}>
              <svg width="260" height="260">
                <circle cx={CX} cy={CY} r={R} fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.07)" strokeWidth={SW} />
                <circle cx={CX} cy={CY} r={R} fill="none"
                  stroke={ACCENT} strokeWidth={SW + 1} strokeLinecap="round"
                  strokeDasharray={circumference} strokeDashoffset={dashOffset}
                  transform={`rotate(-90 ${CX} ${CY})`}
                  style={{ filter: `drop-shadow(0 0 8px ${ACCENT}99)`, transition: 'stroke-dashoffset .8s linear' }}
                />
                <text x={CX} y={112} textAnchor="middle" fill={ACCENT} fontSize="9.5" fontWeight="700" letterSpacing="2.5" style={{ fontFamily: 'system-ui' }}>
                  {PHASE_LABEL[phase]}
                </text>
                <text x={CX} y={149} textAnchor="middle" fill="white" fontSize="44" fontWeight="700" style={{ fontFamily: 'system-ui' }}>
                  {fmt(secs)}
                </text>
                <text x={CX} y={168} textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="11" style={{ fontFamily: 'system-ui' }}>
                  {fmtFocus(totalFocused)} / {settings.goalHours}h enfocado
                </text>
              </svg>
            </div>
            <Controls running={running} toggle={() => setRunning(r => !r)} reset={resetTimer} skip={skipPhase} openSettings={openSettings} />
          </div>
        )}

        {/* Minimal */}
        {timerStyle === 'minimal' && (
          <div className="flex flex-col items-center gap-4 px-4">
            <p className="font-bold tracking-[4px]" style={{ color: ACCENT, fontSize: '11px' }}>{PHASE_LABEL[phase]}</p>
            <p className="font-bold text-white leading-none text-center" style={{ fontSize: 'clamp(60px,9vw,112px)' }}>{fmt(secs)}</p>
            <div className="rounded-full bg-white/[0.08] overflow-hidden" style={{ width: 'clamp(200px,28vw,340px)', height: '3px' }}>
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${progress * 100}%`, background: ACCENT, boxShadow: `0 0 10px ${ACCENT}` }} />
            </div>
            <p className="text-sm text-white/35">{fmtFocus(totalFocused)} / {settings.goalHours}h enfocado</p>
            <Controls running={running} toggle={() => setRunning(r => !r)} reset={resetTimer} skip={skipPhase} openSettings={openSettings} />
          </div>
        )}

        {/* Tarjeta */}
        {timerStyle === 'tarjeta' && (
          <div className="flex flex-col items-center gap-4 px-4">
            <div className="rounded-2xl px-6 py-6 flex flex-col items-center gap-3 w-full max-w-xs"
              style={{ background: 'rgba(12,8,26,0.72)', border: '1px solid rgba(255,255,255,0.09)', backdropFilter: 'blur(24px)' }}
            >
              <p className="font-bold tracking-[4px]" style={{ color: ACCENT, fontSize: '10px' }}>{PHASE_LABEL[phase]}</p>
              <div className="flex items-center gap-4 mt-1">
                <button onClick={() => !running && setSecs(s => Math.max(60, s - 60))}
                  className="w-10 h-10 rounded-xl bg-white/[0.07] border border-white/10 text-white/65 hover:bg-white/[0.13] transition-all text-xl font-light active:scale-95"
                >−</button>
                <span className="font-bold text-white text-center tabular-nums" style={{ fontSize: 'clamp(42px,7vw,56px)', minWidth: '130px' }}>{fmt(secs)}</span>
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

      {/* ── Tasks panel — floating card, z-30 (below header z-50) ──────────── */}
      {!zen && (
        <>
          {/* Floating panel */}
          {showTasks && (
            <div className="fixed z-30 flex flex-col rounded-2xl overflow-hidden"
              style={{
                right: '16px',
                top: '56px',
                width: '220px',
                maxHeight: 'calc(100vh - 56px - 88px)',
                background: 'rgba(7,5,18,0.78)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.09)',
                boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
              }}
            >
              {/* Panel header */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06] flex-shrink-0">
                <span className="text-white text-sm font-semibold">Tareas</span>
                <div className="flex items-center gap-2">
                  <span className="text-white/30 text-[10px]">{doneTasks}/{tasks.length}</span>
                  <button onClick={() => setShowTasks(false)}
                    className="text-white/30 hover:text-white/65 transition-all text-lg leading-none w-5 h-5 flex items-center justify-center"
                  >×</button>
                </div>
              </div>

              {/* Task list */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ scrollbarWidth: 'none' }}>
                {tasks.length === 0 && (
                  <p className="text-white/25 text-xs text-center pt-6 pb-4">Sin tareas para hoy</p>
                )}
                {pendingTasks.length > 0 && (
                  <>
                    <p className="text-[10px] font-bold text-white/28 uppercase tracking-widest px-3 pt-2.5 pb-1">Hoy</p>
                    {pendingTasks.map(t => <TaskCard key={t.id} task={t} onToggle={doToggle} onClick={setSelectedTask} />)}
                  </>
                )}
                {completedTasks.length > 0 && (
                  <>
                    <p className="text-[10px] font-bold text-white/18 uppercase tracking-widest px-3 pt-3 pb-1">Completadas</p>
                    {completedTasks.map(t => <TaskCard key={t.id} task={t} onToggle={doToggle} onClick={setSelectedTask} />)}
                  </>
                )}
              </div>

              {/* Add task */}
              <div className="border-t border-white/[0.05] p-2.5 space-y-2 flex-shrink-0">
                <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addTask()}
                  placeholder="Nueva tarea..."
                  className="w-full bg-white/[0.06] border border-white/[0.09] rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-white/22 outline-none focus:border-white/20 transition-all"
                  style={{ userSelect: 'text' }}
                />
                <div className="flex gap-1.5">
                  <select value={newLabel} onChange={e => setNewLabel(e.target.value)}
                    className="flex-1 min-w-0 rounded-lg px-2 py-1.5 text-xs text-white/70 outline-none cursor-pointer border border-white/[0.09]"
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
        </>
      )}

      {/* ── Sound mixer — centered, max 680px ──────────────────────────────── */}
      {!zen && (
        <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center px-4 pb-3 transition-all duration-300"
          style={{ transform: showSounds ? 'translateY(0)' : 'translateY(120%)' }}
        >
          <div className="rounded-2xl px-5 py-3 w-full"
            style={{ maxWidth: '680px', background: 'rgba(8,6,20,0.82)', border: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(20px)' }}
          >
            <div className="overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              <div className="flex gap-5 min-w-max pb-0.5">
                {SOUND_LIST.map(s => (
                  <div key={s.key} className="flex flex-col items-center gap-1.5" style={{ minWidth: '58px' }}>
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full transition-all duration-200 flex-shrink-0"
                        style={{ background: volumes[s.key] > 0 ? ACCENT : 'rgba(255,255,255,0.2)', boxShadow: volumes[s.key] > 0 ? `0 0 6px ${ACCENT}` : 'none' }} />
                      <span className="text-[10px] text-white/50 whitespace-nowrap">{s.label}</span>
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

      {/* ── Settings modal — z-50 so it's above everything ─────────────────── */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
          onClick={e => e.target === e.currentTarget && setShowSettings(false)}
        >
          <div className="rounded-2xl p-6 w-full max-w-[390px] max-h-[90vh] overflow-y-auto"
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

      {/* ── Task detail modal — z-[60] so it's above everything ────────────── */}
      {selectedTask && (
        <TaskDetail
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onToggle={doToggle}
          onToggleStar={toggleStar}
        />
      )}
    </div>
  )
}
