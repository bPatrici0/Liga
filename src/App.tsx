import React from 'react'

function App() {
  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ marginBottom: '3rem', textAlign: 'center' }}>
        <h1>League of Legends</h1>
        <p style={{ color: 'var(--text-dim)' }}>
          Gestiona tus equipos y crea sorteos épicos
        </p>
      </header>

      <main className="glass-pane" style={{ padding: '3rem', textAlign: 'center' }}>
        <h2 style={{ marginBottom: '1rem' }}>Bienvenido al campo!</h2>
        <p>Aqui es donde la magia de los sorteos comienza</p>
      </main>
    </div>
  )
}

export default App