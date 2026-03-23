'use client';

import { useEffect, useMemo, useState } from 'react';

type DayStatus = 'planned' | 'done' | 'rest' | 'focus';

type DayCard = {
  day: number;
  status: DayStatus;
  label: string;
  energy: string;
  accent: string;
};

const month = 'Marzo 2026';
const dayCards: DayCard[] = [
  { day: 23, status: 'focus', label: 'Día activo', energy: 'Volver al sistema', accent: 'focus' },
  { day: 24, status: 'planned', label: 'Espacio listo', energy: 'Entreno futuro', accent: 'planned' },
  { day: 25, status: 'planned', label: 'Espacio listo', energy: 'Progresión', accent: 'planned' },
  { day: 26, status: 'rest', label: 'Descarga', energy: 'Movilidad / pausa', accent: 'rest' },
  { day: 27, status: 'planned', label: 'Espacio listo', energy: 'Fuerza ligera', accent: 'planned' },
  { day: 28, status: 'rest', label: 'Recuperación', energy: 'Reset', accent: 'rest' },
  { day: 29, status: 'done', label: 'Mock completado', energy: 'Vista histórica', accent: 'done' }
];

const statusText: Record<DayStatus, string> = {
  planned: 'Preparado para asignar rutina',
  done: 'Entrenamiento archivado',
  rest: 'Descanso / movilidad',
  focus: 'Primer día de vuelta'
};

const exercisePlaceholders = [
  'Bloque de calentamiento',
  'Ejercicio principal A',
  'Ejercicio principal B',
  'Accesorio / core',
  'Cierre y sensaciones'
];

export function SportDashboard() {
  const [selectedDay, setSelectedDay] = useState<DayCard>(dayCards[0]);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const stored = window.localStorage.getItem('neo-sport-theme');
    const preferred = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    const nextTheme = stored === 'light' || stored === 'dark' ? stored : preferred;
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('neo-sport-theme', theme);
  }, [theme]);

  const selectedSummary = useMemo(() => {
    return {
      title: selectedDay.status === 'done' ? 'Sesión cerrada' : selectedDay.status === 'rest' ? 'Día de recuperación' : 'Espacio de sesión',
      subtitle: statusText[selectedDay.status],
      cta: selectedDay.status === 'done' ? 'Ver detalles de la sesión' : 'Completar sesión aquí'
    };
  }, [selectedDay]);

  return (
    <main className="app-shell">
      <section className="phone-frame">
        <div className="topbar">
          <div>
            <p className="eyebrow">Neo ⚡ · Sport OS</p>
            <h1>Dashboard de entrenamiento</h1>
          </div>
          <button className="theme-toggle" onClick={() => setTheme((cur) => (cur === 'dark' ? 'light' : 'dark'))}>
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </div>

        <div className="hero-card glass">
          <div>
            <span className="pill pill-accent">MVP estructura</span>
            <h2>Una base visual para que calendario, sesión y seguimiento se sientan como producto real.</h2>
          </div>
          <p>
            Aquí no hay rutina metida todavía: solo la arquitectura UX para que tú entres, veas el día, rellenes ejercicios y luego yo pueda leer la sesión cerrada.
          </p>
          <div className="hero-metrics">
            <div>
              <strong>7</strong>
              <span>días visibles</span>
            </div>
            <div>
              <strong>2</strong>
              <span>temas visuales</span>
            </div>
            <div>
              <strong>100%</strong>
              <span>mobile first</span>
            </div>
          </div>
        </div>

        <section className="grid-stack">
          <article className="calendar-card glass">
            <div className="section-head">
              <div>
                <p className="tiny-label">Calendario</p>
                <h3>{month}</h3>
              </div>
              <span className="tiny-chip">Vista compacta</span>
            </div>

            <div className="calendar-weekdays">
              {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>

            <div className="calendar-grid">
              {Array.from({ length: 35 }).map((_, index) => {
                const day = index - 20;
                const card = dayCards.find((entry) => entry.day === day);
                if (!card) return <div key={index} className="calendar-empty" />;

                return (
                  <button
                    key={card.day}
                    className={`calendar-day ${card.accent} ${selectedDay.day === card.day ? 'active' : ''}`}
                    onClick={() => setSelectedDay(card)}
                  >
                    <strong>{card.day}</strong>
                    <small>{card.status === 'done' ? '✓' : card.status === 'rest' ? '—' : '•'}</small>
                  </button>
                );
              })}
            </div>
          </article>

          <article className="session-card glass">
            <div className="section-head">
              <div>
                <p className="tiny-label">Sesión del día</p>
                <h3>{selectedDay.day} {month}</h3>
              </div>
              <span className={`status-badge ${selectedDay.accent}`}>{selectedDay.label}</span>
            </div>

            <div className="session-overview">
              <div>
                <p className="tiny-label">Estado</p>
                <h4>{selectedSummary.title}</h4>
                <p>{selectedSummary.subtitle}</p>
              </div>
              <div className="energy-bubble">
                <span>enfoque</span>
                <strong>{selectedDay.energy}</strong>
              </div>
            </div>

            <div className="exercise-list">
              {exercisePlaceholders.map((item, index) => (
                <div key={item} className="exercise-row">
                  <div>
                    <span className="index-pill">0{index + 1}</span>
                    <div>
                      <h5>{item}</h5>
                      <p>Campo visual preparado para peso, repeticiones y dificultad 1-10.</p>
                    </div>
                  </div>
                  <button className="ghost-button">Abrir</button>
                </div>
              ))}
            </div>

            <button className="primary-button full">{selectedSummary.cta}</button>
          </article>
        </section>

        <section className="grid-stack secondary">
          <article className="glass insight-card">
            <div className="section-head compact">
              <div>
                <p className="tiny-label">Dashboard</p>
                <h3>Secciones previstas</h3>
              </div>
            </div>
            <div className="feature-stack">
              {[
                'Histórico por ejercicio y máquina',
                'Sensación/RPE por serie o por ejercicio',
                'Cierre de sesión para que Neo analice el día',
                'Ajuste progresivo de la siguiente rutina'
              ].map((item) => (
                <div key={item} className="feature-tile">
                  <span>✦</span>
                  <p>{item}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="glass prompt-card">
            <p className="tiny-label">Estética / dirección</p>
            <h3>Look limpio, premium y usable desde móvil.</h3>
            <p>
              Mezcla de dashboard moderno + sensación fitness elegante: bloques amplios, tipografía grande, aire, contraste y navegación muy simple para que no dé pereza usarla al entrar al gym.
            </p>
            <div className="theme-preview">
              <div>
                <span>Dark</span>
                <strong>alto contraste</strong>
              </div>
              <div>
                <span>Light</span>
                <strong>limpio y claro</strong>
              </div>
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}
