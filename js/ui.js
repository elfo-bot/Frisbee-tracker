// ============================================
// METRO Ultimate Frisbee Tracker — UI Renderer
// ============================================

// ---------- helpers ----------
function el(tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'className') e.className = v;
    else if (k === 'dataset') Object.assign(e.dataset, v);
    else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v);
    else e.setAttribute(k, v);
  }
  for (const c of Array.isArray(children) ? children : [children]) {
    if (typeof c === 'string') e.appendChild(document.createTextNode(c));
    else if (c) e.appendChild(c);
  }
  return e;
}

function clearEl(container) {
  container.innerHTML = '';
}

// ABBA gender helper (mirrored from app.js — used for UI prediction in planned lines)
function abbaGender(startGender, pointNum) {
  const cycle = [0, 1, 1, 0];
  const isFlip = cycle[(pointNum - 1) % 4] === 1;
  if (!isFlip) return startGender;
  return startGender === 'M' ? 'F' : 'M';
}

// Sort players: Males first, then Females (stable within each gender)
function sortByGender(players) {
  return [...players].sort((a, b) => {
    if (a.gender === b.gender) return 0;
    return a.gender === 'M' ? -1 : 1;
  });
}

// ---------- NAV ----------
export function renderNav(activeView, onNavigate) {
  const nav = document.getElementById('nav-stations');
  clearEl(nav);
  const views = [
    { id: 'roster', label: 'ROSTER' },
    { id: 'squads', label: 'SQUADS' },
    { id: 'games', label: 'GAMES' },
    { id: 'manager', label: 'GAME MGR' },
    { id: 'stats', label: 'STATS' },
  ];
  views.forEach((v, i) => {
    const station = el('button', {
      className: `station${v.id === activeView ? ' active' : ''}`,
      dataset: { view: v.id },
      onClick: () => onNavigate(v.id),
    }, [
      el('span', { className: 'station-dot' }),
      el('span', { className: 'station-label' }, v.label),
    ]);
    nav.appendChild(station);
    if (i < views.length - 1) nav.appendChild(el('span', { className: 'station-line' }));
  });
}

// ---------- SQUADS VIEW ----------
export function renderSquads(players, squads, { onAssign }) {
  const sec = document.getElementById('view-squads');
  clearEl(sec);

  sec.appendChild(el('h2', { className: 'page-title' }, 'SQUAD LINES'));
  sec.appendChild(el('p', { className: 'squads-hint' }, 'Pre-assign players to Line A, B, or C. These groups appear as quick filters when building game lines.'));

  const LABELS = ['A', 'B', 'C'];

  // Unassigned pool — shown FIRST for quick access
  const unassigned = sortByGender(players.filter((p) => p.active && !squads[p.id]));
  const unSec = el('div', { className: 'section-block' });
  unSec.appendChild(el('h3', { className: 'section-title' }, `UNASSIGNED${unassigned.length > 0 ? ` (${unassigned.length})` : ' — all assigned!'}`));
  if (unassigned.length > 0) {
    const pool = el('div', { className: 'squad-pool' });
    unassigned.forEach((p) => pool.appendChild(makeSquadCard(p, null, LABELS, onAssign)));
    unSec.appendChild(pool);
  }
  sec.appendChild(unSec);

  // Three squad columns below
  const grid = el('div', { className: 'squads-grid' });
  LABELS.forEach((label) => {
    const col = el('div', { className: `squad-col squad-col-${label.toLowerCase()}` });
    col.appendChild(el('h3', { className: 'squad-col-title' }, `LINE ${label}`));
    const squadPlayers = sortByGender(players.filter((p) => squads[p.id] === label));
    if (squadPlayers.length === 0) {
      col.appendChild(el('p', { className: 'squad-empty' }, '— empty —'));
    } else {
      squadPlayers.forEach((p) => col.appendChild(makeSquadCard(p, label, LABELS, onAssign)));
    }
    grid.appendChild(col);
  });
  sec.appendChild(grid);

  // Inactive players note
  const inactive = players.filter((p) => !p.active);
  if (inactive.length > 0) {
    sec.appendChild(el('p', { className: 'squads-hint' }, `${inactive.length} inactive player(s) not shown. Toggle active in ROSTER.`));
  }
}

function makeSquadCard(player, currentSquad, labels, onAssign) {
  const card = el('div', { className: `squad-card ${player.gender === 'M' ? 'male' : 'female'}` });
  // Name row
  card.appendChild(el('div', { className: 'squad-card-name' }, [
    player.number != null ? el('span', { className: 'player-number' }, `#${player.number}`) : el('span', {}),
    el('span', {}, player.name),
  ]));

  if (currentSquad) {
    // Already assigned — click to unassign (return to unassigned)
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => onAssign(player.id, null));
  } else {
    // Unassigned — show A/B/C buttons
    const btns = el('div', { className: 'squad-card-btns' });
    labels.forEach((s) => {
      btns.appendChild(el('button', {
        className: 'btn btn-tiny squad-btn',
        onClick: () => onAssign(player.id, s),
      }, s));
    });
    card.appendChild(btns);
  }
  return card;
}

// ---------- ROSTER VIEW ----------
export function renderRoster(players, { onAdd, onDelete, onToggle }) {
  const sec = document.getElementById('view-roster');
  clearEl(sec);

  // Add form
  const form = el('form', { className: 'roster-form', id: 'roster-form' }, [
    el('input', { type: 'text', name: 'name', placeholder: 'Player name', required: 'true', autocomplete: 'off' }),
    el('input', { type: 'number', name: 'number', placeholder: '#', min: '0', max: '99', style: 'width:60px' }),
    el('select', { name: 'gender', required: 'true' }, [
      el('option', { value: '' }, '—'),
      el('option', { value: 'M' }, 'Male'),
      el('option', { value: 'F' }, 'Female'),
    ]),
    el('button', { type: 'submit', className: 'btn btn-green' }, '+ ADD'),
  ]);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    onAdd({ name: fd.get('name').trim(), gender: fd.get('gender'), number: fd.get('number') ? Number(fd.get('number')) : null });
    form.reset();
  });
  sec.appendChild(form);

  // Player list
  const grid = el('div', { className: 'roster-grid' });
  sortByGender(players).forEach((p) => {
    const box = el('div', { className: `player-box ${p.gender === 'M' ? 'male' : 'female'}${!p.active ? ' inactive' : ''}` }, [
      el('span', { className: 'player-number' }, p.number != null ? `#${p.number}` : ''),
      el('span', { className: 'player-name' }, p.name),
      el('span', { className: 'player-gender-badge' }, p.gender),
      el('div', { className: 'player-actions' }, [
        el('button', {
          className: `btn btn-small ${p.active ? 'btn-yellow' : 'btn-green'}`,
          onClick: () => onToggle(p.id, !p.active),
        }, p.active ? 'Bench' : 'Activate'),
        el('button', { className: 'btn btn-small btn-red', onClick: () => onDelete(p.id) }, '✕'),
      ]),
    ]);
    grid.appendChild(box);
  });
  sec.appendChild(grid);
}

// ---------- GAMES VIEW ----------
export function renderGames(games, { onCreate, onSelect, onDelete }) {
  const sec = document.getElementById('view-games');
  clearEl(sec);

  const form = el('form', { className: 'game-form', id: 'game-form' }, [
    el('input', { type: 'date', name: 'date', required: 'true', value: new Date().toISOString().slice(0, 10) }),
    el('input', { type: 'text', name: 'opponent', placeholder: 'Opponent name', required: 'true', autocomplete: 'off' }),
    el('button', { type: 'submit', className: 'btn btn-green' }, '+ NEW GAME'),
  ]);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    onCreate({ date: fd.get('date'), opponent: fd.get('opponent').trim() });
    form.reset();
  });
  sec.appendChild(form);

  const list = el('div', { className: 'game-list' });
  games.forEach((g) => {
    const card = el('div', { className: `game-card ${g.status}` }, [
      el('div', { className: 'game-info' }, [
        el('span', { className: 'game-date' }, g.date),
        el('span', { className: 'game-opponent' }, `vs ${g.opponent}`),
        el('span', { className: 'game-score' }, `${g.our_score} – ${g.their_score}`),
      ]),
      el('div', { className: 'game-actions' }, [
        el('button', { className: 'btn btn-blue', onClick: () => onSelect(g.id) }, 'MANAGE'),
        el('button', { className: 'btn btn-small btn-red', onClick: () => onDelete(g.id) }, '✕'),
      ]),
    ]);
    list.appendChild(card);
  });
  sec.appendChild(list);
}

// ---------- GAME MANAGER VIEW ----------
export function renderGameManager(state, handlers) {
  const sec = document.getElementById('view-manager');
  clearEl(sec);

  if (!state.game) {
    sec.appendChild(el('p', { className: 'empty-msg' }, 'Select a game from the GAMES tab first.'));
    return;
  }

  const { game, lines, events, players, selectedLineId, selectedPlayerId, pendingScorePlayerId, pendingScoreLineId,
    squads = {}, squadFilter = null, builderSearch = '', builderGenderFilter = null } = state;

  // ── Game config (O/D + Gender) ──
  // Always show a compact setup strip; block the rest until both are chosen
  if (!game.start_od || !game.start_gender) {
    const configSection = el('div', { className: 'section-block config-block' });
    configSection.appendChild(el('h3', { className: 'section-title' }, 'GAME SETUP'));

    const configForm = el('div', { className: 'config-form' });

    configForm.appendChild(el('label', { className: 'config-label' }, 'We start on:'));
    const odGroup = el('div', { className: 'config-btn-group' });
    ['O', 'D'].forEach((v) => {
      odGroup.appendChild(el('button', {
        className: `btn config-choice${game.start_od === v ? ' chosen' : ''}`,
        onClick: () => handlers.onSetGameConfig({ start_od: v, start_gender: game.start_gender || null }),
      }, v === 'O' ? 'OFFENSE' : 'DEFENSE'));
    });
    configForm.appendChild(odGroup);

    configForm.appendChild(el('label', { className: 'config-label' }, 'First point gender ratio:'));
    const genderGroup = el('div', { className: 'config-btn-group' });
    [{ v: 'M', label: '4M + 3F (Male)' }, { v: 'F', label: '3M + 4F (Female)' }].forEach(({ v, label }) => {
      genderGroup.appendChild(el('button', {
        className: `btn config-choice${game.start_gender === v ? ' chosen' : ''}`,
        onClick: () => handlers.onSetGameConfig({ start_od: game.start_od || null, start_gender: v }),
      }, label));
    });
    configForm.appendChild(genderGroup);

    configSection.appendChild(configForm);

    if (!game.start_od || !game.start_gender) {
      configSection.appendChild(el('p', { className: 'empty-msg' }, 'Set both options above to start tracking.'));
    }
    sec.appendChild(configSection);
    if (!game.start_od || !game.start_gender) return;
  }

  // ── Scoreboard (no manual +/- buttons, scores are auto) ──
  const scoreboard = el('div', { className: 'scoreboard' }, [
    el('div', { className: 'score-team' }, [
      el('span', { className: 'score-name' }, 'METRO'),
      el('span', { className: 'score-value' }, String(game.our_score)),
    ]),
    el('span', { className: 'score-vs' }, 'VS'),
    el('div', { className: 'score-team' }, [
      el('span', { className: 'score-name' }, game.opponent.toUpperCase()),
      el('span', { className: 'score-value their-score' }, String(game.their_score)),
    ]),
  ]);
  sec.appendChild(scoreboard);

  // ── Active line ──
  const activeLine = lines.find((l) => l.status === 'active');
  const activeSection = el('div', { className: 'section-block' });

  // Point info header
  const pointNum = activeLine ? ` — POINT #${activeLine.line_number}` : '';
  activeSection.appendChild(el('h3', { className: 'section-title' }, `LIVE${pointNum}`));

  if (activeLine) {
    // Prominent O/D banner
    if (activeLine.od_type) {
      activeSection.appendChild(el('div', {
        className: `od-banner ${activeLine.od_type === 'O' ? 'od-offense' : 'od-defense'}`,
      }, activeLine.od_type === 'O' ? '⚔️  OFFENSE' : '🛡  DEFENSE'));
    }
    // Gender ratio badge (smaller, below banner)
    if (activeLine.gender_ratio) {
      const badgeRow = el('div', { className: 'point-badges' });
      badgeRow.appendChild(el('span', {
        className: `point-badge ${activeLine.gender_ratio === 'M' ? 'badge-male' : 'badge-female'}`,
      }, activeLine.gender_ratio === 'M' ? '4M + 3F' : '3M + 4F'));
      activeSection.appendChild(badgeRow);
    }
  }

  if (activeLine && activeLine.players) {
    // ── ASSIST PICK MODE ──
    if (pendingScorePlayerId && pendingScoreLineId === activeLine.id) {
      const scorer = activeLine.players.find((p) => p.id === pendingScorePlayerId);
      const assistPanel = el('div', { className: 'assist-panel' });
      assistPanel.appendChild(el('h4', { className: 'assist-title' }, `🎯 ${scorer ? scorer.name : ''} scored! Who assisted?`));

      const assistGrid = el('div', { className: 'line-grid' });
      sortByGender(activeLine.players).forEach((p) => {
        if (p.id === pendingScorePlayerId) return; // Can't assist yourself
        const box = el('div', {
          className: `player-box ${p.gender === 'M' ? 'male' : 'female'} assist-pick`,
          onClick: () => handlers.onAssist(p.id),
        }, [
          el('span', { className: 'player-number' }, p.number != null ? `#${p.number}` : ''),
          el('span', { className: 'player-name' }, p.name),
        ]);
        assistGrid.appendChild(box);
      });
      assistPanel.appendChild(assistGrid);
      assistPanel.appendChild(el('button', {
        className: 'btn btn-green callahan-btn',
        onClick: () => handlers.onCallahan(),
      }, '🔥 CALLAHAN (No Assist)'));
      activeSection.appendChild(assistPanel);
    } else {
      // ── Normal player select + event mode ──
      const lineGrid = el('div', { className: 'line-grid' });
      sortByGender(activeLine.players).forEach((p) => {
        const isSelected = selectedPlayerId === p.id;
        const box = el('div', {
          className: `player-box ${p.gender === 'M' ? 'male' : 'female'}${isSelected ? ' selected' : ''}`,
          onClick: () => handlers.onSelectPlayer(p.id),
        }, [
          el('span', { className: 'player-number' }, p.number != null ? `#${p.number}` : ''),
          el('span', { className: 'player-name' }, p.name),
        ]);
        lineGrid.appendChild(box);
      });
      activeSection.appendChild(lineGrid);

      // Event buttons (show when a player is selected)
      if (selectedPlayerId) {
        const selPlayer = activeLine.players.find((p) => p.id === selectedPlayerId);
        const eventPanel = el('div', { className: 'event-panel' }, [
          ...['D', 'Score', 'Turnover'].map((evt) =>
            el('button', {
              className: `btn event-btn event-${evt.toLowerCase()}`,
              onClick: () => handlers.onAddEvent(activeLine.id, selectedPlayerId, evt),
            }, evt)
          ),
        ]);
        activeSection.appendChild(eventPanel);
      }

      // They Scored button
      activeSection.appendChild(
        el('button', {
          className: 'btn btn-red they-scored-btn',
          onClick: () => handlers.onTheyScored(),
        }, `🚨 THEY SCORED (+1 ${game.opponent.toUpperCase()})`)
      );
    }

    // End point button
    activeSection.appendChild(
      el('button', { className: 'btn btn-yellow end-point-btn', onClick: () => handlers.onEndPoint(activeLine.id) }, '⏭ END POINT / NEXT LINE')
    );
  } else {
    activeSection.appendChild(el('p', { className: 'empty-msg' }, 'No active line. Activate a planned line below.'));
  }
  sec.appendChild(activeSection);

  // Event log for current active line
  if (activeLine) {
    const lineEvents = events.filter((e) => e.line_id === activeLine.id);
    if (lineEvents.length > 0) {
      const logSection = el('div', { className: 'section-block' });
      logSection.appendChild(el('h3', { className: 'section-title' }, 'POINT LOG'));
      const logList = el('div', { className: 'event-log' });
      lineEvents.forEach((ev) => {
        const pName = ev.players ? `${ev.players.name}` : '';
        logList.appendChild(el('div', { className: `event-entry event-${ev.event_type.toLowerCase()}` }, [
          el('span', {}, `${pName}: `),
          el('strong', {}, ev.event_type),
          el('button', { className: 'btn btn-small btn-red', onClick: () => handlers.onDeleteEvent(ev.id), style: 'margin-left:8px' }, '✕'),
        ]));
      });
      logSection.appendChild(logList);
      sec.appendChild(logSection);
    }
  }

  // Planned lines
  const plannedSection = el('div', { className: 'section-block' });
  plannedSection.appendChild(el('h3', { className: 'section-title' }, 'PLANNED LINES'));

  const plannedLines = lines.filter((l) => l.status === 'planned');
  plannedLines.forEach((line) => {
    const mCount = (line.players || []).filter((p) => p.gender === 'M').length;
    const fCount = (line.players || []).filter((p) => p.gender === 'F').length;
    const ratioOk = (line.players || []).length === 7 && ((mCount === 4 && fCount === 3) || (mCount === 3 && fCount === 4));
    const ratioText = `${mCount}M + ${fCount}F`;

    // Predict gender using ABBA when not yet stamped on the line
    const predictedGender = game && game.start_gender
      ? abbaGender(game.start_gender, line.line_number)
      : null;
    const effectiveGender = line.gender_ratio || predictedGender;
    const odLabel = line.od_type ? (line.od_type === 'O' ? '⚔' : '🛡') : '?';
    const genderLabel = effectiveGender ? (effectiveGender === 'M' ? '4M+3F' : '3M+4F') : '';

    const lineCard = el('div', { className: `planned-line-card${selectedLineId === line.id ? ' editing' : ''}` }, [
      el('div', { className: 'planned-line-header' }, [
        el('span', { className: 'line-point-num' }, `PT #${line.line_number}`),
        el('span', { className: `ratio-badge ${ratioOk ? 'ok' : 'warn'}` }, `${ratioText} ${ratioOk ? '✓' : '⚠'}`),
        el('span', { className: 'line-od-label' }, odLabel),
        el('span', { className: 'line-gender-label' }, genderLabel),
        el('div', { className: 'planned-line-actions' }, [
          el('button', { className: 'btn btn-small btn-blue', onClick: () => handlers.onEditLine(line.id) }, 'EDIT'),
          ratioOk && !activeLine
            ? el('button', { className: 'btn btn-small btn-green', onClick: () => handlers.onActivateLine(line.id) }, '▶ GO LIVE')
            : ratioOk && activeLine
              ? el('button', { className: 'btn btn-small btn-green', disabled: 'true', title: 'End current point first' }, '▶ GO LIVE')
              : null,
          el('button', { className: 'btn btn-small btn-red', onClick: () => handlers.onDeleteLine(line.id) }, '✕'),
        ]),
      ]),
      el('div', { className: 'planned-line-players' },
        (line.players || []).map((p) =>
          el('span', { className: `mini-box ${p.gender === 'M' ? 'male' : 'female'}` }, `${p.number != null ? '#' + p.number + ' ' : ''}${p.name}`)
        )
      ),
    ]);
    plannedSection.appendChild(lineCard);
  });

  // Line builder
  const builderWrap = el('div', { className: 'line-builder' });
  const editingLine = selectedLineId ? lines.find((l) => l.id === selectedLineId) : null;
  const editingPlayerIds = editingLine ? (editingLine.players || []).map((p) => p.id) : [];

  const builderMCount = editingLine ? (editingLine.players || []).filter((p) => p.gender === 'M').length : 0;
  const builderFCount = editingLine ? (editingLine.players || []).filter((p) => p.gender === 'F').length : 0;

  builderWrap.appendChild(el('h4', { className: 'builder-title' }, editingLine ? `Editing Line #${editingLine.line_number}  [${builderMCount}M + ${builderFCount}F]` : 'Select a line to edit, or create new:'));

  if (!editingLine) {
    builderWrap.appendChild(
      el('button', { className: 'btn btn-green', onClick: handlers.onCreateLine }, '+ NEW PLANNED LINE')
    );
  } else {
    // ── Filter controls ──
    const filterBar = el('div', { className: 'builder-filter-bar' });

    // Text search
    const searchInput = el('input', {
      type: 'text',
      className: 'builder-search',
      placeholder: '🔍 Search name / #number',
      value: builderSearch,
    });
    searchInput.addEventListener('input', (e) => handlers.onBuilderSearch(e.target.value));
    filterBar.appendChild(searchInput);

    // Squad filter buttons (only show if any players have squad assignments)
    const hasSquads = players.some((p) => squads[p.id]);
    if (hasSquads) {
      const squadBtns = el('div', { className: 'builder-squad-btns' });
      squadBtns.appendChild(el('span', { className: 'filter-label' }, 'LINE:'));
      ['A', 'B', 'C'].forEach((s) => {
        const count = players.filter((p) => p.active && squads[p.id] === s).length;
        if (count === 0) return;
        squadBtns.appendChild(el('button', {
          className: `btn btn-tiny squad-filter-btn${squadFilter === s ? ' active' : ''}`,
          onClick: () => handlers.onBuilderSquadFilter(s),
        }, `${s} (${count})`));
      });
      filterBar.appendChild(squadBtns);
    }

    // Gender filter buttons
    const genderBtns = el('div', { className: 'builder-squad-btns' });
    genderBtns.appendChild(el('span', { className: 'filter-label' }, 'GENDER:'));
    [{ v: 'M', label: '♂ Male' }, { v: 'F', label: '♀ Female' }].forEach(({ v, label }) => {
      genderBtns.appendChild(el('button', {
        className: `btn btn-tiny squad-filter-btn${builderGenderFilter === v ? ' active' : ''}`,
        onClick: () => handlers.onBuilderGenderFilter(v),
      }, label));
    });
    filterBar.appendChild(genderBtns);

    builderWrap.appendChild(filterBar);

    // Apply filters to player list
    const searchLower = builderSearch.toLowerCase();
    const filteredPlayers = players.filter((p) => {
      if (!p.active) return false;
      if (squadFilter && squads[p.id] !== squadFilter) return false;
      if (builderGenderFilter && p.gender !== builderGenderFilter) return false;
      if (searchLower) {
        const nameMatch = p.name.toLowerCase().includes(searchLower);
        const numMatch = p.number != null && String(p.number).includes(searchLower.replace('#', ''));
        if (!nameMatch && !numMatch) return false;
      }
      return true;
    });

    // Compute points played per player for display in builder
    const playedLines = lines.filter((l) => l.status === 'completed' || l.status === 'active');
    const ptsPlayedMap = {};
    players.forEach((p) => {
      ptsPlayedMap[p.id] = playedLines.filter((l) => (l.players || []).some((lp) => lp.id === p.id)).length;
    });

    // Show all active players to toggle in/out
    const rosterGrid = el('div', { className: 'builder-grid' });

    if (filteredPlayers.length === 0) {
      rosterGrid.appendChild(el('p', { className: 'empty-msg' }, 'No players match filter.'));
    }

    sortByGender(filteredPlayers).forEach((p) => {
      const isIn = editingPlayerIds.includes(p.id);
      // Check if adding is allowed
      const canAdd = !isIn && editingPlayerIds.length < 7 && (
        (p.gender === 'M' && builderMCount < 4) || (p.gender === 'F' && builderFCount < 4)
      );
      // Squad badge
      const playerSquad = squads[p.id];
      const pts = ptsPlayedMap[p.id] || 0;
      const box = el('div', {
        className: `player-box small ${p.gender === 'M' ? 'male' : 'female'}${isIn ? ' in-line' : ''}${!isIn && !canAdd ? ' disabled' : ''}`,
        onClick: () => {
          if (isIn) handlers.onRemoveFromLine(editingLine.id, p.id);
          else if (canAdd) handlers.onAddToLine(editingLine.id, p.id);
        },
      }, [
        el('span', { className: 'player-number' }, p.number != null ? `#${p.number}` : ''),
        el('span', { className: 'player-name' }, p.name),
        el('span', { className: 'pts-played-badge' }, `${pts}pt`),
        playerSquad ? el('span', { className: 'squad-mini-badge' }, playerSquad) : null,
        isIn ? el('span', { className: 'in-badge' }, '✓') : null,
      ]);
      rosterGrid.appendChild(box);
    });
    builderWrap.appendChild(rosterGrid);
    builderWrap.appendChild(el('div', { className: 'done-editing-wrap' },
      [el('button', { className: 'btn btn-yellow done-editing-btn', onClick: () => handlers.onEditLine(null) }, '✓ DONE EDITING')]
    ));
  }
  plannedSection.appendChild(builderWrap);
  sec.appendChild(plannedSection);

  // Completed lines
  const completedLines = lines.filter((l) => l.status === 'completed');
  if (completedLines.length > 0) {
    const compSection = el('div', { className: 'section-block' });
    compSection.appendChild(el('h3', { className: 'section-title' }, `COMPLETED LINES (${completedLines.length})`));
    completedLines.forEach((line) => {
      compSection.appendChild(el('div', { className: 'completed-line' }, [
        el('span', {}, `Line #${line.line_number}`),
        el('div', { className: 'planned-line-players' },
          (line.players || []).map((p) =>
            el('span', { className: `mini-box ${p.gender === 'M' ? 'male' : 'female'}` }, `${p.number != null ? '#' + p.number + ' ' : ''}${p.name}`)
          )
        ),
      ]));
    });
    sec.appendChild(compSection);
  }

  // Live summary removed from game manager (available in STATS tab)
}

// ---------- LIVE SUMMARY TABLE ----------
function renderLiveSummary(container, players, lines, events) {
  const section = el('div', { className: 'section-block summary-section' });
  section.appendChild(el('h3', { className: 'section-title' }, 'GAME SUMMARY'));

  const table = el('table', { className: 'summary-table' });
  const thead = el('thead', {}, [
    el('tr', {}, [
      el('th', {}, '#'),
      el('th', {}, 'Player'),
      el('th', {}, 'G'),
      el('th', {}, 'Pts'),
      el('th', { className: 'ev-col ev-d' }, 'D'),
      el('th', { className: 'ev-col ev-score' }, 'Goal'),
      el('th', { className: 'ev-col ev-assist' }, 'Ast'),
      el('th', { className: 'ev-col ev-turnover' }, 'TO'),
      el('th', { className: 'ev-col ev-callahan' }, 'Cal'),
    ]),
  ]);
  table.appendChild(thead);

  const tbody = el('tbody');
  // Only show active players
  const activePlayers = players.filter((p) => p.active);

  // Count points played per player (completed + active lines they appeared in)
  const playedLines = lines.filter((l) => l.status === 'completed' || l.status === 'active');

  activePlayers.forEach((p) => {
    const ptsPlayed = playedLines.filter((l) => (l.players || []).some((lp) => lp.id === p.id)).length;
    const pEvents = events.filter((e) => e.player_id === p.id);
    const dCount = pEvents.filter((e) => e.event_type === 'D').length;
    const scoreCount = pEvents.filter((e) => e.event_type === 'Score').length;
    const assistCount = pEvents.filter((e) => e.event_type === 'Assist').length;
    const toCount = pEvents.filter((e) => e.event_type === 'Turnover').length;
    const calCount = pEvents.filter((e) => e.event_type === 'Callahan').length;

    const row = el('tr', { className: p.gender === 'M' ? 'row-male' : 'row-female' }, [
      el('td', {}, p.number != null ? String(p.number) : ''),
      el('td', {}, p.name),
      el('td', {}, p.gender),
      el('td', {}, String(ptsPlayed)),
      el('td', { className: 'ev-col ev-d' }, String(dCount)),
      el('td', { className: 'ev-col ev-score' }, String(scoreCount)),
      el('td', { className: 'ev-col ev-assist' }, String(assistCount)),
      el('td', { className: 'ev-col ev-turnover' }, String(toCount)),
      el('td', { className: 'ev-col ev-callahan' }, String(calCount)),
    ]);
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  section.appendChild(table);
  container.appendChild(section);
}

// ---------- STATS VIEW ----------
export function renderStats(allGames, allEvents, players, allLinePlayers = [], allLines = []) {
  const sec = document.getElementById('view-stats');
  clearEl(sec);

  sec.appendChild(el('h3', { className: 'section-title' }, 'ALL-TIME PLAYER STATS'));

  // Game filter
  const filterWrap = el('div', { className: 'stats-filter' });
  const sel = el('select', { id: 'stats-game-filter' }, [
    el('option', { value: 'all' }, 'All Games'),
    ...allGames.map((g) => el('option', { value: g.id }, `${g.date} vs ${g.opponent}`)),
  ]);
  sel.addEventListener('change', () => {
    const val = sel.value;
    const filteredEvents = val === 'all' ? allEvents : allEvents.filter((e) => e.game_id === val);
    let filteredLines = allLines;
    let filteredLP = allLinePlayers;
    if (val !== 'all') {
      filteredLines = allLines.filter((l) => l.game_id === val);
      const lineIdSet = new Set(filteredLines.map((l) => l.id));
      filteredLP = allLinePlayers.filter((lp) => lineIdSet.has(lp.line_id));
    }
    renderStatsTable(sec, players, filteredEvents, filteredLP, filteredLines);
  });
  filterWrap.appendChild(el('label', {}, 'Filter by game: '));
  filterWrap.appendChild(sel);
  sec.appendChild(filterWrap);

  renderStatsTable(sec, players, allEvents, allLinePlayers, allLines);
}

function renderStatsTable(container, players, events, linePlayers = [], lines = []) {
  let existing = container.querySelector('.stats-table');
  if (existing) existing.remove();

  // Compute points played per player from completed/active lines
  const completedLineIds = new Set(
    lines.filter((l) => l.status === 'completed' || l.status === 'active').map((l) => l.id)
  );
  const ptsPlayedMap = {};
  linePlayers.forEach((lp) => {
    if (completedLineIds.has(lp.line_id)) {
      ptsPlayedMap[lp.player_id] = (ptsPlayedMap[lp.player_id] || 0) + 1;
    }
  });

  const wrap = el('div', { className: 'stats-table-wrap' });
  const table = el('table', { className: 'summary-table stats-table' });
  const thead = el('thead', {}, [
    el('tr', {}, [
      el('th', {}, '#'),
      el('th', {}, 'Player'),
      el('th', {}, 'G'),
      el('th', {}, 'Pts'),
      el('th', { className: 'ev-col ev-d' }, 'D'),
      el('th', { className: 'ev-col ev-score' }, 'Goal'),
      el('th', { className: 'ev-col ev-assist' }, 'Ast'),
      el('th', { className: 'ev-col ev-turnover' }, 'TO'),
      el('th', { className: 'ev-col ev-callahan' }, 'Cal'),
      el('th', {}, 'Total'),
    ]),
  ]);
  table.appendChild(thead);

  const tbody = el('tbody');
  sortByGender(players).forEach((p) => {
    const ptsPlayed = ptsPlayedMap[p.id] || 0;
    const pEvents = events.filter((e) => e.player_id === p.id);
    const dCount     = pEvents.filter((e) => e.event_type === 'D').length;
    const scoreCount = pEvents.filter((e) => e.event_type === 'Score').length;
    const assistCount = pEvents.filter((e) => e.event_type === 'Assist').length;
    const toCount    = pEvents.filter((e) => e.event_type === 'Turnover').length;
    const calCount   = pEvents.filter((e) => e.event_type === 'Callahan').length;

    const row = el('tr', { className: p.gender === 'M' ? 'row-male' : 'row-female' }, [
      el('td', {}, p.number != null ? String(p.number) : ''),
      el('td', {}, p.name),
      el('td', {}, p.gender),
      el('td', { className: 'pts-played-cell' }, String(ptsPlayed)),
      el('td', { className: 'ev-col ev-d' },        String(dCount)),
      el('td', { className: 'ev-col ev-score' },    String(scoreCount)),
      el('td', { className: 'ev-col ev-assist' },   String(assistCount)),
      el('td', { className: 'ev-col ev-turnover' }, String(toCount)),
      el('td', { className: 'ev-col ev-callahan' }, String(calCount)),
      el('td', {}, String(dCount + scoreCount + assistCount + toCount + calCount)),
    ]);
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  wrap.appendChild(table);
  container.appendChild(wrap);
}
