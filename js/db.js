// ============================================
// METRO Ultimate Frisbee Tracker — Database Layer
// ============================================
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const supabaseUrl = SUPABASE_URL;
const supabaseKey = SUPABASE_ANON_KEY;

// ---------- helpers ----------
async function query(path, { method = 'GET', body, headers: extra = {}, params } = {}) {
  let url = `${supabaseUrl}/rest/v1/${path}`;
  if (params) {
    const qs = new URLSearchParams(params).toString();
    url += `?${qs}`;
  }
  const headers = {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json',
    Prefer: method === 'POST' ? 'return=representation' : (method === 'PATCH' ? 'return=representation' : ''),
    ...extra,
  };
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${method} ${path} failed: ${res.status} ${text}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ---------- Players ----------
export async function getPlayers() {
  return query('players', { params: { select: '*', order: 'name.asc' } });
}

export async function addPlayer({ name, gender, number }) {
  const rows = await query('players', { method: 'POST', body: { name, gender, number } });
  return rows[0];
}

export async function updatePlayer(id, fields) {
  return query(`players?id=eq.${id}`, { method: 'PATCH', body: fields });
}

export async function deletePlayer(id) {
  return query(`players?id=eq.${id}`, { method: 'DELETE' });
}

// ---------- Games ----------
export async function getGames() {
  return query('games', { params: { select: '*', order: 'created_at.desc' } });
}

export async function createGame({ date, opponent }) {
  const rows = await query('games', { method: 'POST', body: { date, opponent } });
  return rows[0];
}

export async function updateGame(id, fields) {
  return query(`games?id=eq.${id}`, { method: 'PATCH', body: fields });
}

export async function deleteGame(id) {
  return query(`games?id=eq.${id}`, { method: 'DELETE' });
}

// ---------- Lines ----------
export async function getLines(gameId) {
  return query('lines', { params: { select: '*', game_id: `eq.${gameId}`, order: 'line_number.asc' } });
}

export async function createLine({ game_id, line_number }) {
  const rows = await query('lines', { method: 'POST', body: { game_id, line_number } });
  return rows[0];
}

export async function updateLine(id, fields) {
  return query(`lines?id=eq.${id}`, { method: 'PATCH', body: fields });
}

export async function deleteLine(id) {
  return query(`lines?id=eq.${id}`, { method: 'DELETE' });
}

// ---------- Line Players ----------
export async function getLinePlayers(lineId) {
  return query('line_players', { params: { select: '*,players(*)', line_id: `eq.${lineId}` } });
}

export async function addPlayerToLine(lineId, playerId) {
  return query('line_players', { method: 'POST', body: { line_id: lineId, player_id: playerId } });
}

export async function removePlayerFromLine(lineId, playerId) {
  return query(`line_players?line_id=eq.${lineId}&player_id=eq.${playerId}`, { method: 'DELETE' });
}

// ---------- Events ----------
export async function addEvent({ game_id, line_id, player_id, event_type }) {
  const rows = await query('player_events', { method: 'POST', body: { game_id, line_id, player_id, event_type } });
  return rows[0];
}

export async function getGameEvents(gameId) {
  return query('player_events', { params: { select: '*,players(name,number,gender)', game_id: `eq.${gameId}`, order: 'created_at.asc' } });
}

export async function deleteEvent(id) {
  return query(`player_events?id=eq.${id}`, { method: 'DELETE' });
}

// ---------- Composite queries ----------
export async function getGameWithLines(gameId) {
  const [game, lines, events] = await Promise.all([
    query('games', { params: { select: '*', id: `eq.${gameId}` } }),
    query('lines', { params: { select: '*', game_id: `eq.${gameId}`, order: 'line_number.asc' } }),
    query('player_events', { params: { select: '*', game_id: `eq.${gameId}` } }),
  ]);
  // For each line, fetch its players
  const linesWithPlayers = await Promise.all(
    lines.map(async (line) => {
      const lps = await getLinePlayers(line.id);
      return { ...line, players: lps.map((lp) => lp.players) };
    })
  );
  return { game: game[0], lines: linesWithPlayers, events };
}
