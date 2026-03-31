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
          },
          {
            onScoreChange: changeScore,
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
async function changeScore(team, delta) {
  const field = team === 'our' ? 'our_score' : 'their_score';
  const current = team === 'our' ? state.game.our_score : state.game.their_score;
  const newVal = Math.max(0, current + delta);
  await db.updateGame(state.game.id, { [field]: newVal });
  state.game[field] = newVal;
  refresh();
}

function selectPlayer(id) {
  state.selectedPlayerId = state.selectedPlayerId === id ? null : id;
  refresh();
}

async function addEvent(lineId, playerId, eventType) {
  await db.addEvent({ game_id: state.game.id, line_id: lineId, player_id: playerId, event_type: eventType });
  state.selectedPlayerId = null;
  showToast(`${eventType} recorded`);
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
  // Activate next planned line if exists
  const nextPlanned = state.lines.find((l) => l.status === 'planned');
  if (nextPlanned) {
    const mCount = (nextPlanned.players || []).filter((p) => p.gender === 'M').length;
    const fCount = (nextPlanned.players || []).filter((p) => p.gender === 'F').length;
    const ratioOk = (nextPlanned.players || []).length === 7 && ((mCount === 4 && fCount === 3) || (mCount === 3 && fCount === 4));
    if (ratioOk) {
      await db.updateLine(nextPlanned.id, { status: 'active' });
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
  await db.updateLine(lineId, { status: 'active' });
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

// ---------- Init ----------
document.addEventListener('DOMContentLoaded', () => {
  navigate('roster');
});
