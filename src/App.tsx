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
  homeScore?: number;
  awayScore?: number;
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
  const [matches, setMatches] = useState<Match[]>([]);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [activeTab, setActiveTab] = useState<'teams' | 'calendar'>('teams');
  const [calendarSubTab, setCalendarSubTab] = useState<'league' | 'knockout'>('league');
  const [modalTab, setModalTab] = useState<'plantilla' | 'stats'>('plantilla');

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

  // Función para actualizar resultados y recalcular estadísticas
  const updateScore = (roundIdx: number, matchIdx: number, score: number, side: 'home' | 'away') => {
    if (isNaN(score)) score = 0;
    const newTournament = [...tournament];
    const match = newTournament[roundIdx][matchIdx];

    if (side === 'home') match.homeScore = score;
    else match.awayScore = score;

    setTournament(newTournament);
    recalculateStats(newTournament);
  };

  const recalculateStats = (currentTournament: Match[][]) => {
    const newTeams = teams.map(t => ({ ...t, points: 0, goalsFor: 0, goalsAgainst: 0 }));

    currentTournament.forEach(round => {
      round.forEach(match => {
        if (match.homeScore !== undefined && match.awayScore !== undefined) {
          const home = newTeams.find(t => t.name === match.home);
          const away = newTeams.find(t => t.name === match.away);

          if (home && away) {
            home.goalsFor += match.homeScore;
            home.goalsAgainst += match.awayScore;
            away.goalsFor += match.awayScore;
            away.goalsAgainst += match.homeScore;

            if (match.homeScore > match.awayScore) home.points += 3;
            else if (match.homeScore < match.awayScore) away.points += 3;
            else { home.points += 1; away.points += 1; }
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
    setStatus('results');
  };

  //funcion para guardar jugadores
  const addPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trimEnd() || !editingTeam) return;

    const updatedTeam = {
      ...editingTeam,
      players: [...(editingTeam.players || []),
      newPlayerName.trim()]
    };

    setTeams(teams.map(t => t.id === editingTeam.id ? updatedTeam : t));
    setEditingTeam(updatedTeam);
    setNewPlayerName('');
  };

  const removePlayer = (playerName: string) => {
    if (!editingTeam) return;
    const updatedTeam = {
      ...editingTeam,
      players: (editingTeam.players || []).filter(p => p !== playerName)
    };
    setTeams(teams.map(t => t.id === editingTeam.id ? updatedTeam : t));
    setEditingTeam(updatedTeam);
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
    setMatches([]);
    setStatus('idle');
  };

  const removeTeam = (id: string) => {
    const updatedTeams = teams.filter(t => t.id !== id);
    setTeams(updatedTeams);
    setMatches([]);
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
                    onClick={() => setEditingTeam(team)}
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
            </div>

            {calendarSubTab === 'league' ? (
              <div style={{ marginTop: '1rem' }}>
                {tournament.length > 0 ? (
                  tournament.map((round, roundIdx) => (
                    <section key={roundIdx} className="round-section" style={{ marginBottom: '3rem' }}>
                      <h3 className="round-title">Jornada {roundIdx + 1}</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                        {round.map((match, mIdx) => (
                          <div key={mIdx} className="match-item">
                            <span className="team-name-clickable" onClick={() => setEditingTeam(teams.find(t => t.name === match.home) || null)}>
                              {match.home}
                            </span>

                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <input
                                type="number"
                                className="score-input"
                                value={match.homeScore ?? ''}
                                onChange={(e) => updateScore(roundIdx, mIdx, parseInt(e.target.value), 'home')}
                              />
                              <span className="vs-badge">VS</span>
                              <input
                                type="number"
                                className="score-input"
                                value={match.awayScore ?? ''}
                                onChange={(e) => updateScore(roundIdx, mIdx, parseInt(e.target.value), 'away')}
                              />
                            </div>

                            <span className="team-name-clickable" onClick={() => setEditingTeam(teams.find(t => t.name === match.away) || null)}>
                              {match.away}
                            </span>
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
              <div style={{ textAlign: 'center', padding: '3rem' }}>
                <h3 style={{ color: 'var(--text-dim)' }}>Próximamente...</h3>
                <p>Las eliminatorias se activarán cuando termine la fase de liga.</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* MODAL DE JUGADORES */}
      {editingTeam && (
        <div className="modal-overlay" onClick={() => setEditingTeam(null)}>
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
                  <span className="stat-value">{editingTeam.points}</span>
                  <span className="stat-label">Puntos</span>
                </div>
                <div className="stat-box">
                  <span className="stat-value">{editingTeam.goalsFor}</span>
                  <span className="stat-label">Goles Favor</span>
                </div>
                <div className="stat-box">
                  <span className="stat-value">{editingTeam.goalsAgainst}</span>
                  <span className="stat-label">Goles Contra</span>
                </div>
                <div className="stat-box">
                  <span className="stat-value">{editingTeam.goalsFor - editingTeam.goalsAgainst}</span>
                  <span className="stat-label">Diferencia</span>
                </div>
              </div>
            )}

            <button
              onClick={() => setEditingTeam(null)}
              className="btn-primary"
              style={{ width: '100%', marginTop: '2rem', background: 'var(--text-dim)', color: 'white' }}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App