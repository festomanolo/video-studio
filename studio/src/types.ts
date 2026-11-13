// Mirror of `Timeline` in crates/vs/src/project.rs. Written by `vs build`, read here.

export type Mode = 'explainer' | 'trend';
export type Format = 'vertical' | 'landscape' | 'square';
export type Template = 'story' | 'toplist' | 'quiz' | 'wyr' | 'facts';

export type Word = { text: string; start: number; end: number; scene: number };

export type AvatarConfig = {
  name?: string;
  skin?: string;
  hair?: string;
  hairStyle?: 'messy' | 'short' | 'curly' | 'long' | 'bald';
  shirt?: string;
  glasses?: boolean;
  beard?: boolean;
  /** Your own drawing instead of the built-in cartoon: files under studio/public. */
  images?: { closed: string; half?: string; open: string; blink?: string };
};

// ---- Visuals (one per scene; `type` picks the component) ----
export type Visual =
  | { type: 'title'; kicker?: string; title: string; subtitle?: string }
  | { type: 'code'; code: string; lang?: string; filename?: string; highlight?: number[]; typing?: boolean }
  | { type: 'terminal'; lines: string[]; title?: string }
  | { type: 'bullets'; title?: string; items: (string | { text: string; cue?: string; icon?: string })[] }
  | { type: 'diagram'; title?: string; nodes: { id: string; label: string; sub?: string; cue?: string }[]; edges?: [string, string, string?][] }
  | { type: 'compare'; title?: string; left: { title: string; items: string[] }; right: { title: string; items: string[] } }
  | { type: 'stat'; value: string; label: string; sub?: string }
  | { type: 'image'; image?: string; imageQuery?: string; caption?: string }
  | { type: 'quote'; text: string; author?: string }
  | { type: 'device'; screen?: string; image?: string; imageQuery?: string; caption?: string }
  | { type: 'outro'; title: string; cta?: string; handle?: string }
  // trend templates
  | { type: 'hook'; text: string; emoji?: string }
  | { type: 'story'; community?: string; author?: string; title: string; upvotes?: string; comments?: string }
  | { type: 'list'; rank: number; title: string; body?: string; image?: string; imageQuery?: string }
  | { type: 'quiz'; question: string; options: string[]; answer: number; countdown?: number }
  | { type: 'wyr'; a: string; b: string; aPct?: number }
  | { type: 'fact'; text: string; image?: string; imageQuery?: string; label?: string }
  | { type: 'captions' };

export type Scene = {
  index: number;
  start: number;
  end: number;
  speechStart: number | null;
  speechEnd: number | null;
  say: string | null;
  visual: Visual;
};

export type Credit = { kind: string; title: string; creator?: string; license: string; licenseUrl?: string; sourceUrl?: string; file: string };

export type Timeline = {
  id: string;
  mode: Mode;
  format: Format;
  template?: Template | null;
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
  theme?: string | null;
  narration?: string | null;
  music?: { src: string; volume: number } | null;
  background?: string | null;
  avatar?: AvatarConfig | null;
  mouth: number[];
  words: Word[];
  scenes: Scene[];
  credits: Credit[];
};
