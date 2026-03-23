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

type ExerciseForm = {
  exerciseName: string;
  targetSets: string;
  targetReps: string;
  actualReps: string;
  weightKg: string;
  difficulty: string;
  notes: string;
};

const month = 'Marzo 2026';
const apiBase = process.env.NEXT_PUBLIC_SPORT_API_BASE || 'https://sport-api.187.77.83.168.sslip.io';
const selectedMonth = '2026-03';
const monthNames = ['2026-02', '2026-03', '2026-04'];

const dayCards: DayCard[] = [
  { day: 23, monthOffset: -1, status: 'rest', label: 'Cierre mes', energy: 'Descarga', accent: 'rest' },
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
  { day: 5, monthOffset: 1, status: 'rest', label: 'Descanso', energy: 'Abril', accent: 'rest' },
  { day: 6, monthOffset: 1, status: 'rest', label: 'Descanso', energy: 'Abril', accent: 'rest' }
];

const emptyExercise = (): ExerciseForm => ({
  exerciseName: '',
  targetSets: '',
  targetReps: '',
  actualReps: '',
  weightKg: '',
  difficulty: '',
  notes: ''
});

const statusText: Record<DayStatus, string> = {
  planned: 'Preparado para asignar rutina',
  done: 'Entrenamiento archivado',
  rest: 'Descanso / movilidad',
  focus: 'Primer día de vuelta'
};

function getTrainingDate(card: DayCard) {
  const offset = card.monthOffset ?? 0;
  const monthKey = monthNames[offset + 1] || selectedMonth;
  return `${monthKey}-${String(card.day).padStart(2, '0')}`;
}

export function SportDashboard() {
  const [selectedDay, setSelectedDay] = useState<DayCard>(dayCards.find((d) => d.day === 23 && (d.monthOffset ?? 0) === 0) || dayCards[0]);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [dbStatus, setDbStatus] = useState<'loading' | 'online' | 'offline'>('loading');
  const [dbCounts, setDbCounts] = useState({ users: 0, workout_days: 0, workout_sessions: 0 });
  const [sessionStatus, setSessionStatus] = useState('');
  const [isSavingDay, setIsSavingDay] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState('');
  const [perceivedEnergy, setPerceivedEnergy] = useState('');
  const [perceivedEffort, setPerceivedEffort] = useState('');
  const [sessionNotes, setSessionNotes] = useState('');
  const [exerciseForms, setExerciseForms] = useState<ExerciseForm[]>([emptyExercise(), emptyExercise(), emptyExercise(), emptyExercise(), emptyExercise()]);
  const [savingExerciseIndex, setSavingExerciseIndex] = useState<number | null>(null);

  const trainingDate = useMemo(() => getTrainingDate(selectedDay), [selectedDay]);

  function updateExercise(index: number, patch: Partial<ExerciseForm>) {
    setExerciseForms((current) => current.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
  }

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

  useEffect(() => {
    let active = true;
    fetch(`${apiBase}/api/health`)
      .then((res) => {
        if (!res.ok) throw new Error('health failed');
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        setDbStatus('online');
        setDbCounts({
          users: data?.counts?.users ?? 0,
          workout_days: data?.counts?.workout_days ?? 0,
          workout_sessions: data?.counts?.workout_sessions ?? 0
        });
      })
      .catch(() => {
        if (!active) return;
        setDbStatus('offline');
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setSessionStatus('');

    fetch(`${apiBase}/api/session?user=migue&trainingDate=${trainingDate}`)
      .then((res) => res.json())
      .then((data) => {
        if (!active || !data?.ok) return;
        if (data.session) {
          setDurationMinutes(data.session.duration_minutes ? String(data.session.duration_minutes) : '');
          setPerceivedEnergy(data.session.perceived_energy ? String(data.session.perceived_energy) : '');
          setPerceivedEffort(data.session.perceived_effort ? String(data.session.perceived_effort) : '');
          setSessionNotes(data.session.notes || '');
        } else {
          setDurationMinutes('');
          setPerceivedEnergy('');
          setPerceivedEffort('');
          setSessionNotes('');
        }

        if (Array.isArray(data.exercises) && data.exercises.length) {
          const mapped = data.exercises.slice(0, 3).map((item: any) => ({
            exerciseName: item.exercise_name || '',
            targetSets: item.target_sets ? String(item.target_sets) : '',
            targetReps: item.target_reps ? String(item.target_reps) : '',
            actualReps: item.reps ? String(item.reps) : '',
            weightKg: item.weight_kg ? String(item.weight_kg) : '',
            difficulty: item.difficulty ? String(item.difficulty) : (item.set_effort ? String(item.set_effort) : ''),
            notes: item.actual_notes || item.set_notes || ''
          }));
          while (mapped.length < 5) mapped.push(emptyExercise());
          setExerciseForms(mapped);
        } else {
          setExerciseForms([emptyExercise(), emptyExercise(), emptyExercise(), emptyExercise(), emptyExercise()]);
        }
      })
      .catch(() => {
        if (!active) return;
      });

    return () => {
      active = false;
    };
  }, [trainingDate]);

  const selectedSummary = useMemo(() => ({
    title: selectedDay.status === 'done' ? 'Sesión cerrada' : selectedDay.status === 'rest' ? 'Día de recuperación' : 'Sesión editable',
    subtitle: statusText[selectedDay.status],
    cta: isCompleting ? 'Cerrando sesión...' : 'Completar sesión'
  }), [selectedDay, isCompleting]);

  async function ensureDay() {
    setIsSavingDay(true);
    try {
      const res = await fetch(`${apiBase}/api/calendar/day`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: 'migue', trainingDate, status: 'planned' })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || 'No pude guardar el día');
      setSessionStatus('Día guardado en la base.');
    } catch (error) {
      setSessionStatus(error instanceof Error ? error.message : 'No pude guardar el día');
    } finally {
      setIsSavingDay(false);
    }
  }

  async function saveExercise(index: number, silent = false) {
    const item = exerciseForms[index];
    if (!item.exerciseName.trim()) return;
    setSavingExerciseIndex(index);
    try {
      const res = await fetch(`${apiBase}/api/session/exercise`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: 'migue',
          trainingDate,
          exerciseName: item.exerciseName,
          sortOrder: index,
          targetSets: item.targetSets ? Number(item.targetSets) : null,
          targetReps: item.targetReps || null,
          difficulty: item.difficulty ? Number(item.difficulty) : null,
          reps: item.actualReps ? Number(item.actualReps) : null,
          weightKg: item.weightKg ? Number(item.weightKg) : null,
          effort: item.difficulty ? Number(item.difficulty) : null,
          actualNotes: item.notes || null
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || 'No pude guardar el ejercicio');
      if (!silent) setSessionStatus(`Ejercicio ${index + 1} guardado.`);
    } catch (error) {
      if (!silent) setSessionStatus(error instanceof Error ? error.message : 'No pude guardar el ejercicio');
      throw error;
    } finally {
      setSavingExerciseIndex(null);
    }
  }

  async function completeSession() {
    setIsCompleting(true);
    try {
      const validExercises = exerciseForms.filter((item) => item.exerciseName.trim());
      if (!validExercises.length) throw new Error('No hay rutina cargada para completar esta sesión.');

      for (let index = 0; index < exerciseForms.length; index += 1) {
        if (!exerciseForms[index].exerciseName.trim()) continue;
        await saveExercise(index, true);
      }

      const res = await fetch(`${apiBase}/api/session/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: 'migue',
          trainingDate,
          durationMinutes: durationMinutes ? Number(durationMinutes) : null,
          perceivedEnergy: perceivedEnergy ? Number(perceivedEnergy) : null,
          perceivedEffort: perceivedEffort ? Number(perceivedEffort) : null,
          notes: sessionNotes || null
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || 'No pude completar la sesión');
      setSessionStatus('Sesión cerrada. Queda pendiente de análisis por Neo.');
    } catch (error) {
      setSessionStatus(error instanceof Error ? error.message : 'No pude completar la sesión');
    } finally {
      setIsCompleting(false);
    }
  }

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
              <p className="live-status">{dbStatus === 'online' ? 'Base conectada' : dbStatus === 'offline' ? 'Base sin conexión' : 'Comprobando base...'}</p>
            </div>
            <span className="tiny-chip">Mobile first</span>
          </div>
          <div className="hero-metrics compact-metrics">
            <div><strong>{dbCounts.workout_sessions}</strong><span>sesiones</span></div>
            <div><strong>{dbCounts.workout_days}</strong><span>días</span></div>
            <div><strong>{dbCounts.users}</strong><span>usuario</span></div>
          </div>
        </div>

        <section className="grid-stack">
          <article className="calendar-card glass">
            <div className="section-head">
              <div>
                <p className="tiny-label">Calendario</p>
                <h3>{month}</h3>
              </div>
              <button className="tiny-action" onClick={ensureDay} disabled={isSavingDay}>{isSavingDay ? 'Guardando...' : 'Guardar día'}</button>
            </div>

            <div className="calendar-weekdays">
              {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((item) => <span key={item}>{item}</span>)}
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
                <h3>{trainingDate}</h3>
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

            <div className="session-form">
              <label><span>Duración (min)</span><input aria-label="Duración" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} inputMode="numeric" placeholder="45" /></label>
              <label><span>Energía (1-10)</span><input aria-label="Energía" value={perceivedEnergy} onChange={(e) => setPerceivedEnergy(e.target.value)} inputMode="numeric" placeholder="7" /></label>
              <label><span>Esfuerzo global (1-10)</span><input aria-label="Esfuerzo global" value={perceivedEffort} onChange={(e) => setPerceivedEffort(e.target.value)} inputMode="numeric" placeholder="8" /></label>
              <label className="full-field"><span>Notas de la sesión</span><textarea aria-label="Notas de la sesión" value={sessionNotes} onChange={(e) => setSessionNotes(e.target.value)} placeholder="Cómo te sentiste, molestias, cosas a vigilar..." /></label>
            </div>

            <div className="exercise-list">
              {exerciseForms.map((item, index) => (
                <div key={index} className="exercise-card">
                  <div className="exercise-head">
                    <div className="exercise-head-left">
                      <span className="index-pill">0{index + 1}</span>
                      <input
                        aria-label={`Nombre ejercicio ${index + 1}`}
                        className="exercise-name-input"
                        value={item.exerciseName}
                        onChange={(e) => updateExercise(index, { exerciseName: e.target.value })}
                        placeholder={`Ejercicio ${index + 1}`}
                      />
                    </div>
                    <button className="ghost-button" onClick={() => saveExercise(index)} disabled={savingExerciseIndex === index || !item.exerciseName.trim()}>
                      {savingExerciseIndex === index ? 'Guardando...' : 'Guardar'}
                    </button>
                  </div>

                  <div className="exercise-section-label">Objetivo</div>
                  <div className="exercise-fields">
                    <label><span>Series objetivo</span><input aria-label={`Series objetivo ${index + 1}`} value={item.targetSets} onChange={(e) => updateExercise(index, { targetSets: e.target.value })} inputMode="numeric" placeholder="3" /></label>
                    <label><span>Reps objetivo</span><input aria-label={`Reps objetivo ${index + 1}`} value={item.targetReps} onChange={(e) => updateExercise(index, { targetReps: e.target.value })} inputMode="numeric" placeholder="10" /></label>
                    <div className="field-spacer" />
                  </div>

                  <div className="exercise-section-label">Resultado real</div>
                  <div className="exercise-fields">
                    <label><span>Reps reales</span><input aria-label={`Reps reales ${index + 1}`} value={item.actualReps} onChange={(e) => updateExercise(index, { actualReps: e.target.value })} inputMode="numeric" placeholder="10" /></label>
                    <label><span>Peso (kg)</span><input aria-label={`Peso ${index + 1}`} value={item.weightKg} onChange={(e) => updateExercise(index, { weightKg: e.target.value })} inputMode="decimal" placeholder="25" /></label>
                    <label><span>Dificultad</span><input aria-label={`Dificultad ${index + 1}`} value={item.difficulty} onChange={(e) => updateExercise(index, { difficulty: e.target.value })} inputMode="numeric" placeholder="7" /></label>
                    <label className="full-field"><span>Notas</span><textarea aria-label={`Notas ejercicio ${index + 1}`} value={item.notes} onChange={(e) => updateExercise(index, { notes: e.target.value })} placeholder="Máquina, sensaciones, ajustes..." /></label>
                  </div>
                </div>
              ))}
            </div>

            {sessionStatus ? <p className="session-status-message">{sessionStatus}</p> : null}
            <button className="primary-button full" onClick={completeSession} disabled={isCompleting}>{selectedSummary.cta}</button>
          </article>
        </section>
      </section>
    </main>
  );
}
