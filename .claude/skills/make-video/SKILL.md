---
name: make-video
description: Make a short video end to end in this repo - write the script and scenes as projects/<id>/project.json, narrate it with the user's cloned voice, render React frames to MP4 and optionally post it through AutoPost. Use when the user asks for a video, a short, a reel, a TikTok, an explainer, a tutorial clip, a quiz/trivia/would-you-rather/story/top-list/facts video, or "make a video about X".
---

# Make a video

Two kinds of video, picked with `mode`:

| mode | for | look |
| --- | --- | --- |
| `explainer` | the user's own tech/programming account | the cartoon avatar (lip-synced to the cloned voice) teaches; code, terminals, diagrams, bullets on top; clean captions |
| `trend` | growth accounts | faceless viral formats (hook, quiz, would-you-rather, story card, countdown list, facts), Openverse photo backgrounds, big pop captions, progress bar, SFX |

## Workflow

1. **Pick the angle.** For trend videos, run `vs trends` (Google Trends + Reddit top posts) for topics. Use titles as inspiration only: write the script fresh, never copy someone's post text.
2. **Write `projects/<id>/project.json`** (id: lowercase letters, digits, dashes). Schema below; examples in `projects/how-hashmaps-work` and `projects/quiz-tech-trivia`.
3. **Draft first:** `vs make <id> --draft` (macOS voice + half-res render, ~2 min). Then `vs sheet <id> --draft` and Read the PNG it prints (a frame every 2 s). Fix layout/timing in the JSON, repeat.
4. **Final:** `vs make <id>` (cloned voice, full res). The voice is slow on this Intel Mac (roughly 1 min of compute per second of speech), so run it in the background; every sentence is cached, so later edits only re-voice the lines that changed.
5. **Post (only when the user asks):** `vs channels` then `vs post <id> -c <integrationId> [--when now|2026-11-20T15:00:00Z]`. Default is a draft in AutoPost. Credits from credits.txt are appended to the caption automatically.

`vs studio` opens Remotion Studio with every built project for live preview.

## Writing rules

- Script: spoken, short sentences, 8-16 words. One idea per scene. Explainers: 30-60 s (6-10 scenes). Trend: 15-35 s, the first scene is a `hook` under 2 s.
- Spell out what TTS would mangle: "H T T P", "S Q L", "O of one", "x eighty six".
- `cue` on bullets/diagram nodes = a word from that scene's `say`; the item appears when the voice says it.
- Code in vertical videos: keep lines under ~32 characters and 4-10 lines, or it gets small.
- `imageQuery` on any visual (or `backgroundQuery` on the project) fetches an openly licensed photo from Openverse (CC0/PD/CC BY only). `music.query` fetches a music bed. Check what came back in `projects/<id>/credits.txt`; pin a better track with `vs search audio "<query>"` then `music.file`.

## project.json

```jsonc
{
  "id": "rust-ownership",
  "mode": "explainer",            // explainer | trend
  "format": "vertical",           // vertical 1080x1920 | landscape 1920x1080 | square
  "fps": 30,
  "theme": "midnight",            // midnight | paper | neon | sunset
  "voice": { "timesteps": 10, "clone": "fast" },   // clone: fast (10 s reference) | full (whole sample + transcript, slower, closer)
  "music": { "query": "lofi chill", "volume": 0.08 },   // or { "file": "track.mp3" }
  "backgroundQuery": "neon city night",                 // trend: full-frame photo
  "avatar": { "hairStyle": "messy", "glasses": true, "shirt": "#8B6CFF", "skin": "#C68A5E", "hair": "#1E1A1A", "beard": false },
  "caption": "post text #hashtags",
  "scenes": [ { "say": "spoken line", "hold": 2.0, "visual": { "type": "title", ... } } ]
}
```

`avatar.images` = `{ "closed": "avatar/closed.png", "half": "avatar/half.png", "open": "avatar/open.png", "blink": "avatar/blink.png" }` (files in `studio/public/avatar/`) swaps the built-in cartoon for the user's own drawing.

### Explainer visuals
- `title` { kicker?, title, subtitle? }: last word of the title gets the accent colour
- `code` { code, lang (rust, typescript, python, go, bash...), filename?, highlight?: [line numbers], typing?: true }: types out over the first 70% of the line, then highlights
- `terminal` { lines: ["$ command", "output", "✓ ok", "error: ..."], title? }
- `bullets` { title?, items: [string | { text, cue?, icon? }] }
- `diagram` { title?, nodes: [{ id, label, sub?, cue? }], edges?: [[from, to, label?]] }: defaults to a chain; packets flow along edges
- `compare` { title?, left: { title, items }, right: { title, items } }: left = bad/old, right = good/new
- `stat` { value: "98%", label, sub? }: numbers count up
- `image` { imageQuery | image, caption? }, `device` { screen | imageQuery, caption? } (phone mockup), `quote` { text, author? }
- `outro` { title, cta?, handle? }

### Trend visuals
- `hook` { text, emoji? }: slam-in opener with a boom
- `quiz` { question, options: [2-4], answer: index, countdown?: 3 }: the voice reads the question; countdown + reveal are added after it
- `wyr` { a, b, aPct? }: would you rather, vote bars fill after the voice
- `story` { community?, author?, title, upvotes?, comments? }: post card (generic, no platform branding); the following scenes narrate the story with pop captions (use `fact` or `captions` scenes)
- `list` { rank, title, imageQuery? }: countdown entry
- `fact` { text, label?, imageQuery? }
- `captions`: nothing but the background + captions (story narration)

## Where things are
- `crates/vs` (Rust): narration via VoxCPM2 (`/Volumes/MacX/Apps/VoxCPM2`, sample `voice/me.wav`), caching, lip-sync envelope, word timing, Openverse, render orchestration, AutoPost upload.
- `studio/` (Remotion, React): `src/scenes/explainer.tsx`, `src/scenes/trend.tsx`, `src/components/Avatar.tsx`, `Captions.tsx`. New visual = add a type in `src/types.ts`, a component, and a case in `src/Video.tsx`.
- Other skills here: `remotion-best-practices` (Remotion API), `motion-design`, `animate`, `choreograph`, `review-animations` (animation craft), `ig-*` (captions, hooks and plans for Instagram).
