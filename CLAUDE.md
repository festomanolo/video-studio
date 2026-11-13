# Video Studio

AI videos made from React frames, narrated in the owner's cloned voice. Two outputs:
**explainer** (cartoon avatar teaches tech/programming) and **trend** (faceless viral formats for growth accounts).

To make a video, follow `.claude/skills/make-video/SKILL.md`.

## Layout

- `crates/vs` – Rust CLI `vs` (binary at `target/release/vs`): build, render, voice, Openverse, trends, AutoPost.
- `studio/` – Remotion 4 project (React 19). Every frame is a React render; `vs render` runs Remotion with parallel Chromium tabs.
- `projects/<id>/project.json` – one video. Outputs land in `projects/<id>/out/`, credits in `projects/<id>/credits.txt`.
- `studio/public/p/<id>/` – generated per build (timeline.json, narration.wav, music, images). Gitignored.
- `.cache/` – voice chunks, Openverse downloads and searches. Safe to delete; costs re-synthesis time.
- `vendor/claude-launchvideo` (MIT): reference Remotion film; `studio/src/lib/anim.ts` is adapted from it.
- `vendor/openverse`: Openverse source; we use its public API (`crates/vs/src/openverse.rs`).

## Contract between Rust and React

`Timeline` in `crates/vs/src/project.rs` and `studio/src/types.ts` must match (camelCase JSON).
Scene `visual` is opaque to Rust except `type` (timing rules for quiz/wyr/outro) and `imageQuery` (resolved to `image`).

## Commands

```sh
cargo build --release                 # the CLI
cd studio && npm install              # once
vs make <id> --draft                  # fast check: macOS voice, half res
vs make <id>                          # final: cloned voice
vs build <id> / vs render <id>        # separately
vs studio                             # Remotion Studio, live preview
vs say "text" -o test.wav             # voice test
vs search audio|images "query"        # Openverse
vs trends                             # topic ideas
vs channels / vs post <id> -c <id>    # AutoPost (env AUTOPOST_URL, AUTOPOST_API_KEY)
cd studio && npx tsc --noEmit         # typecheck
```

## Rules

- Openverse downloads are limited to CC0 / PDM / CC BY (no share-alike or non-commercial). Keep credits.
- Trend videos: write scripts fresh, never copy post or comment text from Reddit or elsewhere. Story cards stay unbranded.
- Avoid CSS `filter: blur()` on settled elements; it costs render time (only apply it while animating).
- The voice engine is the slow part (CPU, Intel Mac). Never invalidate the cache key casually (`chunk_key` in tts.rs).
