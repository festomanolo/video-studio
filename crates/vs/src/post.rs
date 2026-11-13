//! Publishing through AutoPost (/Volumes/MacX/projects/auto-post, a Postiz fork) public API:
//!   POST /public/v1/upload   (multipart "file")  -> { id, path }
//!   POST /public/v1/posts    { type, date, shortLink, tags, posts: [{ integration: {id}, value: [{content, image}], settings }] }
//! Auth: the API key from AutoPost settings in the Authorization header.
//! Env: AUTOPOST_URL (default http://localhost:3000), AUTOPOST_API_KEY.

use crate::util::log;
use anyhow::{bail, Context, Result};
use serde_json::{json, Value};
use std::path::Path;

fn base() -> String {
    std::env::var("AUTOPOST_URL").unwrap_or_else(|_| "http://localhost:3000".into()).trim_end_matches('/').to_string()
}

fn key() -> Result<String> {
    std::env::var("AUTOPOST_API_KEY").context("set AUTOPOST_API_KEY (AutoPost > Settings > Public API)")
}

fn agent() -> ureq::Agent {
    ureq::AgentBuilder::new().timeout(std::time::Duration::from_secs(600)).build()
}

pub fn integrations() -> Result<Value> {
    let r = agent()
        .get(&format!("{}/public/v1/integrations", base()))
        .set("Authorization", &key()?)
        .call()
        .map_err(|e| anyhow::anyhow!("{e}"))?;
    Ok(r.into_json()?)
}

pub fn upload(file: &Path) -> Result<Value> {
    let bytes = std::fs::read(file)?;
    let name = file.file_name().unwrap().to_string_lossy();
    let boundary = format!("----vs{}", std::process::id());
    let mut body = Vec::with_capacity(bytes.len() + 512);
    body.extend(format!("--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{name}\"\r\nContent-Type: video/mp4\r\n\r\n").as_bytes());
    body.extend(&bytes);
    body.extend(format!("\r\n--{boundary}--\r\n").as_bytes());
    log(format!("uploading {} ({:.1} MB) to AutoPost", name, bytes.len() as f32 / 1e6));
    let r = agent()
        .post(&format!("{}/public/v1/upload", base()))
        .set("Authorization", &key()?)
        .set("Content-Type", &format!("multipart/form-data; boundary={boundary}"))
        .send_bytes(&body)
        .map_err(|e| anyhow::anyhow!("upload failed: {e}"))?;
    Ok(r.into_json()?)
}

/// `settings`: provider settings (YouTube title, TikTok privacy...); AutoPost adds `__type` itself.
/// `when`: "draft" (default, safest), "now", or an ISO date to schedule.
pub fn post(file: &Path, caption: &str, integration_ids: &[String], when: &str, settings: &Value) -> Result<Value> {
    if integration_ids.is_empty() {
        bail!("pass at least one --channel <integration id> (see `vs channels`)");
    }
    let media = upload(file)?;
    let (kind, date) = match when {
        "draft" | "now" => (when.to_string(), now_iso()),
        iso => ("schedule".to_string(), iso.to_string()),
    };
    let posts: Vec<Value> = integration_ids
        .iter()
        .map(|id| {
            json!({
                "integration": { "id": id },
                "value": [{ "content": caption, "image": [{ "id": media["id"], "path": media["path"] }] }],
                "settings": settings
            })
        })
        .collect();
    let body = json!({ "type": kind, "date": date, "shortLink": false, "tags": [], "posts": posts });
    let r = agent()
        .post(&format!("{}/public/v1/posts", base()))
        .set("Authorization", &key()?)
        .send_json(body);
    match r {
        Ok(r) => Ok(r.into_json()?),
        Err(ureq::Error::Status(code, r)) => bail!("AutoPost {code}: {}", r.into_string().unwrap_or_default()),
        Err(e) => bail!("{e}"),
    }
}

fn now_iso() -> String {
    let out = std::process::Command::new("date").args(["-u", "+%Y-%m-%dT%H:%M:%SZ"]).output();
    out.map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string()).unwrap_or_default()
}
