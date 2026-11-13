# Video Studio

Short videos made from React frames and narrated in your own cloned voice. Claude writes the script and scenes, and you get an MP4 ready to post.

- **Explainer mode:** a small cartoon avatar, lip-synced to your voice, explains tech and programming with typed-out code, terminals, animated diagrams, bullets and stats.
- **Trend mode:** faceless viral formats for growth accounts: hook, quiz with countdown, would-you-rather, story card, countdown list and facts. They use Openverse photo backgrounds, big pop captions, a progress bar and SFX.

```
project.json ──vs build──▶ voice (VoxCPM2 clone, cached per sentence, parallel)
                          ├─ lip-sync envelope + word timings (Rust)
                          ├─ music + images from Openverse (CC0 / PD / CC BY, credited)
                          └─ timeline.json
timeline.json ──vs render──▶ Remotion: every frame is a React render, N Chromium tabs in parallel ──▶ MP4
MP4 ──vs post──▶ AutoPost (draft / now / scheduled)
```

## Setup

```sh
cargo build --release
(cd studio && npm install)
ln -sf "$PWD/scripts/vs" ~/.local/bin/vs
```

The voice comes from the local VoxCPM2 engine in `/Volumes/MacX/Apps/VoxCPM2`. The sample is `voice/me.wav` and its transcript `voice/me.txt`. To override, set `VOXCPM_DIR`, `VOICE_WAV` or `VOICE_TXT`. ffmpeg comes from `$FFMPEG`, then `PATH`, then the copy bundled with VoxCPM2.

## Make a video

Ask Claude in this folder, for example *"make an explainer about Rust lifetimes"* or *"make a would-you-rather video for the trend account"*. It follows `.claude/skills/make-video/SKILL.md`. To run the steps by hand:

```sh
vs make how-hashmaps-work --draft    # macOS voice, half res: check the visuals fast
vs sheet how-hashmaps-work --draft   # contact sheet PNG
vs make how-hashmaps-work            # your cloned voice, full quality
vs studio                            # live preview in Remotion Studio
```

Other commands: `vs say "text"` (voice test), `vs search audio "lofi"`, `vs trends`, `vs channels`, `vs post <id> -c <channel>`.

## Speed

- **Voice.** The bottleneck on this Intel i5 is the VoxCPM2 engine: roughly 40-60 s of compute per second of speech. To keep that down, `vs`:
  - uses the faster GPU backend instead of `--cpu`;
  - clones from a 10 s reference by default (`"clone": "full"` uses the whole sample and transcript);
  - runs 2 voice processes in parallel (`--jobs`, about 4.7 GB RAM each);
  - caches every sentence, so editing a scene only re-voices that line.

  Use `--draft` while you iterate.
- **Picture.** Remotion renders with one tab per CPU thread minus one, JPEG frames and an x264 `fast` preset. A 27 s 1080×1920 video takes about 3.5 min here; `--draft` (half res, ultrafast) takes about 1.5 min. Renders get faster on Apple Silicon or with more cores.

## Credits and licences

- [Remotion](https://remotion.dev) renders the frames. Its licence is free for individuals and companies of up to 3 people; larger teams need a company licence.
- `studio/src/lib/anim.ts` is adapted from [claude-launchvideo](https://github.com/Leonxlnx/claude-launchvideo) (MIT), which is in `vendor/`.
- Music and images come from [Openverse](https://openverse.org) ([source](https://github.com/WordPress/openverse), in `vendor/`). The filter allows only CC0, Public Domain Mark and CC BY, and each project's `credits.txt` is appended to the post caption.
- SFX in `studio/public/sfx` are from remotion.media.
- Claude skills in `.claude/skills`:
  - [remotion-dev/skills](https://github.com/remotion-dev/skills)
  - [LottieFiles motion-design](https://github.com/LottieFiles/motion-design-skill)
  - [emilkowalski/skills](https://github.com/emilkowalski/skills) (animation)
  - the `ig-*` Instagram skills copied from auto-post (MIT).
