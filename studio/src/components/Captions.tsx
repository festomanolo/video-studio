import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { useStudio } from '../context';
import { SANS } from '../fonts';
import { E, prog, spr, SPR } from '../lib/anim';
import type { Word } from '../types';

/** Groups words into short pages: breaks on punctuation, pauses, or `max` words. */
const paginate = (words: Word[], max: number) => {
  const pages: Word[][] = [];
  let cur: Word[] = [];
  words.forEach((w, i) => {
    const prev = words[i - 1];
    const gap = prev ? w.start - prev.end : 0;
    const newScene = prev && prev.scene !== w.scene;
    if (cur.length && (cur.length >= max || gap > 0.35 || newScene)) {
      pages.push(cur);
      cur = [];
    }
    cur.push(w);
    if (/[.!?,;:]$/.test(w.text) && cur.length >= Math.ceil(max / 2)) {
      pages.push(cur);
      cur = [];
    }
  });
  if (cur.length) pages.push(cur);
  return pages;
};

/**
 * Word-synced captions.
 *  - "pop": trend style. 1-3 huge words, the spoken word pops and takes the accent colour.
 *  - "clean": explainer style. A calm line, the spoken word highlighted.
 */
export const Captions: React.FC<{ variant: 'pop' | 'clean'; y: number; maxWidth: number }> = ({ variant, y, maxWidth }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { timeline, theme, layout } = useStudio();
  const t = frame / fps;
  const pages = React.useMemo(() => paginate(timeline.words, variant === 'pop' ? 3 : 6), [timeline.words, variant]);
  const page = pages.find((p) => t >= p[0].start - 0.08 && t <= p[p.length - 1].end + 0.25);
  if (!page) return null;
  const pageStart = Math.round((page[0].start - 0.08) * fps);
  const enter = spr(frame, pageStart, fps, variant === 'pop' ? SPR.pop : SPR.soft);
  const size = variant === 'pop' ? layout.u * 9.2 : layout.u * 4.4;

  return (
    <div
      style={{
        position: 'absolute',
        left: (layout.w - maxWidth) / 2,
        width: maxWidth,
        top: y,
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        gap: `0 ${size * 0.28}px`,
        fontFamily: SANS,
        fontWeight: variant === 'pop' ? 900 : 650,
        fontSize: size,
        lineHeight: 1.08,
        letterSpacing: variant === 'pop' ? '-0.02em' : '-0.01em',
        textTransform: variant === 'pop' ? 'uppercase' : 'none',
        transform: `translateY(-50%) scale(${0.85 + 0.15 * enter})`,
        opacity: Math.min(1, enter * 1.4),
        textAlign: 'center',
      }}
    >
      {page.map((w, i) => {
        const active = t >= w.start && t < w.end + 0.06;
        const said = t >= w.start;
        const pop = prog(frame, w.start * fps - 1, w.start * fps + 5, E.out);
        if (variant === 'pop') {
          return (
            <span
              key={i}
              style={{
                display: 'inline-block',
                color: active ? theme.accent : '#FFFFFF',
                transform: `scale(${active ? 1 + 0.12 * pop : 1}) rotate(${active ? -2 * pop : 0}deg)`,
                WebkitTextStroke: `${size * 0.09}px #000`,
                paintOrder: 'stroke fill',
                textShadow: `0 ${size * 0.06}px 0 #000, 0 0 ${size * 0.5}px rgba(0,0,0,0.45)`,
              }}
            >
              {w.text}
            </span>
          );
        }
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              color: said ? theme.ink : theme.muted,
              opacity: said ? 1 : 0.55,
              background: active ? `${theme.accent}33` : 'transparent',
              boxShadow: active ? `0 0 0 ${size * 0.12}px ${theme.accent}33` : 'none',
              borderRadius: size * 0.18,
            }}
          >
            {w.text}
          </span>
        );
      })}
    </div>
  );
};
