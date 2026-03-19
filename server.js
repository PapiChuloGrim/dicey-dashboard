const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'dashboard.json');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = 'PapiChuloGrim';
const GITHUB_REPO = 'dicey-dashboard';
const GITHUB_FILE = 'data/dashboard.json';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── GitHub API helpers ──────────────────────────────────────────────────────

async function readData() {
  if (GITHUB_TOKEN) {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILE}`,
      { headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' } }
    );
    if (!res.ok) throw new Error(`GitHub read failed: ${res.status}`);
    const json = await res.json();
    const content = Buffer.from(json.content, 'base64').toString('utf-8');
    return { data: JSON.parse(content), sha: json.sha };
  }
  // Local fallback for development
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  return { data, sha: null };
}

async function writeData(data, sha) {
  if (GITHUB_TOKEN) {
    const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILE}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: 'Update dashboard data', content, sha }),
      }
    );
    if (!res.ok) {
      const err = await res.json();
      throw new Error(`GitHub write failed: ${JSON.stringify(err)}`);
    }
    return;
  }
  // Local fallback for development
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ── Routes ──────────────────────────────────────────────────────────────────

app.get('/api/data', async (req, res) => {
  try {
    const { data } = await readData();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/weekly', async (req, res) => {
  try {
    const { data, sha } = await readData();
    const entry = {
      id: Date.now(),
      weekEnding: req.body.weekEnding,
      followers: req.body.followers,
      followersGained: req.body.followersGained,
      engagementPct: req.body.engagementPct,
      impressions: req.body.impressions,
      topPosts: req.body.topPosts || [],
      learnings: req.body.learnings || '',
      dateAdded: new Date().toISOString(),
    };
    data.weeklyEntries.push(entry);
    await writeData(data, sha);
    res.json({ success: true, entry });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/weekly/:id', async (req, res) => {
  try {
    const { data, sha } = await readData();
    const idx = data.weeklyEntries.findIndex(e => e.id === Number(req.params.id));
    if (idx === -1) return res.status(404).json({ error: 'Entry not found' });
    data.weeklyEntries[idx] = { ...data.weeklyEntries[idx], ...req.body };
    await writeData(data, sha);
    res.json({ success: true, entry: data.weeklyEntries[idx] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/weekly/:id', async (req, res) => {
  try {
    const { data, sha } = await readData();
    data.weeklyEntries = data.weeklyEntries.filter(e => e.id !== Number(req.params.id));
    await writeData(data, sha);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/bangers', async (req, res) => {
  try {
    const { data, sha } = await readData();
    const banger = {
      id: Date.now(),
      url: req.body.url,
      description: req.body.description,
      likes: req.body.likes,
      date: req.body.date,
      platform: req.body.platform || 'X',
      dateAdded: new Date().toISOString(),
    };
    data.bangerPosts.push(banger);
    await writeData(data, sha);
    res.json({ success: true, banger });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/bangers/:id', async (req, res) => {
  try {
    const { data, sha } = await readData();
    data.bangerPosts = data.bangerPosts.filter(b => b.id !== Number(req.params.id));
    await writeData(data, sha);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/config', async (req, res) => {
  try {
    const { data, sha } = await readData();
    data.config = { ...data.config, ...req.body };
    await writeData(data, sha);
    res.json({ success: true, config: data.config });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Dicey Growth Dashboard running at http://localhost:${PORT}`);
});
