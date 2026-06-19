function TeamSelector({ myTeam, onSelect, onClear }) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const teams = window.WC.TEAMS;
  const filtered = teams.filter(t => t.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="team-selector">
      <button className="team-selector-btn" onClick={() => setOpen(!open)}>
        {myTeam ? (
          <>
            <img src={`https://flagcdn.com/w40/${myTeam.isoCode}.png`} alt={myTeam.name} className="flag-icon" />
            <span>{myTeam.name}</span>
          </>
        ) : <span>My Team — none selected</span>}
        <span className="chev">▾</span>
      </button>
      {open && (
        <div className="team-dropdown">
          <input
            autoFocus
            className="team-search"
            placeholder="Search teams…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <div className="team-list">
            <div className="team-option clear-option" onClick={() => { onClear(); setOpen(false); }}>
              ✕ Clear (default theme)
            </div>
            {filtered.map(t => (
              <div key={t.name} className="team-option" onClick={() => { onSelect(t); setOpen(false); setQuery(''); }}>
                <img src={`https://flagcdn.com/w40/${t.iso}.png`} alt={t.name} className="flag-icon" />
                <span className="team-option-name-full">{t.name}</span>
                <span className="team-option-name-short">{teamLabel(t.name)}</span>
                <span className="team-option-group">Grp {t.group}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function VenueLine({ match, tz, goalsToggle }) {
  const v = window.WC.venueFor(match.ground);
  const local = window.WC.formatInTimezone(match.date, match.time, tz);
  return (
    <div className="venue-line">
      <div className="venue-line-row">
        <span className="venue-date">{local ? `${local.date} · ${local.time}` : `${match.date} · ${match.time}`}</span>
      </div>
      <div className="venue-line-row">
        <span>{v.stadium}, {v.city}</span>
        {goalsToggle && <span className="venue-line-spacer" />}
        {goalsToggle}
      </div>
    </div>
  );
}

function formatScorers(goals) {
  return goals.map(function (g) { return `${g.name} ${g.minute}'${g.penalty ? ' (pen)' : ''}`; }).join(', ');
}

function GoalsToggle({ match, show, onToggle }) {
  const goals1 = match.goals1 || [];
  const goals2 = match.goals2 || [];
  if (!goals1.length && !goals2.length) return null;
  return (
    <button className="goals-toggle-btn" onClick={onToggle}>
      ⚽ {show ? 'Hide scorers' : 'Show scorers'}
    </button>
  );
}

function GoalsLine({ match, show }) {
  const goals1 = match.goals1 || [];
  const goals2 = match.goals2 || [];
  if (!show || (!goals1.length && !goals2.length)) return null;
  return (
    <div className="goals-line">
      {goals1.length > 0 && <div className="goals-line-team"><TeamFlag name={match.team1Resolved} /> {formatScorers(goals1)}</div>}
      {goals2.length > 0 && <div className="goals-line-team"><TeamFlag name={match.team2Resolved} /> {formatScorers(goals2)}</div>}
    </div>
  );
}

function teamClass(team, ctx, isProjected) {
  if (!team) return 'tbd';
  let cls = ctx.myTeam && ctx.myTeam.name === team ? 'is-my-team'
    : ctx.qualified[team] ? 'qualified'
    : ctx.eliminatedGroupStage[team] ? 'eliminated' : '';
  if (isProjected) cls += ' projected';
  return cls;
}

function TeamFlag({ name }) {
  const iso = name && window.WC.ISO_CODES[name];
  if (!iso) return null;
  return <img src={`https://flagcdn.com/w40/${iso}.png`} alt="" className="match-flag" />;
}

function teamLabel(name) {
  if (!name) return 'TBD';
  return window.WC.SHORT_CODES[name] || name;
}

function MatchRow({ match, ctx, editable, onSave, tz, compact, liveData }) {
  const [editing, setEditing] = React.useState(false);
  const [g1, setG1] = React.useState(match.score ? match.score[0] : 0);
  const [g2, setG2] = React.useState(match.score ? match.score[1] : 0);
  const [showGoals, setShowGoals] = React.useState(false);

  const canEdit = editable && match.team1Resolved && match.team2Resolved;
  const live = !match.score && window.WC.isLive(match.date, match.time);
  const ended = match.score && window.WC.hasKickedOff(match.date, match.time) && !live;
  const clockMinute = live ? window.WC.liveMinute(match.date, match.time) : null;
  // ESPN overlay only applies while we have no real openfootball result yet.
  const espnScore = live && liveData ? liveData.score : null;
  const liveMinuteText = (live && liveData && liveData.minute) || (clockMinute !== null ? `${clockMinute}'` : '');

  function save() {
    onSave(match.id, [Number(g1), Number(g2)]);
    setEditing(false);
  }

  return (
    <div className={`match-row ${canEdit ? 'editable' : ''} ${live ? 'is-live' : ''}`}>
      {match.group && <span className="match-group-badge">Group {match.group}</span>}
      <div className="match-row-main">
        <div className={`match-team ${teamClass(match.team1Resolved, ctx, match.team1Projected)}`} title={match.team1Resolved || ''}>
          <span>{teamLabel(match.team1Resolved)}</span>{!compact && match.team1Projected && <span className="proj-tag">proj.</span>}
          <TeamFlag name={match.team1Resolved} />
        </div>
        <div className="match-score" onClick={() => canEdit && setEditing(true)}>
          {editing ? (
            <span className="score-edit">
              <input type="number" min="0" value={g1} onChange={e => setG1(e.target.value)} />
              <span>–</span>
              <input type="number" min="0" value={g2} onChange={e => setG2(e.target.value)} />
              <button onClick={save}>✓</button>
            </span>
          ) : (
            <React.Fragment>
              <span className="score-main">
                {match.score ? `${match.score[0]} – ${match.score[1]}`
                  : espnScore ? `${espnScore[0]} – ${espnScore[1]}`
                  : '–'}
              </span>
              {ended && <span className="ft-tag">FT</span>}
              {live && <span className="live-badge">● LIVE{liveMinuteText ? ` ${liveMinuteText}` : ''}</span>}
            </React.Fragment>
          )}
        </div>
        <div className={`match-team right ${teamClass(match.team2Resolved, ctx, match.team2Projected)}`} title={match.team2Resolved || ''}>
          <TeamFlag name={match.team2Resolved} />
          <span>{teamLabel(match.team2Resolved)}</span>{!compact && match.team2Projected && <span className="proj-tag">proj.</span>}
        </div>
      </div>
      <VenueLine
        match={match}
        tz={tz}
        goalsToggle={!compact ? <GoalsToggle match={match} show={showGoals} onToggle={() => setShowGoals(s => !s)} /> : null}
      />
      {!compact && <GoalsLine match={match} show={showGoals} />}
    </div>
  );
}

function GroupTable({ letter, table, ctx, thirdQualifies, groupDone }) {
  return (
    <div className="group-table">
      <div className="group-table-title">
        Group {letter}
        {!groupDone && <span className="group-status">current</span>}
      </div>
      <table>
        <thead>
          <tr><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th></tr>
        </thead>
        <tbody>
          {table.map((row, i) => {
            const qualByRank = i < 2;
            const qualByThird = i === 2 && thirdQualifies[row.team];
            const isQualified = qualByRank || qualByThird;
            const isClinched = !groupDone && ctx.clinched[row.team];
            const cls = ctx.myTeam && ctx.myTeam.name === row.team ? 'is-my-team'
              : isQualified ? (groupDone ? 'qualified' : 'qualified projected')
              : ctx.eliminatedGroupStage[row.team] ? 'eliminated' : '';
            return (
              <tr key={row.team} className={cls}>
                <td title={row.team}>
                  <TeamFlag name={row.team} /> {teamLabel(row.team)}
                  {isClinched && <span className="clinched-tag" title="Mathematically guaranteed to advance, regardless of remaining results">✓</span>}
                </td>
                <td>{row.played}</td><td>{row.won}</td><td>{row.drawn}</td><td>{row.lost}</td>
                <td>{row.gf}</td><td>{row.ga}</td><td>{row.gd}</td><td className="pts">{row.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TimezoneSelector({ tz, onChange }) {
  const regions = [];
  window.WC.TIMEZONES.forEach(t => { if (regions.indexOf(t.region) === -1) regions.push(t.region); });
  return (
    <select
      className="tz-select"
      value={tz.id}
      onChange={e => onChange(window.WC.TIMEZONES.find(t => t.id === e.target.value))}
    >
      {regions.map(region => (
        <optgroup key={region} label={region}>
          {window.WC.TIMEZONES.filter(t => t.region === region).map(t => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

function matchInvolvesTeam(m, team) {
  return m.team1Resolved === team || m.team2Resolved === team || m.team1Ref === team || m.team2Ref === team;
}

function MatchFilter({ filter, onChange }) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const groups = Object.keys(window.WC.GROUPS).sort();
  const teams = window.WC.TEAMS;
  const q = query.toLowerCase();
  const filteredGroups = groups.filter(g => `group ${g}`.includes(q));
  const filteredTeams = teams.filter(t => t.name.toLowerCase().includes(q));

  const label = !filter ? 'All teams & groups'
    : filter.type === 'group' ? `Group ${filter.value}`
    : filter.value;

  return (
    <div className="team-selector">
      <button className="team-selector-btn" onClick={() => setOpen(!open)}>
        <span>🔎 {label}</span>
        <span className="chev">▾</span>
      </button>
      {open && (
        <div className="team-dropdown">
          <input
            autoFocus
            className="team-search"
            placeholder="Search team or group…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <div className="team-list">
            <div className="team-option clear-option" onClick={() => { onChange(null); setOpen(false); setQuery(''); }}>
              ✕ Clear filter
            </div>
            {filteredGroups.map(g => (
              <div key={`g-${g}`} className="team-option" onClick={() => { onChange({ type: 'group', value: g }); setOpen(false); setQuery(''); }}>
                <span>Group {g}</span>
              </div>
            ))}
            {filteredTeams.map(t => (
              <div key={`t-${t.name}`} className="team-option" onClick={() => { onChange({ type: 'team', value: t.name }); setOpen(false); setQuery(''); }}>
                <img src={`https://flagcdn.com/w40/${t.iso}.png`} alt={t.name} className="flag-icon" />
                <span className="team-option-name-full">{t.name}</span>
                <span className="team-option-name-short">{teamLabel(t.name)}</span>
                <span className="team-option-group">Grp {t.group}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GroupStageView({ resolved, ctx, editable, onSave, filter, tz, liveScores }) {
  const groups = window.WC.GROUPS;
  const thirdQualifies = {};
  resolved.thirdPool.forEach(t => { thirdQualifies[t.team] = true; });

  let letters = Object.keys(groups).sort();
  if (filter && filter.type === 'group') letters = letters.filter(l => l === filter.value);
  else if (filter && filter.type === 'team') letters = letters.filter(l => groups[l].indexOf(filter.value) !== -1);

  const hasClinched = Object.keys(ctx.clinched || {}).length > 0;

  return (
    <div className="group-stage">
      {hasClinched && (
        <div className="clinched-legend"><span className="clinched-tag">✓</span> = mathematically confirmed to advance to the next phase</div>
      )}
      <div className="groups-grid">
        {letters.map(letter => (
          <GroupTable key={letter} letter={letter} table={resolved.tables[letter]} ctx={ctx} thirdQualifies={thirdQualifies} groupDone={resolved.groupDone[letter]} />
        ))}
      </div>
      <div className="fixtures-section">
        <div className="section-heading">Group Stage Fixtures</div>
        {letters.map(letter => {
          const matches = resolved.matches.filter(m => m.group === letter
            && (!filter || filter.type !== 'team' || matchInvolvesTeam(m, filter.value)))
            .sort((a, b) => window.WC.toUtcMillis(a.date, a.time) - window.WC.toUtcMillis(b.date, b.time));
          if (!matches.length) return null;
          return (
            <div key={letter} className="fixture-group">
              <div className="fixture-group-title">Group {letter}</div>
              {matches.map(m => (
                <MatchRow key={m.id} match={m} ctx={ctx} editable={editable} onSave={onSave} tz={tz} liveData={liveScores[m.id]} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TodayView({ resolved, ctx, editable, onSave, filter, tz, liveScores }) {
  const today = window.WC.todayInTimezone(tz);
  const matches = resolved.matches
    .filter(m => {
      const local = window.WC.formatInTimezone(m.date, m.time, tz);
      const dateInTz = local ? local.date : m.date;
      if (dateInTz !== today) return false;
      if (filter && filter.type === 'team' && !matchInvolvesTeam(m, filter.value)) return false;
      if (filter && filter.type === 'group' && m.group !== filter.value) return false;
      return true;
    })
    .sort((a, b) => window.WC.toUtcMillis(a.date, a.time) - window.WC.toUtcMillis(b.date, b.time));

  return (
    <div className="today-view">
      <div className="section-heading">Today's Matches ({today})</div>
      {matches.length === 0
        ? <div className="empty-state">No matches scheduled for today{filter ? ' matching this filter' : ''}.</div>
        : matches.map(m => <MatchRow key={m.id} match={m} ctx={ctx} editable={editable} onSave={onSave} tz={tz} liveData={liveScores[m.id]} />)
      }
    </div>
  );
}

const ROUND_ORDER = ['Round of 32', 'Round of 16', 'Quarter-final', 'Semi-final', 'Final', 'Match for third place'];

function BracketView({ resolved, ctx, editable, onSave, filter, tz, liveScores }) {
  const byRound = {};
  ROUND_ORDER.forEach(r => byRound[r] = []);
  resolved.matches.forEach(m => {
    if (!byRound[m.round]) return;
    if (filter && filter.type === 'team' && !matchInvolvesTeam(m, filter.value)) return;
    if (filter && filter.type === 'group' && m.group !== filter.value) return;
    byRound[m.round].push(m);
  });

  return (
    <div>
      <div className="bracket-scroll-hint">← scroll horizontally to see all rounds through the Final →</div>
      <div className="bracket">
      {ROUND_ORDER.map(round => (
        <div key={round} className="bracket-col">
          <div className="bracket-col-title">{round}</div>
          {byRound[round].map(m => (
            <div key={m.id} className="bracket-card">
              <MatchRow match={m} ctx={ctx} editable={editable} onSave={onSave} tz={tz} liveData={liveScores[m.id]} compact />
            </div>
          ))}
        </div>
      ))}
      </div>
    </div>
  );
}

function App() {
  const [loading, setLoading] = React.useState(true);
  const [source, setSource] = React.useState(null);
  const [mode, setMode] = React.useState('actual');
  const [actualMatches, setActualMatches] = React.useState([]);
  const [simulatedMatches, setSimulatedMatches] = React.useState([]);
  const [view, setView] = React.useState(() => localStorage.getItem('wc-view') || 'today');
  const [myTeam, setMyTeam] = React.useState(null);
  const [filter, setFilter] = React.useState(null);
  const [tz, setTz] = React.useState(window.WC.DEFAULT_TZ);
  const [lastFetched, setLastFetched] = React.useState(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [colorMode, setColorMode] = React.useState(() => localStorage.getItem('wc-color-mode') || 'light');
  const [liveScores, setLiveScores] = React.useState({});
  const refreshRef = React.useRef(null);

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', colorMode);
    localStorage.setItem('wc-color-mode', colorMode);
  }, [colorMode]);

  React.useEffect(() => {
    localStorage.setItem('wc-view', view);
  }, [view]);


  React.useEffect(() => {
    function refresh() {
      setRefreshing(true);
      return window.WC.fetchWorldCupData().then(({ matches, source }) => {
        setActualMatches(matches);
        setSimulatedMatches(prev => prev.length ? prev : JSON.parse(JSON.stringify(matches)));
        setSource(source);
        setLoading(false);
        setLastFetched(new Date());
        setRefreshing(false);
      });
    }
    refreshRef.current = refresh;
    refresh();
    const poll = setInterval(refresh, 60000); // pick up live score updates automatically
    const saved = window.WC.loadMyTeam();
    if (saved) {
      // Always re-derive the palette from the curated table, even if an
      // older (unreliable, ColorThief-extracted) palette was persisted.
      const palette = window.WC.TEAM_PALETTES[saved.name] || null;
      const team = { ...saved, palette };
      setMyTeam(team);
      window.WC.saveMyTeam(team);
      if (palette) window.WC.applyPalette(palette);
      else window.WC.clearPalette();
    }
    return () => clearInterval(poll);
  }, []);

  // ESPN overlay: openfootball has no partial score while a match is in
  // progress, only a final result once it ends. While the schedule says a
  // match should currently be live and openfootball hasn't posted a score
  // for it yet, poll ESPN's free scoreboard for the live score/clock. As
  // soon as openfootball reports the real result, that match stops needing
  // (and stops getting) the overlay — see MatchRow's `espnScore` guard.
  React.useEffect(() => {
    function pollLive() {
      const liveMatches = actualMatches.filter(m => !m.score && window.WC.isLive(m.date, m.time));
      if (!liveMatches.length) return;
      window.WC.fetchEspnEvents().then(events => {
        const updates = {};
        liveMatches.forEach(m => {
          const found = window.WC.findEspnLiveScore(events, m.team1, m.team2);
          if (found) updates[m.id] = found;
        });
        if (Object.keys(updates).length) {
          setLiveScores(prev => ({ ...prev, ...updates }));
        }
      });
    }
    pollLive();
    const t = setInterval(pollLive, 20000);
    return () => clearInterval(t);
  }, [actualMatches]);

  function selectTeam(t) {
    const palette = window.WC.TEAM_PALETTES[t.name] || null;
    const team = { name: t.name, isoCode: t.iso, palette };
    setMyTeam(team);
    window.WC.saveMyTeam(team);
    if (palette) window.WC.applyPalette(palette);
    else window.WC.clearPalette();
  }

  function clearTeam() {
    setMyTeam(null);
    window.WC.saveMyTeam(null);
    window.WC.clearPalette();
  }

  function saveScore(matchId, score) {
    setSimulatedMatches(prev => prev.map(m => m.id === matchId ? { ...m, score } : m));
  }

  function resetToActual() {
    setSimulatedMatches(JSON.parse(JSON.stringify(actualMatches)));
  }

  if (loading) {
    return <div className="loading-screen">⚽ Loading 2026 World Cup data…</div>;
  }

  const activeMatches = mode === 'actual' ? actualMatches : simulatedMatches;
  const resolved = window.WC.resolveBracket(activeMatches, window.WC.GROUPS);
  const ctx = {
    myTeam,
    qualified: resolved.qualified,
    projectedQualified: resolved.projectedQualified,
    eliminatedGroupStage: resolved.eliminatedGroupStage,
    clinched: resolved.clinched
  };

  return (
    <div className="wc-app">
      <div className="wc-topbar">
        <div className="wc-brand-block">
          <div className="wc-brand">🏆 2026 World Cup Tracker</div>
          <div className="wc-live-status">
            {source === 'fallback'
              ? '⚠ Live feed unavailable — showing fallback schedule'
              : lastFetched ? `⟳ Live data refreshed every 60s — last checked ${lastFetched.toLocaleTimeString()}` : ''}
            {' '}
            <button className="refresh-now-btn" disabled={refreshing} onClick={() => refreshRef.current && refreshRef.current()}>
              {refreshing ? '⟳ Refreshing…' : '⟳ Refresh now'}
            </button>
          </div>
        </div>
        <div className="wc-topbar-right">
          <button
            className="theme-toggle-btn"
            title={colorMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={colorMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={() => setColorMode(m => m === 'dark' ? 'light' : 'dark')}
          >
            {colorMode === 'dark' ? '☀️' : '🌙'}
          </button>
          <TimezoneSelector tz={tz} onChange={setTz} />
          <TeamSelector myTeam={myTeam} onSelect={selectTeam} onClear={clearTeam} />
        </div>
      </div>

      <div className="wc-controls">
        <div className="view-tabs">
          <button className={view === 'today' ? 'active' : ''} onClick={() => setView('today')}>Today's Matches</button>
          <button className={view === 'groups' ? 'active' : ''} onClick={() => setView('groups')}>Group Stage</button>
          <button className={view === 'bracket' ? 'active' : ''} onClick={() => setView('bracket')}>Knockout Bracket</button>
        </div>
        <MatchFilter filter={filter} onChange={setFilter} />
        <div className="mode-controls">
          <div className="mode-toggle">
            <button className={mode === 'actual' ? 'active' : ''} onClick={() => setMode('actual')}>Actual</button>
            <button className={mode === 'simulation' ? 'active' : ''} onClick={() => setMode('simulation')}>Simulation</button>
          </div>
          {mode === 'simulation' && (
            <button className="reset-btn" onClick={resetToActual}>↺ Reset to Actual</button>
          )}
        </div>
      </div>

      {!resolved.allGroupsDone && (
        <div className="data-banner projected-banner">
          ⚡ Group stage is still in progress — qualifiers and bracket matchups marked <strong>proj.</strong> are projected assuming current group standings hold, and will update automatically as results come in.
        </div>
      )}

      {view === 'today' && <TodayView resolved={resolved} ctx={ctx} editable={mode === 'simulation'} onSave={saveScore} filter={filter} tz={tz} liveScores={liveScores} />}
      {view === 'groups' && <GroupStageView resolved={resolved} ctx={ctx} editable={mode === 'simulation'} onSave={saveScore} filter={filter} tz={tz} liveScores={liveScores} />}
      {view === 'bracket' && <BracketView resolved={resolved} ctx={ctx} editable={mode === 'simulation'} onSave={saveScore} filter={filter} tz={tz} liveScores={liveScores} />}
    </div>
  );
}
