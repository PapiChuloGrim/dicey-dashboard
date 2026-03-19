const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data', 'dashboard.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function readData() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Get all dashboard data
app.get('/api/data', (req, res) => {
  res.json(readData());
});

// Add a new weekly entry
app.post('/api/weekly', (req, res) => {
  const data = readData();
  const entry = {
    id: Date.now(),
    weekEnding: req.body.weekEnding,
    followers: req.body.followers,
    followersGained: req.body.followersGained,
    engagementPct: req.body.engagementPct,
    impressions: req.body.impressions,
    topPosts: req.body.topPosts || [],
    learnings: req.body.learnings || '',
    dateAdded: new Date().toISOString()
  };
  data.weeklyEntries.push(entry);
  writeData(data);
  res.json({ success: true, entry });
});

// Update a weekly entry
app.put('/api/weekly/:id', (req, res) => {
  const data = readData();
  const idx = data.weeklyEntries.findIndex(e => e.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Entry not found' });
  data.weeklyEntries[idx] = { ...data.weeklyEntries[idx], ...req.body };
  writeData(data);
  res.json({ success: true, entry: data.weeklyEntries[idx] });
});

// Delete a weekly entry
app.delete('/api/weekly/:id', (req, res) => {
  const data = readData();
  data.weeklyEntries = data.weeklyEntries.filter(e => e.id !== Number(req.params.id));
  writeData(data);
  res.json({ success: true });
});

// Add a banger post
app.post('/api/bangers', (req, res) => {
  const data = readData();
  const banger = {
    id: Date.now(),
    url: req.body.url,
    description: req.body.description,
    likes: req.body.likes,
    date: req.body.date,
    platform: req.body.platform || 'X',
    dateAdded: new Date().toISOString()
  };
  data.bangerPosts.push(banger);
  writeData(data);
  res.json({ success: true, banger });
});

// Delete a banger post
app.delete('/api/bangers/:id', (req, res) => {
  const data = readData();
  data.bangerPosts = data.bangerPosts.filter(b => b.id !== Number(req.params.id));
  writeData(data);
  res.json({ success: true });
});

// Update config/goals
app.put('/api/config', (req, res) => {
  const data = readData();
  data.config = { ...data.config, ...req.body };
  writeData(data);
  res.json({ success: true, config: data.config });
});

app.listen(PORT, () => {
  console.log(`Dicey Growth Dashboard running at http://localhost:${PORT}`);
});
