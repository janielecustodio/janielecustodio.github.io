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
                <span>{t.name}</span>
                <span className="team-option-group">Grp {t.group}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function VenueLine({ match, tz }) {
  const v = window.WC.venueFor(match.ground);
  const local = window.WC.formatInTimezone(match.date, match.time, tz);
  return (
    <div className="venue-line">
      <span className="venue-date">{local ? `${local.date} · ${local.time}` : `${match.date} · ${match.time}`}</span>
      <span className="venue-dot">·</span>
      <span>{v.stadium}, {v.city}</span>
      <span className="venue-dot">·</span>
      <span className="venue-country">{v.country}</span>
      {match.group && <React.Fragment><span className="venue-dot">·</span><span className="venue-group">Group {match.group}</span></React.Fragment>}
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

function MatchRow({ match, ctx, editable, onSave, tz }) {
  const [editing, setEditing] = React.useState(false);
  const [g1, setG1] = React.useState(match.score ? match.score[0] : 0);
  const [g2, setG2] = React.useState(match.score ? match.score[1] : 0);

  const canEdit = editable && match.team1Resolved && match.team2Resolved;
  const live = !match.score && window.WC.isLive(match.date, match.time);
  const ended = match.score && window.WC.hasKickedOff(match.date, match.time) && !live;

  function save() {
    onSave(match.id, [Number(g1), Number(g2)]);
    setEditing(false);
  }

  return (
    <div className={`match-row ${canEdit ? 'editable' : ''} ${live ? 'is-live' : ''}`}>
      <div className={`match-team ${teamClass(match.team1Resolved, ctx, match.team1Projected)}`}>
        {match.team1Resolved || 'TBD'}{match.team1Projected && <span className="proj-tag">proj.</span>}
      </div>
      <div className="match-score" onClick={() => canEdit && setEditing(true)}>
        {editing ? (
          <span className="score-edit">
            <input type="number" min="0" value={g1} onChange={e => setG1(e.target.value)} />
            <span>–</span>
            <input type="number" min="0" value={g2} onChange={e => setG2(e.target.value)} />
            <button onClick={save}>✓</button>
          </span>
        ) : match.score ? (
          <span>{match.score[0]} – {match.score[1]}{ended && <span className="ft-tag">FT</span>}</span>
        ) : live ? (
          <span className="live-badge">● LIVE</span>
        ) : (
          <span className="vs">{canEdit ? 'Enter score' : 'vs'}</span>
        )}
      </div>
      <div className={`match-team right ${teamClass(match.team2Resolved, ctx, match.team2Projected)}`}>
        {match.team2Resolved || 'TBD'}{match.team2Projected && <span className="proj-tag">proj.</span>}
      </div>
      <VenueLine match={match} tz={tz} />
    </div>
  );
}

function GroupTable({ letter, table, ctx, thirdQualifies, groupDone }) {
  return (
    <div className="group-table">
      <div className="group-table-title">
        Group {letter}
        {!groupDone && <span className="group-status">projected</span>}
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
            const cls = ctx.myTeam && ctx.myTeam.name === row.team ? 'is-my-team'
              : isQualified ? (groupDone ? 'qualified' : 'qualified projected')
              : ctx.eliminatedGroupStage[row.team] ? 'eliminated' : '';
            return (
              <tr key={row.team} className={cls}>
                <td>{row.team}</td>
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
                <span>{t.name}</span>
                <span className="team-option-group">Grp {t.group}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GroupStageView({ resolved, ctx, editable, onSave, filter, tz }) {
  const groups = window.WC.GROUPS;
  const thirdQualifies = {};
  resolved.thirdPool.forEach(t => { thirdQualifies[t.team] = true; });

  let letters = Object.keys(groups).sort();
  if (filter && filter.type === 'group') letters = letters.filter(l => l === filter.value);
  else if (filter && filter.type === 'team') letters = letters.filter(l => groups[l].indexOf(filter.value) !== -1);

  return (
    <div className="group-stage">
      <div className="groups-grid">
        {letters.map(letter => (
          <GroupTable key={letter} letter={letter} table={resolved.tables[letter]} ctx={ctx} thirdQualifies={thirdQualifies} groupDone={resolved.groupDone[letter]} />
        ))}
      </div>
      <div className="fixtures-section">
        <div className="section-heading">Group Stage Fixtures</div>
        {letters.map(letter => {
          const matches = resolved.matches.filter(m => m.group === letter
            && (!filter || filter.type !== 'team' || matchInvolvesTeam(m, filter.value)));
          if (!matches.length) return null;
          return (
            <div key={letter} className="fixture-group">
              <div className="fixture-group-title">Group {letter}</div>
              {matches.map(m => (
                <MatchRow key={m.id} match={m} ctx={ctx} editable={editable} onSave={onSave} tz={tz} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TodayView({ resolved, ctx, editable, onSave, filter, tz }) {
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
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  return (
    <div className="today-view">
      <div className="section-heading">Today's Matches ({today})</div>
      {matches.length === 0
        ? <div className="empty-state">No matches scheduled for today{filter ? ' matching this filter' : ''}.</div>
        : matches.map(m => <MatchRow key={m.id} match={m} ctx={ctx} editable={editable} onSave={onSave} tz={tz} />)
      }
    </div>
  );
}

const ROUND_ORDER = ['Round of 32', 'Round of 16', 'Quarter-final', 'Semi-final', 'Final', 'Match for third place'];

function BracketView({ resolved, ctx, editable, onSave, filter, tz }) {
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
              <MatchRow match={m} ctx={ctx} editable={editable} onSave={onSave} tz={tz} />
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
  const [view, setView] = React.useState('groups');
  const [myTeam, setMyTeam] = React.useState(null);
  const [filter, setFilter] = React.useState(null);
  const [tz, setTz] = React.useState(window.WC.DEFAULT_TZ);
  const [lastFetched, setLastFetched] = React.useState(null);

  React.useEffect(() => {
    function refresh() {
      window.WC.fetchWorldCupData().then(({ matches, source }) => {
        setActualMatches(matches);
        setSimulatedMatches(prev => prev.length ? prev : JSON.parse(JSON.stringify(matches)));
        setSource(source);
        setLoading(false);
        setLastFetched(new Date());
      });
    }
    refresh();
    const poll = setInterval(refresh, 60000); // pick up live score updates automatically
    const saved = window.WC.loadMyTeam();
    if (saved) {
      setMyTeam(saved);
      if (saved.palette) window.WC.applyPalette(saved.palette);
    }
    return () => clearInterval(poll);
  }, []);

  function selectTeam(t) {
    const team = { name: t.name, isoCode: t.iso, palette: null };
    setMyTeam(team);
    window.WC.saveMyTeam(team);
    window.WC.extractPaletteFromFlag(t.iso, palette => {
      if (palette) {
        window.WC.applyPalette(palette);
        const withPalette = { ...team, palette };
        setMyTeam(withPalette);
        window.WC.saveMyTeam(withPalette);
      }
    });
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
    eliminatedGroupStage: resolved.eliminatedGroupStage
  };

  return (
    <div className="wc-app">
      <div className="wc-topbar">
        <div className="wc-brand">🏆 2026 World Cup Tracker</div>
        <div className="wc-topbar-right">
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

      {source === 'fallback' && (
        <div className="data-banner">Live feed unavailable — showing hardcoded fixture schedule (no results yet).</div>
      )}
      {source !== 'fallback' && mode === 'actual' && (
        <div className="live-status">
          ⟳ Auto-refreshing live results every 60s{lastFetched ? ` — last checked ${lastFetched.toLocaleTimeString()}` : ''}
        </div>
      )}
      {!resolved.allGroupsDone && (
        <div className="data-banner projected-banner">
          ⚡ Group stage is still in progress — qualifiers and bracket matchups marked <strong>proj.</strong> are projected assuming current group standings hold, and will update automatically as results come in.
        </div>
      )}

      {view === 'today' && <TodayView resolved={resolved} ctx={ctx} editable={mode === 'simulation'} onSave={saveScore} filter={filter} tz={tz} />}
      {view === 'groups' && <GroupStageView resolved={resolved} ctx={ctx} editable={mode === 'simulation'} onSave={saveScore} filter={filter} tz={tz} />}
      {view === 'bracket' && <BracketView resolved={resolved} ctx={ctx} editable={mode === 'simulation'} onSave={saveScore} filter={filter} tz={tz} />}
    </div>
  );
}
