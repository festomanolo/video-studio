import React from 'react';
import { Highlight, type PrismTheme } from 'prism-react-renderer';
import { Img, staticFile } from 'remotion';
import { useScene, useStudio } from '../context';
import { MONO, SANS } from '../fonts';
import { E, mix, prog, spr, SPR, tw } from '../lib/anim';
import type { Theme } from '../theme';
import type { Visual } from '../types';

type V<T extends Visual['type']> = Extract<Visual, { type: T }>;

/** Scene enter/exit wrapper: rises in with a blur, leaves upward. */
export const Enter: React.FC<{ children: React.ReactNode; style?: React.CSSProperties; delay?: number }> = ({ children, style, delay = 0 }) => {
  const { frame, fps, exit } = useScene();
  const p = spr(frame, delay, fps, SPR.soft);
  const q = exit(9);
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        opacity: Math.min(1, p * 1.3) * (1 - q),
        transform: `translateY(${(1 - p) * 40 - q * 30}px) scale(${mix(0.97, 1, p)})`,
        filter: (1 - p) * 8 + q * 6 > 0.05 ? `blur(${(1 - p) * 8 + q * 6}px)` : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export const Card: React.FC<{ children: React.ReactNode; style?: React.CSSProperties; title?: string }> = ({ children, style, title }) => {
  const { theme, layout } = useStudio();
  return (
    <div
      style={{
        background: theme.surface,
        border: `1px solid ${theme.line}`,
        borderRadius: layout.u * 2.6,
        boxShadow: '0 40px 80px -30px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.02) inset',
        overflow: 'hidden',
        ...style,
      }}
    >
      {title !== undefined && (
        <div style={{ display: 'flex', alignItems: 'center', gap: layout.u * 0.9, padding: `${layout.u * 1.6}px ${layout.u * 2}px`, borderBottom: `1px solid ${theme.line}`, background: theme.surface2 }}>
          {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => (
            <div key={c} style={{ width: layout.u * 1.3, height: layout.u * 1.3, borderRadius: 99, background: c }} />
          ))}
          <div style={{ marginLeft: layout.u, fontFamily: MONO, fontSize: layout.u * 2, color: theme.muted }}>{title}</div>
        </div>
      )}
      {children}
    </div>
  );
};

const Stage: React.FC<{ children: React.ReactNode; center?: boolean }> = ({ children, center = true }) => {
  const { layout } = useStudio();
  const s = layout.stage;
  return (
    <div style={{ position: 'absolute', left: s.x, top: s.y, width: s.w, height: s.h, display: 'flex', flexDirection: 'column', justifyContent: center ? 'center' : 'flex-start', alignItems: 'stretch' }}>
      {children}
    </div>
  );
};

const Heading: React.FC<{ text?: string }> = ({ text }) => {
  const { theme, layout } = useStudio();
  if (!text) return null;
  return (
    <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: layout.u * 5.2, color: theme.ink, letterSpacing: '-0.03em', marginBottom: layout.u * 3, lineHeight: 1.05 }}>
      {text}
    </div>
  );
};

// ---------------------------------------------------------------------------------------------

export const TitleScene: React.FC<{ v: V<'title'> }> = ({ v }) => {
  const { frame, fps } = useScene();
  const { theme, layout } = useStudio();
  const words = v.title.split(' ');
  return (
    <Enter>
      <Stage>
        {v.kicker && (
          <div
            style={{
              alignSelf: 'flex-start',
              fontFamily: MONO,
              fontSize: layout.u * 2.4,
              color: theme.accent,
              border: `2px solid ${theme.accent}66`,
              background: `${theme.accent}14`,
              padding: `${layout.u * 0.8}px ${layout.u * 1.6}px`,
              borderRadius: 99,
              marginBottom: layout.u * 3,
              opacity: prog(frame, 0, 12),
            }}
          >
            {v.kicker}
          </div>
        )}
        <div style={{ fontFamily: SANS, fontWeight: 850, fontSize: layout.u * (layout.vertical ? 10 : 8.4), lineHeight: 0.98, letterSpacing: '-0.045em', color: theme.ink }}>
          {words.map((w, i) => {
            const p = spr(frame, 4 + i * 4, fps, SPR.snap);
            return (
              <span key={i} style={{ display: 'inline-block', marginRight: '0.24em', opacity: p, transform: `translateY(${(1 - p) * 0.5}em)`, filter: p < 0.995 ? `blur(${(1 - p) * 10}px)` : undefined }}>
                {i === words.length - 1 ? <span style={{ color: theme.accent }}>{w}</span> : w}
              </span>
            );
          })}
        </div>
        {v.subtitle && (
          <div style={{ marginTop: layout.u * 3, fontFamily: SANS, fontSize: layout.u * 3.6, color: theme.muted, fontWeight: 500, opacity: prog(frame, 14 + words.length * 4, 30 + words.length * 4), lineHeight: 1.3 }}>
            {v.subtitle}
          </div>
        )}
      </Stage>
    </Enter>
  );
};

const prismTheme = (t: Theme): PrismTheme => ({
  plain: { color: t.code.plain, backgroundColor: 'transparent' },
  styles: [
    { types: ['comment', 'prolog', 'doctype', 'cdata'], style: { color: t.code.comment, fontStyle: 'italic' } },
    { types: ['keyword', 'builtin', 'important', 'atrule'], style: { color: t.code.keyword } },
    { types: ['string', 'char', 'attr-value', 'regex', 'inserted'], style: { color: t.code.string } },
    { types: ['number', 'boolean', 'constant'], style: { color: t.code.number } },
    { types: ['function', 'function-variable', 'method'], style: { color: t.code.fn } },
    { types: ['class-name', 'tag', 'type', 'namespace', 'maybe-class-name'], style: { color: t.code.type } },
    { types: ['punctuation'], style: { color: t.code.punct } },
    { types: ['operator', 'arrow'], style: { color: t.code.op } },
  ],
});

export const CodeScene: React.FC<{ v: V<'code'> }> = ({ v }) => {
  const { frame, speechFrame } = useScene();
  const { theme, layout } = useStudio();
  const code = v.code.replace(/\s+$/, '');
  const lines = code.split('\n');
  const longest = Math.max(...lines.map((l) => l.length), 20);
  const s = layout.stage;
  // Fit: 0.6em per char for JetBrains Mono, 1.5 line-height.
  // Vertical videos drop the line-number gutter and tighten padding so code stays readable on a phone.
  const gutter = !layout.vertical;
  const pad = layout.u * (gutter ? 2.6 : 1.8);
  const fs = Math.min(layout.u * 3.6, (s.w - pad * 2 - 4) / (longest * 0.602 + (gutter ? 2.4 : 0.5)), (s.h - layout.u * 14) / (lines.length * 1.5));
  const typing = v.typing !== false;
  const typedEnd = Math.max(20, speechFrame(0.7));
  const chars = typing ? Math.floor(tw(frame, 4, typedEnd, 0, code.length, E.linear)) : code.length;
  const hl = new Set(v.highlight ?? []);
  const hlOn = prog(frame, typedEnd, typedEnd + 12);
  // Character offset where each line starts in `code` (lines are joined by one '\n').
  const lineStart: number[] = [];
  lines.reduce((acc, l) => (lineStart.push(acc), acc + l.length + 1), 0);

  return (
    <Enter>
      <Stage>
        <Card title={v.filename ?? (v.lang ? `main.${v.lang === 'typescript' ? 'ts' : v.lang === 'python' ? 'py' : v.lang === 'rust' ? 'rs' : v.lang}` : 'code')}>
          <Highlight code={code} language={v.lang ?? 'tsx'} theme={prismTheme(theme)}>
            {({ tokens, getLineProps, getTokenProps }) => (
              <pre style={{ margin: 0, padding: `${layout.u * 2.4}px ${pad}px`, fontFamily: MONO, fontSize: fs, lineHeight: 1.5 }}>
                {tokens.map((line, i) => {
                  const lineNo = i + 1;
                  const dim = hl.size > 0 && !hl.has(lineNo) ? mix(1, 0.28, hlOn) : 1;
                  const lp = getLineProps({ line });
                  return (
                    <div
                      key={i}
                      {...lp}
                      style={{
                        ...lp.style,
                        display: 'flex',
                        opacity: dim,
                        background: hl.has(lineNo) ? `${theme.accent}${Math.round(hlOn * 0x22).toString(16).padStart(2, '0')}` : 'transparent',
                        margin: `0 -${pad}px`,
                        padding: `0 ${pad}px`,
                      }}
                    >
                      {gutter && <span style={{ width: fs * 2.4, color: theme.muted, opacity: 0.5, flexShrink: 0 }}>{lineNo}</span>}
                      <span style={{ whiteSpace: 'pre' }}>
                        {(() => {
                          let off = lineStart[i];
                          return line.map((token, k) => {
                            const start = off;
                            off += token.content.length;
                            if (start >= chars) return null;
                            const tp = getTokenProps({ token });
                            return <span key={k} {...tp} children={token.content.slice(0, chars - start)} />;
                          });
                        })()}
                        {typing && chars < code.length && chars >= lineStart[i] && chars <= lineStart[i] + lines[i].length && (
                          <span style={{ display: 'inline-block', width: '0.55em', height: '1.1em', verticalAlign: 'text-bottom', background: theme.accent, opacity: Math.floor(frame / 8) % 2 ? 1 : 0.3 }} />
                        )}
                      </span>
                    </div>
                  );
                })}
              </pre>
            )}
          </Highlight>
        </Card>
      </Stage>
    </Enter>
  );
};

export const TerminalScene: React.FC<{ v: V<'terminal'> }> = ({ v }) => {
  const { frame, speechFrame } = useScene();
  const { theme, layout } = useStudio();
  const n = v.lines.length;
  const fs = Math.min(layout.u * 3, (layout.stage.w - layout.u * 8) / (Math.max(...v.lines.map((l) => l.length), 24) * 0.6));
  return (
    <Enter>
      <Stage>
        <Card title={v.title ?? 'zsh'} style={{ background: '#0B0D10' }}>
          <div style={{ padding: `${layout.u * 2.4}px ${layout.u * 2.6}px`, fontFamily: MONO, fontSize: fs, lineHeight: 1.6, color: '#E6E8EE', minHeight: layout.u * 20 }}>
            {v.lines.map((line, i) => {
              const at = speechFrame(i / Math.max(1, n)) * 0.9 + 4;
              const isCmd = line.startsWith('$ ');
              const text = isCmd ? line.slice(2) : line;
              const typed = isCmd ? Math.floor(tw(frame, at, at + Math.min(40, text.length * 1.6), 0, text.length, E.linear)) : frame >= at ? text.length : 0;
              if (frame < at) return null;
              return (
                <div key={i} style={{ whiteSpace: 'pre-wrap', color: isCmd ? '#fff' : line.startsWith('✓') || line.startsWith('ok') ? theme.good : line.startsWith('error') || line.startsWith('✗') ? theme.bad : '#A8B0C2' }}>
                  {isCmd && <span style={{ color: theme.accent2 }}>❯ </span>}
                  {text.slice(0, typed)}
                  {isCmd && typed < text.length && <span style={{ background: '#fff', marginLeft: 2 }}>&nbsp;</span>}
                </div>
              );
            })}
          </div>
        </Card>
      </Stage>
    </Enter>
  );
};

export const BulletsScene: React.FC<{ v: V<'bullets'> }> = ({ v }) => {
  const { frame, fps, speechFrame, cueFrame } = useScene();
  const { theme, layout } = useStudio();
  const items = v.items.map((it) => (typeof it === 'string' ? { text: it } : it));
  return (
    <Enter>
      <Stage>
        <Heading text={v.title} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: layout.u * 2 }}>
          {items.map((it, i) => {
            const at = cueFrame((it as { cue?: string }).cue ?? it.text.split(' ')[0], speechFrame(i / items.length)) - 4;
            const p = spr(frame, at, fps, SPR.snap);
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: layout.u * 2,
                  padding: `${layout.u * 2}px ${layout.u * 2.4}px`,
                  borderRadius: layout.u * 2,
                  background: theme.surface,
                  border: `1px solid ${theme.line}`,
                  opacity: p,
                  transform: `translateX(${(1 - p) * -60}px)`,
                }}
              >
                <div style={{ width: layout.u * 5, height: layout.u * 5, borderRadius: layout.u * 1.4, background: `${theme.accent}22`, color: theme.accent, display: 'grid', placeItems: 'center', fontFamily: MONO, fontWeight: 700, fontSize: layout.u * 2.4, flexShrink: 0 }}>
                  {(it as { icon?: string }).icon ?? String(i + 1).padStart(2, '0')}
                </div>
                <div style={{ fontFamily: SANS, fontSize: layout.u * 3.5, fontWeight: 600, color: theme.ink, lineHeight: 1.2 }}>{it.text}</div>
              </div>
            );
          })}
        </div>
      </Stage>
    </Enter>
  );
};

export const DiagramScene: React.FC<{ v: V<'diagram'> }> = ({ v }) => {
  const { frame, fps, speechFrame, cueFrame } = useScene();
  const { theme, layout } = useStudio();
  const s = layout.stage;
  const n = v.nodes.length;
  const vertical = layout.vertical || n > 4;
  const headH = v.title ? layout.u * 9 : 0;
  const nodeW = vertical ? Math.min(s.w * 0.8, layout.u * 60) : (s.w - layout.u * 8 * (n - 1)) / n;
  const nodeH = vertical ? Math.min(layout.u * 13, (s.h - headH - layout.u * 6 * (n - 1)) / n) : layout.u * 18;
  const pos = (i: number) =>
    vertical
      ? { x: (s.w - nodeW) / 2, y: headH + i * (nodeH + (s.h - headH - nodeH * n) / Math.max(1, n - 1)) }
      : { x: i * (nodeW + layout.u * 8), y: headH + (s.h - headH - nodeH) / 2 };
  const idx = Object.fromEntries(v.nodes.map((nd, i) => [nd.id, i]));
  const appear = v.nodes.map((nd, i) => cueFrame(nd.cue ?? nd.label.split(' ')[0], speechFrame(i / n)) - 3);
  const edges = v.edges ?? v.nodes.slice(1).map((nd, i) => [v.nodes[i].id, nd.id] as [string, string]);

  return (
    <Enter>
      <div style={{ position: 'absolute', left: s.x, top: s.y, width: s.w, height: s.h }}>
        <Heading text={v.title} />
        <svg width={s.w} height={s.h} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
          {edges.map(([a, b, label], k) => {
            const A = pos(idx[a]);
            const B = pos(idx[b]);
            if (!A || !B) return null;
            const [x1, y1, x2, y2] = vertical
              ? [A.x + nodeW / 2, A.y + nodeH, B.x + nodeW / 2, B.y]
              : [A.x + nodeW, A.y + nodeH / 2, B.x, B.y + nodeH / 2];
            const len = Math.hypot(x2 - x1, y2 - y1);
            const start = Math.max(appear[idx[a]], appear[idx[b]] - 10);
            const p = prog(frame, start, start + 14, E.smooth);
            const packet = ((frame - start) / (fps * 1.2)) % 1;
            return (
              <g key={k}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={theme.muted} strokeWidth={4} strokeDasharray={len} strokeDashoffset={len * (1 - p)} strokeLinecap="round" />
                {p >= 1 && <circle cx={mix(x1, x2, packet)} cy={mix(y1, y2, packet)} r={layout.u * 0.9} fill={theme.accent2} />}
                {p > 0.6 && (
                  <polygon
                    points={vertical ? `${x2 - 12},${y2 - 18} ${x2 + 12},${y2 - 18} ${x2},${y2 - 2}` : `${x2 - 18},${y2 - 12} ${x2 - 18},${y2 + 12} ${x2 - 2},${y2}`}
                    fill={theme.muted}
                  />
                )}
                {label && p > 0.8 && (
                  <text x={(x1 + x2) / 2 + (vertical ? layout.u * 2 : 0)} y={(y1 + y2) / 2 - (vertical ? 0 : layout.u * 1.5)} fill={theme.muted} fontFamily={MONO} fontSize={layout.u * 2} textAnchor={vertical ? 'start' : 'middle'}>
                    {label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {v.nodes.map((nd, i) => {
          const P = pos(i);
          const p = spr(frame, appear[i], fps, SPR.pop);
          return (
            <div
              key={nd.id}
              style={{
                position: 'absolute',
                left: P.x,
                top: P.y,
                width: nodeW,
                height: nodeH,
                borderRadius: layout.u * 2.2,
                background: theme.surface,
                border: `2px solid ${i === n - 1 ? theme.accent : theme.line}`,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                transform: `scale(${p})`,
                opacity: Math.min(1, p * 2),
                boxShadow: `0 20px 50px -20px ${i === n - 1 ? theme.accent : '#000'}88`,
                textAlign: 'center',
                padding: layout.u,
              }}
            >
              <div style={{ fontFamily: SANS, fontWeight: 750, fontSize: layout.u * 3.4, color: theme.ink }}>{nd.label}</div>
              {nd.sub && <div style={{ fontFamily: MONO, fontSize: layout.u * 2, color: theme.muted, marginTop: layout.u * 0.6 }}>{nd.sub}</div>}
            </div>
          );
        })}
      </div>
    </Enter>
  );
};

export const CompareScene: React.FC<{ v: V<'compare'> }> = ({ v }) => {
  const { frame, fps, speechFrame } = useScene();
  const { theme, layout } = useStudio();
  const col = (side: 'left' | 'right', color: string, mark: string, at: number) => {
    const c = v[side];
    const p = spr(frame, at, fps, SPR.soft);
    return (
      <div style={{ flex: 1, opacity: p, transform: `translateY(${(1 - p) * 40}px)`, background: theme.surface, border: `2px solid ${color}55`, borderRadius: layout.u * 2.4, padding: layout.u * 3 }}>
        <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: layout.u * 3.8, color, marginBottom: layout.u * 2 }}>{c.title}</div>
        {c.items.map((it, i) => (
          <div key={i} style={{ display: 'flex', gap: layout.u * 1.4, fontFamily: SANS, fontSize: layout.u * 3, color: theme.ink, marginBottom: layout.u * 1.4, opacity: prog(frame, at + 8 + i * 6, at + 18 + i * 6) }}>
            <span style={{ color, fontWeight: 800 }}>{mark}</span>
            {it}
          </div>
        ))}
      </div>
    );
  };
  return (
    <Enter>
      <Stage>
        <Heading text={v.title} />
        <div style={{ display: 'flex', flexDirection: layout.vertical ? 'column' : 'row', gap: layout.u * 3 }}>
          {col('left', theme.bad, '✕', 2)}
          {col('right', theme.good, '✓', speechFrame(0.45))}
        </div>
      </Stage>
    </Enter>
  );
};

export const StatScene: React.FC<{ v: V<'stat'> }> = ({ v }) => {
  const { frame, speechFrame } = useScene();
  const { theme, layout } = useStudio();
  const m0 = v.value.match(/^([^\d-]*)(-?[\d.,]+)(.*)$/);
  const m = m0 && !/[A-Za-z(]/.test(m0[1]) ? m0 : null;
  const target = m ? parseFloat(m[2].replace(/,/g, '')) : 0;
  const decimals = m && m[2].includes('.') ? m[2].split('.')[1].length : 0;
  const cur = tw(frame, 4, Math.max(24, speechFrame(0.5)), 0, target, E.out);
  const shown = m ? `${m[1]}${cur.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${m[3]}` : v.value;
  return (
    <Enter>
      <Stage>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: layout.u * 22, letterSpacing: '-0.06em', color: theme.accent, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{shown}</div>
          <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: layout.u * 4.6, color: theme.ink, marginTop: layout.u * 2 }}>{v.label}</div>
          {v.sub && <div style={{ fontFamily: SANS, fontSize: layout.u * 3, color: theme.muted, marginTop: layout.u }}>{v.sub}</div>}
        </div>
      </Stage>
    </Enter>
  );
};

export const ImageScene: React.FC<{ v: V<'image'> }> = ({ v }) => {
  const { frame, dur } = useScene();
  const { theme, layout } = useStudio();
  return (
    <Enter>
      <Stage>
        <div style={{ borderRadius: layout.u * 2.6, overflow: 'hidden', height: layout.stage.h * 0.82, border: `1px solid ${theme.line}`, background: theme.surface }}>
          {v.image && <Img src={staticFile(v.image)} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${1.04 + (frame / dur) * 0.08})` }} />}
        </div>
        {v.caption && <div style={{ fontFamily: SANS, fontSize: layout.u * 3, color: theme.muted, marginTop: layout.u * 2, textAlign: 'center' }}>{v.caption}</div>}
      </Stage>
    </Enter>
  );
};

/** A phone mockup (dimensions follow the S24 Ultra in /Volumes/MacX/projects/mockup/core/devices.json). */
export const DeviceScene: React.FC<{ v: V<'device'> }> = ({ v }) => {
  const { frame, fps } = useScene();
  const { theme, layout } = useStudio();
  const src = v.screen ?? v.image;
  const h = layout.stage.h * 0.92;
  const w = h * (79 / 162.3);
  const p = spr(frame, 0, fps, SPR.soft);
  const spin = mix(-28, -8, p) + Math.sin(frame / fps) * 3;
  return (
    <Enter>
      <Stage>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', perspective: 2400 }}>
          <div
            style={{
              width: w,
              height: h,
              borderRadius: w * 0.11,
              background: '#1C1D21',
              padding: w * 0.035,
              boxShadow: `0 60px 120px -40px #000, 0 0 0 ${w * 0.012}px #4A4D55, 0 0 80px ${theme.accent}33`,
              transform: `rotateY(${spin}deg) rotateX(${mix(12, 4, p)}deg)`,
            }}
          >
            <div style={{ width: '100%', height: '100%', borderRadius: w * 0.085, overflow: 'hidden', background: theme.surface2, position: 'relative' }}>
              {src && <Img src={staticFile(src)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              <div style={{ position: 'absolute', top: w * 0.03, left: '50%', width: w * 0.035, height: w * 0.035, marginLeft: -w * 0.0175, borderRadius: 99, background: '#000' }} />
            </div>
          </div>
          {v.caption && <div style={{ fontFamily: SANS, fontSize: layout.u * 3.2, color: theme.ink, marginTop: layout.u * 3, fontWeight: 650 }}>{v.caption}</div>}
        </div>
      </Stage>
    </Enter>
  );
};

export const QuoteScene: React.FC<{ v: V<'quote'> }> = ({ v }) => {
  const { theme, layout } = useStudio();
  return (
    <Enter>
      <Stage>
        <div style={{ fontFamily: SANS, fontWeight: 300, fontSize: layout.u * 18, color: theme.accent, lineHeight: 0.6 }}>“</div>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: layout.u * 5.4, color: theme.ink, lineHeight: 1.15, letterSpacing: '-0.02em' }}>{v.text}</div>
        {v.author && <div style={{ fontFamily: MONO, fontSize: layout.u * 2.6, color: theme.muted, marginTop: layout.u * 3 }}>— {v.author}</div>}
      </Stage>
    </Enter>
  );
};

export const OutroScene: React.FC<{ v: V<'outro'> }> = ({ v }) => {
  const { frame, fps } = useScene();
  const { theme, layout } = useStudio();
  const p = spr(frame, 10, fps, SPR.pop);
  return (
    <Enter>
      <Stage>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: SANS, fontWeight: 850, fontSize: layout.u * 7.5, color: theme.ink, letterSpacing: '-0.04em', lineHeight: 1.02 }}>{v.title}</div>
          {v.cta && (
            <div
              style={{
                display: 'inline-block',
                marginTop: layout.u * 4,
                padding: `${layout.u * 2}px ${layout.u * 4}px`,
                borderRadius: 99,
                background: theme.accent,
                color: '#0A0A0A',
                fontFamily: SANS,
                fontWeight: 800,
                fontSize: layout.u * 3.6,
                transform: `scale(${p})`,
              }}
            >
              {v.cta}
            </div>
          )}
          {v.handle && <div style={{ fontFamily: MONO, fontSize: layout.u * 3, color: theme.muted, marginTop: layout.u * 3 }}>{v.handle}</div>}
        </div>
      </Stage>
    </Enter>
  );
};
