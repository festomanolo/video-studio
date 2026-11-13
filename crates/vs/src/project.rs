//! The project file a video is described in (`projects/<id>/project.json`) and the
//! timeline the Rust side hands to the Remotion side (`studio/public/p/<id>/timeline.json`).
//! The TypeScript mirror of `Timeline` lives in `studio/src/types.ts`; keep them in sync.

use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    /// "explainer" (avatar teaches tech) or "trend" (faceless, viral formats).
    #[serde(default = "default_mode")]
    pub mode: String,
    /// "vertical" (1080x1920), "landscape" (1920x1080) or "square" (1080x1080).
    #[serde(default = "default_format")]
    pub format: String,
    #[serde(default = "default_fps")]
    pub fps: u32,
    #[serde(default)]
    pub theme: Option<String>,
    /// Trend template: story | toplist | quiz | wyr | facts. Ignored for explainers.
    #[serde(default)]
    pub template: Option<String>,
    #[serde(default)]
    pub voice: VoiceSettings,
    #[serde(default)]
    pub music: Option<MusicSpec>,
    /// Passed through to the avatar component untouched.
    #[serde(default)]
    pub avatar: Option<Value>,
    /// Openverse image query used as the full-frame background (trend videos).
    #[serde(default)]
    pub background_query: Option<String>,
    /// Post caption + hashtags used by `vs post`.
    #[serde(default)]
    pub caption: Option<String>,
    pub scenes: Vec<SceneSpec>,
}

fn default_mode() -> String {
    "explainer".into()
}
fn default_format() -> String {
    "vertical".into()
}
fn default_fps() -> u32 {
    30
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VoiceSettings {
    #[serde(default = "default_timesteps")]
    pub timesteps: u32,
    #[serde(default = "default_cfg")]
    pub cfg: f32,
    #[serde(default = "default_seed")]
    pub seed: u64,
    /// Seconds of silence between sentences inside one scene.
    #[serde(default = "default_gap")]
    pub sentence_gap: f32,
    /// "fast": first 10 s of the sample as reference (about 2x quicker).
    /// "full": whole sample + its transcript (VoxCPM2 "ultimate cloning", closest match, slowest).
    #[serde(default = "default_clone")]
    pub clone: String,
}

fn default_clone() -> String {
    "fast".into()
}

fn default_timesteps() -> u32 {
    10
}
fn default_cfg() -> f32 {
    2.0
}
fn default_seed() -> u64 {
    42
}
fn default_gap() -> f32 {
    0.22
}

impl Default for VoiceSettings {
    fn default() -> Self {
        Self {
            timesteps: default_timesteps(),
            cfg: default_cfg(),
            seed: default_seed(),
            sentence_gap: default_gap(),
            clone: default_clone(),
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MusicSpec {
    /// Openverse audio search, e.g. "lofi chill beat".
    #[serde(default)]
    pub query: Option<String>,
    /// Or a local file (absolute, or relative to the project folder).
    #[serde(default)]
    pub file: Option<String>,
    #[serde(default = "default_music_volume")]
    pub volume: f32,
}

fn default_music_volume() -> f32 {
    0.09
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SceneSpec {
    /// What the voice says during this scene. Empty = silent scene.
    #[serde(default)]
    pub say: Option<String>,
    /// Minimum scene length in seconds (silent scenes use this as their length).
    #[serde(default)]
    pub hold: Option<f32>,
    /// What is on screen. Free-form; the `type` field selects a React component.
    /// A string field `imageQuery` is resolved to a downloaded Openverse image (`image`).
    pub visual: Value,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Timeline {
    pub id: String,
    pub mode: String,
    pub format: String,
    pub template: Option<String>,
    pub fps: u32,
    pub width: u32,
    pub height: u32,
    pub duration_in_frames: u32,
    pub theme: Option<String>,
    pub narration: Option<String>,
    pub music: Option<MusicTrack>,
    pub background: Option<String>,
    pub avatar: Option<Value>,
    /// Mouth openness per video frame, 0..100.
    pub mouth: Vec<u8>,
    pub words: Vec<Word>,
    pub scenes: Vec<TimedScene>,
    pub credits: Vec<Credit>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MusicTrack {
    pub src: String,
    pub volume: f32,
}

#[derive(Debug, Clone, Serialize)]
pub struct Word {
    pub text: String,
    /// Seconds from the start of the video.
    pub start: f32,
    pub end: f32,
    pub scene: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TimedScene {
    pub index: usize,
    pub start: f32,
    pub end: f32,
    /// When speech starts/ends inside the scene (absolute seconds), if any.
    pub speech_start: Option<f32>,
    pub speech_end: Option<f32>,
    pub say: Option<String>,
    pub visual: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Credit {
    pub kind: String,
    pub title: String,
    pub creator: Option<String>,
    pub license: String,
    pub license_url: Option<String>,
    pub source_url: Option<String>,
    pub file: String,
}

pub fn dimensions(format: &str) -> (u32, u32) {
    match format {
        "landscape" => (1920, 1080),
        "square" => (1080, 1080),
        _ => (1080, 1920),
    }
}
