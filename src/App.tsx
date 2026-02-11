import React, { useState } from 'react'

interface Team {
  id: string;
  name: string;
}

function App() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [newTeamName, setNewTeamName] = useState('');

  const addTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;

    const newTeam: Team = {
      id: crypto.randomUUID(),
      name: newTeamName.trim()
    };

    setTeams([...teams, newTeam]);
    setNewTeamName('');
  };

  const removeTeam = (id: string) => {
    setTeams(teams.filter(team => team.id !== id));
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ marginBottom: '3rem', textAlign: 'center' }}>
        <h1>League of Legends</h1>
        <p style={{ color: 'var(--text-dim)' }}>
          Gestiona tus equipos y crea sorteos épicos
        </p>
      </header>

      <main className="glass-pane" style={{ padding: '3rem' }}>
        <form onSubmit={addTeam} className="input-group">
          <input
            type="text"
            placeholder="Nombre de equipo..."
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)} />
          <button type="submit" className="btn-primary">Añadir Equipo</button>
        </form>

        <div className="team-grid">
          {teams.map((team) => (
            <div key={team.id} className="team-card">
              <span>{team.name}</span>
              <button
                onClick={() => removeTeam(team.id)}
                className="btn-delete"
                title="Eliminar equipo"
              >
                x
              </button>
            </div>
          ))}
        </div>

        {teams.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--text-dim' }}>
            No hay equipos inscritos todavía. ¡Añade el primero!...
          </p>
        )}
      </main>
    </div>
  )
}

export default App