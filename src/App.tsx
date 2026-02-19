import React, { useState, useEffect } from 'react'

interface Player {
  id: string;
  name: string;
  goals: number;
}

interface Team {
  id: string;
  name: string;
  players: Player[];
  points: number;
  goalsFor: number;
  goalsAgainst: number;
}

interface Match {
  home: string;
  away: string;
  winner?: 'home' | 'away' | null;
  scorers?: string[]; // IDs de jugadores que anotaron
}

type DrawStatus = 'idle' | 'gathering' | 'results';

function App() {
  const [teams, setTeams] = useState<Team[]>(() => {
    const saved = localStorage.getItem('liga-teams');
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      return parsed.map((t: any) => ({
        ...t,
        players: (t.players || []).map((p: any) =>
          typeof p === 'string' ? { id: crypto.randomUUID(), name: p, goals: 0 } : p
        ),
        points: t.points || 0,
        goalsFor: t.goalsFor || 0,
        goalsAgainst: t.goalsAgainst || 0
      }));
    } catch (e) { return []; }
  });

  const [status, setStatus] = useState<DrawStatus>('idle');
  const [newTeamName, setNewTeamName] = useState('');
  const [newPlayerName, setNewPlayerName] = useState('');
  const [activeTab, setActiveTab] = useState<'teams' | 'calendar'>('teams');
  const [teamSubTab, setTeamSubTab] = useState<'roster' | 'players'>('roster');
  const [selectedManageTeamId, setSelectedManageTeamId] = useState<string | null>(null);
  const [calendarSubTab, setCalendarSubTab] = useState<'league' | 'knockout'>('league');
  const [showStandings, setShowStandings] = useState(false);
  const [knockoutActiveRound, setKnockoutActiveRound] = useState(0);
  const [scoringMatch, setScoringMatch] = useState<{ roundIdx: number, matchIdx: number, type: 'league' | 'knockout' } | null>(null);
  const [knockoutBrackets, setKnockoutBrackets] = useState<Match[][]>(() => {
    const saved = localStorage.getItem('liga-knockout');
    return saved ? JSON.parse(saved) : [];
  });

  const [tournament, setTournament] = useState<Match[][]>(() => {
    const saved = localStorage.getItem('liga-tournament');
    try {
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  useEffect(() => {
    localStorage.setItem('liga-teams', JSON.stringify(teams));
  }, [teams]);

  useEffect(() => {
    localStorage.setItem('liga-tournament', JSON.stringify(tournament));
  }, [tournament]);

  useEffect(() => {
    localStorage.setItem('liga-knockout', JSON.stringify(knockoutBrackets));
  }, [knockoutBrackets]);

  const setWinner = (roundIdx: number, matchIdx: number, winner: 'home' | 'away') => {
    const newTournament = [...tournament];
    const match = newTournament[roundIdx][matchIdx];
    match.winner = match.winner === winner ? null : winner;
    setTournament(newTournament);
    recalculateStats(newTournament);
  };

  const recalculateStats = (currentTournament: Match[][]) => {
    const newTeams = teams.map(t => ({ ...t, points: 0, goalsFor: 0, goalsAgainst: 0 }));

    currentTournament.forEach(round => {
      round.forEach(match => {
        const home = newTeams.find(t => t.name === match.home);
        const away = newTeams.find(t => t.name === match.away);

        if (home && away) {
          // Contar goles reales del partido basándose en scorers
          let homeGoals = 0;
          let awayGoals = 0;

          if (match.scorers) {
            match.scorers.forEach(pId => {
              if (home.players.some(p => p.id === pId)) homeGoals++;
              else if (away.players.some(p => p.id === pId)) awayGoals++;
            });
          }

          home.goalsFor += homeGoals;
          home.goalsAgainst += awayGoals;
          away.goalsFor += awayGoals;
          away.goalsAgainst += homeGoals;

          if (match.winner) {
            if (match.winner === 'home') home.points += 3;
            else if (match.winner === 'away') away.points += 3;
          }
        }
      });
    });

    setTeams(newTeams);
    updateGlobalScorers(currentTournament);
  };

  const updateGlobalScorers = (currentTournament: Match[][]) => {
    setTeams(prevTeams => {
      const resetTeams = prevTeams.map(t => ({
        ...t,
        players: t.players.map(p => ({ ...p, goals: 0 }))
      }));
      currentTournament.flat().forEach(match => {
        if (match.scorers) {
          match.scorers.forEach(playerId => {
            resetTeams.forEach(team => {
              const player = team.players.find(p => p.id === playerId);
              if (player) player.goals += 1;
            });
          });
        }
      });
      return resetTeams;
    });
  };

  const generateLeague = () => {
    if (teams.length < 2) return;
    const teamList = [...teams];
    if (teamList.length % 2 !== 0) {
      teamList.push({ id: 'bye', name: 'DESCANSA', players: [], points: 0, goalsFor: 0, goalsAgainst: 0 });
    }
    const n = teamList.length;
    const rounds = n - 1;
    const matchesPerRound = n / 2;
    const schedule: Match[][] = [];
    for (let r = 0; r < rounds; r++) {
      const roundMatches: Match[] = [];
      for (let m = 0; m < matchesPerRound; m++) {
        const home = teamList[m];
        const away = teamList[n - 1 - m];
        if (home.name !== 'DESCANSA' && away.name !== 'DESCANSA') {
          roundMatches.push({ home: home.name, away: away.name });
        }
      }
      teamList.splice(1, 0, teamList.pop()!);
      schedule.push(roundMatches);
    }
    setTournament(schedule);
    recalculateStats(schedule);
    setStatus('results');
  };

  const fullReset = () => {
    setTournament([]);
    setKnockoutBrackets([]);
    setKnockoutActiveRound(0);
    setStatus('idle');
    setTeams(prev => prev.map(t => ({
      ...t,
      players: [],
      points: 0,
      goalsFor: 0,
      goalsAgainst: 0
    })));
  };

  const isRoundComplete = (rIdx: number) => {
    if (rIdx < 0) return true;
    if (!knockoutBrackets[rIdx]) return false;
    return knockoutBrackets[rIdx].every(m => m.winner !== null && m.home !== '?' && m.away !== '?');
  };

  const startKnockout = () => {
    const sorted = [...teams].sort((a, b) => b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst));
    const numTeams = teams.length >= 8 ? 8 : (teams.length >= 4 ? 4 : 2);
    const topTeams = sorted.slice(0, numTeams);
    const firstRound: Match[] = [];
    for (let i = 0; i < numTeams / 2; i++) {
      firstRound.push({
        home: topTeams[i].name,
        away: topTeams[numTeams - 1 - i].name,
        winner: null
      });
    }
    const brackets: Match[][] = [firstRound];
    let nextRoundSize = numTeams / 4;
    while (nextRoundSize >= 1) {
      brackets.push(Array(nextRoundSize).fill(null).map(() => ({ home: '?', away: '?', winner: null })));
      nextRoundSize /= 2;
    }
    setKnockoutBrackets(brackets);
    setCalendarSubTab('knockout');
    setShowStandings(false);
  };

  const setKnockoutWinner = (roundIdx: number, matchIdx: number, winner: 'home' | 'away') => {
    const newBrackets = [...knockoutBrackets];
    const match = newBrackets[roundIdx][matchIdx];
    if (match.winner === winner) {
      match.winner = null;
    } else {
      match.winner = winner;
      if (roundIdx + 1 < newBrackets.length) {
        const nextMatchIdx = Math.floor(matchIdx / 2);
        const side = matchIdx % 2 === 0 ? 'home' : 'away';
        newBrackets[roundIdx + 1][nextMatchIdx][side] = winner === 'home' ? match.home : match.away;
      }
      if (newBrackets[roundIdx].every(m => m.winner !== null)) {
        setTimeout(() => {
          if (roundIdx + 1 < newBrackets.length) setKnockoutActiveRound(roundIdx + 1);
        }, 600);
      }
    }
    setKnockoutBrackets(newBrackets);
  };

  const removePlayer = (teamId: string, playerId: string) => {
    setTeams(prev => prev.map(t => t.id === teamId ? { ...t, players: (t.players || []).filter(p => p.id !== playerId) } : t));
  };

  const addScorerToMatch = (playerId: string) => {
    if (!scoringMatch) return;
    const { roundIdx, matchIdx, type } = scoringMatch;
    if (type === 'league') {
      const newTournament = [...tournament];
      const match = newTournament[roundIdx][matchIdx];
      match.scorers = [...(match.scorers || []), playerId];
      setTournament(newTournament);
      updateGlobalScorers(newTournament);
    } else {
      const newBrackets = [...knockoutBrackets];
      const match = newBrackets[roundIdx][matchIdx];
      match.scorers = [...(match.scorers || []), playerId];
      setKnockoutBrackets(newBrackets);
      updateGlobalScorers([...tournament, ...knockoutBrackets]);
    }
  };

  const removeScorerFromMatch = (scorerIdx: number) => {
    if (!scoringMatch) return;
    const { roundIdx, matchIdx, type } = scoringMatch;
    if (type === 'league') {
      const newTournament = [...tournament];
      const match = newTournament[roundIdx][matchIdx];
      if (match.scorers) {
        match.scorers.splice(scorerIdx, 1);
        setTournament(newTournament);
        updateGlobalScorers(newTournament);
      }
    } else {
      const newBrackets = [...knockoutBrackets];
      const match = newBrackets[roundIdx][matchIdx];
      if (match.scorers) {
        match.scorers.splice(scorerIdx, 1);
        setKnockoutBrackets(newBrackets);
        updateGlobalScorers([...tournament, ...knockoutBrackets]);
      }
    }
  };

  const addTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    setTeams([...teams, {
      id: Date.now().toString(),
      name: newTeamName.trim(),
      players: [],
      points: 0,
      goalsFor: 0,
      goalsAgainst: 0
    }]);
    setNewTeamName('');
    setStatus('idle');
  };

  const removeTeam = (id: string) => {
    setTeams(teams.filter(t => t.id !== id));
    setStatus('idle');
  };

  const startDrawAction = () => {
    setStatus('gathering');
    setTimeout(() => {
      generateLeague();
    }, 3200);
  };

  const calculateMatchScore = (match: Match) => {
    const homeTeam = teams.find(t => t.name === match.home || t.id === match.home);
    const awayTeam = teams.find(t => t.name === match.away || t.id === match.away);
    let homeGoals = 0;
    let awayGoals = 0;

    if (match.scorers && homeTeam && awayTeam) {
      match.scorers.forEach(playerId => {
        if (homeTeam.players.some(p => p.id === playerId)) homeGoals++;
        else if (awayTeam.players.some(p => p.id === playerId)) awayGoals++;
      });
    }
    return { homeGoals, awayGoals };
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ marginBottom: '3rem', textAlign: 'center' }}>
        <h1>League of Legends</h1>
        <p style={{ color: 'var(--text-dim)' }}>Gestiona tus equipos y crea sorteos épicos</p>
      </header>

      <nav className="tabs-nav">
        <button className={`tab-btn ${activeTab === 'teams' ? 'active' : ''}`} onClick={() => setActiveTab('teams')}>⚽ Equipos</button>
        <button className={`tab-btn ${activeTab === 'calendar' ? 'active' : ''}`} onClick={() => setActiveTab('calendar')}>🏆 Calendario</button>
      </nav>

      <main className="glass-pane" style={{ padding: '3rem', overflow: 'hidden' }}>
        {activeTab === 'teams' ? (
          <div>
            <nav className="sub-tabs-nav">
              <button className={`sub-tab-btn ${teamSubTab === 'roster' ? 'active' : ''}`} onClick={() => setTeamSubTab('roster')}>📋 Inscripción de Equipos</button>
              <button className={`sub-tab-btn ${teamSubTab === 'players' ? 'active' : ''}`} onClick={() => { setTeamSubTab('players'); if (!selectedManageTeamId && teams.length > 0) setSelectedManageTeamId(teams[0].id); }}>🏃 Gestión de Plantillas</button>
            </nav>

            {teamSubTab === 'roster' ? (
              <div className="animate-fade-in">
                <form onSubmit={addTeam} className={`input-group ${status !== 'idle' ? 'hidden' : ''}`}>
                  <input type="text" placeholder="Nombre de equipo..." value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} />
                  <button type="submit" className="btn-primary">Añadir Equipo</button>
                </form>

                <div className={`team-grid ${status === 'results' ? 'hidden' : ''} ${status === 'gathering' ? 'gathering-active' : ''}`} style={{ marginBottom: '2rem' }}>
                  {status === 'gathering' && <div className="vortex-absolute"><div className="vortex"></div></div>}
                  {teams.map((team, idx) => (
                    <div key={team.id} className={`team-card ${status === 'gathering' ? 'team-item-gathering' : ''}`} style={status === 'gathering' ? { '--start-x': `${(idx % 3 - 1) * 300}px`, '--start-y': `${(Math.floor(idx / 3) - 1) * 200}px`, animationDelay: `${idx * 0.1}s` } as React.CSSProperties : {}}>
                      <span className="team-name-clickable" onClick={() => { setSelectedManageTeamId(team.id); setTeamSubTab('players'); }}>{team.name}</span>
                      <button onClick={() => removeTeam(team.id)} className={`btn-delete ${status !== 'idle' ? 'hidden' : ''}`}>×</button>
                    </div>
                  ))}
                </div>

                {teams.length >= 2 && status === 'idle' && (
                  <div style={{ textAlign: 'center' }}>
                    <button onClick={startDrawAction} className="btn-primary" style={{ background: 'var(--accent)', color: 'white' }}>¡LANZAR AL VÓRTICE!</button>
                  </div>
                )}

                {status === 'results' && (
                  <div className="draw-area">
                    <h2 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>🔥 ¡Torneo Generado! 🔥</h2>
                    <p style={{ textAlign: 'center', color: 'var(--text-dim)' }}>Ve a la pestaña de Calendario para ver todas las jornadas.</p>
                    <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                      <button onClick={fullReset} className="btn-primary" style={{ background: 'var(--text-dim)', color: 'white' }}>REINICIAR SORTEO</button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="animate-fade-in">
                <div style={{ marginBottom: '2.5rem' }}>
                  <label style={{ display: 'block', marginBottom: '1rem', color: 'var(--text-dim)', fontSize: '0.9rem' }}>Selecciona Equipo a Gestionar:</label>
                  <div className="team-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
                    {teams.map(team => (
                      <div key={team.id} className={`team-card ${selectedManageTeamId === team.id ? 'active' : ''}`} onClick={() => setSelectedManageTeamId(team.id)} style={{ padding: '1rem', cursor: 'pointer', borderColor: selectedManageTeamId === team.id ? 'var(--neon-cyan)' : 'transparent' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{team.name}</span>
                        {selectedManageTeamId === team.id && <span style={{ color: 'var(--neon-cyan)' }}>●</span>}
                      </div>
                    ))}
                  </div>
                </div>

                {selectedManageTeamId && (() => {
                  const team = teams.find(t => t.id === selectedManageTeamId);
                  if (!team) return null;
                  return (
                    <div className="glass-pane animate-fade-in" style={{ padding: '2rem', border: '1px solid var(--neon-cyan)', boxShadow: '0 0 20px rgba(0, 242, 254, 0.1)' }}>
                      <h2 style={{ color: 'var(--neon-cyan)', marginBottom: '1.5rem' }}>Plantilla: {team.name}</h2>
                      <form onSubmit={(e) => {
                        e.preventDefault();
                        if (!newPlayerName.trim()) return;
                        const newPlayer: Player = { id: crypto.randomUUID(), name: newPlayerName.trim(), goals: 0 };
                        setTeams(prev => prev.map(t => t.id === team.id ? { ...t, players: [...(t.players || []), newPlayer] } : t));
                        setNewPlayerName('');
                      }} className="input-group" style={{ marginBottom: '2rem' }}>
                        <input type="text" placeholder="Nombre del nuevo jugador..." value={newPlayerName} onChange={(e) => setNewPlayerName(e.target.value)} />
                        <button type="submit" className="btn-primary">Inscribir</button>
                      </form>
                      <ul className="player-list">
                        {(team.players || []).map((player) => (
                          <li key={player.id} className="player-item" style={{ background: 'rgba(255,255,255,0.02)', padding: '12px 20px', borderRadius: '12px', marginBottom: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <span style={{ fontSize: '1.1rem' }}>{player.name}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                              <span style={{ color: 'var(--neon-green)', fontWeight: 'bold' }}>⚽ {player.goals}</span>
                              <button onClick={() => removePlayer(team.id, player.id)} className="btn-icon-delete" title="Eliminar Jugador">🗑️</button>
                            </div>
                          </li>
                        ))}
                        {(!team.players || team.players.length === 0) && <p style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '2rem' }}>Este equipo aún no tiene jugadores inscritos.</p>}
                      </ul>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        ) : (
          <div className="calendar-view">
            <div className="tabs-nav" style={{ justifyContent: 'flex-start', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
              <button className={`tab-btn ${calendarSubTab === 'league' ? 'active' : ''}`} onClick={() => setCalendarSubTab('league')}>📅 Jornadas de Liga</button>
              <button className={`tab-btn ${calendarSubTab === 'knockout' ? 'active' : ''}`} onClick={() => setCalendarSubTab('knockout')}>⚔️ Fases Finales</button>
              <button className="btn-primary" onClick={() => setShowStandings(true)} style={{ marginLeft: 'auto', fontSize: '0.8rem', padding: '8px 16px', background: 'var(--neon-magenta)', color: 'white' }}>📊 Ver Tabla de Posiciones</button>
            </div>

            {calendarSubTab === 'league' ? (
              <div style={{ marginTop: '1rem' }}>
                {tournament.length > 0 ? (
                  tournament.map((round, roundIdx) => (
                    <section key={roundIdx} className="round-section" style={{ marginBottom: '3rem' }}>
                      <h3 className="round-title">Jornada {roundIdx + 1}</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                        {round.map((match, mIdx) => {
                          const { homeGoals, awayGoals } = calculateMatchScore(match);
                          return (
                            <div key={mIdx} className={`match-item ${match.winner ? 'has-result' : ''}`}>
                              <div className={`team-selector ${match.winner === 'home' ? 'winner' : match.winner === 'away' ? 'loser' : ''}`} onClick={() => setWinner(roundIdx, mIdx, 'home')}>
                                <strong className="team-name-clickable">{match.home}</strong>
                                {match.winner === 'home' && <span className="winner-check">✓</span>}
                              </div>
                              <span className="vs-badge">{match.winner ? `${homeGoals} - ${awayGoals}` : 'VS'}</span>
                              <div className={`team-selector ${match.winner === 'away' ? 'winner' : match.winner === 'home' ? 'loser' : ''}`} onClick={() => setWinner(roundIdx, mIdx, 'away')}>
                                <strong className="team-name-clickable">{match.away}</strong>
                                {match.winner === 'away' && <span className="winner-check">✓</span>}
                              </div>
                              {match.winner && (
                                <button onClick={(e) => { e.stopPropagation(); setScoringMatch({ roundIdx, matchIdx: mIdx, type: 'league' }); }} className="btn-scorer-trigger" title="Registrar Goleadores">⚽ {(match.scorers || []).length}</button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  ))
                ) : <p style={{ textAlign: 'center', color: 'var(--text-dim)', marginTop: '2rem' }}>Aún no hay un calendario generado.</p>}
              </div>
            ) : (
              <div className="knockout-view" style={{ marginTop: '1rem' }}>
                {knockoutBrackets.length > 0 ? (
                  <>
                    <div className="tabs-nav" style={{ justifyContent: 'center', marginBottom: '2rem', gap: '0.5rem' }}>
                      {knockoutBrackets.map((_, rIdx) => {
                        const isUnlocked = isRoundComplete(rIdx - 1);
                        const label = rIdx === 0 && knockoutBrackets.length === 3 ? 'Cuartos' : rIdx === knockoutBrackets.length - 2 ? 'Semifinales' : rIdx === knockoutBrackets.length - 1 ? 'Gran Final' : `Fase ${rIdx + 1}`;
                        return (
                          <button key={rIdx} className={`tab-btn ${knockoutActiveRound === rIdx ? 'active' : ''} ${!isUnlocked ? 'disabled' : ''}`} onClick={() => isUnlocked && setKnockoutActiveRound(rIdx)}>{isUnlocked ? label : '🔒 Bloqueado'}</button>
                        );
                      })}
                    </div>
                    <div className="bracket-active-round">
                      {knockoutBrackets[knockoutActiveRound] && (
                        <div className="bracket-column animate-fade-in">
                          <h3 className="round-title" style={{ textAlign: 'center', marginBottom: '2rem' }}>
                            {knockoutActiveRound === 0 && knockoutBrackets.length === 3 ? 'Cuartos de Final' : knockoutActiveRound === knockoutBrackets.length - 2 ? 'Semifinales' : knockoutActiveRound === knockoutBrackets.length - 1 ? 'La Gran Final' : `Eliminatoria - Fase ${knockoutActiveRound + 1}`}
                          </h3>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
                            {knockoutBrackets[knockoutActiveRound].map((match, mIdx) => {
                              const { homeGoals, awayGoals } = calculateMatchScore(match);
                              return (
                                <div key={mIdx} className={`match-item ${match.winner ? 'has-result' : ''}`}>
                                  <div
                                    className={`team-selector ${match.winner === 'home' ? 'winner' : match.winner === 'away' ? 'loser' : ''} ${match.home === '?' ? 'disabled' : ''}`}
                                    onClick={() => match.home !== '?' && setKnockoutWinner(knockoutActiveRound, mIdx, 'home')}
                                  >
                                    <strong className="team-name-clickable">{match.home}</strong>
                                    {match.winner === 'home' && <span className="winner-check">✓</span>}
                                  </div>
                                  <span className="vs-badge">{match.winner ? `${homeGoals} - ${awayGoals}` : 'VS'}</span>
                                  <div
                                    className={`team-selector ${match.winner === 'away' ? 'winner' : match.winner === 'home' ? 'loser' : ''} ${match.away === '?' ? 'disabled' : ''}`}
                                    onClick={() => match.away !== '?' && setKnockoutWinner(knockoutActiveRound, mIdx, 'away')}
                                  >
                                    <strong className="team-name-clickable">{match.away}</strong>
                                    {match.winner === 'away' && <span className="winner-check">✓</span>}
                                  </div>
                                  {match.winner && (
                                    <button onClick={(e) => { e.stopPropagation(); setScoringMatch({ roundIdx: knockoutActiveRound, matchIdx: mIdx, type: 'knockout' }); }} className="btn-scorer-trigger" title="Registrar Goleadores">⚽ {(match.scorers || []).length}</button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : <div style={{ textAlign: 'center', padding: '3rem' }}><h3 style={{ color: 'var(--text-dim)' }}>¡Califica a los mejores!</h3><p>Completa la liga y usa el botón en la Tabla de Posiciones para iniciar las eliminatorias.</p></div>}
              </div>
            )}
          </div>
        )}
      </main>

      {showStandings && (
        <div className="modal-overlay" onClick={() => setShowStandings(false)}>
          <div className="modal-content glass-pane" onClick={e => e.stopPropagation()} style={{ padding: '2rem', maxWidth: '700px' }}>
            <h2 style={{ marginBottom: '1.5rem', color: 'var(--neon-cyan)', textAlign: 'center' }}>🏆 Tabla de Posiciones 🏆</h2>
            <div className="standings-table-container">
              <table className="standings-table">
                <thead><tr><th>Pos</th><th style={{ textAlign: 'left' }}>Equipo</th><th>PTS</th><th>GF</th><th>GC</th><th>DG</th></tr></thead>
                <tbody>
                  {[...teams].sort((a, b) => b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst)).map((team, idx) => (
                    <tr key={team.id} className={idx === 0 ? 'leader-row' : ''}><td>{idx + 1}</td><td>{team.name}</td><td>{team.points}</td><td>{team.goalsFor}</td><td>{team.goalsAgainst}</td><td>{team.goalsFor - team.goalsAgainst}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h2 style={{ marginBottom: '1.5rem', marginTop: '2.5rem', color: 'var(--neon-green)', textAlign: 'center' }}>🔥 Bota de Oro 🔥</h2>
            <div className="standings-table-container">
              <table className="standings-table">
                <thead><tr><th>Pos</th><th style={{ textAlign: 'left' }}>Jugador</th><th style={{ textAlign: 'left' }}>Equipo</th><th>Goles</th></tr></thead>
                <tbody>
                  {teams.flatMap(t => t.players.map(p => ({ ...p, teamName: t.name }))).sort((a, b) => b.goals - a.goals).filter(p => p.goals > 0).slice(0, 10).map((player, idx) => (
                    <tr key={player.id} className={idx === 0 ? 'leader-row' : ''}><td>{idx + 1}</td><td>{player.name}</td><td>{player.teamName}</td><td>⚽ {player.goals}</td></tr>
                  ))}
                  {teams.every(t => t.players.every(p => p.goals === 0)) && <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2rem' }}>Aún no hay goles registrados.</td></tr>}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
              <button onClick={fullReset} className="btn-primary" style={{ flex: 1, background: 'var(--neon-magenta)' }}>🔄 Reinicio</button>
              <button onClick={startKnockout} className="btn-primary" style={{ flex: 1, background: 'var(--neon-magenta)' }}>🎯 Eliminatorias</button>
              <button onClick={() => setShowStandings(false)} className="btn-primary" style={{ flex: 1, background: 'var(--text-dim)' }}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {scoringMatch && (() => {
        const { roundIdx, matchIdx, type } = scoringMatch;
        const match = type === 'league' ? tournament[roundIdx][matchIdx] : knockoutBrackets[roundIdx][matchIdx];
        const homeTeam = teams.find(t => t.name === match.home || t.id === match.home);
        const awayTeam = teams.find(t => t.name === match.away || t.id === match.away);
        return (
          <div className="modal-overlay" onClick={() => setScoringMatch(null)}>
            <div className="modal-content glass-pane" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px' }}>
              <h2 style={{ color: 'var(--neon-green)', textAlign: 'center', marginBottom: '1.5rem' }}>⚽ Registro de Goleadores ⚽</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                {[{ team: homeTeam, color: 'var(--neon-cyan)' }, { team: awayTeam, color: 'var(--neon-magenta)' }].map((side, sIdx) => (
                  <div key={sIdx} className="team-column">
                    <h4 style={{ color: side.color, marginBottom: '1rem' }}>{side.team?.name}</h4>
                    <div className="scorers-select-grid">
                      {side.team?.players.map(p => (
                        <div key={p.id} className="player-scorer-row">
                          <button onClick={() => addScorerToMatch(p.id)} className="btn-player-scorer">{p.name}</button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="scorers-summary" style={{ marginTop: '2rem', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>
                <h4 style={{ marginBottom: '1rem' }}>Goles:</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {(match.scorers || []).map((pId, idx) => (
                    <div key={idx} className="scorer-tag">
                      <span>{teams.flatMap(t => t.players).find(p => p.id === pId)?.name} ⚽</span>
                      <button onClick={() => removeScorerFromMatch(idx)}>×</button>
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={() => setScoringMatch(null)} className="btn-primary" style={{ width: '100%', marginTop: '2rem' }}>Cerrar</button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default App;