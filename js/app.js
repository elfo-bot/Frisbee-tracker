// ============================================
// METRO Ultimate Frisbee Tracker — App Controller
// ============================================
import * as db from './db.js';
import { renderNav, renderRoster, renderSquads, renderGames, renderGameManager, renderStats } from './ui.js';

// ---------- State ----------
const state = {
  view: 'roster',
  players: [],
  games: [],
  // Game manager
  currentGameId: null,
  game: null,
  lines: [],
  events: [],
  selectedLineId: null,
  selectedPlayerId: null,
  // Score flow state: when a player scores, we prompt for assist
  pendingScorePlayerId: null,
  pendingScoreLineId: null,
  // Current O/D side — updated after each score (not ABBA; based on who scored)
  currentOD: null,
  // Squads — pre-assigned player groupings (Line A / B / C), stored in localStorage
  squads: {},
  // Builder filter state (persists across add/remove clicks without a DB refetch)
  squadFilter: null,  // null | 'A' | 'B' | 'C'
  builderSearch: '',
  // Stats
  allEvents: [],
};

// ---------- Squads (localStorage) ----------
function loadSquads() {
  try { return JSON.parse(localStorage.getItem('metro_squads_v1') || '{}'); }
  catch { return {}; }
}
function saveSquads(squads) {
  localStorage.setItem('metro_squads_v1', JSON.stringify(squads));
}
function setPlayerSquad(playerId, squad) {
  const s = loadSquads();
  if (squad) s[playerId] = squad;
  else delete s[playerId];
  saveSquads(s);
  state.squads = s;
  // No full refresh — just re-render the squads view instantly
  renderSquads(state.players, state.squads, { onAssign: setPlayerSquad });
}

// ---------- Navigation ----------
function navigate(view) {
  state.view = view;
  // Reset builder filter when leaving manager
  if (view !== 'manager') { state.squadFilter = null; state.builderSearch = ''; }
  document.querySelectorAll('.view-section').forEach((s) => s.classList.remove('active'));
  document.getElementById(`view-${view}`).classList.add('active');
  renderNav(view, navigate);
  refresh();
}

// ---------- Refresh current view (only called on navigation / initial load) ----------
async function refresh() {
  showLoading(true);
  try {
    switch (state.view) {
      case 'roster':
        state.players = await db.getPlayers();
        renderRosterView();
        break;
      case 'squads':
        state.players = await db.getPlayers();
        state.squads = loadSquads();
        renderSquads(state.players, state.squads, { onAssign: setPlayerSquad });
        break;
      case 'games':
        state.games = await db.getGames();
        renderGamesView();
        break;
      case 'manager':
        if (state.currentGameId) {
          const data = await db.getGameWithLines(state.currentGameId);
          state.game = data.game;
          state.lines = data.lines;
          state.events = data.events;
          state.players = await db.getPlayers();
          state.squads = loadSquads();
          if (!state.currentOD && state.game && state.game.start_od) {
            state.currentOD = state.game.start_od;
          }
        }
        renderManagerView();
        break;
      case 'stats':
        state.games = await db.getGames();
        state.players = await db.getPlayers();
        const allEventsArrays = await Promise.all(state.games.map((g) => db.getGameEvents(g.id)));
        state.allEvents = allEventsArrays.flat();
        renderStats(state.games, state.allEvents, state.players);
        break;
    }
  } catch (err) {
    console.error('Refresh error:', err);
    showToast('Error loading data. Check console.', true);
  }
  showLoading(false);
}

// ---------- Lightweight re-render helpers (no DB fetch, no spinner) ----------
function renderRosterView() {
  renderRoster(state.players, { onAdd: addPlayer, onDelete: deletePlayer, onToggle: togglePlayer });
}

function renderGamesView() {
  renderGames(state.games, { onCreate: createGame, onSelect: selectGame, onDelete: deleteGame });
}

// ---------- Game manager render (uses cached state, no DB fetch) ----------
function renderManagerView() {
  renderGameManager(
    {
      game: state.game,
      lines: state.lines,
      events: state.events,
      players: state.players,
      selectedLineId: state.selectedLineId,
      selectedPlayerId: state.selectedPlayerId,
      pendingScorePlayerId: state.pendingScorePlayerId,
      pendingScoreLineId: state.pendingScoreLineId,
      squads: state.squads,
      squadFilter: state.squadFilter,
      builderSearch: state.builderSearch,
    },
    {
      onSetGameConfig: setGameConfig,
      onSelectPlayer: selectPlayer,
      onAddEvent: addEvent,
      onDeleteEvent: deleteEvent,
      onEndPoint: endPoint,
      onCreateLine: createLine,
      onEditLine: editLine,
      onActivateLine: activateLine,
      onDeleteLine: deleteLine,
      onAddToLine: addToLine,
      onRemoveFromLine: removeFromLine,
      onTheyScored: theyScored,
      onAssist: recordAssist,
      onCallahan: recordCallahan,
      // Builder filter handlers — fast re-render, no DB fetch
      onBuilderSearch: (text) => { state.builderSearch = text; renderManagerView(); },
      onBuilderSquadFilter: (squad) => {
        state.squadFilter = state.squadFilter === squad ? null : squad;
        renderManagerView();
      },
    }
  );
}

// ---------- Roster handlers ----------
async function addPlayer({ name, gender, number }) {
  if (!name || !gender) return showToast('Name and gender are required.', true);
  const player = await db.addPlayer({ name, gender, number });
  state.players = [...state.players, player];
  showToast(`${name} added to roster`);
  renderRosterView();
}

async function deletePlayer(id) {
  if (!confirm('Remove this player from roster?')) return;
  state.players = state.players.filter((p) => p.id !== id);
  renderRosterView();            // instant
  db.deletePlayer(id);           // fire-and-forget
  showToast('Player removed');
}

async function togglePlayer(id, active) {
  state.players = state.players.map((p) => p.id === id ? { ...p, active } : p);
  renderRosterView();            // instant
  db.updatePlayer(id, { active }); // fire-and-forget
}

// ---------- Games handlers ----------
async function createGame({ date, opponent }) {
  if (!opponent) return showToast('Opponent is required.', true);
  const game = await db.createGame({ date, opponent });
  state.games = [game, ...state.games];
  showToast(`Game vs ${opponent} created`);
  renderGamesView();
}

async function selectGame(id) {
  state.currentGameId = id;
  state.selectedLineId = null;
  state.selectedPlayerId = null;
  state.pendingScorePlayerId = null;
  state.pendingScoreLineId = null;
  state.currentOD = null;
  navigate('manager');
}

async function deleteGame(id) {
  if (!confirm('Delete this game and all its data?')) return;
  state.games = state.games.filter((g) => g.id !== id);
  if (state.currentGameId === id) {
    state.currentGameId = null;
    state.game = null;
    state.lines = [];
    state.events = [];
  }
  renderGamesView();          // instant
  db.deleteGame(id);          // fire-and-forget
  showToast('Game deleted');
}

// ---------- Game Manager handlers ----------

// Set starting O/D and gender ratio for the game
async function setGameConfig({ start_od, start_gender }) {
  const updates = {};
  if (start_od !== null) updates.start_od = start_od;
  if (start_gender !== null) updates.start_gender = start_gender;
  // Optimistic: update state immediately, re-render, then persist
  if (start_od !== null) state.game.start_od = start_od;
  if (start_gender !== null) state.game.start_gender = start_gender;
  if (!state.currentOD && state.game.start_od) state.currentOD = state.game.start_od;
  const odLabel = state.game.start_od ? `start on ${state.game.start_od}` : '';
  const gLabel = state.game.start_gender ? (state.game.start_gender === 'M' ? '4M+3F first' : '3M+4F first') : '';
  if (odLabel || gLabel) showToast([odLabel, gLabel].filter(Boolean).join(', '));
  renderManagerView();
  db.updateGame(state.game.id, updates); // fire-and-forget
}

// ABBA gender helper — cycle A,B,B,A,A,B,B,A... (only for gender, not O/D)
// O/D is NOT ABBA — it flips based on who scored each point
function getPointGender(startGender, pointNum) {
  // Reference cycle: [A, B, B, A] repeating
  const cycle = [0, 1, 1, 0];
  const isFlip = cycle[(pointNum - 1) % 4] === 1;
  if (!isFlip) return startGender;
  return startGender === 'M' ? 'F' : 'M';
}

function selectPlayer(id) {
  // If we're in assist-pick mode, ignore regular select
  if (state.pendingScorePlayerId) return;
  state.selectedPlayerId = state.selectedPlayerId === id ? null : id;
  renderManagerView(); // pure state change — no DB
}

async function addEvent(lineId, playerId, eventType) {
  if (eventType === 'Score') {
    // Record the score event, enter assist-pick mode instantly
    state.pendingScorePlayerId = playerId;
    state.pendingScoreLineId = lineId;
    state.selectedPlayerId = null;
    renderManagerView(); // instant UI switch
    db.addEvent({ game_id: state.game.id, line_id: lineId, player_id: playerId, event_type: 'Score' }) // persist in background
      .then((ev) => { if (ev) state.events = [...state.events, ev]; });
    showToast('Goal! Now pick who assisted, or Callahan');
    return;
  }
  // Optimistic: add event to local state immediately
  const optimisticEv = { id: '__pending__', game_id: state.game.id, line_id: lineId, player_id: playerId, event_type: eventType };
  state.events = [...state.events, optimisticEv];
  state.selectedPlayerId = null;
  renderManagerView();
  showToast(`${eventType} recorded`);
  // Persist and swap optimistic entry with real one
  const saved = await db.addEvent({ game_id: state.game.id, line_id: lineId, player_id: playerId, event_type: eventType });
  if (saved) state.events = state.events.map((e) => e.id === '__pending__' ? saved : e);
}

async function recordAssist(playerId) {
  const lineId = state.pendingScoreLineId;
  // Optimistic score update
  const newScore = state.game.our_score + 1;
  state.game.our_score = newScore;
  state.currentOD = 'D';
  const completedLineId = state.pendingScoreLineId;
  state.pendingScorePlayerId = null;
  state.pendingScoreLineId = null;
  state.selectedPlayerId = null;
  showToast('⚡ GOAL + Assist! +1 METRO — auto-advancing...');
  // Optimistically advance the line in state, then run DB calls
  advancePointInState();
  renderManagerView();
  // Persist in background (parallel)
  await Promise.all([
    db.addEvent({ game_id: state.game.id, line_id: lineId, player_id: playerId, event_type: 'Assist' }),
    db.updateGame(state.game.id, { our_score: newScore }),
    persistEndPoint(completedLineId),
  ]);
}

async function recordCallahan() {
  const lineId = state.pendingScoreLineId;
  const scorerId = state.pendingScorePlayerId;
  // Optimistic score update
  const newScore = state.game.our_score + 1;
  state.game.our_score = newScore;
  state.currentOD = 'D';
  const completedLineId = state.pendingScoreLineId;
  state.pendingScorePlayerId = null;
  state.pendingScoreLineId = null;
  state.selectedPlayerId = null;
  showToast('🔥 CALLAHAN! +1 METRO — auto-advancing...');
  advancePointInState();
  renderManagerView();
  await Promise.all([
    db.addEvent({ game_id: state.game.id, line_id: lineId, player_id: scorerId, event_type: 'Callahan' }),
    db.updateGame(state.game.id, { our_score: newScore }),
    persistEndPoint(completedLineId),
  ]);
}

async function theyScored() {
  const activeLine = state.lines.find((l) => l.status === 'active');
  const newScore = state.game.their_score + 1;
  state.game.their_score = newScore;
  state.currentOD = 'O';
  state.pendingScorePlayerId = null;
  state.pendingScoreLineId = null;
  state.selectedPlayerId = null;
  showToast(`🚨 They scored. ${state.game.opponent} +1 — auto-advancing...`);
  if (activeLine) {
    advancePointInState();
    renderManagerView();
    await Promise.all([
      db.updateGame(state.game.id, { their_score: newScore }),
      persistEndPoint(activeLine.id),
    ]);
  } else {
    renderManagerView();
    db.updateGame(state.game.id, { their_score: newScore });
  }
}

async function deleteEvent(id) {
  state.events = state.events.filter((e) => e.id !== id); // optimistic
  renderManagerView();
  db.deleteEvent(id); // fire-and-forget
  showToast('Event removed');
}

// Optimistically advance the point in local state (complete active line, activate next planned)
function advancePointInState() {
  const activeLine = state.lines.find((l) => l.status === 'active');
  if (activeLine) activeLine.status = 'completed';
  const nextPlanned = state.lines.find((l) => l.status === 'planned');
  if (nextPlanned) {
    const mCount = (nextPlanned.players || []).filter((p) => p.gender === 'M').length;
    const fCount = (nextPlanned.players || []).filter((p) => p.gender === 'F').length;
    const ratioOk = (nextPlanned.players || []).length === 7 &&
      ((mCount === 4 && fCount === 3) || (mCount === 3 && fCount === 4));
    if (ratioOk) {
      nextPlanned.status = 'active';
      if (state.currentOD) nextPlanned.od_type = state.currentOD;
      if (state.game.start_gender) nextPlanned.gender_ratio = getPointGender(state.game.start_gender, nextPlanned.line_number);
      showToast(`▶ Line #${nextPlanned.line_number} active · ${nextPlanned.od_type || '?'} · ${nextPlanned.gender_ratio === 'M' ? '4M+3F' : nextPlanned.gender_ratio === 'F' ? '3M+4F' : ''}`);
    } else {
      showToast('⚠ Next line needs valid 7-player ratio — set it up!', true);
    }
  } else {
    showToast('No next line queued — add one in PLANNED LINES below', true);
  }
  state.selectedPlayerId = null;
}

// Persist the end-of-point DB changes without blocking the UI
async function persistEndPoint(completedLineId) {
  await db.updateLine(completedLineId, { status: 'completed' });
  // Find the line we just activated in state and persist its updates
  const nowActive = state.lines.find((l) => l.status === 'active');
  if (nowActive && nowActive.id !== completedLineId) {
    const updates = { status: 'active' };
    if (nowActive.od_type) updates.od_type = nowActive.od_type;
    if (nowActive.gender_ratio) updates.gender_ratio = nowActive.gender_ratio;
    await db.updateLine(nowActive.id, updates);
  }
}

// Legacy endPoint — still used when manually pressing End Point button
async function endPoint(lineId) {
  advancePointInState();
  renderManagerView();
  await persistEndPoint(lineId);
  state.selectedPlayerId = null;
}

async function createLine() {
  const nextNum = state.lines.length + 1;
  // Add a placeholder so the UI shows the new line immediately
  const placeholder = { id: '__new__', line_number: nextNum, status: 'planned', players: [], game_id: state.game.id };
  state.lines = [...state.lines, placeholder];
  state.selectedLineId = '__new__';
  renderManagerView();
  // Persist and replace placeholder with real line
  const line = await db.createLine({ game_id: state.game.id, line_number: nextNum });
  state.lines = state.lines.map((l) => l.id === '__new__' ? { ...line, players: [] } : l);
  state.selectedLineId = line.id;
  renderManagerView();
  showToast(`Line #${nextNum} created`);
}

function editLine(lineId) {
  state.selectedLineId = lineId;
  renderManagerView(); // pure state change — no DB
}

async function activateLine(lineId) {
  const line = state.lines.find((l) => l.id === lineId);
  const pointNum = line ? line.line_number : 1;
  const od = state.currentOD || state.game.start_od;
  const gender_ratio = state.game.start_gender ? getPointGender(state.game.start_gender, pointNum) : null;
  // Optimistic update
  if (line) {
    line.status = 'active';
    if (od) line.od_type = od;
    if (gender_ratio) line.gender_ratio = gender_ratio;
  }
  state.selectedLineId = null;
  renderManagerView();
  showToast(`▶ Line activated · ${od || '?'} · ${gender_ratio === 'M' ? '4M+3F' : gender_ratio === 'F' ? '3M+4F' : ''}`);
  // Persist in background
  const updates = { status: 'active' };
  if (od) updates.od_type = od;
  if (gender_ratio) updates.gender_ratio = gender_ratio;
  db.updateLine(lineId, updates);
}

async function deleteLine(lineId) {
  if (!confirm('Delete this planned line?')) return;
  state.lines = state.lines.filter((l) => l.id !== lineId); // optimistic
  if (state.selectedLineId === lineId) state.selectedLineId = null;
  renderManagerView();
  db.deleteLine(lineId); // fire-and-forget
  showToast('Line deleted');
}

async function addToLine(lineId, playerId) {
  // Optimistic: add player object to line's players array immediately
  const player = state.players.find((p) => p.id === playerId);
  const line = state.lines.find((l) => l.id === lineId);
  if (line && player) {
    line.players = [...(line.players || []), player];
    renderManagerView(); // instant
  }
  db.addPlayerToLine(lineId, playerId); // fire-and-forget
}

async function removeFromLine(lineId, playerId) {
  // Optimistic: remove player from line's players array immediately
  const line = state.lines.find((l) => l.id === lineId);
  if (line) {
    line.players = (line.players || []).filter((p) => p.id !== playerId);
    renderManagerView(); // instant
  }
  db.removePlayerFromLine(lineId, playerId); // fire-and-forget
}

// ---------- Utilities ----------
function showLoading(on) {
  document.getElementById('loading').style.display = on ? 'flex' : 'none';
}

function showToast(msg, isError = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast show${isError ? ' error' : ''}`;
  setTimeout(() => (t.className = 'toast'), 2500);
}

// ---------- Seed data (auto-inserts 22 test players on first load) ----------
const SEED_PLAYERS = [
  { name: 'Alex Chen',    gender: 'M', number: 1 },
  { name: 'Jordan Wu',    gender: 'M', number: 2 },
  { name: 'Marcus Lee',   gender: 'M', number: 3 },
  { name: 'Ryan Patel',   gender: 'M', number: 4 },
  { name: 'Derek Tan',    gender: 'M', number: 5 },
  { name: 'Kevin Ng',     gender: 'M', number: 6 },
  { name: 'Sam Huang',    gender: 'M', number: 7 },
  { name: 'Tyler Kim',    gender: 'M', number: 8 },
  { name: 'Brandon Liu',  gender: 'M', number: 9 },
  { name: 'Chris Yang',   gender: 'M', number: 10 },
  { name: 'Nathan Ho',    gender: 'M', number: 11 },
  { name: 'Mia Zhang',    gender: 'F', number: 12 },
  { name: 'Sophie Lin',   gender: 'F', number: 13 },
  { name: 'Emma Wang',    gender: 'F', number: 14 },
  { name: 'Olivia Cho',   gender: 'F', number: 15 },
  { name: 'Hannah Lim',   gender: 'F', number: 16 },
  { name: 'Chloe Sun',    gender: 'F', number: 17 },
  { name: 'Ava Cheng',    gender: 'F', number: 18 },
  { name: 'Lily Fong',    gender: 'F', number: 19 },
  { name: 'Grace Yip',    gender: 'F', number: 20 },
  { name: 'Zoe Park',     gender: 'F', number: 21 },
  { name: 'Ruby Tam',     gender: 'F', number: 22 },
];

async function seedIfEmpty() {
  try {
    const existing = await db.getPlayers();
    if (existing.length === 0) {
      showLoading(true);
      for (const p of SEED_PLAYERS) {
        await db.addPlayer(p);
      }
      showToast('22 test players seeded!');
      showLoading(false);
    }
  } catch (e) {
    // Supabase not configured yet — silently skip
    console.warn('Seed skipped (Supabase not configured?):', e.message);
  }
}

// ---------- Init ----------
document.addEventListener('DOMContentLoaded', async () => {
  await seedIfEmpty();
  navigate('roster');
});
