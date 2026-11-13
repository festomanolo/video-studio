import React from 'react';
import { AbsoluteFill, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Audio } from '@remotion/media';
import './fonts';
import { SceneProvider, StudioProvider, type Layout } from './context';
import { getTheme } from './theme';
import type { Scene, Timeline } from './types';
import { Ambient, PhotoBg } from './components/Background';
import { Avatar } from './components/Avatar';
import { PhotoAvatar } from './avatar/PhotoAvatar';
import type { Mood } from './avatar/rig';
import { Captions } from './components/Captions';
import * as X from './scenes/explainer';
import * as T from './scenes/trend';
import { prog } from './lib/anim';

const layoutFor = (tl: Timeline): Layout => {
  const w = tl.width;
  const h = tl.height;
  const vertical = h > w;
  const u = Math.min(w, h) / 100;
  if (tl.mode === 'trend') return { w, h, vertical, u, stage: { x: u * 6, y: h * 0.1, w: w - u * 12, h: h * 0.55 } };
  // Explainer: content up top / left, avatar peeking from the bottom (right in landscape).
  if (vertical) return { w, h, vertical, u, stage: { x: u * 6, y: h * 0.07, w: w - u * 12, h: h * 0.52 } };
  if (w === h) return { w, h, vertical, u, stage: { x: u * 6, y: u * 6, w: w - u * 12, h: h * 0.56 } };
  return { w, h, vertical, u, stage: { x: u * 7, y: u * 8, w: w * 0.66, h: h - u * 30 } };
};

const SceneView: React.FC<{ scene: Scene }> = ({ scene }) => {
  const v = scene.visual;
  switch (v.type) {
    case 'title': return <X.TitleScene v={v} />;
    case 'code': return <X.CodeScene v={v} />;
    case 'terminal': return <X.TerminalScene v={v} />;
    case 'bullets': return <X.BulletsScene v={v} />;
    case 'diagram': return <X.DiagramScene v={v} />;
    case 'compare': return <X.CompareScene v={v} />;
    case 'stat': return <X.StatScene v={v} />;
    case 'image': return <X.ImageScene v={v} />;
    case 'device': return <X.DeviceScene v={v} />;
    case 'quote': return <X.QuoteScene v={v} />;
    case 'outro': return <X.OutroScene v={v} />;
    case 'hook': return <T.HookScene v={v} />;
    case 'story': return <T.StoryScene v={v} />;
    case 'list': return <T.ListScene v={v} />;
    case 'quiz': return <T.QuizScene v={v} />;
    case 'wyr': return <T.WyrScene v={v} />;
    case 'fact': return <T.FactScene v={v} />;
    default: return null;
  }
};

/** Music bed: fades in/out and ducks under the voice. */
const Music: React.FC<{ tl: Timeline }> = ({ tl }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  if (!tl.music) return null;
  const t = frame / fps;
  const speaking = tl.scenes.some((s) => s.speechStart != null && t >= s.speechStart - 0.15 && t <= (s.speechEnd ?? 0) + 0.2);
  const fade = Math.min(prog(frame, 0, fps * 0.8), 1 - prog(frame, durationInFrames - fps * 1.5, durationInFrames));
  return <Audio src={staticFile(tl.music.src)} volume={tl.music.volume * fade * (speaking ? 0.6 : 1.6)} loop />;
};

export const Video: React.FC<{ timeline: Timeline }> = ({ timeline: tl }) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const theme = getTheme(tl.theme ?? (tl.mode === 'trend' ? 'neon' : 'midnight'));
  const layout = layoutFor(tl);
  const explainer = tl.mode === 'explainer';
  const capVariant = explainer ? 'clean' : 'pop';
  const avatarSize = layout.vertical ? layout.w * 0.5 : layout.h * 0.5;
  const scene = tl.scenes.find((s) => frame / fps >= s.start && frame / fps < s.end);
  const fullBleed = scene && ['quiz', 'wyr', 'story', 'hook'].includes(scene.visual.type);

  return (
    <StudioProvider timeline={tl} theme={theme} layout={layout}>
      <AbsoluteFill style={{ background: theme.bg, overflow: 'hidden' }}>
        {tl.background ? <PhotoBg src={tl.background} scrim={0.62} /> : <Ambient intensity={explainer ? 0.8 : 1.2} />}

        {tl.scenes.map((s) => {
          const from = Math.round(s.start * fps);
          const dur = Math.max(1, Math.round(s.end * fps) - from);
          return (
            <Sequence key={s.index} from={from} durationInFrames={dur} name={`${s.index + 1} ${s.visual.type}`}>
              <SceneProvider scene={s}>
                <SceneView scene={s} />
              </SceneProvider>
            </Sequence>
          );
        })}

        {explainer && (
          <Avatar
            size={avatarSize}
            x={layout.vertical || layout.w === layout.h ? layout.w * 0.5 - avatarSize / 2 : layout.w - avatarSize - layout.u * 4}
            y={layout.h - avatarSize * 1.06}
            look={layout.vertical ? { x: 0, y: -1 } : { x: -1, y: -0.3 }}
          />
        )}

        {!fullBleed && (
          <Captions
            variant={capVariant}
            y={explainer ? (layout.vertical ? layout.h * 0.635 : layout.h - layout.u * 11) : layout.h * 0.72}
            maxWidth={explainer && !layout.vertical ? layout.w * 0.62 : layout.w * 0.88}
          />
        )}

        {!explainer && (
          <div style={{ position: 'absolute', top: 0, left: 0, height: layout.u * 0.7, width: `${(frame / Math.max(1, tl.durationInFrames)) * 100}%`, background: theme.accent, boxShadow: `0 0 20px ${theme.accent}` }} />
        )}

        {tl.narration && <Audio src={staticFile(tl.narration)} />}
        <Music tl={tl} />
        {tl.scenes.slice(1).map((s) =>
          explainer ? (
            <Sequence key={`sfx${s.index}`} from={Math.round(s.start * fps)} durationInFrames={fps} layout="none">
              <Audio src={staticFile('sfx/whoosh.wav')} volume={0.18} />
            </Sequence>
          ) : null,
        )}
      </AbsoluteFill>
    </StudioProvider>
  );
};

