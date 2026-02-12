import React, { useState, useEffect } from 'react'

interface Team {
  id: string;
  name: string;
}

interface Match {
  home: string;
  away: string;
}

function App() {
  const [teams, setTeams] = useState<Team[]>(() => {
    const saved = localStorage.getItem('liga-teams');
    return saved ? JSON.parse(saved) : [];
  });

  const [newTeamName, setNewTeamName] = useState('');
  const [matches, setMatches] = useState<Match[]>([]);

  useEffect(() => {
    localStorage.setItem('liga-teams', JSON.stringify(teams));
  }, [teams]);

  const addTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    const newTeam: Team = { id: Date.now().toString(), name: newTeamName.trim() };
    setTeams([...teams, newTeam]);
    setNewTeamName('');
  };

  const removeTeam = (id: string) => {
    setTeams(teams.filter(team => team.id !== id));
    setMatches([]); // Limpiamos sorteos previos si cambia la lista
  };

  const runDraw = () => {
    if (teams.length < 2) return;

    // Algoritmo de mezcla aleatoria (Fisher-Yates)
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
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ marginBottom: '3rem', textAlign: 'center' }}>
        <h1>Liga Estelar</h1>
        <p style={{ color: 'var(--text-dim)' }}>Gestiona tus equipos y crea sorteos épicos</p>
      </header>

      <main className="glass-pane" style={{ padding: '3rem' }}>
        <form onSubmit={addTeam} className="input-group">
          <input
            type="text"
            placeholder="Nombre de equipo..."
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
          />
          <button type="submit" className="btn-primary">Añadir Equipo</button>
        </form>

        <div className="team-grid" style={{ marginBottom: '2rem' }}>
          {teams.map((team) => (
            <div key={team.id} className="team-card">
              <span>{team.name}</span>
              <button onClick={() => removeTeam(team.id)} className="btn-delete">×</button>
            </div>
          ))}
        </div>

        {teams.length >= 2 && (
          <div style={{ textAlign: 'center' }}>
            <button onClick={runDraw} className="btn-primary" style={{ background: 'var(--accent)', color: 'white' }}>
              ¡REALIZAR SORTEO!
            </button>
          </div>
        )}

        {matches.length > 0 && (
          <div className="draw-area">
            <h2 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>Resultados del Sorteo</h2>
            {matches.map((match, idx) => (
              <div key={idx} className="match-card" style={{ animationDelay: `${idx * 0.1}s` }}>
                <strong style={{ color: 'var(--primary)' }}>{match.home}</strong>
                <span className="vs-badge">VS</span>
                <strong style={{ color: 'var(--secondary)' }}>{match.away}</strong>
              </div>
            ))
            }
          </div >
        )}
      </main >
    </div >
  )
}

export default App