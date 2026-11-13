import React from 'react';
import { AbsoluteFill, Sequence, staticFile } from 'remotion';
import { Audio } from '@remotion/media';
import { useScene, useStudio } from '../context';
import { MONO, SANS } from '../fonts';
import { E, hitPulse, mix, prog, spr, SPR } from '../lib/anim';
import { PhotoBg } from '../components/Background';
import type { Visual } from '../types';

type V<T extends Visual['type']> = Extract<Visual, { type: T }>;

const Sfx: React.FC<{ at: number; src: string; volume?: number }> = ({ at, src, volume = 0.5 }) => (
  <Sequence from={Math.max(0, Math.round(at))} layout="none">
    <Audio src={staticFile(`sfx/${src}.wav`)} volume={volume} />
  </Sequence>
);

/** The first 2 seconds: one punchy line that slams in. */
export const HookScene: React.FC<{ v: V<'hook'> }> = ({ v }) => {
  const { frame, fps, exit } = useScene();
  const { theme, layout } = useStudio();
  const p = spr(frame, 0, fps, { damping: 9, stiffness: 220, mass: 0.6 });
  const shake = hitPulse(frame, 2, 4) * 14;
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: layout.u * 8, opacity: 1 - exit(6) }}>
      <Sfx at={0} src="vine-boom" volume={0.35} />
      {v.emoji && <div style={{ fontSize: layout.u * 16, transform: `scale(${p}) rotate(${(1 - p) * -30}deg)`, marginBottom: layout.u * 2 }}>{v.emoji}</div>}
      <div
        style={{
          fontFamily: SANS,
          fontWeight: 900,
          fontSize: layout.u * 10,
          lineHeight: 0.98,
          textAlign: 'center',
          textTransform: 'uppercase',
          letterSpacing: '-0.03em',
          color: '#fff',
          WebkitTextStroke: `${layout.u * 0.9}px #000`,
          paintOrder: 'stroke fill',
          transform: `scale(${mix(2.2, 1, p)}) translate(${Math.sin(frame * 3) * shake}px, ${Math.cos(frame * 4) * shake}px)`,
          textShadow: `0 ${layout.u}px 0 ${theme.accent2}`,
        }}
      >
        {v.text}
      </div>
    </AbsoluteFill>
  );
};

/** A generic forum-post card for story-time videos (no third-party branding). */
export const StoryScene: React.FC<{ v: V<'story'> }> = ({ v }) => {
  const { frame, fps, exit } = useScene();
  const { theme, layout } = useStudio();
  const p = spr(frame, 0, fps, SPR.pop);
  const q = exit(8);
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <Sfx at={0} src="whoosh" />
      <div
        style={{
          width: layout.w * 0.86,
          background: '#FFFFFF',
          borderRadius: layout.u * 3,
          padding: layout.u * 4,
          boxShadow: '0 40px 100px -20px rgba(0,0,0,0.7)',
          transform: `scale(${p * (1 - q * 0.2)}) rotate(${(1 - p) * -6}deg) translateY(${q * -200}px)`,
          opacity: 1 - q,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: layout.u * 2, marginBottom: layout.u * 2.4 }}>
          <div style={{ width: layout.u * 8, height: layout.u * 8, borderRadius: 99, background: `linear-gradient(135deg, ${theme.accent2}, ${theme.accent})` }} />
          <div>
            <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: layout.u * 3.4, color: '#111' }}>{v.community ?? 'stories'}</div>
            <div style={{ fontFamily: SANS, fontSize: layout.u * 2.6, color: '#777' }}>{v.author ?? 'anonymous'} · 4h</div>
          </div>
        </div>
        <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: layout.u * 5.2, lineHeight: 1.15, color: '#111', letterSpacing: '-0.015em' }}>{v.title}</div>
        <div style={{ display: 'flex', gap: layout.u * 4, marginTop: layout.u * 3, fontFamily: SANS, fontWeight: 700, fontSize: layout.u * 3, color: '#555' }}>
          <span>▲ {v.upvotes ?? '24.1k'}</span>
          <span>💬 {v.comments ?? '3.2k'}</span>
          <span>↗ Share</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** Countdown entry: giant rank number, title, optional photo. */
export const ListScene: React.FC<{ v: V<'list'> }> = ({ v }) => {
  const { frame, fps, exit, dur } = useScene();
  const { theme, layout } = useStudio();
  const p = spr(frame, 0, fps, SPR.pop);
  const t = spr(frame, 6, fps, SPR.snap);
  const q = exit(7);
  return (
    <AbsoluteFill style={{ opacity: 1 - q }}>
      {v.image && (
        <AbsoluteFill style={{ opacity: prog(frame, 0, 10) }}>
          <PhotoBg src={v.image} seed={v.rank} scrim={0.5} />
        </AbsoluteFill>
      )}
      <Sfx at={0} src="whip" volume={0.4} />
      <AbsoluteFill style={{ justifyContent: 'flex-start', alignItems: 'center', paddingTop: layout.h * 0.13 }}>
        <div
          style={{
            fontFamily: SANS,
            fontWeight: 900,
            fontSize: layout.u * 30,
            lineHeight: 0.9,
            color: theme.accent,
            WebkitTextStroke: `${layout.u * 0.8}px #000`,
            paintOrder: 'stroke fill',
            transform: `scale(${mix(3, 1, p)}) rotate(${(1 - p) * 12}deg)`,
            textShadow: `${layout.u}px ${layout.u}px 0 #000`,
          }}
        >
          #{v.rank}
        </div>
        <div
          style={{
            marginTop: layout.u * 3,
            maxWidth: layout.w * 0.86,
            textAlign: 'center',
            fontFamily: SANS,
            fontWeight: 900,
            fontSize: layout.u * 7,
            lineHeight: 1.02,
            textTransform: 'uppercase',
            color: '#fff',
            WebkitTextStroke: `${layout.u * 0.6}px #000`,
            paintOrder: 'stroke fill',
            opacity: t,
            transform: `translateY(${(1 - t) * 60}px)`,
          }}
        >
          {v.title}
        </div>
      </AbsoluteFill>
      <div style={{ position: 'absolute', left: 0, bottom: 0, height: layout.u * 0.8, width: `${(frame / dur) * 100}%`, background: theme.accent }} />
    </AbsoluteFill>
  );
};

/** Quiz: question, options drop in, 3-2-1 ring, the answer lights up. */
export const QuizScene: React.FC<{ v: V<'quiz'> }> = ({ v }) => {
  const { frame, fps, speechEnd, exit } = useScene();
  const { theme, layout } = useStudio();
  const countdown = (v.countdown ?? 3) * fps;
  const cdStart = Math.max(speechEnd, fps * 1.5);
  const reveal = cdStart + countdown;
  const revealed = frame >= reveal;
  const ring = prog(frame, cdStart, reveal, E.linear);
  const left = Math.ceil((1 - ring) * (v.countdown ?? 3));
  const letters = 'ABCD';
  const R = layout.u * 7;
  return (
    <AbsoluteFill style={{ padding: `${layout.h * 0.16}px ${layout.u * 6}px`, alignItems: 'center', opacity: 1 - exit(8) }}>
      <Sfx at={0} src="whoosh" />
      {Array.from({ length: v.countdown ?? 3 }, (_, i) => (
        <Sfx key={i} at={cdStart + i * fps} src="mouse-click" volume={0.6} />
      ))}
      <Sfx at={reveal} src="ding" volume={0.55} />
      <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: layout.u * 6.4, lineHeight: 1.08, color: '#fff', textAlign: 'center', WebkitTextStroke: `${layout.u * 0.4}px #000`, paintOrder: 'stroke fill', opacity: prog(frame, 0, 10), marginBottom: layout.u * 5 }}>
        {v.question}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: layout.u * 2.4, width: '100%' }}>
        {v.options.map((o, i) => {
          const p = spr(frame, 8 + i * 6, fps, SPR.snap);
          const correct = i === v.answer;
          const bg = revealed ? (correct ? theme.good : 'rgba(255,255,255,0.08)') : 'rgba(255,255,255,0.12)';
          const pop = revealed && correct ? 1 + hitPulse(frame - reveal, 3, 6) * 0.08 : 1;
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: layout.u * 2.4,
                padding: `${layout.u * 2.4}px ${layout.u * 3}px`,
                borderRadius: layout.u * 2.4,
                background: bg,
                border: `3px solid ${revealed && correct ? theme.good : 'rgba(255,255,255,0.25)'}`,
                transform: `translateX(${(1 - p) * (i % 2 ? 300 : -300)}px) scale(${pop})`,
                opacity: p * (revealed && !correct ? 0.45 : 1),
              }}
            >
              <div style={{ width: layout.u * 6.5, height: layout.u * 6.5, borderRadius: 99, background: revealed && correct ? '#0A0A0A' : theme.accent, color: revealed && correct ? theme.good : '#0A0A0A', display: 'grid', placeItems: 'center', fontFamily: SANS, fontWeight: 900, fontSize: layout.u * 3.4 }}>
                {letters[i]}
              </div>
              <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: layout.u * 4.2, color: revealed && correct ? '#0A0A0A' : '#fff' }}>{o}</div>
            </div>
          );
        })}
      </div>
      {frame >= cdStart && !revealed && (
        <div style={{ marginTop: layout.u * 6, position: 'relative', width: R * 2, height: R * 2 }}>
          <svg width={R * 2} height={R * 2} style={{ position: 'absolute', transform: 'rotate(-90deg)' }}>
            <circle cx={R} cy={R} r={R - 10} stroke="rgba(255,255,255,0.15)" strokeWidth={14} fill="none" />
            <circle cx={R} cy={R} r={R - 10} stroke={theme.accent} strokeWidth={14} fill="none" strokeLinecap="round" strokeDasharray={2 * Math.PI * (R - 10)} strokeDashoffset={2 * Math.PI * (R - 10) * ring} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontFamily: SANS, fontWeight: 900, fontSize: R, color: '#fff' }}>{left}</div>
        </div>
      )}
    </AbsoluteFill>
  );
};

/** Would you rather: two halves, vote bars fill at the end. */
export const WyrScene: React.FC<{ v: V<'wyr'> }> = ({ v }) => {
  const { frame, fps, speechEnd, exit } = useScene();
  const { layout } = useStudio();
  const a = v.aPct ?? 50;
  const votes = prog(frame, speechEnd + 4, speechEnd + 28, E.out);
  const half = (txt: string, pct: number, color: string, top: boolean, delay: number) => {
    const p = spr(frame, delay, fps, SPR.snap);
    return (
      <div style={{ position: 'absolute', left: 0, right: 0, [top ? 'top' : 'bottom']: 0, height: '50%', background: color, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: layout.u * 6, transform: `translateX(${(1 - p) * (top ? -100 : 100)}%)` }}>
        <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: layout.u * 6.2, color: '#fff', textAlign: 'center', lineHeight: 1.08, textShadow: '0 6px 0 rgba(0,0,0,0.25)' }}>{txt}</div>
        {votes > 0 && <div style={{ marginTop: layout.u * 3, fontFamily: SANS, fontWeight: 900, fontSize: layout.u * 9, color: '#fff' }}>{Math.round(pct * votes)}%</div>}
      </div>
    );
  };
  return (
    <AbsoluteFill style={{ opacity: 1 - exit(8) }}>
      <Sfx at={0} src="whip" volume={0.4} />
      <Sfx at={speechEnd + 4} src="ding" volume={0.4} />
      {half(v.a, a, '#E5383B', true, 0)}
      {half(v.b, 100 - a, '#1D6FE8', false, 6)}
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%,-50%) scale(${spr(frame, 12, fps, SPR.pop)})`, width: layout.u * 16, height: layout.u * 16, borderRadius: 99, background: '#fff', display: 'grid', placeItems: 'center', fontFamily: SANS, fontWeight: 900, fontSize: layout.u * 5, color: '#111', boxShadow: '0 10px 0 rgba(0,0,0,0.25)' }}>
        OR
      </div>
    </AbsoluteFill>
  );
};

/** Fact card over a photo: big label + text, captions run underneath. */
export const FactScene: React.FC<{ v: V<'fact'> }> = ({ v }) => {
  const { frame, fps, exit } = useScene();
  const { theme, layout } = useStudio();
  const p = spr(frame, 0, fps, SPR.snap);
  return (
    <AbsoluteFill style={{ opacity: 1 - exit(7) }}>
      {v.image && <PhotoBg src={v.image} seed={v.text.length} scrim={0.6} />}
      <Sfx at={0} src="whoosh" volume={0.4} />
      <AbsoluteFill style={{ justifyContent: 'flex-start', alignItems: 'center', paddingTop: layout.h * 0.16, paddingLeft: layout.u * 6, paddingRight: layout.u * 6 }}>
        {v.label && (
          <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: layout.u * 3, color: '#0A0A0A', background: theme.accent, padding: `${layout.u}px ${layout.u * 2.4}px`, borderRadius: layout.u, transform: `scale(${p})`, marginBottom: layout.u * 3 }}>
            {v.label}
          </div>
        )}
        <div style={{ fontFamily: SANS, fontWeight: 850, fontSize: layout.u * 6.4, lineHeight: 1.1, textAlign: 'center', color: '#fff', textShadow: '0 4px 30px rgba(0,0,0,0.6)', opacity: p, transform: `translateY(${(1 - p) * 50}px)` }}>
          {v.text}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

