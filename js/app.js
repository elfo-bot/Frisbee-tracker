// ============================================
// METRO Ultimate Frisbee Tracker — App Controller
// ============================================
import * as db from './db.js';
import { renderNav, renderRoster, renderGames, renderGameManager, renderStats } from './ui.js';

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
  // Stats
  allEvents: [],
};

// ---------- Navigation ----------
function navigate(view) {
  state.view = view;
  document.querySelectorAll('.view-section').forEach((s) => s.classList.remove('active'));
  document.getElementById(`view-${view}`).classList.add('active');
  renderNav(view, navigate);
  refresh();
}

// ---------- Refresh current view ----------
async function refresh() {
  showLoading(true);
  try {
    switch (state.view) {
      case 'roster':
        state.players = await db.getPlayers();
        renderRoster(state.players, {
          onAdd: addPlayer,
          onDelete: deletePlayer,
          onToggle: togglePlayer,
        });
        break;
      case 'games':
        state.games = await db.getGames();
        renderGames(state.games, {
          onCreate: createGame,
          onSelect: selectGame,
          onDelete: deleteGame,
        });
        break;
      case 'manager':
        if (state.currentGameId) {
          const data = await db.getGameWithLines(state.currentGameId);
          state.game = data.game;
          state.lines = data.lines;
          state.events = data.events;
          state.players = await db.getPlayers();
        }
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
          }
        );
        break;
      case 'stats':
        state.games = await db.getGames();
        state.players = await db.getPlayers();
        // Fetch events for all games
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

// ---------- Roster handlers ----------
async function addPlayer({ name, gender, number }) {
  if (!name || !gender) return showToast('Name and gender are required.', true);
  await db.addPlayer({ name, gender, number });
  showToast(`${name} added to roster`);
  refresh();
}

async function deletePlayer(id) {
  if (!confirm('Remove this player from roster?')) return;
  await db.deletePlayer(id);
  showToast('Player removed');
  refresh();
}

async function togglePlayer(id, active) {
  await db.updatePlayer(id, { active });
  refresh();
}

// ---------- Games handlers ----------
async function createGame({ date, opponent }) {
  if (!opponent) return showToast('Opponent is required.', true);
  const game = await db.createGame({ date, opponent });
  showToast(`Game vs ${opponent} created`);
  refresh();
}

async function selectGame(id) {
  state.currentGameId = id;
  state.selectedLineId = null;
  state.selectedPlayerId = null;
  navigate('manager');
}

async function deleteGame(id) {
  if (!confirm('Delete this game and all its data?')) return;
  await db.deleteGame(id);
  if (state.currentGameId === id) {
    state.currentGameId = null;
    state.game = null;
    state.lines = [];
    state.events = [];
  }
  showToast('Game deleted');
  refresh();
}

// ---------- Game Manager handlers ----------

// Set starting O/D and gender ratio for the game
async function setGameConfig({ start_od, start_gender }) {
  await db.updateGame(state.game.id, { start_od, start_gender });
  state.game.start_od = start_od;
  state.game.start_gender = start_gender;
  showToast(`Game set: start on ${start_od}, first line ${start_gender === 'M' ? '4M+3F' : '3M+4F'}`);
  refresh();
}

// ABBA helpers: compute O/D and gender ratio for a given point number (1-based)
function getPointOD(startOD, pointNum) {
  // ABBA: 1=A, 2=B,B, 4=A,A, 6=B,B ...
  // After the first point, they alternate in pairs
  // Point 1: startOD
  // Point 2,3: flip
  // Point 4,5: startOD
  // Point 6,7: flip ...
  const flip = startOD === 'O' ? 'D' : 'O';
  if (pointNum === 1) return startOD;
  const block = Math.floor((pointNum - 1 + 1) / 2); // 0-indexed block
  return block % 2 === 0 ? startOD : flip;
}

function getPointGender(startGender, pointNum) {
  const flip = startGender === 'M' ? 'F' : 'M';
  if (pointNum === 1) return startGender;
  const block = Math.floor((pointNum - 1 + 1) / 2);
  return block % 2 === 0 ? startGender : flip;
}

function selectPlayer(id) {
  // If we're in assist-pick mode, ignore regular select
  if (state.pendingScorePlayerId) return;
  state.selectedPlayerId = state.selectedPlayerId === id ? null : id;
  refresh();
}

async function addEvent(lineId, playerId, eventType) {
  if (eventType === 'Score') {
    // Record the score event for the scorer
    await db.addEvent({ game_id: state.game.id, line_id: lineId, player_id: playerId, event_type: 'Score' });
    // Enter assist-pick mode
    state.pendingScorePlayerId = playerId;
    state.pendingScoreLineId = lineId;
    state.selectedPlayerId = null;
    showToast('Goal! Now pick who assisted, or Callahan');
    refresh();
    return;
  }
  await db.addEvent({ game_id: state.game.id, line_id: lineId, player_id: playerId, event_type: eventType });
  state.selectedPlayerId = null;
  showToast(`${eventType} recorded`);
  refresh();
}

async function recordAssist(playerId) {
  const lineId = state.pendingScoreLineId;
  await db.addEvent({ game_id: state.game.id, line_id: lineId, player_id: playerId, event_type: 'Assist' });
  // Auto +1 our score
  const newScore = state.game.our_score + 1;
  await db.updateGame(state.game.id, { our_score: newScore });
  state.game.our_score = newScore;
  state.pendingScorePlayerId = null;
  state.pendingScoreLineId = null;
  state.selectedPlayerId = null;
  showToast('Score + Assist recorded! +1 METRO');
  refresh();
}

async function recordCallahan() {
  const lineId = state.pendingScoreLineId;
  const scorerId = state.pendingScorePlayerId;
  // Record Callahan event for the scorer
  await db.addEvent({ game_id: state.game.id, line_id: lineId, player_id: scorerId, event_type: 'Callahan' });
  // Auto +1 our score
  const newScore = state.game.our_score + 1;
  await db.updateGame(state.game.id, { our_score: newScore });
  state.game.our_score = newScore;
  state.pendingScorePlayerId = null;
  state.pendingScoreLineId = null;
  state.selectedPlayerId = null;
  showToast('CALLAHAN! +1 METRO');
  refresh();
}

async function theyScored() {
  const newScore = state.game.their_score + 1;
  await db.updateGame(state.game.id, { their_score: newScore });
  state.game.their_score = newScore;
  state.selectedPlayerId = null;
  showToast(`They scored. ${state.game.opponent} +1`);
  refresh();
}

async function deleteEvent(id) {
  await db.deleteEvent(id);
  showToast('Event removed');
  refresh();
}

async function endPoint(lineId) {
  // Complete the active line
  await db.updateLine(lineId, { status: 'completed' });
  state.pendingScorePlayerId = null;
  state.pendingScoreLineId = null;
  // Activate next planned line if exists
  const nextPlanned = state.lines.find((l) => l.status === 'planned');
  if (nextPlanned) {
    const mCount = (nextPlanned.players || []).filter((p) => p.gender === 'M').length;
    const fCount = (nextPlanned.players || []).filter((p) => p.gender === 'F').length;
    const ratioOk = (nextPlanned.players || []).length === 7 && ((mCount === 4 && fCount === 3) || (mCount === 3 && fCount === 4));
    if (ratioOk) {
      // Calculate the next point's O/D and gender from ABBA
      const nextPointNum = nextPlanned.line_number;
      const updates = { status: 'active' };
      if (state.game.start_od) {
        updates.od_type = getPointOD(state.game.start_od, nextPointNum);
      }
      if (state.game.start_gender) {
        updates.gender_ratio = getPointGender(state.game.start_gender, nextPointNum);
      }
      await db.updateLine(nextPlanned.id, updates);
      showToast(`Line #${nextPlanned.line_number} now active`);
    } else {
      showToast('Next line doesn\'t have valid ratio. Set it up manually.', true);
    }
  }
  state.selectedPlayerId = null;
  refresh();
}

async function createLine() {
  const nextNum = state.lines.length + 1;
  const line = await db.createLine({ game_id: state.game.id, line_number: nextNum });
  state.selectedLineId = line.id;
  showToast(`Line #${nextNum} created`);
  refresh();
}

function editLine(lineId) {
  state.selectedLineId = lineId;
  refresh();
}

async function activateLine(lineId) {
  const line = state.lines.find((l) => l.id === lineId);
  const pointNum = line ? line.line_number : 1;
  const updates = { status: 'active' };
  if (state.game.start_od) {
    updates.od_type = getPointOD(state.game.start_od, pointNum);
  }
  if (state.game.start_gender) {
    updates.gender_ratio = getPointGender(state.game.start_gender, pointNum);
  }
  await db.updateLine(lineId, updates);
  state.selectedLineId = null;
  showToast('Line activated');
  refresh();
}

async function deleteLine(lineId) {
  if (!confirm('Delete this planned line?')) return;
  await db.deleteLine(lineId);
  if (state.selectedLineId === lineId) state.selectedLineId = null;
  showToast('Line deleted');
  refresh();
}

async function addToLine(lineId, playerId) {
  await db.addPlayerToLine(lineId, playerId);
  refresh();
}

async function removeFromLine(lineId, playerId) {
  await db.removePlayerFromLine(lineId, playerId);
  refresh();
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
