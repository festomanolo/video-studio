import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { noise2D } from '@remotion/noise';
import { useStudio } from '../context';

/** Slow drifting colour fields + grid + grain. Cheap to render, never static. */
export const Ambient: React.FC<{ intensity?: number }> = ({ intensity = 1 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { theme, layout } = useStudio();
  const t = frame / fps;
  const blob = (seed: string, color: string, r: number) => {
    const x = 50 + noise2D(seed, t * 0.05, 0) * 45;
    const y = 50 + noise2D(seed, 0, t * 0.05) * 45;
    return `radial-gradient(${r}% ${r}% at ${x}% ${y}%, ${color} 0%, transparent 70%)`;
  };
  return (
    <AbsoluteFill style={{ background: theme.bg }}>
      <AbsoluteFill
        style={{
          opacity: 0.55 * intensity,
          background: [blob('a', `${theme.accent}55`, 55), blob('b', `${theme.accent2}40`, 50), blob('c', `${theme.bg2}`, 80)].join(','),
        }}
      />
      <AbsoluteFill
        style={{
          opacity: 0.5,
          backgroundImage: `linear-gradient(${theme.line} 1px, transparent 1px), linear-gradient(90deg, ${theme.line} 1px, transparent 1px)`,
          backgroundSize: `${layout.u * 8}px ${layout.u * 8}px`,
          backgroundPosition: `0 ${(t * 6) % (layout.u * 8)}px`,
          maskImage: 'radial-gradient(ellipse at 50% 40%, black 20%, transparent 75%)',
        }}
      />
    </AbsoluteFill>
  );
};

/** Full-bleed photo with a slow Ken Burns push and a dark scrim so captions stay readable. */
export const PhotoBg: React.FC<{ src: string; seed?: number; scrim?: number }> = ({ src, seed = 0, scrim = 0.55 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = frame / Math.max(1, durationInFrames);
  const dir = seed % 2 === 0 ? 1 : -1;
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: '#000' }}>
      <Img
        src={staticFile(src)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `scale(${1.08 + p * 0.12}) translateX(${dir * (p - 0.5) * 3}%)`,
        }}
      />
      <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(0,0,0,${scrim * 0.6}) 0%, rgba(0,0,0,${scrim}) 60%, rgba(0,0,0,${scrim * 1.2}) 100%)` }} />
    </AbsoluteFill>
  );
};
