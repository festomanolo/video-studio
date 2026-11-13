import React, { createContext, useContext } from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import type { Scene, Timeline, Word } from './types';
import type { Theme } from './theme';

export type Layout = {
  w: number;
  h: number;
  vertical: boolean;
  /** Rect where a scene's visual goes (leaves room for avatar + captions in explainers). */
  stage: { x: number; y: number; w: number; h: number };
  /** Base font unit: 1u = 1% of the short side. */
  u: number;
};

type Ctx = { timeline: Timeline; theme: Theme; layout: Layout };
const C = createContext<Ctx | null>(null);
export const StudioProvider: React.FC<Ctx & { children: React.ReactNode }> = ({ children, ...v }) => <C.Provider value={v}>{children}</C.Provider>;
export const useStudio = () => {
  const v = useContext(C);
  if (!v) throw new Error('useStudio outside provider');
  return v;
};

const SceneC = createContext<Scene | null>(null);
export const SceneProvider: React.FC<{ scene: Scene; children: React.ReactNode }> = ({ scene, children }) => (
  <SceneC.Provider value={scene}>{children}</SceneC.Provider>
);

/**
 * Timing helpers for the scene being rendered. `frame` is local to the scene.
 * `speechFrame(p)`: frame at fraction p of the narration (0 = first word, 1 = last word).
 * `cueFrame(word)`: frame where the narration says a word starting with `word`.
 */
export const useScene = () => {
  const scene = useContext(SceneC);
  if (!scene) throw new Error('useScene outside scene');
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { timeline } = useStudio();
  const toLocal = (t: number) => (t - scene.start) * fps;
  const dur = (scene.end - scene.start) * fps;
  const ss = scene.speechStart != null ? toLocal(scene.speechStart) : 6;
  const se = scene.speechEnd != null ? toLocal(scene.speechEnd) : dur - 10;
  const words: Word[] = timeline.words.filter((w) => w.scene === scene.index);
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const cueFrame = (cue: string | undefined, fallback: number) => {
    if (!cue) return fallback;
    const c = norm(cue);
    const w = words.find((x) => norm(x.text).startsWith(c));
    return w ? toLocal(w.start) : fallback;
  };
  return {
    scene,
    frame,
    fps,
    dur,
    speechStart: ss,
    speechEnd: se,
    speechFrame: (p: number) => ss + (se - ss) * p,
    cueFrame,
    words,
    toLocal,
    /** 0..1 exit progress over the last `n` frames. */
    exit: (n = 10) => Math.min(1, Math.max(0, (frame - (dur - n)) / n)),
  };
};
