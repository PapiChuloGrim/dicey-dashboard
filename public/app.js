let dashboardData = null;
let followerChart = null;
let engagementChart = null;

async function loadData() {
  const res = await fetch('/api/data');
  dashboardData = await res.json();
  render();
}

function render() {
  renderCountdown();
  renderKPIs();
  renderProgressBar();
  renderCharts();
  renderTopPosts();
  renderLearnings();
  renderBangers();
  renderHistory();
}

// --- Countdown ---
function renderCountdown() {
  const launch = new Date(dashboardData.config.launchDate + 'T00:00:00');
  const now = new Date();
  const diff = launch - now;
  const days = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  const weeks = Math.floor(days / 7);
  document.getElementById('countdown').innerHTML =
    `<strong>${days} days</strong>until launch (${weeks} weeks) &middot; May 15, 2026`;
}

// --- KPIs ---
function renderKPIs() {
  const entries = dashboardData.weeklyEntries;
  const latest = entries[entries.length - 1];
  const prev = entries.length > 1 ? entries[entries.length - 2] : null;
  const config = dashboardData.config;

  // Followers
  document.getElementById('kpi-followers').textContent = fmt(latest.followers);
  if (prev) {
    const diff = latest.followers - prev.followers;
    setDelta('kpi-followers-delta', diff, `${diff >= 0 ? '+' : ''}${fmt(diff)} this week`);
  }

  // Goal Progress
  const pct = ((latest.followers / config.followerGoal) * 100).toFixed(1);
  document.getElementById('kpi-progress').textContent = pct + '%';
  document.getElementById('kpi-progress-sub').textContent =
    `${fmt(latest.followers)} / ${fmt(config.followerGoal)}`;

  // Engagement
  document.getElementById('kpi-engagement').textContent = latest.engagementPct + '%';
  if (prev) {
    const diff = (latest.engagementPct - prev.engagementPct).toFixed(2);
    setDelta('kpi-engagement-delta', diff, `${diff >= 0 ? '+' : ''}${diff}pp vs last week`);
  }

  // Impressions
  document.getElementById('kpi-impressions').textContent = fmtShort(latest.impressions);
  if (prev) {
    const diff = latest.impressions - prev.impressions;
    const pctChange = prev.impressions ? ((diff / prev.impressions) * 100).toFixed(0) : 0;
    setDelta('kpi-impressions-delta', diff, `${diff >= 0 ? '+' : ''}${pctChange}% vs last week`);
  }

  // Pace
  const launch = new Date(config.launchDate + 'T00:00:00');
  const now = new Date();
  const weeksLeft = Math.max(1, (launch - now) / (1000 * 60 * 60 * 24 * 7));
  const followersNeeded = config.followerGoal - latest.followers;
  const pace = Math.ceil(followersNeeded / weeksLeft);
  document.getElementById('kpi-pace').textContent = fmt(pace);
  document.getElementById('kpi-pace-sub').textContent =
    `${fmt(followersNeeded)} remaining over ${Math.ceil(weeksLeft)} weeks`;
}

// --- Progress Bar ---
function renderProgressBar() {
  const entries = dashboardData.weeklyEntries;
  const latest = entries[entries.length - 1];
  const config = dashboardData.config;
  const pct = Math.min(100, (latest.followers / config.followerGoal) * 100);

  document.getElementById('progress-bar').style.width = pct + '%';
  document.getElementById('progress-text').textContent =
    `${fmt(latest.followers)} / ${fmt(config.followerGoal)}`;

  // Calculate on-pace marker position
  const launchDate = new Date(config.launchDate + 'T00:00:00');
  const startDate = entries.length > 0 ? new Date(entries[0].weekEnding + 'T00:00:00') : new Date();
  const now = new Date();
  const totalSpan = launchDate - startDate;
  const elapsed = now - startDate;
  const timePct = Math.min(100, Math.max(0, (elapsed / totalSpan) * 100));
  document.getElementById('pace-marker').style.left = timePct + '%';
}

// --- Charts ---
function renderCharts() {
  const entries = dashboardData.weeklyEntries;
  const labels = entries.map(e => shortDate(e.weekEnding));
  const followers = entries.map(e => e.followers);
  const engagement = entries.map(e => e.engagementPct);
  const impressions = entries.map(e => e.impressions);

  // Calculate goal trajectory line
  const config = dashboardData.config;
  const goalLine = entries.map(e => {
    const entryDate = new Date(e.weekEnding + 'T00:00:00');
    const startDate = new Date(entries[0].weekEnding + 'T00:00:00');
    const launchDate = new Date(config.launchDate + 'T00:00:00');
    const totalSpan = launchDate - startDate;
    const elapsed = entryDate - startDate;
    const frac = Math.min(1, elapsed / totalSpan);
    const startFollowers = entries[0].followers;
    return Math.round(startFollowers + (config.followerGoal - startFollowers) * frac);
  });

  const chartOpts = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: { labels: { color: '#8888a0', font: { size: 11 } } }
    },
    scales: {
      x: {
        ticks: { color: '#8888a0', font: { size: 10 } },
        grid: { color: 'rgba(255,255,255,0.04)' }
      }
    }
  };

  // Follower Chart
  if (followerChart) followerChart.destroy();
  followerChart = new Chart(document.getElementById('followerChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Followers',
          data: followers,
          borderColor: '#e44dff',
          backgroundColor: 'rgba(228, 77, 255, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 5,
          pointBackgroundColor: '#e44dff',
          borderWidth: 2
        },
        {
          label: 'Goal Pace',
          data: goalLine,
          borderColor: '#ffd740',
          borderDash: [6, 4],
          pointRadius: 0,
          borderWidth: 1.5,
          fill: false
        }
      ]
    },
    options: {
      ...chartOpts,
      scales: {
        ...chartOpts.scales,
        y: {
          ticks: { color: '#8888a0', font: { size: 10 } },
          grid: { color: 'rgba(255,255,255,0.04)' },
          beginAtZero: false
        }
      }
    }
  });

  // Engagement Chart (dual axis)
  if (engagementChart) engagementChart.destroy();
  engagementChart = new Chart(document.getElementById('engagementChart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Impressions',
          data: impressions,
          backgroundColor: 'rgba(68, 138, 255, 0.3)',
          borderColor: '#448aff',
          borderWidth: 1,
          yAxisID: 'y1',
          order: 2
        },
        {
          type: 'line',
          label: 'Engagement %',
          data: engagement,
          borderColor: '#00e676',
          backgroundColor: 'rgba(0, 230, 118, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 5,
          pointBackgroundColor: '#00e676',
          borderWidth: 2,
          yAxisID: 'y',
          order: 1
        }
      ]
    },
    options: {
      ...chartOpts,
      scales: {
        ...chartOpts.scales,
        y: {
          type: 'linear',
          position: 'left',
          ticks: { color: '#00e676', font: { size: 10 }, callback: v => v + '%' },
          grid: { color: 'rgba(255,255,255,0.04)' },
          title: { display: true, text: 'Engagement %', color: '#00e676' }
        },
        y1: {
          type: 'linear',
          position: 'right',
          ticks: { color: '#448aff', font: { size: 10 }, callback: v => fmtShort(v) },
          grid: { drawOnChartArea: false },
          title: { display: true, text: 'Impressions', color: '#448aff' }
        }
      }
    }
  });
}

// --- Top Posts ---
function renderTopPosts() {
  const entries = dashboardData.weeklyEntries;
  const latest = entries[entries.length - 1];
  const container = document.getElementById('top-posts-list');

  if (!latest.topPosts || latest.topPosts.length === 0) {
    container.innerHTML = '<p class="empty-state">No top posts yet. Add them in your weekly update.</p>';
    return;
  }

  const sorted = [...latest.topPosts].sort((a, b) => (b.likes || 0) - (a.likes || 0));
  container.innerHTML = sorted.map((post, i) => `
    <div class="post-item">
      <div class="post-rank">#${i + 1}</div>
      <div class="post-info">
        <div class="post-desc">${esc(post.description)}</div>
        ${post.url ? `<a class="post-url" href="${esc(post.url)}" target="_blank">${esc(post.url)}</a>` : ''}
      </div>
      ${post.likes ? `<div class="post-likes">${fmt(post.likes)}</div>` : ''}
    </div>
  `).join('');
}

// --- Learnings ---
function renderLearnings() {
  const entries = dashboardData.weeklyEntries;
  const container = document.getElementById('learnings-list');
  const withLearnings = entries.filter(e => e.learnings).reverse();

  if (withLearnings.length === 0) {
    container.innerHTML = '<p class="empty-state">No learnings yet.</p>';
    return;
  }

  container.innerHTML = withLearnings.slice(0, 5).map(entry => `
    <div class="learning-item">
      <div class="learning-week">Week of ${shortDate(entry.weekEnding)}</div>
      <div class="learning-text">${esc(entry.learnings)}</div>
    </div>
  `).join('');
}

// --- Bangers ---
function renderBangers() {
  const bangers = dashboardData.bangerPosts;
  const container = document.getElementById('banger-list');

  if (bangers.length === 0) {
    container.innerHTML = '<p class="empty-state">No banger posts yet. Add posts with 1,000+ likes to track them here.</p>';
    return;
  }

  const sorted = [...bangers].sort((a, b) => b.likes - a.likes);
  container.innerHTML = sorted.map(b => `
    <div class="banger-item">
      <button class="btn btn-danger banger-delete" onclick="deleteBanger(${b.id})">Remove</button>
      <div class="banger-likes">${fmt(b.likes)}</div>
      <div class="banger-desc">${esc(b.description)}</div>
      <div class="banger-meta">${b.platform} &middot; ${shortDate(b.date)}</div>
      ${b.url ? `<a class="banger-link" href="${esc(b.url)}" target="_blank">View post &rarr;</a>` : ''}
    </div>
  `).join('');
}

// --- History ---
function renderHistory() {
  const entries = dashboardData.weeklyEntries;
  const tbody = document.getElementById('history-tbody');
  tbody.innerHTML = [...entries].reverse().map(e => `
    <tr>
      <td>${shortDate(e.weekEnding)}</td>
      <td>${fmt(e.followers)}</td>
      <td>${e.followersGained != null ? (e.followersGained >= 0 ? '+' : '') + fmt(e.followersGained) : '--'}</td>
      <td>${e.engagementPct}%</td>
      <td>${fmtShort(e.impressions)}</td>
      <td><button class="btn btn-danger" onclick="deleteWeekly(${e.id})">Delete</button></td>
    </tr>
  `).join('');
}

// --- Modals ---
function openModal(type) {
  document.getElementById('modal-overlay').classList.add('active');
  document.getElementById('weekly-form').style.display = type === 'weekly' ? 'block' : 'none';
  document.getElementById('banger-form').style.display = type === 'banger' ? 'block' : 'none';
  document.getElementById('modal-title').textContent =
    type === 'weekly' ? 'Weekly Update' : 'Add Banger Post';

  if (type === 'weekly') {
    // Pre-fill date to last Sunday
    const today = new Date();
    const dayOfWeek = today.getDay();
    const lastSunday = new Date(today);
    lastSunday.setDate(today.getDate() - dayOfWeek);
    document.getElementById('w-weekEnding').value = lastSunday.toISOString().split('T')[0];
  }
  if (type === 'banger') {
    document.getElementById('b-date').value = new Date().toISOString().split('T')[0];
  }
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
}

// --- Form Submissions ---
async function submitWeekly(e) {
  e.preventDefault();

  const topPostsRaw = document.getElementById('w-topPosts').value.trim();
  const topPosts = topPostsRaw ? topPostsRaw.split('\n').map(line => {
    const parts = line.split('|').map(s => s.trim());
    return {
      description: parts[0] || '',
      likes: parseInt(parts[1]) || 0,
      url: parts[2] || ''
    };
  }) : [];

  const body = {
    weekEnding: document.getElementById('w-weekEnding').value,
    followers: parseInt(document.getElementById('w-followers').value),
    followersGained: parseInt(document.getElementById('w-followersGained').value) || null,
    engagementPct: parseFloat(document.getElementById('w-engagement').value),
    impressions: parseInt(document.getElementById('w-impressions').value),
    topPosts,
    learnings: document.getElementById('w-learnings').value.trim()
  };

  await fetch('/api/weekly', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  closeModal();
  document.getElementById('weekly-form').reset();
  await loadData();
}

async function submitBanger(e) {
  e.preventDefault();

  const body = {
    description: document.getElementById('b-description').value,
    likes: parseInt(document.getElementById('b-likes').value),
    date: document.getElementById('b-date').value,
    url: document.getElementById('b-url').value,
    platform: document.getElementById('b-platform').value
  };

  await fetch('/api/bangers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  closeModal();
  document.getElementById('banger-form').reset();
  await loadData();
}

async function deleteWeekly(id) {
  if (!confirm('Delete this weekly entry?')) return;
  await fetch(`/api/weekly/${id}`, { method: 'DELETE' });
  await loadData();
}

async function deleteBanger(id) {
  if (!confirm('Remove this banger post?')) return;
  await fetch(`/api/bangers/${id}`, { method: 'DELETE' });
  await loadData();
}

// --- Helpers ---
function fmt(n) {
  if (n == null) return '--';
  return n.toLocaleString();
}

function fmtShort(n) {
  if (n == null) return '--';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

function shortDate(dateStr) {
  if (!dateStr) return '--';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function setDelta(id, value, text) {
  const el = document.getElementById(id);
  el.textContent = text;
  el.className = 'kpi-delta ' + (value > 0 ? 'up' : value < 0 ? 'down' : 'neutral');
}

function esc(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// --- Init ---
loadData();
