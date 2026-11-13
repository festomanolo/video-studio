use anyhow::{bail, Context, Result};
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use std::process::Command;

/// Repository root: $VS_ROOT, else the first ancestor of the cwd (or of the binary) that has `studio/`.
pub fn root() -> Result<PathBuf> {
    if let Ok(r) = std::env::var("VS_ROOT") {
        return Ok(PathBuf::from(r));
    }
    let mut starts = vec![std::env::current_dir()?];
    if let Ok(exe) = std::env::current_exe() {
        starts.push(exe);
    }
    for start in starts {
        let mut p: Option<&Path> = Some(start.as_path());
        while let Some(dir) = p {
            if dir.join("studio").join("package.json").exists() && dir.join("crates").exists() {
                return Ok(dir.to_path_buf());
            }
            p = dir.parent();
        }
    }
    bail!("could not find the video-studio root; run inside the repo or set VS_ROOT")
}

pub fn voxcpm_dir() -> PathBuf {
    std::env::var("VOXCPM_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("/Volumes/MacX/Apps/VoxCPM2"))
}

/// ffmpeg: $FFMPEG, then PATH, then the binary that ships with VoxCPM2.
pub fn ffmpeg() -> Result<PathBuf> {
    if let Ok(f) = std::env::var("FFMPEG") {
        return Ok(PathBuf::from(f));
    }
    if let Ok(out) = Command::new("which").arg("ffmpeg").output() {
        let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
        if out.status.success() && !s.is_empty() {
            return Ok(PathBuf::from(s));
        }
    }
    let bundled = voxcpm_dir().join("ffmpeg");
    if bundled.exists() {
        return Ok(bundled);
    }
    bail!("ffmpeg not found: set FFMPEG or install it")
}

pub fn run_ffmpeg(args: &[&str]) -> Result<()> {
    let ff = ffmpeg()?;
    let out = Command::new(&ff)
        .args(["-hide_banner", "-loglevel", "error", "-y"])
        .args(args)
        .output()
        .with_context(|| format!("running {}", ff.display()))?;
    if !out.status.success() {
        bail!("ffmpeg failed: {}", String::from_utf8_lossy(&out.stderr));
    }
    Ok(())
}

pub fn sha(parts: &[&[u8]]) -> String {
    let mut h = Sha256::new();
    for p in parts {
        h.update((p.len() as u64).to_le_bytes());
        h.update(p);
    }
    hex::encode(&h.finalize()[..12])
}

pub fn file_sha(path: &Path) -> Result<String> {
    let bytes = std::fs::read(path).with_context(|| format!("reading {}", path.display()))?;
    Ok(sha(&[&bytes]))
}

pub fn log(msg: impl AsRef<str>) {
    eprintln!("\x1b[1;35m[vs]\x1b[0m {}", msg.as_ref());
}
