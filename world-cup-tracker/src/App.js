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
        <span className="venue-date">{local ? `${local.date} · ${local.time}` : `${match.date} · ${match.time}`} · {v.city}</span>
      </div>
      <div className="venue-line-row">
        <span>{v.stadium}</span>
        {goalsToggle && <span className="venue-line-spacer" />}
        {goalsToggle}
      </div>
    </div>
  );
}

function formatScorers(goals) {
  return goals.map(function (g) { return `${g.name} ${g.minute}'${g.penalty ? ' (pen)' : ''}`; }).join(', ');
}

function GoalsToggle({ goals1, goals2, show, onToggle, compact }) {
  if (!goals1.length && !goals2.length) return null;
  if (compact) {
    return (
      <button className={`goals-toggle-btn compact ${show ? 'is-open' : ''}`} onClick={onToggle} title={show ? 'Hide scorers' : 'Show scorers'}>
        ⚽
      </button>
    );
  }
  return (
    <button className="goals-toggle-btn" onClick={onToggle}>
      ⚽ {show ? 'Hide scorers' : 'Show scorers'}
    </button>
  );
}

function GoalsLine({ match, goals1, goals2, show }) {
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
  // Openfootball only has scorers once a match is final; while it's live,
  // fall back to ESPN's play-by-play scorer data if it has any.
  const goals1 = (match.goals1 && match.goals1.length) ? match.goals1 : ((live && liveData && liveData.goals1) || []);
  const goals2 = (match.goals2 && match.goals2.length) ? match.goals2 : ((live && liveData && liveData.goals2) || []);

  function save() {
    onSave(match.id, [Number(g1), Number(g2)]);
    setEditing(false);
  }

  return (
    <div className={`match-row ${canEdit ? 'editable' : ''} ${live ? 'is-live' : ''}`}>
      {match.group && <span className="match-group-badge">Group {match.group}</span>}
      {!match.group && !match.team1Projected && !match.team2Projected && match.team1Resolved && match.team2Resolved &&
        <span className="match-locked-badge" title="Both teams are confirmed for this matchup — this game will happen as shown">✓</span>}
      {(match.team1Projected || match.team2Projected) &&
        <span className="match-proj-badge" title="At least one team is still projected based on current standings — this matchup is not yet guaranteed">PROJ</span>}
      <div className="match-row-main">
        <div
          className={`match-team ${teamClass(match.team1Resolved, ctx, match.team1Projected)} ${match.team1Resolved ? 'clickable-team' : ''}`}
          title={match.team1Resolved || ''}
          onClick={() => ctx.onTeamClick && ctx.onTeamClick(match.team1Resolved)}
        >
          {ctx.clinched && ctx.clinched[match.team1Resolved] && <span className="clinched-tag" title="Mathematically guaranteed to advance, regardless of remaining results">✓</span>}
          <span>{teamLabel(match.team1Resolved)}</span>
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
        <div
          className={`match-team right ${teamClass(match.team2Resolved, ctx, match.team2Projected)} ${match.team2Resolved ? 'clickable-team' : ''}`}
          title={match.team2Resolved || ''}
          onClick={() => ctx.onTeamClick && ctx.onTeamClick(match.team2Resolved)}
        >
          <TeamFlag name={match.team2Resolved} />
          <span>{teamLabel(match.team2Resolved)}</span>
          {ctx.clinched && ctx.clinched[match.team2Resolved] && <span className="clinched-tag" title="Mathematically guaranteed to advance, regardless of remaining results">✓</span>}
        </div>
      </div>
      <VenueLine
        match={match}
        tz={tz}
        goalsToggle={<GoalsToggle goals1={goals1} goals2={goals2} show={showGoals} onToggle={() => setShowGoals(s => !s)} compact={compact} />}
      />
      <GoalsLine match={match} goals1={goals1} goals2={goals2} show={showGoals} />
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
                <td title={row.team} className="clickable-team" onClick={() => ctx.onTeamClick && ctx.onTeamClick(row.team)}>
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

function StandingsModal({ info, resolved, ctx, tz, liveScores, onClose }) {
  const [showPast, setShowPast] = React.useState(false);
  if (!info) return null;
  const { team, group } = info;
  const table = resolved.tables[group];
  const groupDone = resolved.groupDone[group];
  const clinched = !groupDone && ctx.clinched[team];
  const qualified = ctx.qualified[team];

  let status;
  if (groupDone) status = qualified ? '✅ Qualified for the next phase' : '❌ Eliminated in the group stage';
  else if (clinched) status = '✅ Mathematically guaranteed to advance, regardless of remaining results';
  else if (qualified) status = '📈 Currently projects to advance based on current group standings — not yet guaranteed';
  else status = 'Currently outside the qualification places';

  const teamMatches = resolved.matches
    .filter(m => matchInvolvesTeam(m, team))
    .sort((a, b) => window.WC.toUtcMillis(a.date, a.time) - window.WC.toUtcMillis(b.date, b.time));
  const upcoming = teamMatches.filter(m => !m.score && !window.WC.hasKickedOff(m.date, m.time));
  const past = teamMatches.filter(m => m.score || window.WC.hasKickedOff(m.date, m.time));

  return (
    <div className="standings-modal-backdrop" onClick={onClose}>
      <div className="standings-modal" onClick={e => e.stopPropagation()}>
        <button className="standings-modal-close" onClick={onClose} aria-label="Close">✕</button>
        <div className="group-table-title">
          Group {group}
          {!groupDone && <span className="group-status">current</span>}
        </div>
        <table>
          <thead>
            <tr><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th></tr>
          </thead>
          <tbody>
            {table.map(row => {
              const isClinched = !groupDone && ctx.clinched[row.team];
              const cls = (ctx.qualified[row.team] ? (groupDone ? 'qualified' : 'qualified projected') : ctx.eliminatedGroupStage[row.team] ? 'eliminated' : '')
                + (row.team === team ? ' is-selected-team' : '');
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
        <div className="standings-modal-status">{status}</div>

        <div className="standings-modal-matches">
          <div className="standings-modal-matches-heading">
            Upcoming matches
            {past.length > 0 && (
              <button className="standings-modal-past-toggle" onClick={() => setShowPast(s => !s)}>
                {showPast ? 'Hide past matches' : 'Show past matches'}
              </button>
            )}
          </div>
          {upcoming.length === 0
            ? <div className="empty-state">No upcoming matches scheduled.</div>
            : upcoming.map(m => <MatchRow key={m.id} match={m} ctx={ctx} editable={false} onSave={() => {}} tz={tz} liveData={liveScores[m.id]} compact />)}
          {showPast && past.length > 0 && (
            <React.Fragment>
              <div className="standings-modal-matches-heading">Past matches</div>
              {past.map(m => <MatchRow key={m.id} match={m} ctx={ctx} editable={false} onSave={() => {}} tz={tz} liveData={liveScores[m.id]} compact />)}
            </React.Fragment>
          )}
        </div>
      </div>
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

// Groups every match by its local (tz) calendar date, and summarizes what's
// on each day — which groups are playing their group-stage matchday, or
// which knockout round is underway — for the date-picker dropdown.
function buildDayIndex(matches, tz) {
  const byDate = {};
  matches.forEach(m => {
    const local = window.WC.formatInTimezone(m.date, m.time, tz);
    const dateInTz = local ? local.date : m.date;
    if (!byDate[dateInTz]) byDate[dateInTz] = { groups: new Set(), rounds: new Set() };
    if (m.group) byDate[dateInTz].groups.add(m.group);
    else byDate[dateInTz].rounds.add(m.round);
  });
  return Object.keys(byDate).sort().map(date => {
    const { groups, rounds } = byDate[date];
    const label = groups.size
      ? `Group ${Array.from(groups).sort().join('/')}`
      : Array.from(rounds).join(', ');
    return { date, label };
  });
}

function TodayView({ resolved, ctx, editable, onSave, filter, tz, liveScores }) {
  const today = window.WC.todayInTimezone(tz);
  const [selectedDate, setSelectedDate] = React.useState(today);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const touchRef = React.useRef(null);
  const isToday = selectedDate === today;
  const dayIndex = React.useMemo(() => buildDayIndex(resolved.matches, tz), [resolved.matches, tz]);
  const todayInfo = dayIndex.find(d => d.date === selectedDate);

  const matches = resolved.matches
    .filter(m => {
      const local = window.WC.formatInTimezone(m.date, m.time, tz);
      const dateInTz = local ? local.date : m.date;
      if (dateInTz !== selectedDate) return false;
      if (filter && filter.type === 'team' && !matchInvolvesTeam(m, filter.value)) return false;
      if (filter && filter.type === 'group' && m.group !== filter.value) return false;
      return true;
    })
    .sort((a, b) => window.WC.toUtcMillis(a.date, a.time) - window.WC.toUtcMillis(b.date, b.time));

  function onTouchStart(e) { touchRef.current = e.touches[0].clientX; }
  function onTouchEnd(e) {
    if (touchRef.current === null) return;
    const dx = e.changedTouches[0].clientX - touchRef.current;
    touchRef.current = null;
    if (dx > 50) setSelectedDate(d => window.WC.addDays(d, -1)); // swipe right -> previous day
    else if (dx < -50) setSelectedDate(d => window.WC.addDays(d, 1)); // swipe left -> next day
  }

  return (
    <div className="today-view" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="section-heading day-nav">
        <button className="day-nav-btn" onClick={() => setSelectedDate(d => window.WC.addDays(d, -1))} aria-label="Previous day">‹</button>
        <button className="day-nav-title" onClick={() => setPickerOpen(o => !o)}>
          {isToday ? 'Today\'s Matches' : 'Matches'} ({selectedDate}) <span className="chev">▾</span>
        </button>
        <button className="day-nav-btn" onClick={() => setSelectedDate(d => window.WC.addDays(d, 1))} aria-label="Next day">›</button>
        {!isToday && <button className="day-nav-today" onClick={() => setSelectedDate(today)}>Today</button>}
      </div>
      {todayInfo && todayInfo.label && <div className="day-phase-note">{todayInfo.label}</div>}
      {pickerOpen && (
        <div className="day-picker-backdrop" onClick={() => setPickerOpen(false)}>
          <div className="day-picker" onClick={e => e.stopPropagation()}>
            {dayIndex.map(d => (
              <div
                key={d.date}
                className={'day-picker-option' + (d.date === selectedDate ? ' active' : '')}
                onClick={() => { setSelectedDate(d.date); setPickerOpen(false); }}
              >
                <span className="day-picker-date">{d.date}{d.date === today ? ' (today)' : ''}</span>
                <span className="day-picker-label">{d.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {matches.length === 0
        ? <div className="empty-state">No matches scheduled for this day{filter ? ' matching this filter' : ''}.</div>
        : matches.map(m => <MatchRow key={m.id} match={m} ctx={ctx} editable={editable} onSave={onSave} tz={tz} liveData={liveScores[m.id]} />)
      }
    </div>
  );
}

const ROUND_ORDER = ['Round of 32', 'Round of 16', 'Quarter-final', 'Semi-final', 'Final', 'Match for third place'];

// Matches a "W<id>" / "L<id>" reference and returns the source match id —
// used to draw connector lines to the *specific* earlier match a slot comes
// from, since these ids are not adjacent/sequential across rounds.
const BRACKET_REF_RE = /^([WL])(\d+)$/;

// Backward walk from the Final used to lay out each round in actual bracket
// (tree) order rather than chronological/id order — otherwise a match's two
// feeder matches can end up far apart within their round's column, forcing
// long looping connector lines across unrelated cards.
const BRACKET_REVERSE_CHAIN = ['Final', 'Semi-final', 'Quarter-final', 'Round of 16', 'Round of 32'];

function BracketView({ resolved, ctx, editable, onSave, filter, tz, liveScores }) {
  const byRound = {};
  ROUND_ORDER.forEach(r => byRound[r] = []);
  resolved.matches.forEach(m => {
    if (!byRound[m.round]) return;
    if (filter && filter.type === 'team' && !matchInvolvesTeam(m, filter.value)) return;
    if (filter && filter.type === 'group' && m.group !== filter.value) return;
    byRound[m.round].push(m);
  });

  const matchById = {};
  resolved.matches.forEach(m => { matchById[m.id] = m; });
  const treeOrder = {};
  BRACKET_REVERSE_CHAIN.forEach((round, i) => {
    if (i === 0) {
      treeOrder[round] = byRound[round].map(m => m.id);
      return;
    }
    const parentRound = BRACKET_REVERSE_CHAIN[i - 1];
    const seq = [];
    (treeOrder[parentRound] || []).forEach(pid => {
      const parent = matchById[pid];
      if (!parent) return;
      [parent.team1Ref, parent.team2Ref].forEach(ref => {
        const wl = BRACKET_REF_RE.exec(ref || '');
        if (wl) seq.push(Number(wl[2]));
      });
    });
    const seqSet = new Set(seq);
    byRound[round].forEach(m => { if (!seqSet.has(m.id)) seq.push(m.id); });
    treeOrder[round] = seq;
  });
  ROUND_ORDER.forEach(round => {
    const ord = treeOrder[round];
    if (ord) byRound[round].sort((a, b) => ord.indexOf(a.id) - ord.indexOf(b.id));
  });

  const containerRef = React.useRef(null);
  const cardRefs = React.useRef({});
  const [lines, setLines] = React.useState([]);
  const [size, setSize] = React.useState({ w: 0, h: 0 });
  const [positions, setPositions] = React.useState({});
  const [selectedId, setSelectedId] = React.useState(null);

  // Maps a match id to the id of the later match its *winner* feeds into,
  // so clicking a card can highlight every connector on that team's
  // possible path all the way to the Final. "Match for third place" is
  // excluded since it isn't part of the advancement path.
  const winnerNext = {};
  resolved.matches.forEach(m => {
    if (m.round === 'Match for third place') return;
    [m.team1Ref, m.team2Ref].forEach(ref => {
      const wl = BRACKET_REF_RE.exec(ref || '');
      if (wl && wl[1] === 'W') winnerNext[Number(wl[2])] = m.id;
    });
  });
  const highlightedKeys = new Set();
  if (selectedId !== null) {
    let cur = selectedId;
    while (winnerNext[cur] !== undefined) {
      highlightedKeys.add(winnerNext[cur]);
      cur = winnerNext[cur];
    }
  }

  // Pass 1: vertically center every non-leaf match between the midpoint of
  // its two feeder matches (recursively, leaf round up to the Final) —
  // without this, cards just stack in flow order and end up at the wrong
  // height relative to the matches they actually connect to, even once the
  // column order itself is correct. Skipped while a filter is active, where
  // a simpler static stack is good enough and the math (which assumes both
  // feeders are present) doesn't hold up.
  React.useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || filter) { setPositions({}); return; }
    const cRect = container.getBoundingClientRect();
    const centerY = {};
    byRound['Round of 32'].forEach(m => {
      const el = cardRefs.current[m.id];
      if (!el) return;
      const r = el.getBoundingClientRect();
      centerY[m.id] = r.top + r.height / 2 - cRect.top + container.scrollTop;
    });
    const newPositions = {};
    ['Round of 16', 'Quarter-final', 'Semi-final', 'Final'].forEach(round => {
      byRound[round].forEach(m => {
        const el = cardRefs.current[m.id];
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const colRect = el.parentElement.getBoundingClientRect();
        const srcYs = [];
        [m.team1Ref, m.team2Ref].forEach(ref => {
          const wl = BRACKET_REF_RE.exec(ref || '');
          if (wl && centerY[Number(wl[2])] !== undefined) srcYs.push(centerY[Number(wl[2])]);
        });
        const y = srcYs.length ? (Math.min(...srcYs) + Math.max(...srcYs)) / 2
          : rect.top + rect.height / 2 - cRect.top + container.scrollTop;
        centerY[m.id] = y;
        newPositions[m.id] = y - (colRect.top - cRect.top + container.scrollTop) - rect.height / 2;
      });
    });
    setPositions(newPositions);
  }, [resolved.matches, filter, tz, liveScores]);

  // Pass 2: once the centering above has been applied to the DOM, measure
  // real card positions to draw the connector lines — must run after pass 1
  // so the lines match where the cards actually ended up, not their
  // pre-centering flow position.
  React.useLayoutEffect(() => {
    function recompute() {
      const container = containerRef.current;
      if (!container) return;
      const cRect = container.getBoundingClientRect();
      const newLines = [];
      resolved.matches.forEach(m => {
        if (!byRound[m.round]) return;
        if (m.round === 'Match for third place') return;
        const dstEl = cardRefs.current[m.id];
        if (!dstEl) return;
        const dRect = dstEl.getBoundingClientRect();
        const x2 = dRect.left - cRect.left + container.scrollLeft;
        const y2 = dRect.top + dRect.height / 2 - cRect.top + container.scrollTop;

        const sources = [];
        [m.team1Ref, m.team2Ref].forEach(ref => {
          const wl = BRACKET_REF_RE.exec(ref || '');
          if (!wl) return;
          const srcEl = cardRefs.current[Number(wl[2])];
          if (!srcEl) return;
          const sRect = srcEl.getBoundingClientRect();
          sources.push({
            x: sRect.right - cRect.left + container.scrollLeft,
            y: sRect.top + sRect.height / 2 - cRect.top + container.scrollTop
          });
        });
        if (!sources.length) return;

        // Classic bracket elbow connector: each source runs its own
        // horizontal-then-vertical-then-horizontal path that bends at a
        // shared busX and drops straight to the destination's own height,
        // so both sources visibly converge right at the destination card's
        // edge rather than at a separate, disconnected-looking midpoint.
        const busX = (sources[0].x + x2) / 2;
        const segments = sources.map(s =>
          'M' + s.x + ',' + s.y + ' H' + busX + ' V' + y2 + ' H' + x2
        );
        newLines.push({ key: m.id, path: segments.join(' ') });
      });
      setLines(newLines);
      setSize({ w: container.scrollWidth, h: container.scrollHeight });
    }
    recompute();
    window.addEventListener('resize', recompute);
    return () => window.removeEventListener('resize', recompute);
  }, [resolved.matches, filter, tz, liveScores, positions]);

  return (
    <div>
      <div className="bracket-scroll-hint">← scroll horizontally to see all rounds through the Final →</div>
      <div className="bracket" ref={containerRef}>
        <svg className="bracket-lines" width={size.w} height={size.h}>
          {lines.map(l => <path key={l.key} d={l.path} className={`bracket-line ${highlightedKeys.has(l.key) ? 'is-highlighted' : ''}`} />)}
        </svg>
      {ROUND_ORDER.map(round => (
        <div key={round} className="bracket-col" style={round !== 'Round of 32' && round !== 'Match for third place' ? { minHeight: size.h } : null}>
          <div className="bracket-col-title">{round}</div>
          {byRound[round].map(m => (
            <div
              key={m.id}
              className={`bracket-card ${selectedId === m.id ? 'is-selected' : ''}`}
              ref={el => { if (el) cardRefs.current[m.id] = el; else delete cardRefs.current[m.id]; }}
              style={positions[m.id] !== undefined ? { position: 'absolute', top: positions[m.id], left: 0, right: 0 } : null}
              onClick={() => setSelectedId(prev => prev === m.id ? null : m.id)}
            >
              <MatchRow match={m} ctx={ctx} editable={editable} onSave={onSave} tz={tz} liveData={liveScores[m.id]} compact />
              {round === 'Match for third place' && <div className="bracket-card-note">Fed by the losers of both Semi-finals</div>}
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
  const [includeLive, setIncludeLive] = React.useState(true);
  const [standingsInfo, setStandingsInfo] = React.useState(null);
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
  const resolved = window.WC.resolveBracket(activeMatches, window.WC.GROUPS, liveScores, mode === 'actual' ? includeLive : true);
  function openStandings(team) {
    if (!team) return;
    const group = Object.keys(window.WC.GROUPS).find(g => window.WC.GROUPS[g].indexOf(team) !== -1);
    if (group) setStandingsInfo({ team, group });
  }

  const ctx = {
    myTeam,
    qualified: resolved.qualified,
    projectedQualified: resolved.projectedQualified,
    eliminatedGroupStage: resolved.eliminatedGroupStage,
    clinched: resolved.clinched,
    onTeamClick: openStandings
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
        <div className="filter-mode-row">
          <MatchFilter filter={filter} onChange={setFilter} />
          <div className="mode-controls">
            <div className="mode-toggle">
              <button className={mode === 'actual' ? 'active' : ''} onClick={() => setMode('actual')}>Actual</button>
              <button className={mode === 'simulation' ? 'active' : ''} onClick={() => setMode('simulation')}>Simulation</button>
            </div>
            {mode === 'simulation' && (
              <button className="reset-btn" onClick={resetToActual}>↺ Reset to Actual</button>
            )}
            {mode === 'actual' && (
              <label className="live-toggle">
                <input type="checkbox" checked={includeLive} onChange={e => setIncludeLive(e.target.checked)} />
                Live scores
              </label>
            )}
          </div>
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
      <StandingsModal info={standingsInfo} resolved={resolved} ctx={ctx} tz={tz} liveScores={liveScores} onClose={() => setStandingsInfo(null)} />
    </div>
  );
}
