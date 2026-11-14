import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { saveGameScore, subscribeUserScores } from '../lib/firebase';
import type { GameScore } from '../types/studio';

type GamePhase = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

interface Enemy {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hp: number;
  maxHp: number;
  kind: 'interceptor' | 'asteroid';
  hitFlash: number;
  rot: number;
  rotSpeed: number;
}

interface CorePickup {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  pulse: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  active: boolean;
}

interface Star {
  x: number;
  y: number;
  size: number;
  speed: number;
  alpha: number;
}

class SynthSfx {
  private ctx: AudioContext | null = null;
  public muted = false;

  private ensureCtx(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (AC) {
        this.ctx = new AC();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  playShot() {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.exponentialRampToValueAtTime(210, now + 0.08);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  playImpact() {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.14);
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  playPickup() {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(980, now + 0.12);
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  playHullHit() {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(135, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.24);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.26);
  }
}

export function ArcadeGameWorkspace() {
  const { user } = useAuth();
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sfxRef = useRef(new SynthSfx());

  const [phase, setPhase] = useState<GamePhase>('TITLE_MENU');
  const phaseRef = useRef<GamePhase>('TITLE_MENU');
  const [muted, setMuted] = useState(false);

  // Perimeter HUD synced values
  const [hud, setHud] = useState({
    score: 0,
    wave: 1,
    hull: 100,
    multiplier: 1,
  });
  const [bestScore, setBestScore] = useState<number>(0);
  const [scoreSaved, setScoreSaved] = useState(false);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    if (!user) {
      setBestScore(0);
      return;
    }
    return subscribeUserScores(
      user.uid,
      (items: GameScore[]) => {
        setBestScore(items[0]?.score ?? 0);
      },
      () => undefined
    );
  }, [user]);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      sfxRef.current.muted = next;
      return next;
    });
  }, []);

  // Mutable simulation state isolated inside ref
  const simRef = useRef({
    width: 960,
    height: 600,
    player: {
      x: 480,
      y: 300,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2,
      radius: 15,
      hull: 100,
      invuln: 0,
      dashCooldown: 0,
      fireCooldown: 0,
    },
    pointer: { active: false, x: 480, y: 180, down: false },
    bullets: [] as Bullet[],
    enemies: [] as Enemy[],
    pickups: [] as CorePickup[],
    particles: Array.from({ length: 140 }, () => ({
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 1,
      color: '#38bdf8',
      size: 2,
      active: false,
    })) as Particle[],
    stars: [] as Star[],
    score: 0,
    wave: 1,
    multiplier: 1,
    comboTimer: 0,
    waveTimer: 0,
    spawnTimer: 0.8,
    shake: 0,
    hitstop: 0,
    held: new Set<string>(),
    justPressed: new Set<string>(),
    lastHudSync: 0,
  });

  const resetMatch = useCallback(() => {
    const sim = simRef.current;
    sim.player = {
      x: sim.width * 0.5,
      y: sim.height * 0.55,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2,
      radius: 15,
      hull: 100,
      invuln: 1.0,
      dashCooldown: 0,
      fireCooldown: 0,
    };
    sim.bullets = [];
    sim.enemies = [];
    sim.pickups = [];
    sim.particles.forEach((p) => {
      p.active = false;
    });
    sim.score = 0;
    sim.wave = 1;
    sim.multiplier = 1;
    sim.comboTimer = 0;
    sim.waveTimer = 0;
    sim.spawnTimer = 0.6;
    sim.shake = 0;
    sim.hitstop = 0;
    setScoreSaved(false);
    setHud({ score: 0, wave: 1, hull: 100, multiplier: 1 });
    phaseRef.current = 'PLAYING';
    setPhase('PLAYING');
  }, []);

  // Main game loop + ResizeObserver + Input Listeners
  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const sim = simRef.current;

    const initStars = (w: number, h: number) => {
      sim.stars = Array.from({ length: 90 }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        size: 1 + Math.random() * 1.8,
        speed: 14 + Math.random() * 44,
        alpha: 0.25 + Math.random() * 0.65,
      }));
    };

    const syncSize = () => {
      const rect = stage.getBoundingClientRect();
      const w = Math.max(360, Math.floor(rect.width));
      const h = Math.max(460, Math.floor(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sim.width = w;
      sim.height = h;
      if (sim.stars.length === 0) initStars(w, h);
    };

    syncSize();
    const ro = new ResizeObserver(syncSize);
    ro.observe(stage);

    const spawnParticles = (
      x: number,
      y: number,
      color: string,
      count: number,
      speed = 160
    ) => {
      let spawned = 0;
      for (let i = 0; i < sim.particles.length && spawned < count; i++) {
        const p = sim.particles[i];
        if (!p.active) {
          const ang = Math.random() * Math.PI * 2;
          const spd = (0.3 + Math.random() * 0.85) * speed;
          p.x = x;
          p.y = y;
          p.vx = Math.cos(ang) * spd;
          p.vy = Math.sin(ang) * spd;
          p.maxLife = 0.28 + Math.random() * 0.36;
          p.life = p.maxLife;
          p.color = color;
          p.size = 1.8 + Math.random() * 2.5;
          p.active = true;
          spawned++;
        }
      }
    };

    const spawnEnemy = () => {
      const edge = Math.floor(Math.random() * 4);
      let x = 0;
      let y = 0;
      if (edge === 0) {
        x = Math.random() * sim.width;
        y = -32;
      } else if (edge === 1) {
        x = sim.width + 32;
        y = Math.random() * sim.height;
      } else if (edge === 2) {
        x = Math.random() * sim.width;
        y = sim.height + 32;
      } else {
        x = -32;
        y = Math.random() * sim.height;
      }

      const isAsteroid = Math.random() < 0.42;
      const dx = sim.player.x - x;
      const dy = sim.player.y - y;
      const dist = Math.hypot(dx, dy) || 1;
      const speed = isAsteroid
        ? 58 + sim.wave * 8 + Math.random() * 35
        : 92 + sim.wave * 11;

      sim.enemies.push({
        x,
        y,
        vx: (dx / dist) * speed,
        vy: (dy / dist) * speed,
        radius: isAsteroid ? 20 + Math.random() * 8 : 14,
        hp: isAsteroid ? 2 + Math.floor(sim.wave / 3) : 1 + Math.floor(sim.wave / 4),
        maxHp: isAsteroid ? 2 + Math.floor(sim.wave / 3) : 1 + Math.floor(sim.wave / 4),
        kind: isAsteroid ? 'asteroid' : 'interceptor',
        hitFlash: 0,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 3,
      });
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const code = e.code;
      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)
      ) {
        e.preventDefault();
      }
      if (!sim.held.has(code)) {
        sim.justPressed.add(code);
      }
      sim.held.add(code);

      if (code === 'KeyM') {
        toggleMute();
      }
      if (code === 'KeyP' || code === 'Escape') {
        if (phaseRef.current === 'PLAYING') {
          phaseRef.current = 'PAUSED';
          setPhase('PAUSED');
        } else if (phaseRef.current === 'PAUSED') {
          phaseRef.current = 'PLAYING';
          setPhase('PLAYING');
        }
      }
      if (
        (code === 'Enter' || code === 'Space') &&
        (phaseRef.current === 'TITLE_MENU' || phaseRef.current === 'GAME_OVER')
      ) {
        resetMatch();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      sim.held.delete(e.code);
    };

    const handleBlur = () => {
      sim.held.clear();
      sim.justPressed.clear();
      sim.pointer.down = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    let rafId = 0;
    let prev = performance.now();

    const frame = (now: number) => {
      const rawDt = (now - prev) / 1000;
      prev = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

      // Update ambient parallax stars in every phase
      for (const s of sim.stars) {
        s.y += s.speed * dt;
        if (s.y > sim.height) {
          s.y = -4;
          s.x = Math.random() * sim.width;
        }
      }

      if (phaseRef.current === 'PLAYING') {
        if (sim.hitstop > 0) {
          sim.hitstop = Math.max(0, sim.hitstop - dt);
        } else {
          const p = sim.player;
          if (p.invuln > 0) p.invuln = Math.max(0, p.invuln - dt);
          if (p.dashCooldown > 0) p.dashCooldown = Math.max(0, p.dashCooldown - dt);
          if (p.fireCooldown > 0) p.fireCooldown = Math.max(0, p.fireCooldown - dt);
          if (sim.shake > 0) sim.shake = Math.max(0, sim.shake - dt * 28);

          // Movement input
          let ix = 0;
          let iy = 0;
          if (sim.held.has('KeyA') || sim.held.has('ArrowLeft')) ix -= 1;
          if (sim.held.has('KeyD') || sim.held.has('ArrowRight')) ix += 1;
          if (sim.held.has('KeyW') || sim.held.has('ArrowUp')) iy -= 1;
          if (sim.held.has('KeyS') || sim.held.has('ArrowDown')) iy += 1;

          if (ix !== 0 || iy !== 0) {
            const len = Math.hypot(ix, iy);
            ix /= len;
            iy /= len;
          }

          // Dash burst
          if (
            (sim.justPressed.has('ShiftLeft') || sim.justPressed.has('ShiftRight')) &&
            p.dashCooldown <= 0
          ) {
            const dashDirX = ix !== 0 || iy !== 0 ? ix : Math.cos(p.angle);
            const dashDirY = ix !== 0 || iy !== 0 ? iy : Math.sin(p.angle);
            p.vx += dashDirX * 520;
            p.vy += dashDirY * 520;
            p.invuln = Math.max(p.invuln, 0.25);
            p.dashCooldown = 1.1;
            spawnParticles(p.x, p.y, '#38bdf8', 12, 180);
          }

          const accel = 980;
          p.vx += ix * accel * dt;
          p.vy += iy * accel * dt;
          const drag = Math.exp(-4.6 * dt);
          p.vx *= drag;
          p.vy *= drag;
          p.x = Math.max(24, Math.min(sim.width - 24, p.x + p.vx * dt));
          p.y = Math.max(24, Math.min(sim.height - 24, p.y + p.vy * dt));

          if (sim.pointer.active) {
            p.angle = Math.atan2(sim.pointer.y - p.y, sim.pointer.x - p.x);
          } else if (Math.hypot(p.vx, p.vy) > 18) {
            p.angle = Math.atan2(p.vy, p.vx);
          }

          // Firing
          const wantsFire = sim.held.has('Space') || sim.pointer.down;
          if (wantsFire && p.fireCooldown <= 0) {
            const bSpd = 660;
            sim.bullets.push({
              x: p.x + Math.cos(p.angle) * 18,
              y: p.y + Math.sin(p.angle) * 18,
              vx: Math.cos(p.angle) * bSpd + p.vx * 0.2,
              vy: Math.sin(p.angle) * bSpd + p.vy * 0.2,
              life: 1.4,
            });
            p.fireCooldown = 0.14;
            sfxRef.current.playShot();
          }

          // Wave & Spawning
          sim.waveTimer += dt;
          if (sim.waveTimer >= 16) {
            sim.waveTimer = 0;
            sim.wave += 1;
            sim.hitstop = 0.04;
            spawnParticles(p.x, p.y, '#f59e0b', 20, 220);
          }
          sim.spawnTimer -= dt;
          if (sim.spawnTimer <= 0) {
            spawnEnemy();
            sim.spawnTimer = Math.max(0.28, 1.05 - sim.wave * 0.08);
          }

          // Combo decay
          if (sim.comboTimer > 0) {
            sim.comboTimer -= dt;
            if (sim.comboTimer <= 0) sim.multiplier = 1;
          }

          // Update Bullets
          for (let i = sim.bullets.length - 1; i >= 0; i--) {
            const b = sim.bullets[i];
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            b.life -= dt;
            if (
              b.life <= 0 ||
              b.x < -20 ||
              b.x > sim.width + 20 ||
              b.y < -20 ||
              b.y > sim.height + 20
            ) {
              sim.bullets.splice(i, 1);
            }
          }

          // Update Enemies + Collisions
          for (let i = sim.enemies.length - 1; i >= 0; i--) {
            const en = sim.enemies[i];
            if (en.kind === 'interceptor') {
              const dx = p.x - en.x;
              const dy = p.y - en.y;
              const dist = Math.hypot(dx, dy) || 1;
              const spd = 95 + sim.wave * 10;
              en.vx = en.vx * 0.94 + (dx / dist) * spd * 0.06;
              en.vy = en.vy * 0.94 + (dy / dist) * spd * 0.06;
              en.rot = Math.atan2(en.vy, en.vx);
            } else {
              en.rot += en.rotSpeed * dt;
            }
            en.x += en.vx * dt;
            en.y += en.vy * dt;
            if (en.hitFlash > 0) en.hitFlash = Math.max(0, en.hitFlash - dt);

            // Bullet hit check
            let destroyed = false;
            for (let j = sim.bullets.length - 1; j >= 0; j--) {
              const b = sim.bullets[j];
              const d = Math.hypot(b.x - en.x, b.y - en.y);
              if (d <= en.radius + 4) {
                sim.bullets.splice(j, 1);
                en.hp -= 1;
                en.hitFlash = 0.08;
                spawnParticles(b.x, b.y, '#7dd3fc', 5, 110);
                if (en.hp <= 0) {
                  destroyed = true;
                  sim.score += (en.kind === 'asteroid' ? 120 : 160) * sim.multiplier;
                  sim.shake = Math.min(8, sim.shake + 2.5);
                  spawnParticles(
                    en.x,
                    en.y,
                    en.kind === 'asteroid' ? '#f59e0b' : '#38bdf8',
                    14,
                    190
                  );
                  sfxRef.current.playImpact();
                  if (Math.random() < 0.55) {
                    sim.pickups.push({
                      x: en.x,
                      y: en.y,
                      vx: (Math.random() - 0.5) * 30,
                      vy: (Math.random() - 0.5) * 30,
                      life: 7.5,
                      pulse: 0,
                    });
                  }
                  break;
                }
              }
            }

            if (destroyed) {
              sim.enemies.splice(i, 1);
              continue;
            }

            // Player collision
            const playerDist = Math.hypot(en.x - p.x, en.y - p.y);
            if (playerDist < en.radius + p.radius) {
              if (p.invuln <= 0) {
                p.hull = Math.max(0, p.hull - 25);
                p.invuln = 0.85;
                sim.multiplier = 1;
                sim.shake = 10;
                sim.hitstop = 0.045;
                spawnParticles(p.x, p.y, '#ef4444', 18, 220);
                sfxRef.current.playHullHit();
                if (p.hull <= 0) {
                  phaseRef.current = 'GAME_OVER';
                  setPhase('GAME_OVER');
                  setHud({
                    score: sim.score,
                    wave: sim.wave,
                    hull: 0,
                    multiplier: 1,
                  });
                  if (user && sim.score > 0) {
                    void saveGameScore({
                      ownerId: user.uid,
                      playerName:
                        user.displayName ||
                        user.email?.split('@')[0] ||
                        'Pilot',
                      score: sim.score,
                      wave: sim.wave,
                    }).then(() => setScoreSaved(true));
                  }
                }
              }
              sim.enemies.splice(i, 1);
              continue;
            }

            // Out-of-bounds cleanup
            if (
              en.x < -120 ||
              en.x > sim.width + 120 ||
              en.y < -120 ||
              en.y > sim.height + 120
            ) {
              sim.enemies.splice(i, 1);
            }
          }

          // Update Pickups
          for (let i = sim.pickups.length - 1; i >= 0; i--) {
            const pk = sim.pickups[i];
            pk.pulse += dt * 5;
            pk.life -= dt;
            const dx = p.x - pk.x;
            const dy = p.y - pk.y;
            const dist = Math.hypot(dx, dy) || 1;
            if (dist < 130) {
              pk.x += (dx / dist) * 240 * dt;
              pk.y += (dy / dist) * 240 * dt;
            } else {
              pk.x += pk.vx * dt;
              pk.y += pk.vy * dt;
            }
            if (dist < p.radius + 14) {
              sim.multiplier = Math.min(8, sim.multiplier + 1);
              sim.comboTimer = 5.0;
              sim.score += 50 * sim.multiplier;
              spawnParticles(pk.x, pk.y, '#34d399', 8, 130);
              sfxRef.current.playPickup();
              sim.pickups.splice(i, 1);
              continue;
            }
            if (pk.life <= 0) sim.pickups.splice(i, 1);
          }

          // Update Pooled Particles
          for (const pt of sim.particles) {
            if (!pt.active) continue;
            pt.x += pt.vx * dt;
            pt.y += pt.vy * dt;
            pt.vx *= 0.96;
            pt.vy *= 0.96;
            pt.life -= dt;
            if (pt.life <= 0) pt.active = false;
          }

          if (now - sim.lastHudSync > 80) {
            sim.lastHudSync = now;
            setHud({
              score: sim.score,
              wave: sim.wave,
              hull: p.hull,
              multiplier: sim.multiplier,
            });
          }
        }
      }

      sim.justPressed.clear();

      // Render Scene
      ctx.save();
      ctx.fillStyle = '#070b14';
      ctx.fillRect(0, 0, sim.width, sim.height);

      if (sim.shake > 0 && phaseRef.current === 'PLAYING') {
        ctx.translate(
          (Math.random() - 0.5) * sim.shake,
          (Math.random() - 0.5) * sim.shake
        );
      }

      // Subtle tactical grid
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.2)';
      ctx.lineWidth = 1;
      for (let gx = 0; gx < sim.width; gx += 64) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, sim.height);
        ctx.stroke();
      }
      for (let gy = 0; gy < sim.height; gy += 64) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(sim.width, gy);
        ctx.stroke();
      }

      // Stars
      for (const s of sim.stars) {
        ctx.fillStyle = `rgba(226, 232, 240, ${s.alpha})`;
        ctx.fillRect(s.x, s.y, s.size, s.size);
      }

      if (phaseRef.current !== 'TITLE_MENU') {
        // Pickups
        for (const pk of sim.pickups) {
          const r = 6 + Math.sin(pk.pulse) * 1.5;
          ctx.fillStyle = '#34d399';
          ctx.beginPath();
          ctx.arc(pk.x, pk.y, r, 0, Math.PI * 2);
          ctx.fill();
        }

        // Bullets
        ctx.fillStyle = '#38bdf8';
        for (const b of sim.bullets) {
          ctx.beginPath();
          ctx.arc(b.x, b.y, 3.2, 0, Math.PI * 2);
          ctx.fill();
        }

        // Enemies
        for (const en of sim.enemies) {
          ctx.save();
          ctx.translate(en.x, en.y);
          ctx.rotate(en.rot);
          ctx.fillStyle =
            en.hitFlash > 0
              ? '#ffffff'
              : en.kind === 'asteroid'
              ? '#64748b'
              : '#f43f5e';
          ctx.strokeStyle = en.kind === 'asteroid' ? '#cbd5e1' : '#fda4af';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          if (en.kind === 'asteroid') {
            for (let k = 0; k < 7; k++) {
              const a = (k / 7) * Math.PI * 2;
              const rad = en.radius * (k % 2 === 0 ? 1 : 0.78);
              if (k === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
              else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
            }
          } else {
            ctx.moveTo(en.radius, 0);
            ctx.lineTo(-en.radius * 0.8, en.radius * 0.75);
            ctx.lineTo(-en.radius * 0.35, 0);
            ctx.lineTo(-en.radius * 0.8, -en.radius * 0.75);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }

        // Particles
        for (const pt of sim.particles) {
          if (!pt.active) continue;
          ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
          ctx.fillStyle = pt.color;
          ctx.fillRect(pt.x - pt.size * 0.5, pt.y - pt.size * 0.5, pt.size, pt.size);
        }
        ctx.globalAlpha = 1;

        // Player Craft
        const p = sim.player;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        if (p.invuln > 0) {
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, p.radius + 7, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.fillStyle = '#f8fafc';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(18, 0);
        ctx.lineTo(-12, 12);
        ctx.lineTo(-6, 0);
        ctx.lineTo(-12, -12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      ctx.restore();
      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [resetMatch, toggleMute, user]);

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    simRef.current.pointer.active = true;
    simRef.current.pointer.x = e.clientX - rect.left;
    simRef.current.pointer.y = e.clientY - rect.top;
  };

  return (
    <div
      ref={stageRef}
      className="relative w-full min-h-[620px] h-[calc(100vh-140px)] rounded-xl overflow-hidden border border-slate-800 bg-slate-950 select-none"
    >
      <canvas
        ref={canvasRef}
        onPointerMove={handlePointerMove}
        onPointerDown={(e) => {
          handlePointerMove(e);
          simRef.current.pointer.down = true;
        }}
        onPointerUp={() => {
          simRef.current.pointer.down = false;
        }}
        onPointerLeave={() => {
          simRef.current.pointer.down = false;
        }}
        className="block w-full h-full cursor-crosshair touch-none"
      />

      {/* Perimeter HUD during active play */}
      {phase !== 'TITLE_MENU' && (
        <div className="absolute top-4 left-4 right-4 z-10 flex items-start justify-between pointer-events-none">
          <div className="flex items-center gap-6 bg-slate-950/85 border border-slate-800 rounded-lg px-4 py-2 text-slate-100">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400">
                Score
              </div>
              <div className="text-base font-mono font-semibold tabular-nums">
                {hud.score.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400">
                Wave
              </div>
              <div className="text-base font-mono font-semibold tabular-nums text-sky-400">
                {hud.wave}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400">
                Combo
              </div>
              <div className="text-base font-mono font-semibold tabular-nums text-emerald-400">
                x{hud.multiplier}
              </div>
            </div>
            <div className="w-28">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-slate-400 mb-1">
                <span>Hull</span>
                <span className="font-mono tabular-nums text-slate-200">{hud.hull}%</span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    hud.hull > 40 ? 'bg-sky-400' : 'bg-red-500'
                  }`}
                  style={{ width: `${hud.hull}%` }}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              type="button"
              onClick={toggleMute}
              title="Toggle sound (M)"
              className="p-2 bg-slate-950/85 hover:bg-slate-900 border border-slate-800 text-slate-200 rounded-lg"
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() =>
                setPhase((p) => (p === 'PLAYING' ? 'PAUSED' : 'PLAYING'))
              }
              title="Pause (P)"
              className="p-2 bg-slate-950/85 hover:bg-slate-900 border border-slate-800 text-slate-200 rounded-lg"
            >
              {phase === 'PAUSED' ? (
                <Play className="w-4 h-4" />
              ) : (
                <Pause className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* TITLE_MENU Overlay */}
      {phase === 'TITLE_MENU' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center px-6 text-center bg-slate-950/45">
          <svg
            viewBox="0 0 80 80"
            className="w-16 h-16 mb-4 text-sky-400"
            fill="none"
            aria-hidden="true"
          >
            <circle cx="40" cy="40" r="34" stroke="currentColor" strokeWidth="1.5" strokeDasharray="6 4" />
            <polygon
              points="40,14 58,54 40,45 22,54"
              fill="#f8fafc"
              stroke="currentColor"
              strokeWidth="2"
            />
          </svg>
          <h2 className="text-3xl font-bold tracking-tight text-white">
            ORBITAL RELAY
          </h2>
          <p className="text-sm text-slate-300 mt-2 max-w-md">
            Intercept incoming drone swarms, collect energy cores to stack multipliers, and defend the relay corridor.
          </p>

          {bestScore > 0 && (
            <div className="mt-3 text-xs font-mono tabular-nums text-sky-300">
              Personal Best: {bestScore.toLocaleString()}
            </div>
          )}

          <button
            type="button"
            onClick={resetMatch}
            className="mt-6 px-7 py-3 bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-sm rounded-lg transition-colors inline-flex items-center gap-2"
          >
            <Play className="w-4 h-4 fill-current" />
            Start Mission
          </button>

          <div className="mt-6 text-xs text-slate-400 font-mono">
            WASD / Arrows Move · Mouse / Space Fire · Shift Dash · P Pause · M Mute
          </div>
        </div>
      )}

      {/* PAUSED Overlay */}
      {phase === 'PAUSED' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/75 px-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-xs text-center space-y-4">
            <h3 className="text-lg font-semibold text-white">Mission Paused</h3>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setPhase('PLAYING')}
                className="w-full py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-sm rounded-lg"
              >
                Resume
              </button>
              <button
                type="button"
                onClick={resetMatch}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm rounded-lg"
              >
                Restart
              </button>
              <button
                type="button"
                onClick={() => setPhase('TITLE_MENU')}
                className="w-full py-2 text-slate-400 hover:text-slate-200 text-xs"
              >
                Return to Title
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GAME_OVER Overlay */}
      {phase === 'GAME_OVER' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/80 px-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-7 w-full max-w-sm text-center space-y-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-red-400 font-semibold">
                Hull Breached
              </div>
              <h3 className="text-2xl font-bold text-white mt-1 tabular-nums">
                {hud.score.toLocaleString()} pts
              </h3>
              <p className="text-xs text-slate-400 mt-1 tabular-nums">
                Reached Wave {hud.wave}
              </p>
            </div>

            {user ? (
              <div className="text-xs text-emerald-400">
                {scoreSaved
                  ? 'Score recorded in Cloud Library.'
                  : 'Saving score...'}
              </div>
            ) : (
              <div className="text-xs text-slate-400">
                Sign in with Google to persist high scores to your Library.
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={resetMatch}
                className="flex-1 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-sm rounded-lg inline-flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                Play Again
              </button>
              <button
                type="button"
                onClick={() => setPhase('TITLE_MENU')}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm rounded-lg"
              >
                Title
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
