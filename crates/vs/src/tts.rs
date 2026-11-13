//! Narration: cloned voice through the local VoxCPM2 engine (or macOS `say` for fast drafts).
//! Every sentence chunk is cached by a hash of text + voice sample + settings, so re-building a
//! project only synthesizes lines that changed. Chunks run in parallel (`--jobs`).

use crate::audio::{self, Mono, SR};
use crate::project::VoiceSettings;
use crate::util::{self, log};
use anyhow::{bail, Context, Result};
use rayon::prelude::*;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicUsize, Ordering};

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Engine {
    /// Your cloned voice (VoxCPM2, local, slow on CPU).
    Clone,
    /// macOS `say`: instant, robotic; for iterating on visuals before the final voice.
    Draft,
}

pub struct Voice {
    engine: Engine,
    cli: PathBuf,
    base: PathBuf,
    acoustic: PathBuf,
    ref_wav: PathBuf,
    ref_short: PathBuf,
    ref_text: Option<String>,
    voice_key: String,
    cache: PathBuf,
}

impl Voice {
    pub fn new(engine: Engine, cache_root: &Path) -> Result<Self> {
        let dir = util::voxcpm_dir();
        let sample = std::env::var("VOICE_WAV")
            .map(PathBuf::from)
            .unwrap_or_else(|_| dir.join("voice/me.wav"));
        let text_path = std::env::var("VOICE_TXT")
            .map(PathBuf::from)
            .unwrap_or_else(|_| sample.with_extension("txt"));
        let cache = cache_root.join("tts");
        std::fs::create_dir_all(&cache)?;

        let (voice_key, ref_wav, ref_short, ref_text) = if engine == Engine::Clone {
            if !sample.exists() {
                bail!("voice sample not found: {} (set VOICE_WAV)", sample.display());
            }
            let key = util::file_sha(&sample)?;
            let ref_wav = cache_root.join(format!("voice/ref-{key}.wav"));
            if !ref_wav.exists() {
                std::fs::create_dir_all(ref_wav.parent().unwrap())?;
                log("preparing voice reference (mono 48 kHz, silence trimmed)");
                util::run_ffmpeg(&[
                    "-i",
                    sample.to_str().unwrap(),
                    "-ac",
                    "1",
                    "-ar",
                    "48000",
                    "-af",
                    "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse",
                    ref_wav.to_str().unwrap(),
                ])?;
            }
            let short = cache_root.join(format!("voice/ref-{key}-10s.wav"));
            if !short.exists() {
                util::run_ffmpeg(&["-i", ref_wav.to_str().unwrap(), "-t", "10", short.to_str().unwrap()])?;
            }
            let text = std::fs::read_to_string(&text_path).ok().map(|t| t.trim().to_string()).filter(|t| !t.is_empty());
            (key, ref_wav, short, text)
        } else {
            ("say".to_string(), PathBuf::new(), PathBuf::new(), None)
        };

        Ok(Self {
            engine,
            cli: dir.join("engine/voxcpm2-cli"),
            base: dir.join("models/VoxCPM2-BaseLM-F16.gguf"),
            acoustic: dir.join("models/VoxCPM2-Acoustic-F16.gguf"),
            ref_wav,
            ref_short,
            ref_text,
            voice_key,
            cache,
        })
    }

    fn chunk_key(&self, text: &str, s: &VoiceSettings) -> String {
        let settings = format!("{:?}|{}|{}|{}|{}", self.engine, s.timesteps, s.cfg, s.seed, s.clone);
        util::sha(&[text.as_bytes(), self.voice_key.as_bytes(), settings.as_bytes(), b"v2"])
    }

    /// Synthesizes every scene's lines and returns one mono 48 kHz buffer per scene (None = silent).
    pub fn narrate(&self, lines: &[Option<String>], s: &VoiceSettings, jobs: usize) -> Result<Vec<Option<Mono>>> {
        // Flatten scenes -> sentence chunks so all of them share one job pool.
        let per_scene: Vec<Vec<String>> = lines
            .iter()
            .map(|l| l.as_deref().map(split_chunks).unwrap_or_default())
            .collect();
        let mut todo: Vec<(String, PathBuf)> = Vec::new();
        for chunk in per_scene.iter().flatten() {
            let path = self.cache.join(format!("{}.wav", self.chunk_key(chunk, s)));
            if !path.exists() && !todo.iter().any(|(_, p)| p == &path) {
                todo.push((chunk.clone(), path));
            }
        }
        let total = per_scene.iter().map(|v| v.len()).sum::<usize>();
        let shown_jobs = if self.engine == Engine::Draft { std::thread::available_parallelism().map(|n| n.get()).unwrap_or(4) } else { jobs };
        log(format!(
            "voice ({:?}): {} chunk(s), {} cached, {} to synthesize with {} job(s)",
            self.engine,
            total,
            total - todo.len(),
            todo.len(),
            shown_jobs
        ));

        // `say` is light: use every core. VoxCPM2 is heavy (~4.7 GB each): respect --jobs.
        let jobs = if self.engine == Engine::Draft { std::thread::available_parallelism().map(|n| n.get()).unwrap_or(4) } else { jobs };
        let done = AtomicUsize::new(0);
        let n = todo.len();
        let pool = rayon::ThreadPoolBuilder::new().num_threads(jobs.max(1)).build()?;
        pool.install(|| {
            todo.par_iter().try_for_each(|(text, path)| -> Result<()> {
                let t0 = std::time::Instant::now();
                self.synthesize(text, s, path)?;
                let k = done.fetch_add(1, Ordering::SeqCst) + 1;
                log(format!("  [{k}/{n}] {:.1}s  {}", t0.elapsed().as_secs_f32(), preview(text)));
                Ok(())
            })
        })?;

        per_scene
            .iter()
            .map(|chunks| {
                if chunks.is_empty() {
                    return Ok(None);
                }
                let mut out: Mono = Vec::new();
                for (i, c) in chunks.iter().enumerate() {
                    let path = self.cache.join(format!("{}.wav", self.chunk_key(c, s)));
                    let samples = audio::trim_silence(&audio::read_mono(&path)?);
                    if i > 0 {
                        out.extend(std::iter::repeat(0.0).take((s.sentence_gap * SR as f32) as usize));
                    }
                    out.extend(samples);
                }
                Ok(Some(out))
            })
            .collect()
    }

    fn synthesize(&self, text: &str, s: &VoiceSettings, out: &Path) -> Result<()> {
        let raw = out.with_extension("raw.wav");
        match self.engine {
            Engine::Clone => {
                let mut cmd = Command::new(&self.cli);
                // The default (GPU) backend measured ~1.6x faster than --cpu on this Intel Mac.
                if std::env::var("VOXCPM_CPU").is_ok() {
                    cmd.arg("--cpu");
                }
                cmd.args(["-t", text]);
                match (&self.ref_text, s.clone.as_str()) {
                    (Some(t), "full") => cmd.args(["--prompt-wav", self.ref_wav.to_str().unwrap(), "--prompt-text", t]),
                    (None, "full") => cmd.args(["-r", self.ref_wav.to_str().unwrap()]),
                    _ => cmd.args(["-r", self.ref_short.to_str().unwrap()]),
                };
                cmd.args(["--timesteps", &s.timesteps.to_string()])
                    .args(["--cfg", &s.cfg.to_string()])
                    .args(["--seed", &s.seed.to_string()])
                    .args(["-o", raw.to_str().unwrap()])
                    .arg(&self.base)
                    .arg(&self.acoustic);
                let o = cmd.output().with_context(|| format!("running {}", self.cli.display()))?;
                if !o.status.success() || !raw.exists() {
                    bail!("voxcpm2-cli failed on {:?}: {}", preview(text), String::from_utf8_lossy(&o.stderr));
                }
            }
            Engine::Draft => {
                let aiff = out.with_extension("aiff");
                let o = Command::new("say").args(["-o", aiff.to_str().unwrap(), text]).output()?;
                if !o.status.success() {
                    bail!("say failed: {}", String::from_utf8_lossy(&o.stderr));
                }
                util::run_ffmpeg(&["-i", aiff.to_str().unwrap(), raw.to_str().unwrap()])?;
                let _ = std::fs::remove_file(aiff);
            }
        }
        // Normalize to the house format: mono, 48 kHz, 16 bit.
        let tmp = out.with_extension("tmp.wav");
        util::run_ffmpeg(&["-i", raw.to_str().unwrap(), "-ac", "1", "-ar", "48000", "-c:a", "pcm_s16le", tmp.to_str().unwrap()])?;
        std::fs::rename(&tmp, out)?;
        let _ = std::fs::remove_file(raw);
        Ok(())
    }
}

/// Splits text into sentence groups of at most ~250 characters; the model is stable on short input.
pub fn split_chunks(text: &str) -> Vec<String> {
    let text = text.split_whitespace().collect::<Vec<_>>().join(" ");
    let mut sentences = Vec::new();
    let mut cur = String::new();
    let chars: Vec<char> = text.chars().collect();
    for (i, c) in chars.iter().enumerate() {
        cur.push(*c);
        let end = matches!(c, '.' | '!' | '?') && chars.get(i + 1).map_or(true, |n| *n == ' ');
        if end {
            sentences.push(cur.trim().to_string());
            cur.clear();
        }
    }
    if !cur.trim().is_empty() {
        sentences.push(cur.trim().to_string());
    }
    let mut chunks: Vec<String> = Vec::new();
    for s in sentences {
        match chunks.last_mut() {
            Some(last) if last.len() + s.len() < 250 && last.len() < 120 => {
                last.push(' ');
                last.push_str(&s);
            }
            _ => chunks.push(s),
        }
    }
    chunks
}

fn preview(t: &str) -> String {
    let p: String = t.chars().take(60).collect();
    if t.chars().count() > 60 {
        format!("{p}…")
    } else {
        p
    }
}
