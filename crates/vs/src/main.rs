mod audio;
mod openverse;
mod pipeline;
mod post;
mod project;
mod trends;
mod tts;
mod util;

use anyhow::{Context, Result};
use clap::{Parser, Subcommand};
use std::path::PathBuf;
use tts::Engine;

/// Video Studio: React-frame videos with your cloned voice.
#[derive(Parser)]
#[command(name = "vs", version)]
struct Cli {
    #[command(subcommand)]
    cmd: Cmd,
}

#[derive(Subcommand)]
enum Cmd {
    /// Narrate, lip-sync, caption and fetch assets: project -> studio/public/p/<id>/timeline.json
    Build {
        /// Project id (projects/<id>), folder or project.json path
        project: String,
        /// Use macOS `say` instead of the cloned voice (instant, for checking visuals)
        #[arg(long)]
        draft_voice: bool,
        /// Parallel voice jobs (each VoxCPM2 process needs ~4.7 GB RAM)
        #[arg(long, short, default_value_t = 2)]
        jobs: usize,
        /// Skip Openverse downloads
        #[arg(long)]
        offline: bool,
    },
    /// Render the built timeline to projects/<id>/out/<id>.mp4
    Render {
        project: String,
        /// Half resolution, fast encode
        #[arg(long)]
        draft: bool,
        /// Parallel Chromium tabs (default: CPU threads - 1)
        #[arg(long, short)]
        concurrency: Option<usize>,
        /// Frame range, e.g. 0-90
        #[arg(long)]
        frames: Option<String>,
    },
    /// Build + render in one go
    Make {
        project: String,
        #[arg(long)]
        draft: bool,
        #[arg(long, short, default_value_t = 2)]
        jobs: usize,
        #[arg(long, short)]
        concurrency: Option<usize>,
        #[arg(long)]
        offline: bool,
    },
    /// Open Remotion Studio (live preview of every built project)
    Studio,
    /// Contact sheet of a rendered video (PNG grid, one frame every N seconds) for quick review
    Sheet {
        project: String,
        #[arg(long)]
        draft: bool,
        #[arg(long, default_value_t = 2.0)]
        every: f32,
    },
    /// Speak a line with the cloned voice into a WAV (voice test)
    Say {
        text: String,
        #[arg(long, short, default_value = "say.wav")]
        out: PathBuf,
        #[arg(long, default_value_t = 10)]
        timesteps: u32,
    },
    /// Search Openverse: vs search audio "lofi beat" / vs search images "server room"
    Search { kind: String, query: String },
    /// Trending topics for idea generation: Google Trends, Hacker News, top posts of subreddits
    Trends {
        /// Google Trends region
        #[arg(long, default_value = "US")]
        geo: String,
        /// Subreddits, comma separated
        #[arg(long, default_value = "todayilearned,AskReddit,programming,technology,interestingasfuck")]
        reddit: String,
        /// Reddit window: hour, day, week
        #[arg(long, default_value = "day")]
        window: String,
    },
    /// List AutoPost channels (integration ids for `vs post`)
    Channels,
    /// Upload the rendered video to AutoPost as a draft (or --when now / ISO date)
    Post {
        project: String,
        #[arg(long = "channel", short = 'c')]
        channels: Vec<String>,
        #[arg(long, default_value = "draft")]
        when: String,
        /// Caption; defaults to the project's `caption`
        #[arg(long)]
        caption: Option<String>,
        /// Provider settings JSON, e.g. '{"title":"...","type":"public"}'
        #[arg(long, default_value = "{}")]
        settings: String,
    },
}

fn main() -> Result<()> {
    let cli = Cli::parse();
    match cli.cmd {
        Cmd::Build { project, draft_voice, jobs, offline } => {
            pipeline::build(&project, engine(draft_voice), jobs, offline)?;
        }
        Cmd::Render { project, draft, concurrency, frames } => {
            pipeline::render(&project, &pipeline::RenderOpts { concurrency, draft, frames })?;
        }
        Cmd::Make { project, draft, jobs, concurrency, offline } => {
            pipeline::build(&project, engine(draft), jobs, offline)?;
            pipeline::render(&project, &pipeline::RenderOpts { concurrency, draft, frames: None })?;
        }
        Cmd::Studio => {
            let root = util::root()?;
            std::process::Command::new("npx").current_dir(root.join("studio")).args(["remotion", "studio"]).status()?;
        }
        Cmd::Sheet { project, draft, every } => {
            let (p, paths) = pipeline::resolve(&project)?;
            let name = if draft { format!("{}-draft", p.id) } else { p.id.clone() };
            let video = paths.project_dir.join("out").join(format!("{name}.mp4"));
            let out = paths.project_dir.join("out").join(format!("{name}-sheet.png"));
            let vf = format!("fps=1/{every},scale=240:-1,tile=8x3");
            util::run_ffmpeg(&["-i", video.to_str().unwrap(), "-vf", &vf, "-frames:v", "1", out.to_str().unwrap()])?;
            println!("{}", out.display());
        }
        Cmd::Say { text, out, timesteps } => {
            let root = util::root()?;
            let voice = tts::Voice::new(Engine::Clone, &root.join(".cache"))?;
            let settings = project::VoiceSettings { timesteps, ..Default::default() };
            let bufs = voice.narrate(&[Some(text)], &settings, 1)?;
            audio::write_mono(&out, bufs[0].as_ref().unwrap())?;
            util::log(format!("wrote {}", out.display()));
        }
        Cmd::Search { kind, query } => {
            let root = util::root()?;
            let kind = if kind.starts_with("im") { "images" } else { "audio" };
            for i in openverse::Client::new(&root.join(".cache"))?.search(kind, &query, "")? {
                println!(
                    "{}  {}  by {}  [{}]  {}{}",
                    i.id,
                    i.title.unwrap_or_default(),
                    i.creator.unwrap_or_default(),
                    i.license,
                    i.duration.map(|d| format!("{}s  ", d / 1000)).unwrap_or_default(),
                    i.url
                );
            }
        }
        Cmd::Trends { geo, reddit, window } => {
            let mut all = Vec::new();
            match trends::google(&geo) {
                Ok(v) => all.extend(v),
                Err(e) => util::log(format!("google trends: {e}")),
            }
            match trends::hackernews(12) {
                Ok(v) => all.extend(v),
                Err(e) => util::log(format!("hacker news: {e}")),
            }
            for sub in reddit.split(',').map(str::trim).filter(|s| !s.is_empty()) {
                match trends::reddit(sub, &window) {
                    Ok(v) => all.extend(v),
                    Err(e) => util::log(format!("r/{sub}: {e}")),
                }
            }
            for i in all {
                println!("[{}] {}  ({})  {}", i.source, i.title, i.score, i.url);
            }
        }
        Cmd::Channels => {
            let v = post::integrations()?;
            for i in v.as_array().cloned().unwrap_or_default() {
                println!("{}  {}  {}", i["id"].as_str().unwrap_or(""), i["identifier"].as_str().unwrap_or(""), i["name"].as_str().unwrap_or(""));
            }
        }
        Cmd::Post { project, channels, when, caption, settings } => {
            let (p, paths) = pipeline::resolve(&project)?;
            let file = paths.project_dir.join("out").join(format!("{}.mp4", p.id));
            let mut text = caption.or(p.caption.clone()).unwrap_or_default();
            if let Ok(credits) = std::fs::read_to_string(paths.project_dir.join("credits.txt")) {
                text.push_str("\n\nCredits:\n");
                text.push_str(&credits);
            }
            let settings: serde_json::Value = serde_json::from_str(&settings).context("--settings must be JSON")?;
            let r = post::post(&file, &text, &channels, &when, &settings)?;
            println!("{}", serde_json::to_string_pretty(&r)?);
        }
    }
    Ok(())
}

fn engine(draft: bool) -> Engine {
    if draft {
        Engine::Draft
    } else {
        Engine::Clone
    }
}
