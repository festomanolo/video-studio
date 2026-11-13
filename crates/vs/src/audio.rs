//! Audio in plain Rust: WAV I/O, silence trimming, the per-frame mouth envelope that drives the
//! avatar's lip-sync, and word timing for captions (energy-guided forced alignment).

use anyhow::{Context, Result};
use std::path::Path;

pub const SR: u32 = 48_000;
pub type Mono = Vec<f32>;

pub fn read_mono(path: &Path) -> Result<Mono> {
    let mut r = hound::WavReader::open(path).with_context(|| format!("opening {}", path.display()))?;
    let spec = r.spec();
    let ch = spec.channels as usize;
    let raw: Vec<f32> = match spec.sample_format {
        hound::SampleFormat::Float => r.samples::<f32>().collect::<Result<_, _>>()?,
        hound::SampleFormat::Int => {
            let scale = 1.0 / (1i64 << (spec.bits_per_sample - 1)) as f32;
            r.samples::<i32>().map(|s| s.map(|v| v as f32 * scale)).collect::<Result<_, _>>()?
        }
    };
    Ok(raw.chunks(ch).map(|f| f.iter().sum::<f32>() / ch as f32).collect())
}

pub fn write_mono(path: &Path, samples: &[f32]) -> Result<()> {
    let spec = hound::WavSpec { channels: 1, sample_rate: SR, bits_per_sample: 16, sample_format: hound::SampleFormat::Int };
    let mut w = hound::WavWriter::create(path, spec)?;
    for s in samples {
        w.write_sample((s.clamp(-1.0, 1.0) * 32767.0) as i16)?;
    }
    w.finalize()?;
    Ok(())
}

/// RMS per window of `win` samples.
fn rms_frames(s: &[f32], win: usize) -> Vec<f32> {
    s.chunks(win)
        .map(|c| (c.iter().map(|x| x * x).sum::<f32>() / c.len().max(1) as f32).sqrt())
        .collect()
}

fn db(x: f32) -> f32 {
    20.0 * (x.max(1e-6)).log10()
}

/// Cuts leading/trailing silence (below -42 dBFS in 10 ms windows), keeping 40 ms of air.
pub fn trim_silence(s: &[f32]) -> Mono {
    let win = (SR / 100) as usize;
    let r = rms_frames(s, win);
    let loud = |v: &f32| db(*v) > -42.0;
    let (Some(a), Some(b)) = (r.iter().position(loud), r.iter().rposition(loud)) else {
        return s.to_vec();
    };
    let pad = 4;
    let start = a.saturating_sub(pad) * win;
    let end = ((b + 1 + pad) * win).min(s.len());
    s[start..end].to_vec()
}

/// Mouth openness 0..100 for every video frame. Fast attack, slower release, so the mouth
/// snaps open on syllables and relaxes between them like a cartoon.
pub fn mouth_envelope(s: &[f32], fps: u32, frames: u32) -> Vec<u8> {
    let hop = SR as f32 / fps as f32;
    let mut out = Vec::with_capacity(frames as usize);
    let mut level = 0.0f32;
    for f in 0..frames {
        let c = (f as f32 * hop) as usize;
        let a = c.saturating_sub(hop as usize / 2);
        let b = (c + hop as usize / 2).min(s.len());
        let v = if a < b { (s[a..b].iter().map(|x| x * x).sum::<f32>() / (b - a) as f32).sqrt() } else { 0.0 };
        let target = ((db(v) + 46.0) / 30.0).clamp(0.0, 1.0);
        level = if target > level { level + (target - level) * 0.75 } else { level + (target - level) * 0.45 };
        out.push((level * 100.0).round() as u8);
    }
    out
}

/// Distributes the words of `text` over the voiced parts of `s` (scene-local seconds).
/// Words are weighted by length (+ a bonus after punctuation), mapped onto the timeline of
/// voiced 10 ms windows only, so no word lands inside a pause.
pub fn align_words(text: &str, s: &[f32]) -> Vec<(String, f32, f32)> {
    let words: Vec<&str> = text.split_whitespace().collect();
    if words.is_empty() {
        return vec![];
    }
    let win = (SR / 100) as usize;
    let r = rms_frames(s, win);
    let peak = r.iter().cloned().fold(0.0f32, f32::max);
    let thresh = (peak * 0.08).max(10f32.powf(-40.0 / 20.0));
    let mut voiced: Vec<bool> = r.iter().map(|v| *v > thresh).collect();
    // Close tiny gaps (< 80 ms) inside words.
    let mut i = 0;
    while i < voiced.len() {
        if !voiced[i] {
            let j = (i..voiced.len()).find(|&k| voiced[k]).unwrap_or(voiced.len());
            if i > 0 && j < voiced.len() && j - i < 8 {
                voiced[i..j].iter_mut().for_each(|v| *v = true);
            }
            i = j;
        } else {
            i += 1;
        }
    }
    let idx: Vec<usize> = voiced.iter().enumerate().filter(|(_, v)| **v).map(|(i, _)| i).collect();
    if idx.is_empty() {
        let d = s.len() as f32 / SR as f32 / words.len() as f32;
        return words.iter().enumerate().map(|(i, w)| (w.to_string(), i as f32 * d, (i + 1) as f32 * d)).collect();
    }
    let weights: Vec<f32> = words
        .iter()
        .map(|w| {
            let letters = w.chars().filter(|c| c.is_alphanumeric()).count().max(1) as f32;
            letters + 1.5
        })
        .collect();
    let total: f32 = weights.iter().sum();
    let n = idx.len() as f32;
    let at = |pos: f32| -> f32 {
        let k = (pos.clamp(0.0, n - 1.0)) as usize;
        idx[k] as f32 * 0.01
    };
    let mut acc = 0.0;
    words
        .iter()
        .zip(weights)
        .map(|(w, wt)| {
            let a = acc / total * n;
            acc += wt;
            let b = acc / total * n;
            (w.to_string(), at(a), at(b - 1.0) + 0.01)
        })
        .collect()
}
