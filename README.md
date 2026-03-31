# METRO — Ultimate Frisbee Tracker 🚇

A single-page web app for tracking your ultimate frisbee team's playtime and performance, deployed on GitHub Pages and backed by Supabase.

## Features

- **Roster management** — Add players with name, number, and gender (M/F)
- **Game tracking** — Create games, track scores point-by-point
- **Line management** — Build 7-player lines with gender ratio enforcement (4M+3F or 3M+4F)
- **Plan ahead** — Queue up future lines while the current point is being played
- **Event logging** — Record D, Score, Assist, Turnover for each player per point
- **Live summary table** — Real-time stats for the current game
- **All-time stats** — Per-player stats across all games, filterable by game
- **Metro/subway themed UI** — Dark mode, station navigation, departure-board scoreboard

---

## Setup Guide

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up / sign in
2. Click **New Project**
3. Give it a name (e.g., `metro-tracker`), set a database password, choose a region
4. Wait for the project to finish provisioning

### 2. Run the Database Setup SQL

1. In your Supabase dashboard, go to **SQL Editor** (left sidebar)
2. Click **New Query**
3. Copy the entire contents of `supabase-setup.sql` from this repo and paste it in
4. Click **Run** — you should see "Success" for all statements

### 3. Get Your API Credentials

1. In Supabase dashboard, go to **Settings → API**
2. Copy the **Project URL** (e.g., `https://abc123.supabase.co`)
3. Copy the **anon / public** key (the long `eyJ...` string)

### 4. Configure the App

1. Open `js/config.js` in this repo
2. Replace the placeholder values:

```js
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY_HERE';
```

### 5. Deploy to GitHub Pages

1. Create a new GitHub repository
2. Push this code to the `main` branch:

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git branch -M main
git push -u origin main
```

3. In GitHub, go to **Settings → Pages**
4. Under "Source", select **Deploy from a branch**
5. Choose `main` branch and `/ (root)` folder
6. Click **Save**
7. Your site will be live at `https://YOUR_USERNAME.github.io/YOUR_REPO/`

### 6. Test It

1. Visit your GitHub Pages URL
2. Go to **ROSTER** and add a few players
3. Go to **GAMES** and create a game
4. Click **MANAGE** to enter the game manager
5. Create planned lines, activate one, and log events
6. Check the live summary table at the bottom

---

## Tech Stack

- **Frontend**: Vanilla HTML / CSS / JavaScript (ES modules)
- **Backend**: Supabase (PostgreSQL + REST API)
- **Hosting**: GitHub Pages (static files, no build step)

---

## File Structure

```
├── index.html              ← Single page app shell
├── css/style.css           ← Metro/subway theme styles
├── js/
│   ├── config.js           ← Your Supabase credentials (edit this)
│   ├── db.js               ← All database CRUD operations
│   ├── ui.js               ← View rendering functions
│   └── app.js              ← State management & event handlers
├── supabase-setup.sql      ← SQL to set up your database
└── README.md               ← This file
```

---

## Gender Ratio Rules

Lines must have exactly 7 players in one of these combos:
- **4 Male + 3 Female**
- **3 Male + 4 Female**

The app enforces this: you can't activate a line with an invalid ratio.
