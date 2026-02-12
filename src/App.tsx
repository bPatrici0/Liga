import React, { useState, useEffect } from 'react'

interface Team { id: string; name: string; }
interface Match { home: string; away: string; }

// Estados: 'idle' | 'gathering' | 'results'
type DrawStatus = 'idle' | 'gathering' | 'results';

function App() {
  const [teams, setTeams] = useState<Team[]>(() => {
    const saved = localStorage.getItem('liga-teams');
    return saved ? JSON.parse(saved) : [];
  });
  const [newTeamName, setNewTeamName] = useState('');
  const [matches, setMatches] = useState<Match[]>([]);
  const [status, setStatus] = useState<DrawStatus>('idle');

  useEffect(() => {
    localStorage.setItem('liga-teams', JSON.stringify(teams));
  }, [teams]);

  const addTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    setTeams([...teams, { id: Date.now().toString(), name: newTeamName.trim() }]);
    setNewTeamName('');
    setMatches([]);
    setStatus('idle');
  };

  const removeTeam = (id: string) => {
    setTeams(teams.filter(t => t.id !== id));
    setMatches([]);
    setStatus('idle');
  };

  const startDrawAction = () => {
    setStatus('gathering');

    // Esperamos a que la animación de "reunión" termine (800ms)
    setTimeout(() => {
      const shuffled = [...teams].sort(() => Math.random() - 0.5);
      const result: Match[] = [];
      for (let i = 0; i < shuffled.length; i += 2) {
        if (shuffled[i + 1]) {
          result.push({ home: shuffled[i].name, away: shuffled[i + 1].name });
        } else {
          result.push({ home: shuffled[i].name, away: "DESCANSA" });
        }
      }
      setMatches(result);
      setStatus('results');
    }, 3200);
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ marginBottom: '3rem', textAlign: 'center' }}>
        <h1>Liga Estelar</h1>
        <p style={{ color: 'var(--text-dim)' }}>Gestiona tus equipos y crea sorteos épicos</p>
      </header>

      <main className="glass-pane" style={{ padding: '3rem', overflow: 'hidden' }}>
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
              <span>{team.name}</span>
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
            <h2 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>🔥 Enfrentamientos Estelares 🔥</h2>
            {matches.map((match, idx) => (
              <div key={idx} className="match-card match-card-pop" style={{ animationDelay: `${idx * 0.15}s` }}>
                <strong style={{ color: 'var(--primary)' }}>{match.home}</strong>
                <span className="vs-badge">VS</span>
                <strong style={{ color: 'var(--secondary)' }}>{match.away}</strong>
              </div>
            ))}
            <div style={{ textAlign: 'center', marginTop: '2rem' }}>
              <button onClick={() => setStatus('idle')} className="btn-primary" style={{ background: 'var(--text-dim)', color: 'white' }}>
                REINICIAR SORTEO
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App