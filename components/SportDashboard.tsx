'use client';

import { useEffect, useMemo, useState } from 'react';

type DayStatus = 'planned' | 'done' | 'rest' | 'focus';

type DayCard = {
  day: number;
  monthOffset?: -1 | 0 | 1;
  status: DayStatus;
  label: string;
  energy: string;
  accent: string;
};

const month = 'Marzo 2026';
const dayCards: DayCard[] = [
  { day: 24, monthOffset: -1, status: 'rest', label: 'Cierre mes', energy: 'Descarga', accent: 'rest' },
  { day: 25, monthOffset: -1, status: 'rest', label: 'Cierre mes', energy: 'Descarga', accent: 'rest' },
  { day: 26, monthOffset: -1, status: 'rest', label: 'Cierre mes', energy: 'Descarga', accent: 'rest' },
  { day: 27, monthOffset: -1, status: 'rest', label: 'Cierre mes', energy: 'Descarga', accent: 'rest' },
  { day: 28, monthOffset: -1, status: 'done', label: 'Sesión anterior', energy: 'Referencia', accent: 'done' },
  { day: 1, status: 'rest', label: 'Recuperación', energy: 'Reset', accent: 'rest' },
  { day: 2, status: 'planned', label: 'Hueco libre', energy: 'Disponible', accent: 'planned' },
  { day: 3, status: 'planned', label: 'Hueco libre', energy: 'Disponible', accent: 'planned' },
  { day: 4, status: 'rest', label: 'Movilidad', energy: 'Ligero', accent: 'rest' },
  { day: 5, status: 'planned', label: 'Hueco libre', energy: 'Disponible', accent: 'planned' },
  { day: 6, status: 'planned', label: 'Hueco libre', energy: 'Disponible', accent: 'planned' },
  { day: 7, status: 'rest', label: 'Movilidad', energy: 'Ligero', accent: 'rest' },
  { day: 8, status: 'planned', label: 'Hueco libre', energy: 'Disponible', accent: 'planned' },
  { day: 9, status: 'planned', label: 'Hueco libre', energy: 'Disponible', accent: 'planned' },
  { day: 10, status: 'rest', label: 'Descanso', energy: 'Recuperar', accent: 'rest' },
  { day: 11, status: 'planned', label: 'Hueco libre', energy: 'Disponible', accent: 'planned' },
  { day: 12, status: 'planned', label: 'Hueco libre', energy: 'Disponible', accent: 'planned' },
  { day: 13, status: 'rest', label: 'Descanso', energy: 'Recuperar', accent: 'rest' },
  { day: 14, status: 'planned', label: 'Hueco libre', energy: 'Disponible', accent: 'planned' },
  { day: 15, status: 'planned', label: 'Hueco libre', energy: 'Disponible', accent: 'planned' },
  { day: 16, status: 'rest', label: 'Movilidad', energy: 'Ligero', accent: 'rest' },
  { day: 17, status: 'planned', label: 'Hueco libre', energy: 'Disponible', accent: 'planned' },
  { day: 18, status: 'planned', label: 'Hueco libre', energy: 'Disponible', accent: 'planned' },
  { day: 19, status: 'rest', label: 'Descanso', energy: 'Recuperar', accent: 'rest' },
  { day: 20, status: 'planned', label: 'Hueco libre', energy: 'Disponible', accent: 'planned' },
  { day: 21, status: 'planned', label: 'Hueco libre', energy: 'Disponible', accent: 'planned' },
  { day: 22, status: 'rest', label: 'Descarga', energy: 'Reset', accent: 'rest' },
  { day: 23, status: 'focus', label: 'Día activo', energy: 'Volver al sistema', accent: 'focus' },
  { day: 24, status: 'planned', label: 'Espacio listo', energy: 'Entreno futuro', accent: 'planned' },
  { day: 25, status: 'planned', label: 'Espacio listo', energy: 'Progresión', accent: 'planned' },
  { day: 26, status: 'rest', label: 'Descarga', energy: 'Movilidad / pausa', accent: 'rest' },
  { day: 27, status: 'planned', label: 'Espacio listo', energy: 'Fuerza ligera', accent: 'planned' },
  { day: 28, status: 'rest', label: 'Recuperación', energy: 'Reset', accent: 'rest' },
  { day: 29, status: 'done', label: 'Mock completado', energy: 'Vista histórica', accent: 'done' },
  { day: 30, status: 'planned', label: 'Espacio listo', energy: 'Continuidad', accent: 'planned' },
  { day: 31, status: 'planned', label: 'Espacio listo', energy: 'Continuidad', accent: 'planned' },
  { day: 1, monthOffset: 1, status: 'planned', label: 'Próximo bloque', energy: 'Abril', accent: 'planned' },
  { day: 2, monthOffset: 1, status: 'rest', label: 'Descarga', energy: 'Abril', accent: 'rest' },
  { day: 3, monthOffset: 1, status: 'planned', label: 'Próximo bloque', energy: 'Abril', accent: 'planned' },
  { day: 4, monthOffset: 1, status: 'planned', label: 'Próximo bloque', energy: 'Abril', accent: 'planned' },
  { day: 5, monthOffset: 1, status: 'rest', label: 'Descanso', energy: 'Abril', accent: 'rest' }
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
  const [selectedDay, setSelectedDay] = useState<DayCard>(dayCards.find((d) => d.day === 23 && (d.monthOffset ?? 0) === 0) || dayCards[0]);
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

        <div className="hero-card glass compact-hero">
          <div className="hero-title-row">
            <div>
              <p className="tiny-label">Vista general</p>
              <h2>Marzo 2026</h2>
            </div>
            <span className="tiny-chip">Mobile first</span>
          </div>
          <div className="hero-metrics compact-metrics">
            <div>
              <strong>4</strong>
              <span>sesiones</span>
            </div>
            <div>
              <strong>1</strong>
              <span>hoy</span>
            </div>
            <div>
              <strong>DL</strong>
              <span>tema</span>
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
              {dayCards.map((card, index) => (
                <button
                  key={`${card.monthOffset ?? 0}-${card.day}-${index}`}
                  className={`calendar-day ${card.accent} ${(card.monthOffset ?? 0) !== 0 ? 'muted-day' : ''} ${selectedDay.day === card.day && (selectedDay.monthOffset ?? 0) === (card.monthOffset ?? 0) ? 'active' : ''}`}
                  onClick={() => setSelectedDay(card)}
                >
                  <span className="calendar-dot">{card.status === 'done' ? '✓' : card.status === 'rest' ? '—' : '•'}</span>
                  <strong>{card.day}</strong>
                  <small>{(card.monthOffset ?? 0) === 0 ? 'mar' : card.monthOffset === -1 ? 'feb' : 'abr'}</small>
                </button>
              ))}
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
                <h3>Estructura prevista</h3>
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

          <article className="glass prompt-card minimal-card">
            <div className="section-head compact">
              <div>
                <p className="tiny-label">Tema</p>
                <h3>Preferencias visuales</h3>
              </div>
            </div>
            <div className="theme-preview minimal-preview">
              <div>
                <span>Dark</span>
                <strong>Activo</strong>
              </div>
              <div>
                <span>Light</span>
                <strong>Disponible</strong>
              </div>
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}
