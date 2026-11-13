import React from 'react';
import { Img, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { noise2D } from '@remotion/noise';
import { useStudio } from '../context';
import { RIG, type Mood } from './rig';

/**
 * The owner as the host, from real photos. Lip-sync trick ("jaw drop puppet"):
 *  1. the photo is drawn as is;
 *  2. a mouth cavity (dark, upper teeth, tongue) is drawn on the lip line, as tall as the voice is loud;
 *  3. a copy of the photo, clipped to lower lip + chin and feathered at the sides, slides down by
 *     the same amount, so the lower lip rides the cavity's bottom edge.
 * Openness comes from `vs build`'s loudness envelope, shaped by the letter being spoken
 * (closed on m/b/p, half on f/v), so plosives visibly close the mouth.
 */

const openFor = (t: number, level: number, words: { text: string; start: number; end: number }[]) => {
  const w = words.find((x) => t >= x.start && t < x.end);
  if (!w) return level * 0.6;
  const letters = w.text.toLowerCase().replace(/[^a-z]/g, '');
  if (!letters) return level;
  const p = (t - w.start) / Math.max(0.01, w.end - w.start);
  const ch = letters[Math.min(letters.length - 1, Math.floor(p * letters.length))];
  if ('mbp'.includes(ch)) return level * 0.1;
  if ('fv'.includes(ch)) return level * 0.35;
  if ('ao'.includes(ch)) return Math.min(1, level * 1.15);
  return level;
};

export const PhotoAvatar: React.FC<{ height: number; x: number; y: number; mood?: Mood; flip?: boolean }> = ({ height, x, y, mood = 'smile', flip }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { timeline } = useStudio();
  const r = RIG[mood] ?? RIG.smile;
  const t = frame / fps;
  // Average two frames: smoother jaw without losing syllable onsets.
  const lv = (((timeline.mouth[frame] ?? 0) + (timeline.mouth[frame - 1] ?? timeline.mouth[frame] ?? 0)) / 2) / 100;
  const open = Math.max(0, openFor(t, lv, timeline.words) - 0.06) / 0.94;
  const d = open * r.maxOpen;

  const [L, R, M] = [r.lipL, r.lipR, r.lipMid];
  // Quadratic control point so the curve passes through M at its midpoint.
  const C: [number, number] = [2 * M[0] - (L[0] + R[0]) / 2, 2 * M[1] - (L[1] + R[1]) / 2];
  const upper = `M ${L[0]} ${L[1]} Q ${C[0]} ${C[1]} ${R[0]} ${R[1]}`;
  const lowerBack = `Q ${C[0]} ${C[1] + d * 2.1} ${L[0]} ${L[1] + d * 0.15}`;
  const cavity = `${upper} L ${R[0]} ${R[1] + d * 0.15} ${lowerBack} Z`;
  const teethH = Math.min(d * 0.42, r.maxOpen * 0.32);
  const pad = 46;
  const jawClip = `path('M ${L[0] - pad} ${L[1] + 2} L ${L[0]} ${L[1]} Q ${C[0]} ${C[1]} ${R[0]} ${R[1]} L ${R[0] + pad} ${R[1] + 2} L ${R[0] + pad} ${r.chin + 30} L ${L[0] - pad} ${r.chin + 30} Z')`;
  const jcx = M[0];
  const jcy = (M[1] + r.chin) / 2;
  const jrx = (R[0] - L[0]) / 2 + pad;
  const jry = (r.chin - M[1]) / 2 + 28;
  const jawMask = `radial-gradient(${jrx}px ${jry}px at ${jcx}px ${jcy}px, #000 62%, transparent 100%)`;

  // Life: sway from the hips, bob with speech, slow breathing.
  const sway = noise2D('sway', t * 0.3, 0) * 1.6 + noise2D('talk', t * 1.8, 1) * 1.2 * lv;
  const bob = Math.sin(t * Math.PI * 2 * 0.23) * 4 - lv * 6;
  const breathe = 1 + Math.sin(t * Math.PI * 2 * 0.25) * 0.008;
  const scale = height / r.h;
  const src = staticFile(r.src);
  const img: React.CSSProperties = { position: 'absolute', left: 0, top: 0, width: r.w, height: r.h };

  return (
    <div style={{ position: 'absolute', left: x, top: y, width: r.w * scale, height: r.h * scale }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: r.w,
          height: r.h,
          transformOrigin: '50% 100%',
          transform: `scale(${scale}) ${flip ? 'scaleX(-1)' : ''} translateY(${bob / scale}px) rotate(${sway}deg) scaleY(${breathe})`,
        }}
      >
        <Img src={src} style={img} />
        {d > 0.6 && (
          <>
            <svg width={r.w} height={r.h} style={{ position: 'absolute', left: 0, top: 0 }}>
              <defs>
                <clipPath id={`cav-${mood}`}>
                  <path d={cavity} />
                </clipPath>
                <linearGradient id={`cg-${mood}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#120404" />
                  <stop offset="1" stopColor="#3A1012" />
                </linearGradient>
              </defs>
              <path d={cavity} fill={`url(#cg-${mood})`} />
              <g clipPath={`url(#cav-${mood})`}>
                <ellipse cx={M[0]} cy={M[1] + d * 1.05} rx={(R[0] - L[0]) * 0.27} ry={Math.max(2, d * 0.32)} fill="#8E3A3F" opacity={0.9} />
                {mood !== 'grin' && mood !== 'angry' && <path d={upper} stroke="#E6DCCB" strokeWidth={teethH * 2} fill="none" opacity={0.95} />}
              </g>
            </svg>
            <div style={{ ...img, clipPath: jawClip, WebkitMaskImage: jawMask, maskImage: jawMask, transform: `translateY(${d}px)` }}>
              <Img src={src} style={img} />
            </div>
          </>
        )}
      </div>
    </div>
  );
};
