import React from 'react';
import { Img, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { noise2D } from '@remotion/noise';
import { useStudio } from '../context';
import { rand } from '../lib/anim';
import type { AvatarConfig, Word } from '../types';

/**
 * The explainer host: a small cartoon that talks with your cloned voice.
 * Lip-sync = loudness envelope from `vs build` (how open) + the letter being spoken in the
 * current word (shape: round for o/u/w, wide for e/i, closed on m/b/p). Blinks, breathes,
 * bobs with speech and glances toward the content.
 *
 * Bring your own drawing with `avatar.images` (closed / half / open / blink PNGs under
 * studio/public); otherwise the SVG character below is drawn from `avatar` colours.
 */

const DEFAULT: Required<Omit<AvatarConfig, 'images' | 'name' | 'style'>> = {
  skin: '#C68A5E',
  hair: '#1E1A1A',
  hairStyle: 'messy',
  shirt: '#8B6CFF',
  glasses: true,
  beard: false,
};

type Mouth = { open: number; round: number; wide: number };

const visemeAt = (words: Word[], t: number, level: number): Mouth => {
  const w = words.find((x) => t >= x.start && t < x.end);
  if (!w) return { open: level, round: 0.2, wide: 1 };
  const letters = w.text.toLowerCase().replace(/[^a-z]/g, '');
  if (!letters) return { open: level, round: 0.2, wide: 1 };
  const p = (t - w.start) / Math.max(0.01, w.end - w.start);
  const ch = letters[Math.min(letters.length - 1, Math.floor(p * letters.length))];
  if ('mbp'.includes(ch)) return { open: level * 0.15, round: 0.1, wide: 0.95 };
  if ('ouw'.includes(ch)) return { open: level * 0.85, round: 0.9, wide: 0.75 };
  if ('eiy'.includes(ch)) return { open: level * 0.7, round: 0, wide: 1.18 };
  if ('fv'.includes(ch)) return { open: level * 0.3, round: 0, wide: 1.05 };
  if (ch === 'a') return { open: level, round: 0.35, wide: 1.05 };
  return { open: level * 0.8, round: 0.25, wide: 1 };
};

export const Avatar: React.FC<{ size: number; x: number; y: number; look?: { x: number; y: number }; flip?: boolean }> = ({ size, x, y, look = { x: -0.4, y: -0.2 }, flip }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { timeline } = useStudio();
  const cfg = { ...DEFAULT, ...(timeline.avatar ?? {}) };
  const t = frame / fps;
  const level = (timeline.mouth[frame] ?? 0) / 100;
  const m = visemeAt(timeline.words, t, level);

  // Blink: every 2.6-4.6 s, 5 frames, sometimes a double blink.
  const blinkPeriod = Math.round(fps * 3.4);
  const cycle = Math.floor(frame / blinkPeriod);
  const blinkAt = cycle * blinkPeriod + Math.floor(rand(cycle) * fps * 1.2);
  const bf = frame - blinkAt;
  const blink = bf >= 0 && bf < 5 ? Math.sin((bf / 5) * Math.PI) : rand(cycle + 99) > 0.7 && bf >= 8 && bf < 13 ? Math.sin(((bf - 8) / 5) * Math.PI) : 0;

  const talk = level;
  const tilt = noise2D('tilt', t * 0.35, 0) * 4 + noise2D('talk', t * 2.2, 1) * 2.2 * talk;
  const bob = Math.sin(t * Math.PI * 2 * 0.22) * 3 - talk * 5;
  const breathe = 1 + Math.sin(t * Math.PI * 2 * 0.25) * 0.012;
  const lookX = look.x * 7 + noise2D('lx', t * 0.3, 2) * 2.5;
  const lookY = look.y * 5 + noise2D('ly', t * 0.3, 3) * 1.5;
  const brow = Math.max(0, talk - 0.55) * 14 + noise2D('brow', t * 0.5, 4) * 1.5;

  if (cfg.images) {
    const img = blink > 0.5 && cfg.images.blink ? cfg.images.blink : m.open > 0.55 ? cfg.images.open : m.open > 0.2 ? cfg.images.half ?? cfg.images.open : cfg.images.closed;
    return (
      <div style={{ position: 'absolute', left: x, top: y, width: size, height: size, transform: `translateY(${bob}px) rotate(${tilt}deg) ${flip ? 'scaleX(-1)' : ''}`, transformOrigin: '50% 90%' }}>
        <Img src={staticFile(img)} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </div>
    );
  }

  const stroke = '#17151A';
  const sw = 5;
  // Mouth geometry
  const mx = 200;
  const my = 262;
  const W = 54 * m.wide * (1 - 0.32 * m.round);
  const H = 4 + 40 * m.open * (0.75 + 0.35 * m.round);
  const mouthOpen = m.open > 0.06;
  const eyeH = 26 * (1 - blink * 0.92);

  return (
    <svg
      viewBox="0 0 400 460"
      width={size}
      height={size * 1.15}
      style={{ position: 'absolute', left: x, top: y, overflow: 'visible', transform: flip ? 'scaleX(-1)' : undefined }}
    >
      <defs>
        <clipPath id="mouthClip">
          <path d={`M ${mx - W / 2} ${my} Q ${mx} ${my - H * 0.3} ${mx + W / 2} ${my} Q ${mx} ${my + H} ${mx - W / 2} ${my} Z`} />
        </clipPath>
        <radialGradient id="cheek" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FF7A8A" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#FF7A8A" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Body */}
      <g transform={`translate(200 460) scale(${breathe}) translate(-200 -460)`}>
        <path d="M 40 470 C 40 380 110 340 200 340 C 290 340 360 380 360 470 Z" fill={cfg.shirt} stroke={stroke} strokeWidth={sw} />
        <path d="M 150 345 Q 200 395 250 345" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
        <path d="M 170 352 L 166 410 M 230 352 L 234 410" stroke={stroke} strokeWidth={4} strokeLinecap="round" opacity={0.6} />
        <rect x="172" y="300" width="56" height="55" rx="20" fill={cfg.skin} stroke={stroke} strokeWidth={sw} />
      </g>

      {/* Head */}
      <g transform={`translate(0 ${bob}) rotate(${tilt} 200 330)`}>
        <ellipse cx="78" cy="205" rx="22" ry="30" fill={cfg.skin} stroke={stroke} strokeWidth={sw} />
        <ellipse cx="322" cy="205" rx="22" ry="30" fill={cfg.skin} stroke={stroke} strokeWidth={sw} />
        <path d="M 82 190 C 82 95 140 60 200 60 C 260 60 318 95 318 190 C 318 270 270 318 200 318 C 130 318 82 270 82 190 Z" fill={cfg.skin} stroke={stroke} strokeWidth={sw} />
        {cfg.beard && (
          <path d="M 90 220 C 100 300 150 322 200 322 C 250 322 300 300 310 220 C 290 270 260 290 200 292 C 140 290 110 270 90 220 Z" fill={cfg.hair} stroke={stroke} strokeWidth={4} />
        )}
        <Hair style={cfg.hairStyle} color={cfg.hair} stroke={stroke} />

        <ellipse cx="128" cy="238" rx="26" ry="16" fill="url(#cheek)" />
        <ellipse cx="272" cy="238" rx="26" ry="16" fill="url(#cheek)" />

        {/* Brows */}
        <path d={`M 128 ${152 - brow} Q 150 ${142 - brow} 172 ${150 - brow}`} fill="none" stroke={stroke} strokeWidth={7} strokeLinecap="round" />
        <path d={`M 228 ${150 - brow} Q 250 ${142 - brow} 272 ${152 - brow}`} fill="none" stroke={stroke} strokeWidth={7} strokeLinecap="round" />

        {/* Eyes */}
        {[150, 250].map((ex) => (
          <g key={ex}>
            <ellipse cx={ex} cy={192} rx={19} ry={Math.max(1.5, eyeH)} fill="#fff" stroke={stroke} strokeWidth={4} />
            {blink < 0.6 && (
              <>
                <circle cx={ex + lookX} cy={194 + lookY} r={10} fill={stroke} />
                <circle cx={ex + lookX + 3.5} cy={190 + lookY} r={3.2} fill="#fff" />
              </>
            )}
          </g>
        ))}
        {cfg.glasses && (
          <g fill="none" stroke={stroke} strokeWidth={5}>
            <rect x="114" y="160" width="72" height="62" rx="22" />
            <rect x="214" y="160" width="72" height="62" rx="22" />
            <path d="M 186 188 Q 200 180 214 188" />
            <path d="M 114 182 L 90 176 M 286 182 L 310 176" />
          </g>
        )}

        {/* Nose */}
        <path d="M 200 206 Q 190 232 202 236" fill="none" stroke={stroke} strokeWidth={4.5} strokeLinecap="round" opacity={0.75} />

        {/* Mouth */}
        {mouthOpen ? (
          <g>
            <path d={`M ${mx - W / 2} ${my} Q ${mx} ${my - H * 0.3} ${mx + W / 2} ${my} Q ${mx} ${my + H} ${mx - W / 2} ${my} Z`} fill="#4A1C24" />
            <g clipPath="url(#mouthClip)">
              <rect x={mx - W} y={my - H} width={W * 2} height={H * 0.55 + 2} fill="#fff" />
              <ellipse cx={mx} cy={my + H * 0.85} rx={W * 0.36} ry={H * 0.4} fill="#E76A7A" />
            </g>
            <path d={`M ${mx - W / 2} ${my} Q ${mx} ${my - H * 0.3} ${mx + W / 2} ${my} Q ${mx} ${my + H} ${mx - W / 2} ${my} Z`} fill="none" stroke={stroke} strokeWidth={4.5} strokeLinejoin="round" />
          </g>
        ) : (
          <path d={`M ${mx - 26} ${my - 2} Q ${mx} ${my + 14} ${mx + 26} ${my - 2}`} fill="none" stroke={stroke} strokeWidth={5} strokeLinecap="round" />
        )}
      </g>
    </svg>
  );
};

const Hair: React.FC<{ style: string; color: string; stroke: string }> = ({ style, color, stroke }) => {
  const common = { fill: color, stroke, strokeWidth: 5, strokeLinejoin: 'round' as const };
  switch (style) {
    case 'bald':
      return null;
    case 'short':
      return <path d="M 84 170 C 80 90 140 52 200 52 C 262 52 322 90 316 170 C 300 130 270 112 200 112 C 132 112 100 130 84 170 Z" {...common} />;
    case 'curly':
      return (
        <g {...common}>
          {[
            [100, 150, 34], [130, 105, 36], [175, 82, 38], [225, 82, 38], [270, 105, 36], [300, 150, 34], [200, 112, 30], [150, 130, 26], [250, 130, 26],
          ].map(([cx, cy, r], i) => (
            <circle key={i} cx={cx} cy={cy} r={r} />
          ))}
        </g>
      );
    case 'long':
      return (
        <path d="M 70 300 C 50 200 70 60 200 50 C 330 60 350 200 330 300 C 318 240 312 170 300 140 C 260 125 160 118 100 140 C 88 170 82 240 70 300 Z" {...common} />
      );
    default:
      // messy: swept spikes
      return (
        <path
          d="M 82 178 C 70 120 96 70 140 58 C 150 36 182 30 205 42 C 228 26 268 34 280 58 C 318 70 336 118 318 176 C 312 150 300 136 282 128 C 286 142 280 150 270 152 C 262 132 246 120 226 116 C 230 130 222 138 210 138 C 200 120 176 112 152 116 C 158 128 150 136 140 134 C 118 138 96 152 82 178 Z"
          {...common}
        />
      );
  }
};
