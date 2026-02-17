import React, { useState, useEffect } from 'react'

interface Team {
  id: string;
  name: string;
  players: string[];
  points: number;
  goalsFor: number;
  goalsAgainst: number;
}

interface Match {
  home: string;
  away: string;
  winner?: 'home' | 'away' | null;
}

// Estados: 'idle' | 'gathering' | 'results'
type DrawStatus = 'idle' | 'gathering' | 'results';

function App() {
  const [teams, setTeams] = useState<Team[]>(() => {
    const saved = localStorage.getItem('liga-teams');
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      return parsed.map((t: any) => ({
        ...t,
        players: t.players || [],
        points: t.points || 0,
        goalsFor: t.goalsFor || 0,
        goalsAgainst: t.goalsAgainst || 0
      }));
    } catch (e) { return []; }
  });

  const [status, setStatus] = useState<DrawStatus>('idle');
  const [newTeamName, setNewTeamName] = useState('');
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [activeTab, setActiveTab] = useState<'teams' | 'calendar'>('teams');
  const [calendarSubTab, setCalendarSubTab] = useState<'league' | 'knockout'>('league');
  const [modalTab, setModalTab] = useState<'plantilla' | 'stats'>('plantilla');
  const [showStandings, setShowStandings] = useState(false);
  const [knockoutActiveRound, setKnockoutActiveRound] = useState(0);
  const [knockoutBrackets, setKnockoutBrackets] = useState<Match[][]>(() => {
    const saved = localStorage.getItem('liga-knockout');
    return saved ? JSON.parse(saved) : [];
  });

  // Persistencia del torneo
  const [tournament, setTournament] = useState<Match[][]>(() => {
    const saved = localStorage.getItem('liga-tournament');
    try {
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  // Efectos de persistencia
  useEffect(() => {
    localStorage.setItem('liga-teams', JSON.stringify(teams));
  }, [teams]);

  useEffect(() => {
    localStorage.setItem('liga-tournament', JSON.stringify(tournament));
  }, [tournament]);

  useEffect(() => {
    localStorage.setItem('liga-knockout', JSON.stringify(knockoutBrackets));
  }, [knockoutBrackets]);

  // Función para establecer ganador por clic
  const setWinner = (roundIdx: number, matchIdx: number, winner: 'home' | 'away') => {
    const newTournament = [...tournament];
    const match = newTournament[roundIdx][matchIdx];

    // Si ya era el ganador, lo quitamos (cancelar)
    if (match.winner === winner) {
      match.winner = null;
    } else {
      match.winner = winner;
    }

    setTournament(newTournament);
    recalculateStats(newTournament);
  };

  const recalculateStats = (currentTournament: Match[][]) => {
    const newTeams = teams.map(t => ({ ...t, points: 0, goalsFor: 0, goalsAgainst: 0 }));

    currentTournament.forEach(round => {
      round.forEach(match => {
        if (match.winner) {
          const home = newTeams.find(t => t.name === match.home);
          const away = newTeams.find(t => t.name === match.away);

          if (home && away) {
            if (match.winner === 'home') {
              home.points += 3;
            } else if (match.winner === 'away') {
              away.points += 3;
            }
          }
        }
      });
    });
    setTeams(newTeams);
  };

  // Función para generar calendario Round Robin (Liga)
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
        if (home.name !== 'DESCANSA' || away.name !== 'DESCANSA') {
          roundMatches.push({ home: home.name, away: away.name });
        }
      }
      // Rotar equipos excepto el primero
      teamList.splice(1, 0, teamList.pop()!);
      schedule.push(roundMatches);
    }
    setTournament(schedule);
    recalculateStats(schedule); // Asegurar reset de puntos al iniciar nuevo torneo
    setStatus('results');
  };

  // Función para reiniciar todos los resultados del torneo actual
  const resetTournamentResults = () => {
    const freshTournament = tournament.map(round =>
      round.map(match => ({ ...match, winner: null }))
    );
    setTournament(freshTournament);
    setKnockoutBrackets([]);
    setKnockoutActiveRound(0);
    recalculateStats(freshTournament);
  };

  const isRoundComplete = (rIdx: number) => {
    if (rIdx < 0) return true;
    if (!knockoutBrackets[rIdx]) return false;
    return knockoutBrackets[rIdx].every(m => m.winner !== null && m.home !== '?' && m.away !== '?');
  };

  // Función para iniciar Fases Finales (Top 8 o Top 4)
  const startKnockout = () => {
    const sorted = [...teams].sort((a, b) => b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst));

    // Determinamos si hacemos Cuartos (8 equipos) o Semis (4 equipos)
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

    // Inicializamos las rondas siguientes vacías
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

  // Función para establecer ganador en eliminatorias y avanzar
  const setKnockoutWinner = (roundIdx: number, matchIdx: number, winner: 'home' | 'away') => {
    const newBrackets = [...knockoutBrackets];
    const match = newBrackets[roundIdx][matchIdx];

    if (match.winner === winner) {
      match.winner = null;
    } else {
      match.winner = winner;
      // Avanzar al equipo a la siguiente ronda si existe
      if (roundIdx + 1 < newBrackets.length) {
        const nextMatchIdx = Math.floor(matchIdx / 2);
        const side = matchIdx % 2 === 0 ? 'home' : 'away';
        const teamName = winner === 'home' ? match.home : match.away;
        newBrackets[roundIdx + 1][nextMatchIdx][side] = teamName;
      }

      // Proactividad: Si se completa la ronda actual, sugerir/saltar a la siguiente
      if (newBrackets[roundIdx].every(m => m.winner !== null)) {
        setTimeout(() => {
          if (roundIdx + 1 < newBrackets.length) {
            setKnockoutActiveRound(roundIdx + 1);
          }
        }, 600);
      }
    }
    setKnockoutBrackets(newBrackets);
  };

  //funcion para guardar jugadores
  const addPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trimEnd() || !editingTeamId) return;

    const team = teams.find(t => t.id === editingTeamId);
    if (!team) return;

    const updatedTeam = {
      ...team,
      players: [...(team.players || []), newPlayerName.trim()]
    };

    setTeams(teams.map(t => t.id === editingTeamId ? updatedTeam : t));
    setNewPlayerName('');
  };

  const removePlayer = (playerName: string) => {
    if (!editingTeamId) return;
    const team = teams.find(t => t.id === editingTeamId);
    if (!team) return;

    const updatedTeam = {
      ...team,
      players: (team.players || []).filter(p => p !== playerName)
    };
    setTeams(teams.map(t => t.id === editingTeamId ? updatedTeam : t));
  };

  const updateTeamStats = (id: string, field: keyof Team, value: number) => {
    setTeams(teams.map(t => t.id === id ? { ...t, [field]: value } : t));
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
    const updatedTeams = teams.filter(t => t.id !== id);
    setTeams(updatedTeams);
    setStatus('idle');
  };

  // Función para iniciar el sorteo con animación
  const startDrawAction = () => {
    setStatus('gathering');
    setTimeout(() => {
      generateLeague();
    }, 3200);
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ marginBottom: '3rem', textAlign: 'center' }}>
        <h1>Liga Estelar</h1>
        <p style={{ color: 'var(--text-dim)' }}>Gestiona tus equipos y crea sorteos épicos</p>
      </header>

      <nav className="tabs-nav">
        <button
          className={`tab-btn ${activeTab === 'teams' ? 'active' : ''}`}
          onClick={() => setActiveTab('teams')}
        >
          ⚽ Equipos
        </button>
        <button
          className={`tab-btn ${activeTab === 'calendar' ? 'active' : ''}`}
          onClick={() => setActiveTab('calendar')}
        >
          🏆 Calendario
        </button>
      </nav>

      <main className="glass-pane" style={{ padding: '3rem', overflow: 'hidden' }}>
        {activeTab === 'teams' ? (
          <div>
            {/* Formulario e Input */}
            <form onSubmit={addTeam} className={`input-group ${status !== 'idle' ? 'hidden' : ''}`}>
              <input
                type="text"
                placeholder="Nombre de equipo..."
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
              />
              <button type="submit" className="btn-primary">Añadir Equipo</button>
            </form>

            {/* Lista de equipos con animación de reunión */}
            <div className={`team-grid ${status === 'results' ? 'hidden' : ''} ${status === 'gathering' ? 'gathering-active' : ''}`} style={{ marginBottom: '2rem' }}>
              {status === 'gathering' && (
                <div className="vortex-absolute">
                  <div className="vortex"></div>
                </div>
              )}
              {teams.map((team, idx) => (
                <div
                  key={team.id}
                  className={`team-card ${status === 'gathering' ? 'team-item-gathering' : ''}`}
                  style={status === 'gathering' ? {
                    '--start-x': `${(idx % 3 - 1) * 300}px`,
                    '--start-y': `${(Math.floor(idx / 3) - 1) * 200}px`,
                    animationDelay: `${idx * 0.1}s`
                  } as React.CSSProperties : {}}
                >
                  <span
                    className="team-name-clickable"
                    onClick={() => setEditingTeamId(team.id)}
                  >
                    {team.name}
                  </span>
                  <button onClick={() => removeTeam(team.id)} className={`btn-delete ${status !== 'idle' ? 'hidden' : ''}`}>×</button>
                </div>
              ))}
            </div>

            {/* Botón de Sorteo */}
            {teams.length >= 2 && status === 'idle' && (
              <div style={{ textAlign: 'center' }}>
                <button onClick={startDrawAction} className="btn-primary" style={{ background: 'var(--accent)', color: 'white' }}>
                  ¡LANZAR AL VÓRTICE!
                </button>
              </div>
            )}

            {/* El Vórtice Animado (Solo se muestra fuera si no estamos recolectando) */}
            {status === 'gathering' && false && (
              <div className="vortex-container">
                <div className="vortex"></div>
              </div>
            )}

            {/* Resultados con animación de explosión */}
            {status === 'results' && (
              <div className="draw-area">
                <h2 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>🔥 ¡Torneo Generado! 🔥</h2>
                <p style={{ textAlign: 'center', color: 'var(--text-dim)' }}>
                  Ve a la pestaña de Calendario para ver todas las jornadas.
                </p>
                <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                  <button onClick={() => setStatus('idle')} className="btn-primary" style={{ background: 'var(--text-dim)', color: 'white' }}>
                    REINICIAR SORTEO
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="calendar-view">
            <div className="tabs-nav" style={{ justifyContent: 'flex-start', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
              <button
                className={`tab-btn ${calendarSubTab === 'league' ? 'active' : ''}`}
                onClick={() => setCalendarSubTab('league')}
                style={{ fontSize: '0.9rem', padding: '8px 16px' }}
              >
                📅 Jornadas de Liga
              </button>
              <button
                className={`tab-btn ${calendarSubTab === 'knockout' ? 'active' : ''}`}
                onClick={() => setCalendarSubTab('knockout')}
                style={{ fontSize: '0.9rem', padding: '8px 16px' }}
              >
                ⚔️ Fases Finales
              </button>
              <button
                className="btn-primary"
                onClick={() => setShowStandings(true)}
                style={{ marginLeft: 'auto', fontSize: '0.8rem', padding: '8px 16px', background: 'var(--neon-magenta)', color: 'white' }}
              >
                📊 Ver Tabla de Posiciones
              </button>
            </div>

            {calendarSubTab === 'league' ? (
              // ... vista de liga existente ...
              <div style={{ marginTop: '1rem' }}>
                {tournament.length > 0 ? (
                  tournament.map((round, roundIdx) => (
                    <section key={roundIdx} className="round-section" style={{ marginBottom: '3rem' }}>
                      <h3 className="round-title">Jornada {roundIdx + 1}</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                        {round.map((match, mIdx) => (
                          <div key={mIdx} className={`match-item ${match.winner ? 'has-result' : ''}`}>
                            <div
                              className={`team-selector ${match.winner === 'home' ? 'winner' : match.winner === 'away' ? 'loser' : ''}`}
                              onClick={() => setWinner(roundIdx, mIdx, 'home')}
                            >
                              <strong className="team-name-clickable">{match.home}</strong>
                              {match.winner === 'home' && <span className="winner-check">✓</span>}
                            </div>

                            <span className="vs-badge">VS</span>

                            <div
                              className={`team-selector ${match.winner === 'away' ? 'winner' : match.winner === 'home' ? 'loser' : ''}`}
                              onClick={() => setWinner(roundIdx, mIdx, 'away')}
                            >
                              <strong className="team-name-clickable">{match.away}</strong>
                              {match.winner === 'away' && <span className="winner-check">✓</span>}
                            </div>
                          </div>
                        ))}      </div>
                    </section>
                  ))
                ) : (
                  <p style={{ textAlign: 'center', color: 'var(--text-dim)', marginTop: '2rem' }}>
                    Aún no hay un calendario generado.
                  </p>
                )}
              </div>
            ) : (
              <div className="knockout-view" style={{ marginTop: '1rem' }}>
                {knockoutBrackets.length > 0 ? (
                  <>
                    <div className="tabs-nav" style={{ justifyContent: 'center', marginBottom: '2rem', gap: '0.5rem' }}>
                      {knockoutBrackets.map((_, rIdx) => {
                        const isUnlocked = isRoundComplete(rIdx - 1);
                        const label = rIdx === 0 && knockoutBrackets.length === 3 ? 'Cuartos' :
                          rIdx === knockoutBrackets.length - 2 ? 'Semifinales' :
                            rIdx === knockoutBrackets.length - 1 ? 'Gran Final' : `Fase ${rIdx + 1}`;

                        return (
                          <button
                            key={rIdx}
                            className={`tab-btn ${knockoutActiveRound === rIdx ? 'active' : ''} ${!isUnlocked ? 'disabled' : ''}`}
                            onClick={() => isUnlocked && setKnockoutActiveRound(rIdx)}
                            style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                          >
                            {isUnlocked ? label : '🔒 Bloqueado'}
                          </button>
                        );
                      })}
                    </div>

                    <div className="bracket-active-round">
                      {knockoutBrackets[knockoutActiveRound] && (
                        <div className="bracket-column animate-fade-in">
                          <h3 className="round-title" style={{ textAlign: 'center', marginBottom: '2rem' }}>
                            {knockoutActiveRound === 0 && knockoutBrackets.length === 3 ? 'Cuartos de Final' :
                              knockoutActiveRound === knockoutBrackets.length - 2 ? 'Semifinales' :
                                knockoutActiveRound === knockoutBrackets.length - 1 ? 'La Gran Final' : `Eliminatoria - Fase ${knockoutActiveRound + 1}`}
                          </h3>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
                            {knockoutBrackets[knockoutActiveRound].map((match, mIdx) => (
                              <div key={mIdx} className={`match-item ${match.winner ? 'has-result' : ''}`}>
                                <div
                                  className={`team-selector ${match.winner === 'home' ? 'winner' : match.winner === 'away' ? 'loser' : ''} ${match.home === '?' ? 'disabled' : ''}`}
                                  onClick={() => match.home !== '?' && setKnockoutWinner(knockoutActiveRound, mIdx, 'home')}
                                >
                                  <strong className="team-name-clickable">{match.home}</strong>
                                  {match.winner === 'home' && <span className="winner-check">✓</span>}
                                </div>
                                <span className="vs-badge">VS</span>
                                <div
                                  className={`team-selector ${match.winner === 'away' ? 'winner' : match.winner === 'home' ? 'loser' : ''} ${match.away === '?' ? 'disabled' : ''}`}
                                  onClick={() => match.away !== '?' && setKnockoutWinner(knockoutActiveRound, mIdx, 'away')}
                                >
                                  <strong className="team-name-clickable">{match.away}</strong>
                                  {match.winner === 'away' && <span className="winner-check">✓</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '3rem' }}>
                    <h3 style={{ color: 'var(--text-dim)' }}>¡Califica a los mejores!</h3>
                    <p>Completa la liga y usa el botón en la Tabla de Posiciones para iniciar las eliminatorias.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* MODAL DE JUGADORES Y ESTADÍSTICAS */}
      {(() => {
        const editingTeam = teams.find(t => t.id === editingTeamId);
        if (!editingTeam) return null;

        return (
          <div className="modal-overlay" onClick={() => setEditingTeamId(null)}>
            <div className="modal-content glass-pane" onClick={e => e.stopPropagation()} style={{ padding: '2rem' }}>
              <h2 style={{ marginBottom: '1rem', color: 'var(--primary)' }}>{editingTeam.name}</h2>

              <div className="modal-tabs">
                <div className={`modal-tab ${modalTab === 'plantilla' ? 'active' : ''}`} onClick={() => setModalTab('plantilla')}>
                  Plantilla
                </div>
                <div className={`modal-tab ${modalTab === 'stats' ? 'active' : ''}`} onClick={() => setModalTab('stats')}>
                  Estadísticas
                </div>
              </div>

              {modalTab === 'plantilla' ? (
                <>
                  <form onSubmit={addPlayer} className="input-group">
                    <input
                      type="text"
                      placeholder="Nombre del jugador..."
                      value={newPlayerName}
                      onChange={(e) => setNewPlayerName(e.target.value)}
                    />
                    <button type="submit" className="btn-primary">Añadir</button>
                  </form>

                  <ul className="player-list">
                    {(editingTeam.players || []).map((player, idx) => (
                      <li key={idx} className="player-item">
                        <span>{player}</span>
                        <button onClick={() => removePlayer(player)} className="btn-delete" style={{ fontSize: '1rem' }}>
                          Eliminar
                        </button>
                      </li>
                    ))}
                    {(!editingTeam.players || editingTeam.players.length === 0) && (
                      <p style={{ color: 'var(--text-dim)', textAlign: 'center' }}>No hay jugadores registrados.</p>
                    )}
                  </ul>
                </>
              ) : (
                <div className="stats-grid">
                  <div className="stat-box">
                    <input
                      type="number"
                      className="score-input"
                      style={{ fontSize: '1.5rem', width: '60px' }}
                      value={editingTeam.points}
                      onChange={(e) => updateTeamStats(editingTeam.id, 'points', parseInt(e.target.value) || 0)}
                    />
                    <span className="stat-label">Puntos</span>
                  </div>
                  <div className="stat-box">
                    <input
                      type="number"
                      className="score-input"
                      style={{ fontSize: '1.5rem', width: '60px' }}
                      value={editingTeam.goalsFor}
                      onChange={(e) => updateTeamStats(editingTeam.id, 'goalsFor', parseInt(e.target.value) || 0)}
                    />
                    <span className="stat-label">Goles Favor</span>
                  </div>
                  <div className="stat-box">
                    <input
                      type="number"
                      className="score-input"
                      style={{ fontSize: '1.5rem', width: '60px' }}
                      value={editingTeam.goalsAgainst}
                      onChange={(e) => updateTeamStats(editingTeam.id, 'goalsAgainst', parseInt(e.target.value) || 0)}
                    />
                    <span className="stat-label">Goles Contra</span>
                  </div>
                  <div className="stat-box">
                    <span className="stat-value">{editingTeam.goalsFor - editingTeam.goalsAgainst}</span>
                    <span className="stat-label">Diferencia</span>
                  </div>
                  <p style={{ gridColumn: 'span 2', fontSize: '0.8rem', color: 'var(--text-dim)', textAlign: 'center', marginTop: '1rem' }}>
                    Presiona Enter o cambia de pestaña para asegurar el guardado.
                  </p>
                </div>
              )}

              <button
                onClick={() => setEditingTeamId(null)}
                className="btn-primary"
                style={{ width: '100%', marginTop: '2rem', background: 'var(--text-dim)', color: 'white' }}
              >
                Cerrar
              </button>
            </div>
          </div>
        );
      })()}

      {/* MODAL DE TABLA DE POSICIONES */}
      {showStandings && (
        <div className="modal-overlay" onClick={() => setShowStandings(false)}>
          <div className="modal-content glass-pane" onClick={e => e.stopPropagation()} style={{ padding: '2rem', maxWidth: '600px' }}>
            <h2 style={{ marginBottom: '1.5rem', color: 'var(--neon-cyan)', textAlign: 'center' }}>🏆 Tabla de Posiciones 🏆</h2>

            <div className="standings-table-container">
              <table className="standings-table">
                <thead>
                  <tr>
                    <th>Pos</th>
                    <th style={{ textAlign: 'left' }}>Equipo</th>
                    <th>PTS</th>
                    <th>GF</th>
                    <th>GC</th>
                    <th>DG</th>
                  </tr>
                </thead>
                <tbody>
                  {[...teams]
                    .sort((a, b) => b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst))
                    .map((team, idx) => (
                      <tr key={team.id} className={idx === 0 ? 'leader-row' : ''}>
                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{idx + 1}</td>
                        <td style={{ fontWeight: '600' }}>{team.name}</td>
                        <td className="pts-cell">{team.points}</td>
                        <td>{team.goalsFor}</td>
                        <td>{team.goalsAgainst}</td>
                        <td>{team.goalsFor - team.goalsAgainst}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
              <button
                onClick={resetTournamentResults}
                className="btn-primary"
                style={{ flex: 1, background: 'var(--text-dim)', color: 'white' }}
              >
                🔄 Reiniciar Tabla
              </button>
              <button
                onClick={startKnockout}
                className="btn-primary"
                style={{ flex: 1, background: 'var(--neon-magenta)', color: 'white', border: '1px solid #fff' }}
              >
                🎯 Iniciar Fases Finales
              </button>
              <button
                onClick={() => setShowStandings(false)}
                className="btn-primary"
                style={{ flex: 1, background: 'var(--text-dim)', color: 'white' }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App