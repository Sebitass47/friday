'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import * as THREE from 'three'
import { getTasks, getTask, toggleTaskComplete, createTask, updateTask, updateSubtask, createSubtask } from '@/lib/api'
import { Task } from '@/lib/types'
import Sidebar from '@/components/layout/Sidebar'
import { useSidebar } from '@/components/layout/SidebarContext'

// ─── Types ────────────────────────────────────────────────────────────────────
type BgName = 'lluvia' | 'brasas' | 'aurora' | 'cosmos' | 'mar' | 'planeta' | 'tunel' | 'cyberpunk' | 'gamer' | 'agujero'
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
  { key: 'planeta', label: 'Sistema' },
  { key: 'tunel', label: 'Túnel' },
  { key: 'cyberpunk', label: 'Ciudad' },
  { key: 'gamer', label: 'Gamer' },
  { key: 'agujero', label: 'Agujero' },
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
const FOCUS_KEY = 'friday_focus_session'

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

// ── Mar — Three.js night ocean: animated waves, moon, moonlight column ────────
function bgMar(canvas: HTMLCanvasElement): () => void {
  const W = canvas.width, H = canvas.height
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x000810)
  scene.fog = new THREE.FogExp2(0x020c1e, 0.018)

  const camera = new THREE.PerspectiveCamera(65, W / H, 0.1, 600)
  camera.position.set(0, 6, 18)
  camera.lookAt(0, 0, -30)

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false })
  renderer.setSize(W, H)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 0.75

  // Ocean plane
  const oceanGeo = new THREE.PlaneGeometry(300, 300, 100, 100)
  oceanGeo.rotateX(-Math.PI / 2)
  const oceanMat = new THREE.MeshPhongMaterial({ color: 0x041535, emissive: 0x020810, shininess: 90, specular: 0x2050a0 })
  const ocean = new THREE.Mesh(oceanGeo, oceanMat)
  scene.add(ocean)

  // Sky plane (behind everything)
  const skyGeo = new THREE.PlaneGeometry(600, 300)
  const skyMat = new THREE.MeshBasicMaterial({ color: 0x000810, side: THREE.FrontSide })
  const sky = new THREE.Mesh(skyGeo, skyMat)
  sky.position.set(0, 0, -140)
  scene.add(sky)

  // Stars
  const sPos = new Float32Array(600 * 3)
  for (let i = 0; i < 600; i++) {
    sPos[i * 3] = (Math.random() - .5) * 500; sPos[i * 3 + 1] = Math.random() * 120 + 5; sPos[i * 3 + 2] = (Math.random() - .5) * 500
  }
  const sGeo = new THREE.BufferGeometry(); sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3))
  const sMat = new THREE.PointsMaterial({ color: 0xddd5ff, size: 0.5 })
  scene.add(new THREE.Points(sGeo, sMat))

  // Moon
  const moonGeo = new THREE.SphereGeometry(4, 16, 16)
  const moonMat = new THREE.MeshBasicMaterial({ color: 0xddd5b0 })
  const moon = new THREE.Mesh(moonGeo, moonMat)
  moon.position.set(40, 70, -100)
  scene.add(moon)
  const moonLight = new THREE.PointLight(0xd0c880, 3.5, 600)
  moonLight.position.copy(moon.position)
  scene.add(moonLight)
  scene.add(new THREE.AmbientLight(0x020818, 2))

  // Wave vertex animation
  const posAttr = oceanGeo.attributes.position as THREE.BufferAttribute
  const origX = new Float32Array(posAttr.count), origZ = new Float32Array(posAttr.count)
  for (let i = 0; i < posAttr.count; i++) { origX[i] = posAttr.getX(i); origZ[i] = posAttr.getZ(i) }

  let t = 0, raf = 0
  const animate = () => {
    raf = requestAnimationFrame(animate)
    t += 0.012
    for (let i = 0; i < posAttr.count; i++) {
      const x = origX[i], z = origZ[i]
      const y = Math.sin(x * 0.08 + t) * 0.9
        + Math.sin(z * 0.06 + t * 0.75) * 0.6
        + Math.sin((x + z) * 0.04 + t * 1.1) * 0.35
      posAttr.setY(i, y)
    }
    posAttr.needsUpdate = true
    oceanGeo.computeVertexNormals()
    renderer.render(scene, camera)
  }
  animate()

  return () => {
    cancelAnimationFrame(raf)
    renderer.dispose()
    oceanGeo.dispose(); oceanMat.dispose(); skyGeo.dispose(); skyMat.dispose()
    moonGeo.dispose(); moonMat.dispose(); sGeo.dispose(); sMat.dispose()
  }
}

// ── Planeta — Three.js gas giant: rotating sphere, rings, stars, atmosphere ───
function bgPlaneta(canvas: HTMLCanvasElement): () => void {
  const W = canvas.width, H = canvas.height
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x000008)

  const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 2000)
  camera.position.set(0, 30, 70)
  camera.lookAt(0, 0, 0)

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false })
  renderer.setSize(W, H)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  const geos: THREE.BufferGeometry[] = []
  const mats: THREE.Material[] = []
  function track<T extends THREE.BufferGeometry>(g: T) { geos.push(g); return g }
  function trackM<T extends THREE.Material>(m: T) { mats.push(m); return m }

  // Stars
  const sPos = new Float32Array(3000 * 3)
  for (let i = 0; i < 3000; i++) {
    const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1), r = 300 + Math.random() * 700
    sPos[i*3] = r*Math.sin(ph)*Math.cos(th); sPos[i*3+1] = r*Math.sin(ph)*Math.sin(th); sPos[i*3+2] = r*Math.cos(ph)
  }
  const sGeo = track(new THREE.BufferGeometry()); sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3))
  scene.add(new THREE.Points(sGeo, trackM(new THREE.PointsMaterial({ color: 0xddd8ff, size: 0.35 }))))

  // Sun
  const sunGeo = track(new THREE.SphereGeometry(5, 32, 32))
  const sunMat = trackM(new THREE.MeshBasicMaterial({ color: 0xffee55 }))
  const sunMesh = new THREE.Mesh(sunGeo, sunMat)
  scene.add(sunMesh)
  // Sun corona (glow)
  const coronaGeo = track(new THREE.SphereGeometry(6.5, 24, 24))
  const coronaMat = trackM(new THREE.MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.12 }))
  scene.add(new THREE.Mesh(coronaGeo, coronaMat))
  const sunLight = new THREE.PointLight(0xfff5d0, 8, 600); scene.add(sunLight)
  scene.add(new THREE.AmbientLight(0x101828, 2.5))

  // Planet definitions
  type PlanetDef = { r: number; dist: number; spd: number; color: number; emissive: number; tilt?: number; rings?: boolean; moon?: boolean; stripes?: boolean }
  const defs: PlanetDef[] = [
    { r: 0.55, dist: 10,  spd: 4.7,  color: 0xccccdd, emissive: 0x222233 },                            // Mercury
    { r: 0.95, dist: 16,  spd: 1.85, color: 0xffcc33, emissive: 0x331a00, tilt: 0.05 },                // Venus
    { r: 1.0,  dist: 22,  spd: 1.0,  color: 0x1a88ff, emissive: 0x001133, tilt: 0.41, moon: true },    // Earth
    { r: 0.65, dist: 30,  spd: 0.53, color: 0xff4422, emissive: 0x330800, tilt: 0.44 },                 // Mars
    { r: 2.8,  dist: 46,  spd: 0.08, color: 0xffaa44, emissive: 0x221100, tilt: 0.05, stripes: true },  // Jupiter
    { r: 2.2,  dist: 63,  spd: 0.03, color: 0xffdd66, emissive: 0x221100, tilt: 0.47, rings: true },    // Saturn
  ]

  type PlanetObj = { pivot: THREE.Object3D; mesh: THREE.Mesh; spd: number; moon?: { pivot: THREE.Object3D } }
  const planets: PlanetObj[] = []

  for (const d of defs) {
    // Orbit ring
    const orb: THREE.Vector3[] = []
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2
      orb.push(new THREE.Vector3(d.dist * Math.cos(a), 0, d.dist * Math.sin(a)))
    }
    const og = track(new THREE.BufferGeometry().setFromPoints(orb))
    scene.add(new THREE.Line(og, trackM(new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.07 }))))

    // Pivot (rotation around sun)
    const pivot = new THREE.Object3D()
    pivot.rotation.y = Math.random() * Math.PI * 2
    scene.add(pivot)

    // Planet mesh
    let mat: THREE.MeshPhongMaterial
    if (d.stripes) {
      // Jupiter-like canvas texture — vivid orange/cream bands
      const tc = document.createElement('canvas'); tc.width = 256; tc.height = 128
      const tx = tc.getContext('2d')!
      const bgs = tx.createLinearGradient(0, 0, 0, 128)
      bgs.addColorStop(0, '#ff8833'); bgs.addColorStop(.5, '#ffcc77'); bgs.addColorStop(1, '#ff8833')
      tx.fillStyle = bgs; tx.fillRect(0, 0, 256, 128)
      for (let b = 0; b < 12; b++) {
        tx.fillStyle = `rgba(${b%2===0?'120,40,0':'255,200,100'},0.35)`
        tx.fillRect(0, (b/12)*128, 256, 128/12)
      }
      const tex = new THREE.CanvasTexture(tc); tex.wrapS = THREE.RepeatWrapping
      mats.push(tex as unknown as THREE.Material)
      mat = trackM(new THREE.MeshPhongMaterial({ map: tex, emissive: new THREE.Color(d.emissive), emissiveIntensity: 0.4, shininess: 20 }))
    } else {
      mat = trackM(new THREE.MeshPhongMaterial({ color: d.color, emissive: new THREE.Color(d.emissive), emissiveIntensity: 0.5, shininess: 35 }))
    }
    const pg = track(new THREE.SphereGeometry(d.r, 24, 24))
    const mesh = new THREE.Mesh(pg, mat)
    mesh.position.x = d.dist
    mesh.rotation.z = d.tilt ?? 0
    pivot.add(mesh)

    const obj: PlanetObj = { pivot, mesh, spd: d.spd }

    // Saturn rings
    if (d.rings) {
      const rg = track(new THREE.RingGeometry(d.r * 1.55, d.r * 2.7, 80))
      const rm = trackM(new THREE.MeshBasicMaterial({ color: 0xffdd88, transparent: true, opacity: 0.55, side: THREE.DoubleSide }))
      const rm2 = trackM(new THREE.MeshBasicMaterial({ color: 0xddaa44, transparent: true, opacity: 0.28, side: THREE.DoubleSide }))
      const rg2 = track(new THREE.RingGeometry(d.r * 2.8, d.r * 3.4, 80))
      const rMesh = new THREE.Mesh(rg, rm); rMesh.rotation.x = Math.PI * 0.43
      const rMesh2 = new THREE.Mesh(rg2, rm2); rMesh2.rotation.x = Math.PI * 0.43
      mesh.add(rMesh); mesh.add(rMesh2)
    }

    // Earth moon
    if (d.moon) {
      const moonPivot = new THREE.Object3D(); mesh.add(moonPivot)
      const mg = track(new THREE.SphereGeometry(0.27, 16, 16))
      const mm = trackM(new THREE.MeshPhongMaterial({ color: 0xcccccc, shininess: 5 }))
      const moonMesh = new THREE.Mesh(mg, mm); moonMesh.position.x = 1.8
      moonPivot.add(moonMesh)
      obj.moon = { pivot: moonPivot }
    }

    planets.push(obj)
  }

  let t = 0, raf = 0
  const animate = () => {
    raf = requestAnimationFrame(animate)
    t += 0.005
    // Sun slow rotation
    sunMesh.rotation.y = t * 0.3
    // Planet orbits
    for (const p of planets) {
      p.pivot.rotation.y += p.spd * 0.005
      p.mesh.rotation.y += 0.01
      if (p.moon) p.moon.pivot.rotation.y += 0.04
    }
    // Gentle camera drift — slow arc above the system
    camera.position.x = Math.sin(t * 0.07) * 18
    camera.position.y = 28 + Math.sin(t * 0.05) * 6
    camera.position.z = 65 + Math.cos(t * 0.06) * 10
    camera.lookAt(0, 0, 0)
    renderer.render(scene, camera)
  }
  animate()

  return () => {
    cancelAnimationFrame(raf)
    geos.forEach(g => g.dispose())
    mats.forEach(m => m.dispose())
    renderer.dispose()
  }
}

// ── Túnel — Three.js hexagonal warp corridor flying toward viewer ─────────────
function bgTunel(canvas: HTMLCanvasElement): () => void {
  const W = canvas.width, H = canvas.height
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x020008)
  scene.fog = new THREE.Fog(0x020008, 0.5, 28)

  const camera = new THREE.PerspectiveCamera(80, W / H, 0.1, 80)
  camera.position.set(0, 0, 0)
  camera.lookAt(0, 0, -1)

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false })
  renderer.setSize(W, H)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  // Build hexagonal ring geometry
  function makeHexRing(outerR: number, innerR: number): THREE.BufferGeometry {
    const N = 6, pts: number[] = []
    for (let i = 0; i < N; i++) {
      const a0 = (Math.PI / 3) * i + Math.PI / 6
      const a1 = (Math.PI / 3) * (i + 1) + Math.PI / 6
      // Two triangles per face
      pts.push(outerR * Math.cos(a0), outerR * Math.sin(a0), 0)
      pts.push(innerR * Math.cos(a0), innerR * Math.sin(a0), 0)
      pts.push(outerR * Math.cos(a1), outerR * Math.sin(a1), 0)
      pts.push(innerR * Math.cos(a0), innerR * Math.sin(a0), 0)
      pts.push(innerR * Math.cos(a1), innerR * Math.sin(a1), 0)
      pts.push(outerR * Math.cos(a1), outerR * Math.sin(a1), 0)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3))
    return geo
  }

  const N_RINGS = 32, SPACING = 2.2
  const rings: { mesh: THREE.Mesh; geo: THREE.BufferGeometry; mat: THREE.MeshBasicMaterial; initZ: number }[] = []

  for (let i = 0; i < N_RINGS; i++) {
    const frac = i / N_RINGS
    const hue = 270 + frac * 50
    const geo = makeHexRing(1.6, 1.35)
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(`hsl(${hue},85%,60%)`), transparent: true, opacity: 0.7, side: THREE.DoubleSide })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.z = -i * SPACING
    rings.push({ mesh, geo, mat, initZ: -i * SPACING })
    scene.add(mesh)
  }

  const totalLen = N_RINGS * SPACING
  let t = 0, raf = 0
  const animate = () => {
    raf = requestAnimationFrame(animate)
    t += 0.008
    const offset = t * SPACING * 0.6
    camera.rotation.z = Math.sin(t * 0.4) * 0.08
    rings.forEach((r, i) => {
      let z = r.initZ + offset
      while (z > 1.5) z -= totalLen
      r.mesh.position.z = z
      // Fade out rings very close to camera
      const dist = Math.abs(z)
      r.mat.opacity = dist < 1 ? dist * 0.7 : 0.75
    })
    renderer.render(scene, camera)
  }
  animate()

  return () => {
    cancelAnimationFrame(raf)
    rings.forEach(r => { r.geo.dispose(); r.mat.dispose() })
    renderer.dispose()
  }
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

// ── Cyberpunk City — rain-soaked city viewed from window height ───────────────
function bgCyberpunk(canvas: HTMLCanvasElement): () => void {
  const W = canvas.width, H = canvas.height
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x000810)
  scene.fog = new THREE.Fog(0x010a1a, 70, 210)

  const camera = new THREE.PerspectiveCamera(68, W / H, 0.1, 280)
  camera.position.set(0, 8, 6); camera.lookAt(0, 13, -20)

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setSize(W, H); renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  const geos: THREE.BufferGeometry[] = [], mats: THREE.Material[] = []
  const track = <T extends THREE.BufferGeometry>(g: T) => { geos.push(g); return g }
  const trackM = <T extends THREE.Material>(m: T) => { mats.push(m); return m }

  // Window texture — dark walls with bright lit rooms visible through windows
  function winTex(cols: number, rows: number): THREE.CanvasTexture {
    const cw = 18, rh = 20
    const tc = document.createElement('canvas'); tc.width = cols * cw; tc.height = rows * rh
    const tx = tc.getContext('2d')!
    tx.fillStyle = '#03080f'; tx.fillRect(0, 0, tc.width, tc.height)
    const wc = ['#ffee99','#ffcc55','#ffaa33','#aaddff','#ff99cc','#ccffee','#ffffcc','#ffdd77','#ffffff','#88ccff']
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (Math.random() < 0.65) {
        tx.fillStyle = wc[Math.floor(Math.random() * wc.length)]
        tx.globalAlpha = 0.8 + Math.random() * 0.2
        tx.fillRect(c*cw+2, r*rh+2, cw-4, rh-4)
        if (Math.random() > 0.65) {  // curtain shadow
          tx.fillStyle = 'rgba(0,0,0,0.4)'; tx.fillRect(c*cw+2, r*rh+2, Math.floor((cw-4)*0.4), rh-4)
        }
      }
    }
    tx.globalAlpha = 1
    const tex = new THREE.CanvasTexture(tc); mats.push(tex as unknown as THREE.Material); return tex
  }

  // Neon sign with canvas text
  const signWords = ['HOTEL','RAMEN','BAR','NOODLES','SPA','SYNTH','CYBER','OPEN','24H','ROOMS','CLUB','NEON']
  function neonSignTex(text: string, col: string): THREE.CanvasTexture {
    const tc = document.createElement('canvas'); tc.width = 256; tc.height = 64
    const tx = tc.getContext('2d')!
    tx.fillStyle = '#000000'; tx.fillRect(0, 0, 256, 64)
    tx.font = 'bold 38px monospace'; tx.textAlign = 'center'; tx.textBaseline = 'middle'
    tx.shadowColor = col; tx.shadowBlur = 22
    for (let i = 0; i < 4; i++) { tx.fillStyle = col; tx.fillText(text, 128, 32) }
    const tex = new THREE.CanvasTexture(tc); mats.push(tex as unknown as THREE.Material); return tex
  }

  // Wet ground with neon streaks
  const gtc = document.createElement('canvas'); gtc.width = 512; gtc.height = 512
  const gx = gtc.getContext('2d')!
  gx.fillStyle = '#020810'; gx.fillRect(0, 0, 512, 512)
  for (let i = 0; i < 25; i++) {
    const x = Math.random()*512
    gx.strokeStyle = 'rgba(50,70,120,0.22)'; gx.lineWidth = 1+Math.random()*2
    gx.beginPath(); gx.moveTo(x,0); gx.lineTo(x+(Math.random()-0.5)*30,512); gx.stroke()
  }
  const gTex = new THREE.CanvasTexture(gtc); mats.push(gTex as unknown as THREE.Material)
  const ground = new THREE.Mesh(track(new THREE.PlaneGeometry(300, 200)),
    trackM(new THREE.MeshPhongMaterial({ map: gTex, color: 0x06101a, shininess: 300, specular: 0x3355aa })))
  ground.rotation.x = -Math.PI/2; scene.add(ground)

  // Window frame (dark room interior around the view)
  const fMat = trackM(new THREE.MeshBasicMaterial({ color: 0x030108 }))
  ;[
    [0, 7, 5.8, 20, 0.5, 3],    // sill bottom
    [0, 16, 5.8, 20, 0.5, 3],   // top
    [-9.5, 11.5, 5.8, 1, 10, 3], // left pillar
    [9.5, 11.5, 5.8, 1, 10, 3], // right pillar
  ].forEach(([x,y,z,w,h,d]) => {
    const m = new THREE.Mesh(track(new THREE.BoxGeometry(w,h,d)), fMat)
    m.position.set(x,y,z); scene.add(m)
  })

  // Buildings — left/right flanks + deep center
  type BD = { x:number; z:number; w:number; d:number; h:number }
  const bDefs: BD[] = [
    // Left flank
    {x:-11,z:-7,w:8,d:6,h:24},{x:-19,z:-16,w:9,d:7,h:44},{x:-9,z:-23,w:7,d:5,h:38},
    {x:-23,z:-31,w:10,d:8,h:60},{x:-13,z:-43,w:8,d:6,h:50},{x:-27,z:-55,w:12,d:9,h:74},{x:-33,z:-40,w:7,d:6,h:32},
    // Right flank
    {x:11,z:-7,w:8,d:6,h:28},{x:19,z:-16,w:9,d:7,h:48},{x:9,z:-23,w:7,d:5,h:36},
    {x:23,z:-31,w:10,d:8,h:64},{x:13,z:-43,w:8,d:6,h:46},{x:27,z:-55,w:12,d:9,h:70},{x:33,z:-40,w:7,d:6,h:34},
    // Center deep
    {x:0,z:-51,w:16,d:10,h:88},{x:-6,z:-69,w:11,d:8,h:64},{x:8,z:-64,w:10,d:8,h:76},
  ]

  const NEON_PAL = [0xff00cc,0x00eeff,0xff4400,0x8800ff,0x00ff88,0xffcc00,0xff0066,0x00ffcc]
  const animSigns: { mat: THREE.MeshBasicMaterial; light: THREE.PointLight; rate: number; on: boolean }[] = []
  const avLights: { light: THREE.PointLight; phase: number }[] = []

  for (const b of bDefs) {
    const cols = Math.max(3, Math.round(b.w * 0.9))
    const rows = Math.max(5, Math.round(b.h * 0.55))
    const tex = winTex(cols, rows)
    // emissiveMap = windows always lit, independent of scene lighting
    const bMat = trackM(new THREE.MeshPhongMaterial({
      color: 0x050c18, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.9, shininess: 10,
    }))
    const bMesh = new THREE.Mesh(track(new THREE.BoxGeometry(b.w, b.h, b.d)), bMat)
    bMesh.position.set(b.x, b.h/2, b.z); scene.add(bMesh)

    // Neon sign
    if (Math.random() > 0.22) {
      const nc = NEON_PAL[Math.floor(Math.random() * NEON_PAL.length)]
      const ncHex = '#' + nc.toString(16).padStart(6, '0')
      const isText = Math.random() > 0.45
      const sw = b.w * (0.4 + Math.random() * 0.4), sh = 1.4 + Math.random() * 0.9
      let signMat: THREE.MeshBasicMaterial
      if (isText) {
        const word = signWords[Math.floor(Math.random() * signWords.length)]
        signMat = trackM(new THREE.MeshBasicMaterial({ map: neonSignTex(word, ncHex), transparent: true, opacity: 0.98 }))
      } else {
        signMat = trackM(new THREE.MeshBasicMaterial({ color: nc, transparent: true, opacity: 0.96 }))
      }
      const sy = b.h * (0.72 + Math.random() * 0.22)
      const sign = new THREE.Mesh(track(new THREE.PlaneGeometry(sw, sh)), signMat)
      sign.position.set(b.x, sy, b.z - b.d/2 - 0.1); scene.add(sign)
      const sl = new THREE.PointLight(nc, 4, 30); sl.position.set(b.x, sy, b.z - b.d/2 - 2); scene.add(sl)
      animSigns.push({ mat: signMat, light: sl, rate: 0.002 + Math.random()*0.003, on: true })
    }

    // Rooftop aviation blink (tall buildings)
    if (b.h > 40) {
      const al = new THREE.PointLight(0xff2200, 2.5, 14)
      al.position.set(b.x, b.h + 0.5, b.z); scene.add(al)
      avLights.push({ light: al, phase: Math.random() * Math.PI * 2 })
    }
  }

  // Rain as LineSegments (proper streaks)
  const RC = 700
  const rV = new Float32Array(RC * 6), rSpd = new Float32Array(RC)
  for (let i = 0; i < RC; i++) {
    const x=(Math.random()-.5)*140, z=-Math.random()*110, y=Math.random()*80, len=1+Math.random()*2
    rV[i*6]=x; rV[i*6+1]=y; rV[i*6+2]=z; rV[i*6+3]=x+0.3; rV[i*6+4]=y-len; rV[i*6+5]=z+0.1
    rSpd[i] = 1.2 + Math.random() * 1.5
  }
  const rGeo = track(new THREE.BufferGeometry()); rGeo.setAttribute('position', new THREE.BufferAttribute(rV, 3))
  scene.add(new THREE.LineSegments(rGeo, trackM(new THREE.LineBasicMaterial({ color: 0x8899bb, transparent: true, opacity: 0.4 }))))

  // Flying cars (pairs of front/tail lights)
  const cars = Array.from({ length: 6 }, () => {
    const y=10+Math.random()*22, z=-8-Math.random()*44
    const head=new THREE.PointLight(0xffffff,2.5,22); head.position.set(-68,y,z)
    const tail=new THREE.PointLight(0xff2200,1.2,10); tail.position.set(-70,y,z)
    scene.add(head, tail); return { lights:[head,tail], spd:0.14+Math.random()*0.22 }
  })

  // Ground neon puddle reflections (colored PointLights near street level)
  ;[[-10,0,-8,0xff00cc,2],[ 10,0,-8,0x00ccff,2],[0,0,-18,0xffcc00,1.5],[-6,0,-28,0xff4400,1.5]].forEach(([x,y,z,c,i])=>{
    const l=new THREE.PointLight(c as number,i as number,22); l.position.set(x as number,y as number,z as number); scene.add(l)
  })

  scene.add(new THREE.AmbientLight(0x030810, 4))
  const ml1=new THREE.PointLight(0xff00cc,5,100); ml1.position.set(-15,4,2); scene.add(ml1)
  const ml2=new THREE.PointLight(0x00ccff,5,100); ml2.position.set(15,4,2); scene.add(ml2)

  let t=0, raf=0
  const animate=()=>{
    raf=requestAnimationFrame(animate); t+=0.012

    // Rain streaks
    const rv2=rGeo.attributes.position.array as Float32Array
    for(let i=0;i<RC;i++){
      rv2[i*6+1]-=rSpd[i]; rv2[i*6+4]-=rSpd[i]
      if(rv2[i*6+4]<-2){
        const x=(Math.random()-.5)*140, z=-Math.random()*110, y=78+Math.random()*12, len=1+Math.random()*2
        rv2[i*6]=x; rv2[i*6+1]=y; rv2[i*6+2]=z; rv2[i*6+3]=x+0.3; rv2[i*6+4]=y-len; rv2[i*6+5]=z+0.1
      }
    }
    rGeo.attributes.position.needsUpdate=true

    // Cars
    for(const c of cars){ c.lights.forEach(l=>l.position.x+=c.spd); if(c.lights[0].position.x>72) c.lights.forEach(l=>l.position.x=-72) }

    // Neon sign blinks
    animSigns.forEach(s=>{ if(Math.random()<s.rate){ s.on=!s.on; s.light.intensity=s.on?4:0; s.mat.opacity=s.on?0.97:0 } })

    // Aviation lights pulse
    avLights.forEach(a=>{ a.light.intensity=Math.sin(t*2.5+a.phase)>0.6?3:0 })

    // Gentle camera sway
    camera.position.x=Math.sin(t*0.02)*1.5; camera.position.y=8+Math.sin(t*0.033)*0.3
    camera.lookAt(Math.sin(t*0.015)*2.5,13,-20)
    renderer.render(scene,camera)
  }
  animate()
  return ()=>{ cancelAnimationFrame(raf); geos.forEach(g=>g.dispose()); mats.forEach(m=>m.dispose()); renderer.dispose() }
}

// ── Gamer Room — 80s neon bedroom with CRT, grid floor, synthwave vibes ───────
function bgGamer(canvas: HTMLCanvasElement): () => void {
  const W = canvas.width, H = canvas.height
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x050108)
  const camera = new THREE.PerspectiveCamera(68, W/H, 0.1, 80)
  camera.position.set(0, 3.2, 9); camera.lookAt(0, 3.5, -5)
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setSize(W, H); renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.7

  const geos: THREE.BufferGeometry[] = [], mats: THREE.Material[] = []
  const track = <T extends THREE.BufferGeometry>(g: T) => { geos.push(g); return g }
  const trackM = <T extends THREE.Material>(m: T) => { mats.push(m); return m }
  const box = (w: number,h: number,d: number,col: number,emi=0x000000) => {
    const m = new THREE.Mesh(track(new THREE.BoxGeometry(w,h,d)), trackM(new THREE.MeshPhongMaterial({ color:col, emissive:emi, shininess:30 })))
    scene.add(m); return m
  }

  // Grid floor texture
  const ftc = document.createElement('canvas'); ftc.width = 512; ftc.height = 512
  const ftx = ftc.getContext('2d')!
  ftx.fillStyle = '#08020e'; ftx.fillRect(0, 0, 512, 512)
  for (let i = 0; i <= 16; i++) {
    const v = i * 32
    ftx.strokeStyle = `rgba(255,0,180,${i%4===0?0.55:0.18})`; ftx.lineWidth = i%4===0 ? 2 : 1
    ftx.beginPath(); ftx.moveTo(v,0); ftx.lineTo(v,512); ftx.stroke()
    ftx.strokeStyle = `rgba(0,160,255,${i%4===0?0.55:0.18})`
    ftx.beginPath(); ftx.moveTo(0,v); ftx.lineTo(512,v); ftx.stroke()
  }
  const ftex = new THREE.CanvasTexture(ftc); ftex.wrapS = ftex.wrapT = THREE.RepeatWrapping; ftex.repeat.set(3,3)
  mats.push(ftex as unknown as THREE.Material)
  const floor = new THREE.Mesh(track(new THREE.PlaneGeometry(20,18)),
    trackM(new THREE.MeshPhongMaterial({ map:ftex, color:0x110820, shininess:80, specular:0x220044 })))
  floor.rotation.x = -Math.PI/2; scene.add(floor)

  // Walls & ceiling
  const bwMat = trackM(new THREE.MeshPhongMaterial({ color:0x0a0614, emissive:0x040008 }))
  const bw = new THREE.Mesh(track(new THREE.PlaneGeometry(20,10)), bwMat); bw.position.set(0,5,-9); scene.add(bw)
  const swGeo = track(new THREE.PlaneGeometry(18,10)); const swMat = trackM(new THREE.MeshPhongMaterial({ color:0x09051a }))
  const lw = new THREE.Mesh(swGeo, swMat); lw.rotation.y=Math.PI/2; lw.position.set(-10,5,0); scene.add(lw)
  const rw = new THREE.Mesh(swGeo, swMat); rw.rotation.y=-Math.PI/2; rw.position.set(10,5,0); scene.add(rw)
  const ceil = new THREE.Mesh(track(new THREE.PlaneGeometry(20,18)), trackM(new THREE.MeshPhongMaterial({ color:0x06021a })))
  ceil.rotation.x=Math.PI/2; ceil.position.set(0,8,0); scene.add(ceil)

  // Neon trim lines
  const nLine = (x1:number,y1:number,z1:number,x2:number,y2:number,z2:number,col:number,li=1.5) => {
    const g = track(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x1,y1,z1),new THREE.Vector3(x2,y2,z2)]))
    scene.add(new THREE.Line(g, trackM(new THREE.LineBasicMaterial({ color:col }))))
    const l = new THREE.PointLight(col,li,12); l.position.set((x1+x2)/2,(y1+y2)/2,(z1+z2)/2); scene.add(l)
  }
  nLine(-10,9.9,-8.9,10,9.9,-8.9,0x00eeff,2)   // back top
  nLine(-10,0.05,-8.9,10,0.05,-8.9,0xff00bb,2)  // back bottom
  nLine(-9.9,0,-8.9,-9.9,9.9,-8.9,0xff00bb)      // back left
  nLine(9.9,0,-8.9,9.9,9.9,-8.9,0x00eeff)        // back right
  nLine(-9.9,9.9,-9,-9.9,9.9,9,0xff8800,1)       // side top left
  nLine(9.9,9.9,-9,9.9,9.9,9,0x8800ff,1)         // side top right
  nLine(-10,0.05,-9,10,0.05,9,0xff00bb,1)         // floor edge back

  // Desk
  const desk = box(6,0.15,2.5,0x1a0d2e); desk.position.set(0,2.5,-6)
  ;[[-2.9,1.25,-7.1],[2.9,1.25,-7.1],[-2.9,1.25,-4.9],[2.9,1.25,-4.9]].forEach(([x,y,z])=>{
    const leg=box(0.15,2.5,0.15,0x150a22); leg.position.set(x,y,z)
  })

  // CRT Monitor
  const mon = box(2.2,1.8,0.9,0x18102a); mon.position.set(0,3.58,-7)
  // Screen texture
  const stc = document.createElement('canvas'); stc.width=256; stc.height=200
  const sctx = stc.getContext('2d')!
  sctx.fillStyle='#000020'; sctx.fillRect(0,0,256,200)
  for(let i=0;i<200;i+=4){sctx.fillStyle='rgba(0,0,0,0.35)';sctx.fillRect(0,i,256,2)}
  sctx.font='bold 13px monospace'
  sctx.fillStyle='#00ff88'; sctx.fillText('> FRIDAY OS v2.0',8,28); sctx.fillText('READY_',8,168)
  sctx.fillStyle='#00cc55'; sctx.fillText('Loading modules...',8,52); sctx.fillText('████████░░ 80%',8,76)
  sctx.fillStyle='#ff00aa'; sctx.fillText('HIGH SCORE: 999999',8,110)
  sctx.fillStyle='#00eeff'; sctx.fillText('PLAYER 1  READY',8,140)
  const stex=new THREE.CanvasTexture(stc); mats.push(stex as unknown as THREE.Material)
  const screen=new THREE.Mesh(track(new THREE.PlaneGeometry(1.9,1.5)),trackM(new THREE.MeshBasicMaterial({map:stex})))
  screen.position.set(0,3.58,-6.54); scene.add(screen)
  const scLight=new THREE.PointLight(0x00ff88,3.5,14); scLight.position.set(0,3.5,-5.5); scene.add(scLight)

  // Keyboard
  const kb=box(1.8,0.08,0.65,0x201040); kb.position.set(0,2.6,-5.8)
  // Keycaps canvas
  const ktc=document.createElement('canvas'); ktc.width=180; ktc.height=65
  const kctx=ktc.getContext('2d')!
  kctx.fillStyle='#180a30'; kctx.fillRect(0,0,180,65)
  for(let row=0;row<4;row++) for(let col=0;col<12;col++){
    const lit=Math.random()>0.7
    kctx.fillStyle=lit?`hsl(${Math.random()*60+270},100%,60%)`:'#2a1858'
    kctx.fillRect(col*15+1,row*16+1,13,14)
  }
  const ktex=new THREE.CanvasTexture(ktc); mats.push(ktex as unknown as THREE.Material)
  const kbFace=new THREE.Mesh(track(new THREE.PlaneGeometry(1.8,0.65)),trackM(new THREE.MeshBasicMaterial({map:ktex})))
  kbFace.rotation.x=-Math.PI/2; kbFace.position.set(0,2.65,-5.8); scene.add(kbFace)

  // Speakers
  const spk1=box(0.5,0.8,0.4,0x150a28,0x050015); spk1.position.set(-1.5,2.95,-7)
  const spk2=box(0.5,0.8,0.4,0x150a28,0x050015); spk2.position.set(1.5,2.95,-7)
  new THREE.PointLight(0xff00bb,1,6)

  // Neon wall signs
  ;[{x:-5,y:6.5,w:2.8,h:0.75,c:0xff00bb},{x:4.8,y:7.2,w:3.2,h:0.75,c:0x00eeff},{x:0,y:8.1,w:5,h:0.55,c:0xffcc00}]
  .forEach(({x,y,w,h,c})=>{
    const s=new THREE.Mesh(track(new THREE.PlaneGeometry(w,h)),trackM(new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:0.95})))
    s.position.set(x,y,-8.85); scene.add(s)
    const sl=new THREE.PointLight(c,3,22); sl.position.set(x,y,-7.5); scene.add(sl)
  })

  // Posters
  ;[{x:-3.5,c:0x3300aa},{x:3.5,c:0xaa0055}].forEach(({x,c})=>{
    const p=new THREE.Mesh(track(new THREE.PlaneGeometry(1.6,2.2)),trackM(new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:0.85})))
    p.position.set(x,5.5,-8.85); scene.add(p)
    const pl=new THREE.PointLight(c,1,10); pl.position.set(x,5.5,-7.5); scene.add(pl)
  })

  // PC Tower
  const tower=box(0.7,2.2,0.7,0x12082a,0x040012); tower.position.set(3.5,1.1,-7.2)
  const pwrL=new THREE.PointLight(0x00ff33,1.2,3); pwrL.position.set(3.5,2,-6.86); scene.add(pwrL)

  // Floating dust particles
  const DP=180, dp=new Float32Array(DP*3)
  for(let i=0;i<DP;i++){dp[i*3]=(Math.random()-.5)*18;dp[i*3+1]=Math.random()*7;dp[i*3+2]=(Math.random()-.5)*16}
  const dustGeo=track(new THREE.BufferGeometry()); dustGeo.setAttribute('position',new THREE.BufferAttribute(dp,3))
  scene.add(new THREE.Points(dustGeo,trackM(new THREE.PointsMaterial({color:0xaa88ff,size:0.04,transparent:true,opacity:0.65}))))

  // Lighting
  scene.add(new THREE.AmbientLight(0x080214,2.5))
  const purp=new THREE.PointLight(0x8800ff,3.5,28); purp.position.set(0,7.5,-2); scene.add(purp)
  const pink=new THREE.PointLight(0xff0088,3,22); pink.position.set(-8,4,-2); scene.add(pink)
  const cyan=new THREE.PointLight(0x00ccff,3,22); cyan.position.set(8,4,-2); scene.add(cyan)

  let t=0, raf=0
  const animate=()=>{
    raf=requestAnimationFrame(animate); t+=0.01
    scLight.intensity=3+Math.sin(t*8)*0.5+(Math.random()>0.98?-2:0)
    pwrL.intensity=1+Math.sin(t*2)*0.5
    camera.position.x=Math.sin(t*0.04)*0.7
    camera.position.y=3.2+Math.sin(t*0.06)*0.12
    camera.lookAt(Math.sin(t*0.03)*0.8,3.5,-5)
    renderer.render(scene,camera)
  }
  animate()
  return ()=>{ cancelAnimationFrame(raf); geos.forEach(g=>g.dispose()); mats.forEach(m=>m.dispose()); renderer.dispose() }
}

// ── Agujero Negro — black hole with accretion disk, jets & orbiting matter ────
function bgAgujero(canvas: HTMLCanvasElement): () => void {
  const W = canvas.width, H = canvas.height
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x000002)
  const camera = new THREE.PerspectiveCamera(60, W/H, 0.1, 2000)
  camera.position.set(0,25,60); camera.lookAt(0,0,0)
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setSize(W,H); renderer.setPixelRatio(Math.min(window.devicePixelRatio,2))

  const geos: THREE.BufferGeometry[] = [], mats: THREE.Material[] = []
  const track = <T extends THREE.BufferGeometry>(g: T) => { geos.push(g); return g }
  const trackM = <T extends THREE.Material>(m: T) => { mats.push(m); return m }

  // Stars
  const sPos=new Float32Array(5000*3)
  for(let i=0;i<5000;i++){
    const th=Math.random()*Math.PI*2, ph=Math.acos(2*Math.random()-1), r=250+Math.random()*750
    sPos[i*3]=r*Math.sin(ph)*Math.cos(th); sPos[i*3+1]=r*Math.sin(ph)*Math.sin(th); sPos[i*3+2]=r*Math.cos(ph)
  }
  const sGeo=track(new THREE.BufferGeometry()); sGeo.setAttribute('position',new THREE.BufferAttribute(sPos,3))
  scene.add(new THREE.Points(sGeo,trackM(new THREE.PointsMaterial({color:0xeeddff,size:0.45}))))

  // Black hole
  scene.add(new THREE.Mesh(track(new THREE.SphereGeometry(8,32,32)),trackM(new THREE.MeshBasicMaterial({color:0x000000}))))

  // Photon ring
  const photon=new THREE.Mesh(track(new THREE.RingGeometry(8.05,8.8,128)),
    trackM(new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.75,side:THREE.DoubleSide})))
  photon.rotation.x=Math.PI*0.15; scene.add(photon)

  // Accretion disk layers
  const TILT=Math.PI*0.12
  ;[
    [8.8,13,0xffffff,0.9],[13,18,0xffdd44,0.75],[18,25,0xff7700,0.6],
    [25,34,0xff2200,0.45],[34,45,0x660022,0.28],[45,58,0x220044,0.14],
  ].forEach(([inner,outer,col,op])=>{
    const m=new THREE.Mesh(track(new THREE.RingGeometry(inner as number,outer as number,128)),
      trackM(new THREE.MeshBasicMaterial({color:col as number,transparent:true,opacity:op as number,side:THREE.DoubleSide})))
    m.rotation.x=TILT; scene.add(m)
  })

  // Einstein ring / lensing glow (opposite tilt)
  const lensGeo=track(new THREE.RingGeometry(7.5,10.5,128))
  const lensMat=trackM(new THREE.MeshBasicMaterial({color:0xff8800,transparent:true,opacity:0.35,side:THREE.DoubleSide}))
  const lens=new THREE.Mesh(lensGeo,lensMat); lens.rotation.x=-TILT+Math.PI*0.5; scene.add(lens)

  // Orbiting particles (matter spiraling in)
  const ORBS=350, orbPos=new Float32Array(ORBS*3)
  const orbData=Array.from({length:ORBS},()=>{
    const r=9+Math.random()*48, theta=Math.random()*Math.PI*2
    return { r, theta, spd:0.009/Math.sqrt(r/10), spread:(Math.random()-.5)*0.4 }
  })
  const orbGeo=track(new THREE.BufferGeometry()); orbGeo.setAttribute('position',new THREE.BufferAttribute(orbPos,3))
  scene.add(new THREE.Points(orbGeo,trackM(new THREE.PointsMaterial({color:0xffaa44,size:0.35,transparent:true,opacity:0.85}))))

  // Polar jets (relativistic plasma beams)
  const makeJet=(dir:number,col:number)=>{
    const pts=new Float32Array(80*3)
    for(let i=0;i<80;i++){
      const frac=i/79, spread=frac*frac*5
      pts[i*3]=(Math.random()-.5)*spread; pts[i*3+1]=dir*(8+frac*90); pts[i*3+2]=(Math.random()-.5)*spread
    }
    const g=track(new THREE.BufferGeometry()); g.setAttribute('position',new THREE.BufferAttribute(pts,3))
    scene.add(new THREE.Points(g,trackM(new THREE.PointsMaterial({color:col,size:0.55,transparent:true,opacity:0.65}))))
    const jl=new THREE.PointLight(col,3,40); jl.position.set(0,dir*30,0); scene.add(jl)
  }
  makeJet(1,0x4499ff); makeJet(-1,0x4499ff)

  // Core glow
  const coreL=new THREE.PointLight(0xff6600,10,90); scene.add(coreL)
  const rimL=new THREE.PointLight(0xff4400,4,50); rimL.position.set(0,8,0); scene.add(rimL)
  scene.add(new THREE.AmbientLight(0x020006,2))

  let t=0, raf=0
  const animate=()=>{
    raf=requestAnimationFrame(animate); t+=0.005
    const op=orbGeo.attributes.position.array as Float32Array
    for(let i=0;i<ORBS;i++){
      orbData[i].theta+=orbData[i].spd
      const {r,theta,spread}=orbData[i]
      op[i*3]=r*Math.cos(theta); op[i*3+1]=Math.sin(theta*2)*spread; op[i*3+2]=r*Math.sin(theta)
    }
    orbGeo.attributes.position.needsUpdate=true
    photon.rotation.z=t*0.4
    lens.rotation.z=-t*0.2
    coreL.intensity=9+Math.sin(t*15)*1.5
    camera.position.x=Math.sin(t*0.08)*70
    camera.position.y=20+Math.sin(t*0.05)*14
    camera.position.z=Math.cos(t*0.08)*70
    camera.lookAt(0,0,0)
    renderer.render(scene,camera)
  }
  animate()
  return ()=>{ cancelAnimationFrame(raf); geos.forEach(g=>g.dispose()); mats.forEach(m=>m.dispose()); renderer.dispose() }
}

const BG_RUNNERS: Record<BgName, (c: HTMLCanvasElement) => () => void> = {
  lluvia: bgLluvia, brasas: bgBrasas, aurora: bgAurora, cosmos: bgCosmos,
  mar: bgMar, planeta: bgPlaneta, tunel: bgTunel,
  cyberpunk: bgCyberpunk, gamer: bgGamer, agujero: bgAgujero,
}
const IS_3D_SET = new Set<BgName>(['mar', 'planeta', 'tunel', 'cyberpunk', 'gamer', 'agujero'])

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

// ─── Focus Select ─────────────────────────────────────────────────────────────
function FocusSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative flex-1 min-w-0">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between rounded-lg px-2 py-1.5 text-xs text-white/70 border border-white/[0.09] transition-colors hover:border-white/20"
        style={{ background: 'rgba(255,255,255,0.06)' }}
      >
        <span>{value}</span>
        <span className="text-white/30 text-[10px] ml-1" style={{ transform: open ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform .2s' }}>▾</span>
      </button>
      {open && (
        <div className="absolute bottom-full mb-1 left-0 right-0 rounded-xl overflow-hidden z-50"
          style={{ background: 'rgba(18,12,38,0.97)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
          {options.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => { onChange(opt); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-xs transition-colors"
              style={opt === value
                ? { background: `${ACCENT}22`, color: ACCENT, fontWeight: 600 }
                : { color: 'rgba(255,255,255,0.65)' }
              }
              onMouseEnter={e => { if (opt !== value) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)' }}
              onMouseLeave={e => { if (opt !== value) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  )
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

  // Auth + restore session
  useEffect(() => {
    if (!localStorage.getItem('token')) { router.push('/login'); return }
    try {
      const raw = localStorage.getItem(FOCUS_KEY)
      if (raw) {
        const s = JSON.parse(raw)
        if (s.phase) setPhase(s.phase)
        if (s.secs != null) setSecs(s.secs)
        if (s.sessionsDone != null) setSessionsDone(s.sessionsDone)
        if (s.totalFocused != null) setTotalFocused(s.totalFocused)
        if (s.settings) setSettings(s.settings)
        if (s.bg) setBg(s.bg)
        if (s.timerStyle) setTimerStyle(s.timerStyle)
      }
    } catch { /* ignore */ }
    setReady(true)
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
  const [showMusic, setShowMusic] = useState(false)
  const [zen, setZen] = useState(false)
  const [bgPickerOpen, setBgPickerOpen] = useState(false)

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
  const [editNotes, setEditNotes] = useState('')
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')
  const notesDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Refs
  const canvas2DRef = useRef<HTMLCanvasElement | null>(null)
  const canvas3DRef = useRef<HTMLCanvasElement | null>(null)
  const cleanupBgRef = useRef<(() => void) | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const handlesRef = useRef<Partial<Record<SoundKey, SoundHandle>>>({})
  const justRanOutRef = useRef(false)

  // Sync mutable refs so timer callbacks always read fresh values
  const phaseRef = useRef(phase)
  const sessionsDoneRef = useRef(sessionsDone)
  const settingsRef = useRef(settings)
  const totalFocusedRef = useRef(totalFocused)
  const bgRef = useRef(bg)
  phaseRef.current = phase
  sessionsDoneRef.current = sessionsDone
  settingsRef.current = settings
  totalFocusedRef.current = totalFocused
  bgRef.current = bg

  // ── Persist session to localStorage ────────────────────────────────────────
  useEffect(() => {
    if (!ready) return
    try {
      localStorage.setItem(FOCUS_KEY, JSON.stringify({ phase, secs, sessionsDone, totalFocused, settings, bg, timerStyle }))
    } catch { /* ignore */ }
  }, [phase, secs, sessionsDone, totalFocused, settings, bg, timerStyle, ready])

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
    const is3D = IS_3D_SET.has(bg)
    const canvas = is3D ? canvas3DRef.current : canvas2DRef.current
    if (!ready || !canvas) return
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
    // Change background randomly when a break ends (full cycle complete)
    if (nextPhase === 'work') {
      const others = BG_LIST.map(b => b.key).filter(k => k !== bgRef.current)
      setBg(others[Math.floor(Math.random() * others.length)])
    }
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
    try { localStorage.removeItem(FOCUS_KEY) } catch { /* ignore */ }
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
  async function openDetail(task: Task) {
    setShowTasks(true)
    setSelectedTask(task)
    try {
      const full = await getTask(task.id)
      setSelectedTask(full)
    } catch { /* keep the task we already set */ }
  }

  // Sync editNotes when selected task changes
  useEffect(() => {
    setEditNotes(selectedTask?.notes ?? '')
    setNewSubtaskTitle('')
  }, [selectedTask?.id])

  async function doToggleSubtask(taskId: string, subtaskId: string, completed: boolean) {
    try {
      await updateSubtask(taskId, subtaskId, { is_completed: completed })
      const updater = (s: import('@/lib/types').Subtask) => s.id === subtaskId ? { ...s, is_completed: completed } : s
      setSelectedTask(prev => prev ? { ...prev, subtasks: prev.subtasks.map(updater) } : null)
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, subtasks: t.subtasks.map(updater) } : t))
    } catch { /* ignore */ }
  }

  function handleNotesChange(val: string) {
    setEditNotes(val)
    if (!selectedTask) return
    if (notesDebounceRef.current) clearTimeout(notesDebounceRef.current)
    notesDebounceRef.current = setTimeout(async () => {
      try {
        await updateTask(selectedTask.id, { notes: val.trim() || null })
        setSelectedTask(prev => prev ? { ...prev, notes: val.trim() || null } : null)
      } catch { /* ignore */ }
    }, 600)
  }

  async function doAddSubtask(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter' || !newSubtaskTitle.trim() || !selectedTask) return
    const title = newSubtaskTitle.trim()
    setNewSubtaskTitle('')
    try {
      const sub = await createSubtask(selectedTask.id, title)
      setSelectedTask(prev => prev ? { ...prev, subtasks: [...prev.subtasks, sub] } : null)
    } catch { /* ignore */ }
  }

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

      {/* Canvas background — 2D for lluvia/brasas/aurora/cosmos, WebGL for mar/planeta/tunel */}
      <canvas ref={canvas2DRef} className="absolute inset-0 w-full h-full"
        style={{ display: IS_3D_SET.has(bg) ? 'none' : 'block' }} />
      <canvas ref={canvas3DRef} className="absolute inset-0 w-full h-full"
        style={{ display: IS_3D_SET.has(bg) ? 'block' : 'none' }} />

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
          {/* BG picker — dropdown on mobile, tabs on desktop */}
          <div className="flex-1 mr-3">
            {/* Mobile: dropdown */}
            <div className="relative lg:hidden">
              <button
                onClick={() => setBgPickerOpen(o => !o)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
              >
                {BG_LIST.find(b => b.key === bg)?.label}
                <span style={{ display: 'inline-block', transition: 'transform .2s', transform: bgPickerOpen ? 'rotate(180deg)' : 'none', fontSize: '9px' }}>▾</span>
              </button>
              {bgPickerOpen && (
                <div className="absolute top-full left-0 mt-1 rounded-xl overflow-hidden z-[60]"
                  style={{ background: 'rgba(12,8,26,0.97)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 8px 32px rgba(0,0,0,0.7)', minWidth: '130px' }}>
                  {BG_LIST.map(b => (
                    <button key={b.key}
                      onClick={() => { setBg(b.key); setBgPickerOpen(false) }}
                      className="w-full text-left px-4 py-2.5 text-xs font-medium transition-colors"
                      style={bg === b.key
                        ? { background: `${ACCENT}33`, color: '#fff' }
                        : { color: 'rgba(255,255,255,0.55)' }
                      }
                    >{b.label}</button>
                  ))}
                </div>
              )}
            </div>
            {/* Desktop: pill tabs */}
            <div className="hidden lg:flex items-center gap-1 min-w-max">
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
            <button onClick={() => setShowMusic(s => !s)}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
              style={showMusic
                ? { background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }
                : { color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.07)' }
              }
            >Música</button>
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
                width: '320px',
                maxHeight: 'calc(100vh - 56px - 88px)',
                background: 'rgba(7,5,18,0.82)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.09)',
                boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
              }}
            >
              {selectedTask ? (
                /* ── Detail view ── */
                <>
                  {/* Header */}
                  <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/[0.06] flex-shrink-0">
                    <button
                      onClick={() => setSelectedTask(null)}
                      className="flex items-center gap-1.5 text-white/45 hover:text-white/75 transition-colors text-xs font-medium"
                    >
                      <span className="text-base leading-none">←</span> Tareas
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleStar(selectedTask.id, !selectedTask.is_starred)}
                        className="text-[16px] transition-transform hover:scale-110"
                        style={{ color: selectedTask.is_starred ? '#facc15' : 'rgba(255,255,255,0.2)' }}
                      >{selectedTask.is_starred ? '★' : '☆'}</button>
                      <button onClick={() => setShowTasks(false)}
                        className="text-white/25 hover:text-white/60 transition-colors text-lg leading-none w-5 h-5 flex items-center justify-center"
                      >×</button>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ scrollbarWidth: 'none' }}>
                    {/* Title + toggle */}
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => doToggle(selectedTask.id)}
                        className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all"
                        style={selectedTask.is_completed
                          ? { background: LABEL_COLORS[selectedTask.label ?? ''] ?? ACCENT, borderColor: LABEL_COLORS[selectedTask.label ?? ''] ?? ACCENT }
                          : { borderColor: 'rgba(255,255,255,0.3)', background: 'transparent' }
                        }
                      >
                        {selectedTask.is_completed && <span className="text-white text-[9px]">✓</span>}
                      </button>
                      <h3
                        className="text-[15px] font-semibold leading-snug flex-1"
                        style={selectedTask.is_completed
                          ? { textDecoration: 'line-through', color: 'rgba(255,255,255,0.35)' }
                          : { color: 'rgba(255,255,255,0.92)' }
                        }
                      >{selectedTask.title}</h3>
                    </div>

                    {/* Meta badges */}
                    {(selectedTask.label || selectedTask.due_date || selectedTask.reminder_at) && (
                      <div className="flex flex-wrap gap-2">
                        {selectedTask.label && (() => {
                          const c = LABEL_COLORS[selectedTask.label] ?? ACCENT
                          return (
                            <span className="text-[10px] font-bold px-2 py-1 rounded-lg"
                              style={{ background: `${c}22`, color: c }}>
                              {selectedTask.label}
                            </span>
                          )
                        })()}
                        {selectedTask.due_date && (
                          <span className="text-[10px] px-2 py-1 rounded-lg text-white/45"
                            style={{ background: 'rgba(255,255,255,0.05)' }}>
                            📅 {selectedTask.due_date}{selectedTask.due_time ? ` · ${selectedTask.due_time.slice(0, 5)}` : ''}
                          </span>
                        )}
                        {selectedTask.reminder_at && (
                          <span className="text-[10px] px-2 py-1 rounded-lg text-white/45"
                            style={{ background: 'rgba(255,255,255,0.05)' }}>
                            🔔 {selectedTask.reminder_at.slice(11, 16)}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Notes — editable, auto-save */}
                    <div>
                      <p className="text-[10px] font-semibold text-white/28 uppercase tracking-wider mb-1.5">Notas</p>
                      <textarea
                        value={editNotes}
                        onChange={e => handleNotesChange(e.target.value)}
                        placeholder="Agregar nota..."
                        rows={3}
                        className="w-full rounded-xl px-3 py-2.5 text-[12px] leading-relaxed resize-none outline-none transition-colors"
                        style={{
                          background: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          color: 'rgba(255,255,255,0.7)',
                          userSelect: 'text',
                        }}
                        onFocus={e => (e.target.style.borderColor = 'rgba(107,70,229,0.5)')}
                        onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
                      />
                    </div>

                    {/* Subtasks */}
                    <div>
                      {selectedTask.subtasks?.length > 0 && (
                        <>
                          <p className="text-[10px] font-semibold text-white/28 uppercase tracking-wider mb-2">
                            Subtareas · {selectedTask.subtasks.filter(s => s.is_completed).length}/{selectedTask.subtasks.length}
                          </p>
                          <div className="space-y-1 mb-2">
                            {selectedTask.subtasks.map(sub => {
                              const c = LABEL_COLORS[selectedTask.label ?? ''] ?? ACCENT
                              return (
                                <button
                                  key={sub.id}
                                  onClick={() => doToggleSubtask(selectedTask.id, sub.id, !sub.is_completed)}
                                  className="flex items-center gap-2.5 w-full text-left px-2 py-2 rounded-lg transition-all hover:bg-white/[0.04] active:scale-[0.98]"
                                >
                                  <div
                                    className="w-4 h-4 rounded-full border flex-shrink-0 flex items-center justify-center transition-all"
                                    style={sub.is_completed
                                      ? { background: c, borderColor: c }
                                      : { borderColor: 'rgba(255,255,255,0.22)', background: 'transparent' }
                                    }
                                  >
                                    {sub.is_completed && <span className="text-[7px] text-white">✓</span>}
                                  </div>
                                  <span className="text-[12px] leading-snug"
                                    style={sub.is_completed
                                      ? { textDecoration: 'line-through', color: 'rgba(255,255,255,0.28)' }
                                      : { color: 'rgba(255,255,255,0.72)' }
                                    }>{sub.title}</span>
                                </button>
                              )
                            })}
                          </div>
                        </>
                      )}
                      {/* Add subtask input */}
                      <input
                        value={newSubtaskTitle}
                        onChange={e => setNewSubtaskTitle(e.target.value)}
                        onKeyDown={doAddSubtask}
                        placeholder="+ Agregar subtarea..."
                        className="w-full bg-transparent text-[12px] outline-none border-b pb-1 transition-colors"
                        style={{
                          color: 'rgba(255,255,255,0.55)',
                          borderColor: 'rgba(255,255,255,0.1)',
                          userSelect: 'text',
                        }}
                        onFocus={e => (e.target.style.borderColor = 'rgba(107,70,229,0.5)')}
                        onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
                      />
                    </div>
                  </div>
                </>
              ) : (
                /* ── List view ── */
                <>
                  {/* Header */}
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
                        {pendingTasks.map(t => <TaskCard key={t.id} task={t} onToggle={doToggle} onClick={openDetail} />)}
                      </>
                    )}
                    {completedTasks.length > 0 && (
                      <>
                        <p className="text-[10px] font-bold text-white/18 uppercase tracking-widest px-3 pt-3 pb-1">Completadas</p>
                        {completedTasks.map(t => <TaskCard key={t.id} task={t} onToggle={doToggle} onClick={openDetail} />)}
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
                      <FocusSelect
                        value={newLabel}
                        onChange={setNewLabel}
                        options={Object.keys(LABEL_COLORS)}
                      />
                      <button onClick={addTask}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold leading-none hover:opacity-85 transition-all flex-shrink-0 active:scale-95"
                        style={{ background: ACCENT, fontSize: '20px' }}>
                        <span style={{ display: 'inline-block', transform: 'translateY(-1.5px)' }}>+</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Lofi Boy YouTube player — floating bottom-left ─────────────────── */}
      {!zen && showMusic && (
        <div className="fixed z-30 rounded-2xl overflow-hidden"
          style={{
            left: '16px',
            bottom: showSounds ? '88px' : '16px',
            width: '280px',
            transition: 'bottom .3s',
            boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          {/* Header bar */}
          <div className="flex items-center justify-between px-3 py-2 flex-shrink-0"
            style={{ background: 'rgba(7,5,18,0.92)', backdropFilter: 'blur(16px)' }}>
            <span className="text-[11px] text-white/60 font-medium">🎵 Lofi Boy</span>
            <button onClick={() => setShowMusic(false)}
              className="text-white/30 hover:text-white/70 transition-colors text-base leading-none">×</button>
          </div>
          <iframe
            src="https://www.youtube.com/embed/4xDzrJKXOOY?autoplay=1&controls=1&modestbranding=1&rel=0"
            allow="autoplay; encrypted-media"
            allowFullScreen
            style={{ display: 'block', width: '280px', height: '158px', border: 'none' }}
          />
        </div>
      )}

      {/* ── Sound mixer — full width, one row, no scroll ───────────────────── */}
      {!zen && (
        <div className="fixed bottom-0 left-0 right-0 z-40 px-3 pb-3 transition-all duration-300"
          style={{ transform: showSounds ? 'translateY(0)' : 'translateY(120%)' }}
        >
          <div className="rounded-2xl px-4 py-3 w-full"
            style={{ background: 'rgba(8,6,20,0.88)', border: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(24px)' }}
          >
            {/* Desktop: single row */}
            <div className="hidden lg:flex items-center" style={{ gap: '0' }}>
              {SOUND_LIST.map((s, i) => (
                <div key={s.key} className="flex flex-col items-center gap-1"
                  style={{ flex: 1, minWidth: 0, padding: '0 6px', borderRight: i < SOUND_LIST.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                  <div className="flex items-center gap-1.5 w-full justify-center">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 transition-all duration-200"
                      style={{ background: volumes[s.key] > 0 ? ACCENT : 'rgba(255,255,255,0.2)', boxShadow: volumes[s.key] > 0 ? `0 0 5px ${ACCENT}` : 'none' }} />
                    <span className="text-[9.5px] text-white/50 whitespace-nowrap overflow-hidden text-ellipsis">{s.label}</span>
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
            {/* Mobile: 3-col grid */}
            <div className="grid grid-cols-3 gap-x-4 gap-y-3 lg:hidden">
              {SOUND_LIST.map(s => (
                <div key={s.key} className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 transition-all duration-200"
                      style={{ background: volumes[s.key] > 0 ? ACCENT : 'rgba(255,255,255,0.2)', boxShadow: volumes[s.key] > 0 ? `0 0 5px ${ACCENT}` : 'none' }} />
                    <span className="text-[10px] text-white/55 truncate">{s.label}</span>
                  </div>
                  <input type="range" min="0" max="1" step="0.01"
                    value={volumes[s.key]}
                    onChange={e => setVolume(s.key, parseFloat(e.target.value))}
                    className="w-full cursor-pointer"
                    style={{ accentColor: ACCENT, height: '4px' }}
                  />
                </div>
              ))}
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

    </div>
  )
}
