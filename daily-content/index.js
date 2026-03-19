require('dotenv').config();
const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.ODDS_API_KEY;
const BASE_URL = 'https://api.the-odds-api.com/v4/sports';

// ── Sport keys mapped to The Odds API v4 identifiers ──
const SPORTS = [
  // Tier 1 — highest weight
  { key: 'soccer_epl', name: 'Premier League', tier: 1 },
  { key: 'soccer_uefa_champs_league', name: 'Champions League', tier: 1 },
  { key: 'basketball_nba', name: 'NBA', tier: 1 },
  { key: 'americanfootball_nfl', name: 'NFL', tier: 1 },
  // Tier 2
  { key: 'soccer_spain_la_liga', name: 'La Liga', tier: 2 },
  { key: 'soccer_italy_serie_a', name: 'Serie A', tier: 2 },
  { key: 'soccer_germany_bundesliga', name: 'Bundesliga', tier: 2 },
  { key: 'icehockey_nhl', name: 'NHL', tier: 2 },
  // Tier 3
  { key: 'soccer_france_ligue_one', name: 'Ligue 1', tier: 3 },
  { key: 'soccer_uefa_europa_league', name: 'Europa League', tier: 3 },
  { key: 'mma_mixed_martial_arts', name: 'UFC/MMA', tier: 3 },
];

// ── Known rivalries (lowercase) ──
const RIVALRIES = [
  // Premier League
  ['manchester united', 'manchester city'],
  ['manchester united', 'liverpool'],
  ['arsenal', 'tottenham hotspur'],
  ['liverpool', 'everton'],
  ['chelsea', 'arsenal'],
  ['chelsea', 'tottenham hotspur'],
  // La Liga
  ['real madrid', 'barcelona'],
  ['atletico madrid', 'real madrid'],
  ['real madrid', 'atletico madrid'],
  // Serie A
  ['ac milan', 'inter milan'],
  ['juventus', 'inter milan'],
  ['as roma', 'lazio'],
  // Bundesliga
  ['borussia dortmund', 'bayern munich'],
  // Ligue 1
  ['paris saint-germain', 'olympique marseille'],
  // NBA
  ['los angeles lakers', 'boston celtics'],
  ['los angeles lakers', 'golden state warriors'],
  ['boston celtics', 'philadelphia 76ers'],
  ['golden state warriors', 'los angeles clippers'],
  // NFL
  ['dallas cowboys', 'philadelphia eagles'],
  ['green bay packers', 'chicago bears'],
  ['kansas city chiefs', 'las vegas raiders'],
  ['san francisco 49ers', 'seattle seahawks'],
  // NHL
  ['montreal canadiens', 'boston bruins'],
  ['pittsburgh penguins', 'washington capitals'],
  ['new york rangers', 'new jersey devils'],
];

// ── Helpers ──

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)); }
          catch (e) { reject(new Error('Invalid JSON response')); }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
        }
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function fetchEventsForSport(sport) {
  const url = `${BASE_URL}/${sport.key}/odds/?apiKey=${API_KEY}&regions=us&markets=h2h&oddsFormat=american&dateFormat=iso`;
  try {
    const events = await fetch(url);
    return events.map((e) => ({ ...e, league: sport.name, tier: sport.tier }));
  } catch (err) {
    // Sport may have no upcoming events — that's fine
    if (!String(err).includes('422')) {
      console.error(`  ⚠  Could not fetch ${sport.name}: ${err.message}`);
    }
    return [];
  }
}

function isRivalry(teamA, teamB) {
  const a = teamA.toLowerCase();
  const b = teamB.toLowerCase();
  return RIVALRIES.some(
    ([x, y]) =>
      (a.includes(x) && b.includes(y)) || (a.includes(y) && b.includes(x))
  );
}

function scoreEvent(event) {
  let score = 0;
  const kickoff = new Date(event.commence_time);
  const hour = kickoff.getUTCHours();
  const day = kickoff.getUTCDay(); // 0=Sun, 6=Sat

  // Tier weight (higher tier = higher base score)
  if (event.tier === 1) score += 50;
  else if (event.tier === 2) score += 30;
  else score += 15;

  // Rivalry boost
  if (isRivalry(event.home_team, event.away_team)) {
    score += 25;
  }

  // Prime-time boost (17:00-23:00 UTC — covers US and EU prime windows)
  if (hour >= 17 && hour <= 23) {
    score += 10;
  }

  // Weekend boost
  if (day === 0 || day === 6) {
    score += 10;
  }

  return score;
}

function formatKickoff(iso) {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

// ── Prompt builders ──

function buildMatchPrompt(topMatches) {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  let matchList = '';
  topMatches.forEach((m, i) => {
    matchList += `${i + 1}. ${m.away_team} vs ${m.home_team}\n`;
    matchList += `   League: ${m.league}\n`;
    matchList += `   Kickoff: ${formatKickoff(m.commence_time)}\n\n`;
  });

  return `=============================================================
DICEY — DAILY CONTENT BRIEF
Date: ${today}
=============================================================

BRAND REFERENCE
- Voice: Confident, witty, Gen-Z-friendly. Smart but slightly degenerate. We know the game.
- Tone: Bold and punchy. Never corporate. Think "your sharpest friend who also bets."
- Emoji use: Intentional, 1-2 per post max. Never cluttered.

=============================================================
TODAY'S PRIORITY MATCHES (Ranked by Importance)
=============================================================

${matchList}
=============================================================
DELIVERABLES — Per Match (${topMatches.length} matches x 7 pieces = ${topMatches.length * 7} total assets)
=============================================================

For EACH match listed above, we need the following copy delivered:

1. HYPE TWEET (Pre-Game)
   - Purpose: Build anticipation before kickoff
   - Format: Max 280 characters, 1-2 emojis
   - Direction: Get people excited to watch and bet. Bold takes welcome.

2. PICKS TWEET (Betting Angle)
   - Purpose: Drive engagement from the betting audience
   - Format: Max 280 characters
   - Note: Use [LINE] as a placeholder wherever a real spread, moneyline, or over/under would go. These will be filled in by our team before posting.
   - Example tone: "Taking [TEAM] [LINE] today feels like free money"

3. CLOSE GAME REACTIVE TEMPLATE
   - Purpose: Ready-to-fire tweet if the game goes down to the wire
   - Format: Use placeholders — [TEAM_A], [TEAM_B], [SCORE]
   - Direction: Edge-of-your-seat energy. Make the reader feel the tension.

4. UPSET TEMPLATE
   - Purpose: Reactive tweet if the underdog pulls it off
   - Format: Use placeholders — [UNDERDOG], [FAVORITE]
   - Direction: Celebrate the chaos. This is why we bet.

5. BAD BEAT TEMPLATE
   - Purpose: Reactive tweet for heartbreaking losses
   - Format: Use placeholders — [TEAM], [WHAT_HAPPENED]
   - Direction: Commiserate with the audience. "We've all been there" energy. Funny but not dismissive.

6. INSTAGRAM CAPTION (Match Preview Post)
   - Purpose: Pair with a match preview graphic for the IG feed
   - Format: 2-4 sentences
   - Must include a CTA (e.g., "Drop your pick below", "Tag someone who's on the wrong side of this one")

7. IG STORY POLL
   - Purpose: Quick engagement tap on Instagram Stories
   - Format:
     Question: [engaging question about the match]
     Option A: [team/outcome]
     Option B: [team/outcome]

=============================================================
FORMATTING & DELIVERY
=============================================================
- Organize output by match, with the matchup as a header
- Number each content piece 1-7 under its match
- All copy should be ready to post or plug into templates — no placeholder text beyond the bracketed ones specified above
- Keep everything on-brand: confident, fun, slightly edgy, betting-savvy`;
}

function buildCasinoFallbackPrompt() {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `=============================================================
DICEY — DAILY CONTENT BRIEF (Casino Day)
Date: ${today}
=============================================================

BRAND REFERENCE
- Voice: Confident, witty, Gen-Z-friendly. Smart but slightly degenerate. We know the game.
- Tone: Bold and punchy. Never corporate. Think "your sharpest friend who also gambles."
- Emoji use: Intentional, 1-2 per post max. Never cluttered.

=============================================================
NOTE: No major sports matches on today's schedule.
Pivot to casino / gambling lifestyle content.
=============================================================

DELIVERABLES (7 total assets)
=============================================================

1. CASINO HYPE TWEET
   - Purpose: Promote slots, table games, or live dealer action
   - Format: Max 280 characters, 1-2 emojis
   - Direction: Make the casino floor sound like the move tonight.

2. PROMO TWEET
   - Purpose: Drive sign-ups or deposits through a promotional offer
   - Format: Max 280 characters
   - Note: Use [BONUS_TYPE] and [PROMO_CODE] as placeholders. Our team will fill these in before posting.
   - Direction: Should feel exclusive and urgent, not spammy.

3. BAD LUCK COMMISERATION TWEET
   - Purpose: Relatable content for the audience after losses
   - Format: Max 280 characters
   - Direction: Funny and self-aware. "We ride again tomorrow" energy. Never bitter.

4. BIG WIN CELEBRATION TEMPLATE
   - Purpose: Reactive tweet when someone hits big
   - Format: Use placeholders — [GAME], [AMOUNT]
   - Direction: Pure hype. Make the reader wish it was them.

5. INSTAGRAM CAPTION (Casino Lifestyle Post)
   - Purpose: Pair with a branded casino/lifestyle graphic for the IG feed
   - Format: 2-4 sentences
   - Must include a CTA (e.g., "What's your go-to game?", "Tag your casino partner")

6. IG STORY POLL
   - Purpose: Quick engagement tap on Instagram Stories
   - Format:
     Question: [fun casino-related question]
     Option A: [option]
     Option B: [option]

7. ENGAGEMENT TWEET
   - Purpose: Drive replies and quote tweets
   - Format: A question or hot take that invites debate
   - Example tone: "Blackjack or Roulette — and why is it Blackjack?"

=============================================================
FORMATTING & DELIVERY
=============================================================
- Number each content piece 1-7
- All copy should be ready to post or plug into templates — no placeholder text beyond the bracketed ones specified above
- Keep everything on-brand: confident, fun, slightly edgy, always entertaining`;
}

// ── Weekly prompt builder ──

function buildWeeklyPrompt(matchesByDay) {
  const now = new Date();
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + 6);

  const fmtDate = (d) =>
    d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  const weekRange = `${fmtDate(now)} — ${fmtDate(endDate)}`;

  let scheduleBlock = '';
  let matchCount = 0;
  for (const [dayLabel, matches] of matchesByDay) {
    scheduleBlock += `${dayLabel}\n`;
    matches.forEach((m, i) => {
      matchCount++;
      const rivalryTag = isRivalry(m.home_team, m.away_team) ? '  ** RIVALRY **' : '';
      scheduleBlock += `  ${i + 1}. ${m.away_team} vs ${m.home_team}\n`;
      scheduleBlock += `     League: ${m.league}${rivalryTag}\n`;
      scheduleBlock += `     Kickoff: ${formatKickoff(m.commence_time)}\n\n`;
    });
  }

  return `=============================================================
DICEY — WEEKLY CONTENT OUTLOOK
Week of: ${weekRange}
=============================================================

BRAND REFERENCE
- Voice: Confident, witty, Gen-Z-friendly. Smart but slightly degenerate. We know the game.
- Tone: Bold and punchy. Never corporate. Think "your sharpest friend who also bets."
- Emoji use: Intentional, 1-2 per post max. Never cluttered.

=============================================================
THIS WEEK'S BIGGEST MATCHUPS (${matchCount} total, ranked per day)
=============================================================

${scheduleBlock}
=============================================================
DELIVERABLES
=============================================================

We need two things from this weekly outlook:

A. WEEKLY PREVIEW THREAD (Twitter/X)
   - A 4-6 tweet thread previewing the week ahead
   - Tweet 1: Hook — "This week's slate is [loaded/insane/etc]" energy, set the tone
   - Tweets 2-5: One tweet per marquee matchup (pick the top 4 from the schedule above). Each tweet should name the matchup, the league, the day, and a one-line betting angle or storyline. Use [LINE] placeholders for any specific odds.
   - Final tweet: CTA — drive followers to engage ("Which game are you most locked in on?" or similar)
   - Each tweet max 280 characters

B. WEEKLY PREVIEW INSTAGRAM CAROUSEL (Caption + Slide Direction)
   - Caption: 3-5 sentences covering the week ahead. Hype the biggest matchups, mention how stacked the schedule is, end with a CTA ("Save this post — you'll need it all week").
   - Slide direction for the design team:
     - Slide 1: Cover slide — "This Week in Dicey" or similar header, week date range
     - Slides 2-5: One marquee matchup per slide — include teams, league, day, and kickoff time
     - Slide 6: Engagement slide — "Which game are you betting?" with a poll-style layout
   - Note: We only need the copy and direction, not the designs themselves.

C. WEEKLY IG STORY SEQUENCE (3 stories)
   - Story 1: "Week preview" hype frame — text overlay copy for a branded background
   - Story 2: Poll — pick the biggest game of the week
     Question: [question]
     Option A: [matchup]
     Option B: [matchup]
   - Story 3: "Reminder" frame — copy nudging followers to turn on notifications for game-day content

=============================================================
FORMATTING & DELIVERY
=============================================================
- Label each section (A, B, C) clearly
- Within each section, number or label individual pieces
- All copy should be ready to post or hand to a designer — no placeholder text beyond the bracketed ones specified above
- Keep everything on-brand: confident, fun, slightly edgy, betting-savvy`;
}

// ── Shared helpers ──

function toLocalDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDayLabel(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function saveAndPrint(prompt, filename) {
  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const filepath = path.join(outputDir, filename);
  fs.writeFileSync(filepath, prompt, 'utf8');
  console.log(`\n✅ Prompt saved to: output/${filename}\n`);
  console.log('═'.repeat(60));
  console.log('COPY THE PROMPT BELOW INTO CLAUDE:');
  console.log('═'.repeat(60));
  console.log('\n' + prompt + '\n');
}

// ── Main ──

async function main() {
  const mode = process.argv.includes('--weekly') ? 'weekly' : 'daily';

  console.log(`🎲 Dicey Content Generator — ${mode.toUpperCase()} mode\n`);
  console.log('Fetching matches from The Odds API...\n');

  // Fetch all sports in parallel
  const results = await Promise.all(SPORTS.map(fetchEventsForSport));
  let allEvents = results.flat();

  console.log(`Found ${allEvents.length} total upcoming events across ${SPORTS.length} leagues.\n`);

  const now = new Date();
  const dateStr = toLocalDateStr(now);

  if (mode === 'daily') {
    // ── DAILY: today only ──
    const todayEvents = allEvents.filter((e) => toLocalDateStr(new Date(e.commence_time)) === dateStr);

    console.log(`${todayEvents.length} of those are happening today (${dateStr}).\n`);

    const scored = todayEvents.map((e) => ({ ...e, score: scoreEvent(e) }));
    scored.sort((a, b) => b.score - a.score);
    const top3 = scored.slice(0, 3);

    let prompt;
    if (top3.length === 0) {
      console.log('No matches found today — generating casino fallback prompt.\n');
      prompt = buildCasinoFallbackPrompt();
    } else {
      console.log('Top 3 matches by importance:\n');
      top3.forEach((m, i) => {
        const rivalryTag = isRivalry(m.home_team, m.away_team) ? ' ⚔️  RIVALRY' : '';
        console.log(
          `  ${i + 1}. [Score: ${m.score}] ${m.away_team} vs ${m.home_team} — ${m.league}${rivalryTag}`
        );
        console.log(`     ${formatKickoff(m.commence_time)}\n`);
      });
      prompt = buildMatchPrompt(top3);
    }

    saveAndPrint(prompt, `dicey-daily-${dateStr}.txt`);

  } else {
    // ── WEEKLY: next 7 days, top 5 per day, max 3 matches per day shown ──
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + 6);
    const endStr = toLocalDateStr(endDate);

    const weekEvents = allEvents.filter((e) => {
      const ds = toLocalDateStr(new Date(e.commence_time));
      return ds >= dateStr && ds <= endStr;
    });

    console.log(`${weekEvents.length} events in the next 7 days (${dateStr} to ${endStr}).\n`);

    // Score everything
    const scored = weekEvents.map((e) => ({ ...e, score: scoreEvent(e) }));

    // Group by day, take top 3 per day, skip empty days
    const dayMap = new Map();
    for (const e of scored) {
      const ds = toLocalDateStr(new Date(e.commence_time));
      if (!dayMap.has(ds)) dayMap.set(ds, []);
      dayMap.get(ds).push(e);
    }

    const matchesByDay = [];
    let totalShown = 0;
    const sortedDays = [...dayMap.keys()].sort();
    for (const ds of sortedDays) {
      const dayEvents = dayMap.get(ds);
      dayEvents.sort((a, b) => b.score - a.score);
      const topForDay = dayEvents.slice(0, 3);
      const label = formatDayLabel(ds);
      matchesByDay.push([`📅 ${label}`, topForDay]);
      totalShown += topForDay.length;
    }

    if (totalShown === 0) {
      console.log('No matches found this week — generating casino fallback prompt.\n');
      const prompt = buildCasinoFallbackPrompt();
      saveAndPrint(prompt, `dicey-weekly-${dateStr}.txt`);
    } else {
      console.log(`Weekly outlook — top matchups per day:\n`);
      for (const [dayLabel, matches] of matchesByDay) {
        console.log(`  ${dayLabel}`);
        matches.forEach((m, i) => {
          const rivalryTag = isRivalry(m.home_team, m.away_team) ? ' ⚔️  RIVALRY' : '';
          console.log(
            `    ${i + 1}. [Score: ${m.score}] ${m.away_team} vs ${m.home_team} — ${m.league}${rivalryTag}`
          );
        });
        console.log('');
      }
      const prompt = buildWeeklyPrompt(matchesByDay);
      saveAndPrint(prompt, `dicey-weekly-${dateStr}.txt`);
    }
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
