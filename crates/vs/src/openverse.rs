//! Openverse (https://openverse.org, source in vendor/openverse): openly licensed audio for
//! music beds and images for backgrounds. Only CC0, Public Domain Mark and CC BY are requested:
//! they allow commercial use and editing, and (unlike BY-SA) don't force a licence onto the
//! video. CC BY needs attribution, so every file gets a credit line (credits.txt, `vs post`).
//!
//! Anonymous access works with a low rate limit. For more, register an app
//! (POST /v1/auth_tokens/register/) and set OPENVERSE_CLIENT_ID / OPENVERSE_CLIENT_SECRET.

use crate::project::Credit;
use crate::util::{self, log};
use anyhow::{bail, Context, Result};
use serde::Deserialize;
use serde_json::Value;
use std::io::Read;
use std::path::{Path, PathBuf};

const API: &str = "https://api.openverse.org/v1";
const UA: &str = "video-studio/0.1 (local video renderer)";

#[derive(Debug, Deserialize, Clone)]
pub struct Item {
    pub id: String,
    pub title: Option<String>,
    pub url: String,
    pub creator: Option<String>,
    pub license: String,
    pub license_version: Option<String>,
    pub license_url: Option<String>,
    pub foreign_landing_url: Option<String>,
    /// Audio only, milliseconds.
    pub duration: Option<u64>,
    pub filetype: Option<String>,
}

pub struct Client {
    agent: ureq::Agent,
    token: Option<String>,
    cache: PathBuf,
}

impl Client {
    pub fn new(cache_root: &Path) -> Result<Self> {
        let agent = ureq::AgentBuilder::new().user_agent(UA).timeout(std::time::Duration::from_secs(60)).build();
        let cache = cache_root.join("openverse");
        std::fs::create_dir_all(&cache)?;
        let token = match (std::env::var("OPENVERSE_CLIENT_ID"), std::env::var("OPENVERSE_CLIENT_SECRET")) {
            (Ok(id), Ok(secret)) => {
                let r: Value = agent
                    .post(&format!("{API}/auth_tokens/token/"))
                    .send_form(&[("grant_type", "client_credentials"), ("client_id", &id), ("client_secret", &secret)])?
                    .into_json()?;
                r["access_token"].as_str().map(String::from)
            }
            _ => None,
        };
        Ok(Self { agent, token, cache })
    }

    fn get(&self, url: &str) -> Result<ureq::Response> {
        let mut req = self.agent.get(url);
        if let Some(t) = &self.token {
            req = req.set("Authorization", &format!("Bearer {t}"));
        }
        req.call().map_err(|e| anyhow::anyhow!("GET {url}: {e}"))
    }

    /// kind = "audio" | "images". Extra = additional query params ("aspect_ratio=tall").
    pub fn search(&self, kind: &str, q: &str, extra: &str) -> Result<Vec<Item>> {
        let key = util::sha(&[kind.as_bytes(), q.as_bytes(), extra.as_bytes()]);
        let cached = self.cache.join(format!("search-{key}.json"));
        let body: Value = if cached.exists() {
            serde_json::from_slice(&std::fs::read(&cached)?)?
        } else {
            let mut url = format!(
                "{API}/{kind}/?q={}&license=cc0,pdm,by&page_size=20&mature=false",
                urlencode(q)
            );
            if !extra.is_empty() {
                url.push('&');
                url.push_str(extra);
            }
            let v: Value = self.get(&url)?.into_json()?;
            std::fs::write(&cached, serde_json::to_vec(&v)?)?;
            v
        };
        let results = body["results"].as_array().cloned().unwrap_or_default();
        Ok(results.into_iter().filter_map(|r| serde_json::from_value(r).ok()).collect())
    }

    pub fn download(&self, item: &Item, dest_dir: &Path, stem: &str) -> Result<PathBuf> {
        let ext = item
            .filetype
            .clone()
            .or_else(|| item.url.rsplit('.').next().map(|e| e.to_lowercase()))
            .filter(|e| e.len() <= 4 && e.chars().all(|c| c.is_ascii_alphanumeric()))
            .unwrap_or_else(|| "bin".into());
        let cached = self.cache.join(format!("{}.{ext}", item.id));
        if !cached.exists() {
            log(format!("downloading {} ({})", item.title.as_deref().unwrap_or(&item.id), item.license));
            let mut buf = Vec::new();
            self.get(&item.url)?.into_reader().take(200 * 1024 * 1024).read_to_end(&mut buf)?;
            if buf.len() < 1024 {
                bail!("download too small from {}", item.url);
            }
            std::fs::write(&cached, &buf)?;
        }
        std::fs::create_dir_all(dest_dir)?;
        let dest = dest_dir.join(format!("{stem}.{ext}"));
        std::fs::copy(&cached, &dest).with_context(|| format!("copying to {}", dest.display()))?;
        Ok(dest)
    }

    /// First track that is long enough for the video and downloads cleanly.
    pub fn music(&self, q: &str, min_secs: f32, dest_dir: &Path) -> Result<(PathBuf, Credit)> {
        let items = self.search("audio", q, "category=music").unwrap_or_default();
        let mut items: Vec<Item> = items.into_iter().filter(|i| i.duration.unwrap_or(0) as f32 / 1000.0 >= min_secs.min(120.0)).collect();
        if items.is_empty() {
            items = self.search("audio", q, "")?;
        }
        for item in items {
            match self.download(&item, dest_dir, "music") {
                Ok(p) => return Ok((p.clone(), credit("music", &item, &p))),
                Err(e) => log(format!("skipping track {}: {e}", item.id)),
            }
        }
        bail!("no usable Openverse music for {q:?}")
    }

    pub fn image(&self, q: &str, aspect: &str, dest_dir: &Path, stem: &str) -> Result<(PathBuf, Credit)> {
        let mut items = self.search("images", q, &format!("aspect_ratio={aspect}&size=large")).unwrap_or_else(|e| {
            log(format!("filtered image search failed ({e}), retrying plain"));
            vec![]
        });
        if items.is_empty() {
            items = self.search("images", q, "")?;
        }
        for item in items {
            match self.download(&item, dest_dir, stem) {
                Ok(p) => return Ok((p.clone(), credit("image", &item, &p))),
                Err(e) => log(format!("skipping image {}: {e}", item.id)),
            }
        }
        bail!("no usable Openverse image for {q:?}")
    }
}

fn credit(kind: &str, i: &Item, file: &Path) -> Credit {
    Credit {
        kind: kind.into(),
        title: i.title.clone().unwrap_or_else(|| i.id.clone()),
        creator: i.creator.clone(),
        license: format!("{} {}", i.license.to_uppercase(), i.license_version.clone().unwrap_or_default()).trim().to_string(),
        license_url: i.license_url.clone(),
        source_url: i.foreign_landing_url.clone(),
        file: file.file_name().unwrap().to_string_lossy().into(),
    }
}

pub fn urlencode(s: &str) -> String {
    s.bytes()
        .map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => (b as char).to_string(),
            b' ' => "+".into(),
            _ => format!("%{b:02X}"),
        })
        .collect()
}
