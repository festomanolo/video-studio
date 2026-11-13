//! `vs build`: project.json -> narration, lip-sync, captions, assets -> timeline.json for Remotion.
//! `vs render`: timeline.json -> MP4 through Remotion (React frames, rendered in parallel).

use crate::audio::{self, SR};
use crate::openverse;
use crate::project::*;
use crate::tts::{Engine, Voice};
use crate::util::{self, log};
use anyhow::{bail, Context, Result};
use serde_json::Value;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Instant;

pub struct Paths {
    pub root: PathBuf,
    pub project_dir: PathBuf,
    pub public_dir: PathBuf,
    /// Path of the public dir relative to studio/public (what React's staticFile() takes).
    pub public_rel: String,
    pub cache: PathBuf,
}

pub fn resolve(target: &str) -> Result<(Project, Paths)> {
    let root = util::root()?;
    let file = {
        let p = PathBuf::from(target);
        if p.is_file() {
            p
        } else if p.join("project.json").is_file() {
            p.join("project.json")
        } else {
            root.join("projects").join(target).join("project.json")
        }
    };
    let project: Project = serde_json::from_slice(&std::fs::read(&file).with_context(|| format!("reading {}", file.display()))?)
        .with_context(|| format!("parsing {}", file.display()))?;
    if project.id.is_empty() || !project.id.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-') {
        bail!("project id must be [a-z0-9-]: {:?}", project.id);
    }
    let public_rel = format!("p/{}", project.id);
    let paths = Paths {
        project_dir: file.parent().unwrap().to_path_buf(),
        public_dir: root.join("studio/public").join(&public_rel),
        public_rel,
        cache: root.join(".cache"),
        root,
    };
    Ok((project, paths))
}

pub fn build(target: &str, engine: Engine, jobs: usize, offline: bool) -> Result<PathBuf> {
    let t0 = Instant::now();
    let (project, paths) = resolve(target)?;
    std::fs::create_dir_all(&paths.public_dir)?;
    let fps = project.fps;
    let (width, height) = dimensions(&project.format);
    log(format!("building {} ({} {}x{} @ {fps} fps, {} scenes)", project.id, project.mode, width, height, project.scenes.len()));

    // 1. Narration, one buffer per scene, cached per sentence.
    let voice = Voice::new(engine, &paths.cache)?;
    let lines: Vec<Option<String>> = project
        .scenes
        .iter()
        .map(|s| s.say.clone().filter(|t| !t.trim().is_empty()))
        .collect();
    let buffers = voice.narrate(&lines, &project.voice, jobs)?;

    // 2. Scene timing from the speech lengths.
    const LEAD: f32 = 0.18;
    const TAIL: f32 = 0.42;
    let mut cursor = 0.0f32;
    let mut narration: Vec<f32> = Vec::new();
    let mut scenes = Vec::new();
    let mut words = Vec::new();
    for (i, (spec, buf)) in project.scenes.iter().zip(&buffers).enumerate() {
        let start = cursor;
        let (speech_start, speech_end, mut end) = match buf {
            Some(b) => {
                let ss = start + LEAD;
                let se = ss + b.len() as f32 / SR as f32;
                let at = (ss * SR as f32) as usize;
                if narration.len() < at + b.len() {
                    narration.resize(at + b.len(), 0.0);
                }
                narration[at..at + b.len()].iter_mut().zip(b).for_each(|(d, s)| *d += s);
                for (w, a, e) in audio::align_words(spec.say.as_deref().unwrap_or(""), b) {
                    words.push(Word { text: w, start: ss + a, end: ss + e, scene: i });
                }
                (Some(ss), Some(se), se + TAIL)
            }
            None => (None, None, start + 2.5),
        };
        // Formats that keep going after the voice stops: quiz countdown + reveal, vote bars.
        let after_speech = match spec.visual.get("type").and_then(|t| t.as_str()) {
            Some("quiz") => spec.visual.get("countdown").and_then(|c| c.as_f64()).unwrap_or(3.0) as f32 + 1.6,
            Some("wyr") => 2.2,
            Some("outro") => 1.0,
            _ => 0.0,
        };
        if after_speech > 0.0 {
            end = speech_end.unwrap_or(start) + after_speech;
        }
        if let Some(h) = spec.hold {
            end = end.max(start + h);
        }
        // Snap scene boundaries to whole frames so React and audio agree exactly.
        end = (end * fps as f32).round() / fps as f32;
        scenes.push(TimedScene { index: i, start, end, speech_start, speech_end, say: spec.say.clone(), visual: spec.visual.clone() });
        cursor = end;
    }
    let duration = cursor;
    let frames = (duration * fps as f32).ceil() as u32;

    // 3. Master the narration (same chain as VoxCPM2's podcast.sh, at a social-media -14 LUFS).
    let narration_file = if narration.is_empty() {
        None
    } else {
        narration.resize((duration * SR as f32) as usize + SR as usize, 0.0);
        let raw = paths.public_dir.join("narration.raw.wav");
        let master = paths.public_dir.join("narration.wav");
        audio::write_mono(&raw, &narration)?;
        util::run_ffmpeg(&[
            "-i",
            raw.to_str().unwrap(),
            "-af",
            "highpass=f=70,equalizer=f=110:t=q:w=1.0:g=3,equalizer=f=320:t=q:w=1.2:g=-2.5,equalizer=f=3200:t=q:w=1.0:g=2,equalizer=f=7000:t=q:w=2.0:g=-2,acompressor=threshold=-20dB:ratio=3:attack=10:release=150:makeup=2,loudnorm=I=-14:TP=-1.5:LRA=7",
            "-ar",
            "48000",
            "-ac",
            "1",
            "-c:a",
            "pcm_s16le",
            master.to_str().unwrap(),
        ])?;
        let _ = std::fs::remove_file(raw);
        Some(master)
    };
    let mouth = match &narration_file {
        Some(f) => audio::mouth_envelope(&audio::read_mono(f)?, fps, frames),
        None => vec![0; frames as usize],
    };

    // 4. Openverse assets: music bed, background, per-scene images.
    let mut credits: Vec<Credit> = Vec::new();
    let ov = if offline { None } else { Some(openverse::Client::new(&paths.cache)?) };
    let aspect = match project.format.as_str() {
        "landscape" => "wide",
        "square" => "square",
        _ => "tall",
    };
    let music = match &project.music {
        Some(m) => {
            let file = if let Some(f) = &m.file {
                let src = if Path::new(f).is_absolute() { PathBuf::from(f) } else { paths.project_dir.join(f) };
                let ext = src.extension().and_then(|e| e.to_str()).unwrap_or("mp3");
                let dest = paths.public_dir.join(format!("music.{ext}"));
                std::fs::copy(&src, &dest).with_context(|| format!("copying {}", src.display()))?;
                Some(dest)
            } else if let (Some(q), Some(ov)) = (&m.query, &ov) {
                match ov.music(q, duration, &paths.public_dir) {
                    Ok((p, c)) => {
                        credits.push(c);
                        Some(p)
                    }
                    Err(e) => {
                        log(format!("music skipped: {e}"));
                        None
                    }
                }
            } else {
                None
            };
            file.map(|f| MusicTrack { src: rel(&paths, &f), volume: m.volume })
        }
        None => None,
    };
    let background = match (&project.background_query, &ov) {
        (Some(q), Some(ov)) => match ov.image(q, aspect, &paths.public_dir, "background") {
            Ok((p, c)) => {
                credits.push(c);
                Some(rel(&paths, &p))
            }
            Err(e) => {
                log(format!("background skipped: {e}"));
                None
            }
        },
        _ => None,
    };
    if let Some(ov) = &ov {
        let mut n = 0;
        for s in scenes.iter_mut() {
            resolve_images(&mut s.visual, ov, aspect, &paths, &mut credits, &mut n);
        }
    }

    // Credits next to the project, ready to paste into the post description.
    if !credits.is_empty() {
        let txt: String = credits
            .iter()
            .map(|c| {
                format!(
                    "{} \"{}\" by {} ({}{}) {}\n",
                    c.kind,
                    c.title,
                    c.creator.as_deref().unwrap_or("unknown"),
                    c.license,
                    c.license_url.as_ref().map(|u| format!(", {u}")).unwrap_or_default(),
                    c.source_url.as_deref().unwrap_or("")
                )
            })
            .collect();
        std::fs::write(paths.project_dir.join("credits.txt"), txt)?;
    }

    let timeline = Timeline {
        id: project.id.clone(),
        mode: project.mode.clone(),
        format: project.format.clone(),
        template: project.template.clone(),
        fps,
        width,
        height,
        duration_in_frames: frames,
        theme: project.theme.clone(),
        narration: narration_file.as_ref().map(|f| rel(&paths, f)),
        music,
        background,
        avatar: project.avatar.clone(),
        mouth,
        words,
        scenes,
        credits,
    };
    let out = paths.public_dir.join("timeline.json");
    std::fs::write(&out, serde_json::to_vec(&timeline)?)?;
    log(format!("timeline: {} ({duration:.1}s, {frames} frames) in {:.1}s", out.display(), t0.elapsed().as_secs_f32()));
    Ok(out)
}

fn rel(paths: &Paths, f: &Path) -> String {
    format!("{}/{}", paths.public_rel, f.file_name().unwrap().to_string_lossy())
}

/// Any `"imageQuery": "..."` inside a visual becomes `"image": "p/<id>/img-N.jpg"`.
fn resolve_images(v: &mut Value, ov: &openverse::Client, aspect: &str, paths: &Paths, credits: &mut Vec<Credit>, n: &mut usize) {
    match v {
        Value::Object(map) => {
            if let Some(Value::String(q)) = map.get("imageQuery").cloned() {
                if !map.contains_key("image") {
                    *n += 1;
                    match ov.image(&q, aspect, &paths.public_dir, &format!("img-{n}")) {
                        Ok((p, c)) => {
                            credits.push(c);
                            map.insert("image".into(), Value::String(rel(paths, &p)));
                        }
                        Err(e) => log(format!("image {q:?} skipped: {e}")),
                    }
                }
            }
            for (_, child) in map.iter_mut() {
                resolve_images(child, ov, aspect, paths, credits, n);
            }
        }
        Value::Array(items) => items.iter_mut().for_each(|c| resolve_images(c, ov, aspect, paths, credits, n)),
        _ => {}
    }
}

pub struct RenderOpts {
    pub concurrency: Option<usize>,
    pub draft: bool,
    pub frames: Option<String>,
}

pub fn render(target: &str, o: &RenderOpts) -> Result<PathBuf> {
    let t0 = Instant::now();
    let (project, paths) = resolve(target)?;
    if !paths.public_dir.join("timeline.json").exists() {
        bail!("no timeline yet, run `vs build {target}` first");
    }
    let out_dir = paths.project_dir.join("out");
    std::fs::create_dir_all(&out_dir)?;
    let out = out_dir.join(if o.draft { format!("{}-draft.mp4", project.id) } else { format!("{}.mp4", project.id) });
    let threads = std::thread::available_parallelism().map(|n| n.get()).unwrap_or(4);
    let concurrency = o.concurrency.unwrap_or(threads.saturating_sub(1).max(1));
    let studio = paths.root.join("studio");
    let mut cmd = Command::new("npx");
    cmd.current_dir(&studio)
        // Root.tsx registers one composition per built project, named by its id.
        .args(["remotion", "render", "src/index.ts", &project.id])
        .arg(&out)
        .arg(format!("--concurrency={concurrency}"))
        .args(["--codec=h264", "--image-format=jpeg", "--audio-codec=aac", "--audio-bitrate=192k"]);
    if o.draft {
        // Half resolution, fast encode: for checking timing and layout.
        cmd.args(["--scale=0.5", "--jpeg-quality=70", "--x264-preset=ultrafast", "--crf=28"]);
    } else {
        cmd.args(["--jpeg-quality=95", "--x264-preset=slow", "--crf=16"]);
    }
    if let Some(f) = &o.frames {
        cmd.arg(format!("--frames={f}"));
    }
    log(format!("rendering {} with {concurrency} parallel tabs{}", out.display(), if o.draft { " (draft)" } else { "" }));
    let st = cmd.status().context("running npx remotion render (did you run `npm install` in studio/?)")?;
    if !st.success() {
        bail!("remotion render failed");
    }
    log(format!("done in {:.1}s: {}", t0.elapsed().as_secs_f32(), out.display()));
    Ok(out)
}
