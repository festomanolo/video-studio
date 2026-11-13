//! Idea fuel for trend videos: what people are searching for (Google Trends daily RSS), what
//! is hot on chosen subreddits (RSS) and the Hacker News front page (tech explainers). Titles only; scripts must be written fresh, not
//! copied from posts (other people's stories are their content).

use anyhow::Result;
use serde_json::Value;

const UA: &str = "video-studio/0.1 (trend research)";

fn agent() -> ureq::Agent {
    ureq::AgentBuilder::new().user_agent(UA).timeout(std::time::Duration::from_secs(30)).build()
}

pub struct Item {
    pub source: String,
    pub title: String,
    pub score: String,
    pub url: String,
}

pub fn google(geo: &str) -> Result<Vec<Item>> {
    let xml = agent().get(&format!("https://trends.google.com/trending/rss?geo={geo}")).call()?.into_string()?;
    let mut out = Vec::new();
    for chunk in xml.split("<item>").skip(1) {
        let tag = |t: &str| {
            chunk
                .split(&format!("<{t}>"))
                .nth(1)
                .and_then(|r| r.split(&format!("</{t}>")).next())
                .unwrap_or("")
                .trim()
                .to_string()
        };
        out.push(Item { source: format!("google/{geo}"), title: tag("title"), score: tag("ht:approx_traffic"), url: tag("ht:news_item_url") });
    }
    Ok(out)
}

/// Reddit's JSON API refuses anonymous clients (403); the RSS feed still works.
pub fn reddit(sub: &str, window: &str) -> Result<Vec<Item>> {
    let xml = agent().get(&format!("https://www.reddit.com/r/{sub}/top/.rss?t={window}&limit=15")).call()?.into_string()?;
    Ok(xml
        .split("<entry>")
        .skip(1)
        .map(|e| {
            let title = e.split("<title>").nth(1).and_then(|r| r.split("</title>").next()).unwrap_or("");
            let url = e.split("<link href=\"").nth(1).and_then(|r| r.split('"').next()).unwrap_or("");
            Item { source: format!("r/{sub}"), title: unescape(title), score: String::new(), url: url.to_string() }
        })
        .collect())
}

/// Hacker News front page (official API): the best pulse for tech explainers.
pub fn hackernews(n: usize) -> Result<Vec<Item>> {
    let ids: Vec<u64> = agent().get("https://hacker-news.firebaseio.com/v0/topstories.json").call()?.into_json()?;
    let mut out = Vec::new();
    for id in ids.into_iter().take(n) {
        let v: Value = agent().get(&format!("https://hacker-news.firebaseio.com/v0/item/{id}.json")).call()?.into_json()?;
        out.push(Item {
            source: "hn".into(),
            title: v["title"].as_str().unwrap_or("").to_string(),
            score: v["score"].as_i64().map(|s| format!("{s} pts")).unwrap_or_default(),
            url: format!("https://news.ycombinator.com/item?id={id}"),
        });
    }
    Ok(out)
}

fn unescape(s: &str) -> String {
    s.replace("&amp;", "&").replace("&quot;", "\"").replace("&#39;", "'").replace("&lt;", "<").replace("&gt;", ">")
}
