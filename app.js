// Multiple CORS proxies — try US-based ones first
const PROXIES = [
  url => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  url => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
  url => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];

const PANELS = [
  {
    id: 'ai-tech',
    icon: '🤖',
    title: 'AI & Tech',
    feeds: [
      { name: 'HN Front', url: 'https://hnrss.org/frontpage?count=25' },
      { name: 'The Verge AI', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml' },
      { name: 'VentureBeat AI', url: 'https://venturebeat.com/category/ai/feed/' },
      { name: 'TechMeme', url: 'https://www.techmeme.com/feed.xml' },
      { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/technology-lab' },
    ]
  },
  {
    id: 'crypto',
    icon: '💰',
    title: 'Crypto',
    feeds: [
      { name: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/' },
      { name: 'Decrypt', url: 'https://decrypt.co/feed' },
      { name: 'The Block', url: 'https://www.theblock.co/rss.xml' },
      { name: 'CryptoSlate', url: 'https://cryptoslate.com/feed/' },
      { name: 'Blockworks', url: 'https://blockworks.co/feed' },
      { name: 'DL News', url: 'https://www.dlnews.com/rss/' },
    ]
  },
  {
    id: 'culture',
    icon: '🌊',
    title: 'Culture',
    feeds: [
      { name: 'Reddit Popular', url: 'https://www.reddit.com/r/popular.rss?limit=20' },
      { name: 'r/Technology', url: 'https://www.reddit.com/r/technology.rss?limit=15' },
      { name: 'r/CryptoCurrency', url: 'https://www.reddit.com/r/CryptoCurrency.rss?limit=15' },
      { name: 'r/WallStreetBets', url: 'https://www.reddit.com/r/wallstreetbets.rss?limit=15' },
      { name: 'Know Your Meme', url: 'https://knowyourmeme.com/newsfeed.rss' },
    ]
  },
  {
    id: 'macro',
    icon: '🌍',
    title: 'Macro',
    feeds: [
      { name: 'Reuters World', url: gnews('site:reuters.com+world+OR+politics', 1) },
      { name: 'AP News', url: gnews('site:apnews.com+breaking', 1) },
      { name: 'Crypto Regulation', url: gnews('SEC+crypto+OR+CFTC+regulation+OR+crypto+policy', 2) },
    ]
  },
  {
    id: 'science',
    icon: '🔬',
    title: 'Science',
    feeds: [
      { name: 'Ars Science', url: 'https://feeds.arstechnica.com/arstechnica/science' },
      { name: 'Space', url: gnews('NASA+OR+SpaceX+launch+OR+astronomy', 3) },
      { name: 'Biotech', url: gnews('biotech+breakthrough+OR+CRISPR+OR+quantum+computing', 5) },
    ]
  },
  {
    id: 'funding',
    icon: '💸',
    title: 'Funding',
    feeds: [
      { name: 'TechCrunch Venture', url: 'https://techcrunch.com/category/venture/feed/' },
      { name: 'Crunchbase', url: 'https://news.crunchbase.com/feed/' },
      { name: 'Crypto Raises', url: gnews('"raised+million"+crypto+OR+blockchain+funding', 3) },
    ]
  }
];

function gnews(query, days) {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}+when:${days}d&hl=en-US&gl=US&ceid=US:en&geo=US&cr=countryUS`;
}

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
  if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
  return Math.floor(seconds / 86400) + 'd ago';
}

function extractSource(title) {
  const match = title.match(/\s-\s([^-]+)$/);
  if (match) {
    return {
      clean: title.replace(/\s-\s[^-]+$/, '').trim(),
      source: match[1].trim()
    };
  }
  return { clean: title, source: '' };
}

async function fetchViaProxy(feedUrl) {
  for (const makeUrl of PROXIES) {
    try {
      const url = makeUrl(feedUrl);
      const resp = await fetch(url, { signal: AbortSignal.timeout(12000) });
      if (!resp.ok) continue;
      const raw = await resp.text();
      // allorigins /get returns JSON with contents field
      try {
        const json = JSON.parse(raw);
        if (json.contents) return json.contents;
      } catch(e) {}
      return raw;
    } catch(e) { continue; }
  }
  throw new Error('All proxies failed');
}

async function fetchFeed(feedUrl, feedName) {
  const text = await fetchViaProxy(feedUrl);
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/xml');

  const items = [];
  const entries = doc.querySelectorAll('item, entry');

  entries.forEach(entry => {
    const rawTitle = entry.querySelector('title')?.textContent?.trim() || '';
    const link = entry.querySelector('link')?.textContent?.trim()
      || entry.querySelector('link')?.getAttribute('href') || '';
    const pubDate = entry.querySelector('pubDate, published, updated')?.textContent?.trim();

    if (!rawTitle) return;

    const { clean, source } = extractSource(rawTitle);

    items.push({
      title: clean,
      link,
      source: source || feedName,
      date: pubDate ? new Date(pubDate) : new Date(),
    });
  });

  return items;
}

async function loadPanel(panel) {
  const feedEl = document.querySelector(`#panel-${panel.id} .panel-feed`);
  const countEl = document.querySelector(`#panel-${panel.id} .item-count`);

  feedEl.innerHTML = '<div class="panel-loading"><span class="spinner"></span>Loading...</div>';

  const results = await Promise.allSettled(
    panel.feeds.map(f => fetchFeed(f.url, f.name))
  );

  let allItems = [];
  results.forEach(r => {
    if (r.status === 'fulfilled') allItems = allItems.concat(r.value);
  });

  // Deduplicate by similar titles
  const seen = new Set();
  allItems = allItems.filter(item => {
    const key = item.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  allItems.sort((a, b) => b.date - a.date);
  allItems = allItems.slice(0, 30);

  if (allItems.length === 0) {
    feedEl.innerHTML = '<div class="panel-error">No items loaded</div>';
    countEl.textContent = '0';
    return;
  }

  countEl.textContent = allItems.length;
  feedEl.innerHTML = allItems.map(item => `
    <div class="feed-item">
      <a href="${escapeHtml(item.link)}" target="_blank" rel="noopener">${escapeHtml(item.title)}</a>
      <div class="meta">
        <span class="source">${escapeHtml(item.source)}</span>
        <span class="time">${timeAgo(item.date)}</span>
      </div>
    </div>
  `).join('');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function updateClock() {
  const now = new Date();
  const utc = now.toISOString().slice(11, 19);
  document.getElementById('clock').textContent = utc + ' UTC';
}

function updateRefreshTime() {
  const now = new Date();
  const t = now.toISOString().slice(11, 16);
  document.getElementById('last-refresh').textContent = 'refreshed ' + t;
}

async function refreshAll() {
  updateRefreshTime();
  await Promise.allSettled(PANELS.map(p => loadPanel(p)));
}

function buildGrid() {
  const grid = document.getElementById('grid');
  grid.innerHTML = PANELS.map(p => `
    <div class="panel" id="panel-${p.id}">
      <div class="panel-header">
        <span><span class="category-icon">${p.icon}</span>${p.title}</span>
        <span class="item-count">—</span>
      </div>
      <div class="panel-feed"></div>
    </div>
  `).join('');
}

function init() {
  buildGrid();
  updateClock();
  setInterval(updateClock, 1000);
  refreshAll();
  setInterval(refreshAll, 5 * 60 * 1000);
}

document.addEventListener('DOMContentLoaded', init);
