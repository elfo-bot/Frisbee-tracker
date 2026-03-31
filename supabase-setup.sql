-- ============================================
-- METRO Ultimate Frisbee Tracker — Supabase Setup
-- ============================================
-- Paste this entire file into Supabase SQL Editor and click "Run"

-- 1. Players
CREATE TABLE IF NOT EXISTS players (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('M', 'F')),
  number INTEGER,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Games
CREATE TABLE IF NOT EXISTS games (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  opponent TEXT NOT NULL,
  our_score INTEGER DEFAULT 0,
  their_score INTEGER DEFAULT 0,
  start_od TEXT DEFAULT NULL CHECK (start_od IN ('O', 'D')),
  start_gender TEXT DEFAULT NULL CHECK (start_gender IN ('M', 'F')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Lines (each point in a game)
CREATE TABLE IF NOT EXISTS lines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  od_type TEXT DEFAULT NULL CHECK (od_type IN ('O', 'D')),
  gender_ratio TEXT DEFAULT NULL CHECK (gender_ratio IN ('M', 'F')),
  status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'completed')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Line-Players junction
CREATE TABLE IF NOT EXISTS line_players (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  line_id UUID NOT NULL REFERENCES lines(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  UNIQUE(line_id, player_id)
);

-- 5. Player events
CREATE TABLE IF NOT EXISTS player_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  line_id UUID NOT NULL REFERENCES lines(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('D', 'Score', 'Assist', 'Turnover', 'Callahan')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- Open access: disable RLS so anyone with the
-- anon key can read/write (no login required).
-- ============================================
ALTER TABLE players     ENABLE ROW LEVEL SECURITY;
ALTER TABLE games       ENABLE ROW LEVEL SECURITY;
ALTER TABLE lines       ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_events ENABLE ROW LEVEL SECURITY;

-- Allow all operations for anonymous users
CREATE POLICY "Allow all on players"       ON players       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on games"         ON games         FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on lines"         ON lines         FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on line_players"  ON line_players  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on player_events" ON player_events FOR ALL USING (true) WITH CHECK (true);
