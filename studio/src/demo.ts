// A silent demo timeline so Studio has something to show before any `vs build`.
// Word timings and the mouth envelope are faked from the text.
import type { Scene, Timeline, Visual, Word } from './types';

const FPS = 30;
const spec: { say: string; visual: Visual; secs: number }[] = [
  { secs: 3.5, say: 'What actually happens when you type a URL?', visual: { type: 'title', kicker: 'web 101', title: 'What happens when you hit enter', subtitle: 'From keystroke to pixels in about 100 ms' } },
  {
    secs: 6,
    say: 'First DNS turns the name into an address, then TCP and TLS open a secure connection, and finally HTTP asks for the page.',
    visual: { type: 'diagram', nodes: [{ id: 'dns', label: 'DNS', sub: 'name → IP', cue: 'DNS' }, { id: 'tcp', label: 'TCP + TLS', sub: 'handshake', cue: 'TCP' }, { id: 'http', label: 'HTTP', sub: 'GET /', cue: 'HTTP' }] },
  },
  { secs: 5, say: 'You can watch it yourself with curl and the verbose flag.', visual: { type: 'terminal', lines: ['$ curl -v https://example.com', '* Trying 93.184.215.14:443...', '* TLS 1.3 handshake done', '> GET / HTTP/2', '< HTTP/2 200'] } },
  {
    secs: 5.5,
    say: 'In code it is a single fetch call, but now you know what hides behind it.',
    visual: { type: 'code', lang: 'typescript', filename: 'page.ts', highlight: [2], code: "async function load() {\n  const res = await fetch('https://example.com');\n  return res.text();\n}" },
  },
  { secs: 3, say: 'Follow for more!', visual: { type: 'outro', title: 'Now you know.', cta: 'Follow for more', handle: '@yourhandle' } },
];

let t = 0;
const scenes: Scene[] = [];
const words: Word[] = [];
spec.forEach((s, i) => {
  const ss = t + 0.2;
  const se = t + s.secs - 0.4;
  const ws = s.say.split(' ');
  ws.forEach((w, k) => words.push({ text: w, start: ss + ((se - ss) * k) / ws.length, end: ss + ((se - ss) * (k + 0.9)) / ws.length, scene: i }));
  scenes.push({ index: i, start: t, end: t + s.secs, speechStart: ss, speechEnd: se, say: s.say, visual: s.visual });
  t += s.secs;
});
const frames = Math.ceil(t * FPS);
const mouth = Array.from({ length: frames }, (_, f) => {
  const tt = f / FPS;
  const w = words.find((x) => tt >= x.start && tt < x.end);
  return w ? Math.round(45 + 45 * Math.abs(Math.sin(tt * 19))) : 0;
});

export const demoTimeline: Timeline = {
  id: 'demo',
  mode: 'explainer',
  format: 'vertical',
  fps: FPS,
  width: 1080,
  height: 1920,
  durationInFrames: frames,
  theme: 'midnight',
  mouth,
  words,
  scenes,
  credits: [],
};
