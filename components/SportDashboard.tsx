'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type DayStatus = 'planned' | 'done' | 'rest' | 'focus';

type DayCard = {
  day: number;
  monthOffset?: -1 | 0 | 1;
  status: DayStatus;
  label: string;
  energy: string;
  accent: string;
};

type ExerciseGhost = {
  lastDate: string;
  lastSets: string;
  lastReps: string;
  lastWeightKg: string;
  lastDurationMinutes: string;
  lastDistanceKm: string;
  lastCaloriesBurned: string;
  lastDifficulty: string;
  lastNotes: string;
};

type ExerciseType = 'strength' | 'cardio' | 'mobility';

type ExerciseForm = {
  exerciseName: string;
  exerciseType: ExerciseType;
  isCustom: boolean;
  targetSets: string;
  targetReps: string;
  targetWeightKg: string;
  actualSets: string;
  actualReps: string;
  weightKg: string;
  actualDurationMinutes: string;
  actualDistanceKm: string;
  actualCaloriesBurned: string;
  difficulty: string;
  notes: string;
  ghost: ExerciseGhost | null;
};

type AppSection = 'dashboard' | 'day' | 'stats' | 'timer';
type DayViewMode = 'summary' | 'training';

const apiBase = process.env.NEXT_PUBLIC_SPORT_API_BASE || 'https://sport-api.187.77.83.168.sslip.io';
const trainingWeekdays = new Set([1, 2, 4, 5]); // Mon, Tue, Thu, Fri
const monthFormatter = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const shortMonthFormatter = new Intl.DateTimeFormat('es-ES', { month: 'short', timeZone: 'UTC' });

const emptyExercise = (patch?: Partial<ExerciseForm>): ExerciseForm => ({
  exerciseName: '',
  exerciseType: 'strength',
  isCustom: false,
  targetSets: '',
  targetReps: '',
  targetWeightKg: '',
  actualSets: '',
  actualReps: '',
  weightKg: '',
  actualDurationMinutes: '',
  actualDistanceKm: '',
  actualCaloriesBurned: '',
  difficulty: '',
  notes: '',
  ghost: null,
  ...patch
});

const difficultyOptions = Array.from({ length: 10 }, (_, index) => String(index + 1));


const EXERCISE_VISUALS: Record<string, { imageUrl: string; sourceName: string }> = {
  'Prensa de piernas': {
    imageUrl: 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Leg_Press/0.jpg',
    sourceName: 'Leg Press'
  },
  'Jalón al pecho': {
    imageUrl: 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Wide-Grip_Lat_Pulldown/0.jpg',
    sourceName: 'Wide-Grip Lat Pulldown'
  },
  'Press pecho en máquina': {
    imageUrl: 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Machine_Bench_Press/0.jpg',
    sourceName: 'Machine Bench Press'
  },
  'Curl femoral sentado': {
    imageUrl: 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Seated_Leg_Curl/0.jpg',
    sourceName: 'Seated Leg Curl'
  },
  'Leg curl en máquina': {
    imageUrl: '/exercises/leg-curl-en-maquina-migue-2026-03-30.jpg',
    sourceName: 'Foto real de Migue en gym'
  },
  'Plancha': {
    imageUrl: '/exercises/plancha-nanobanana.png',
    sourceName: 'NanoBanana custom'
  },
  'Crunch en polea': {
    imageUrl: 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Cable_Crunch/0.jpg',
    sourceName: 'Cable Crunch'
  },
  'Crunch en máquina': {
    imageUrl: 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Ab_Crunch_Machine/0.jpg',
    sourceName: 'Ab Crunch Machine'
  },
  'Remo sentado': {
    imageUrl: 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Seated_Cable_Rows/0.jpg',
    sourceName: 'Seated Cable Rows'
  },
  'Press hombro en máquina': {
    imageUrl: 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Machine_Shoulder_(Military)_Press/0.jpg',
    sourceName: 'Machine Shoulder (Military) Press'
  },
  'Aperturas en máquina': {
    imageUrl: 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Butterfly/0.jpg',
    sourceName: 'Butterfly'
  },
  'Aperturas de pecho con mancuernas': {
    imageUrl: 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Dumbbell_Flyes/0.jpg',
    sourceName: 'Dumbbell Flyes'
  },
  'Curl bíceps en máquina': {
    imageUrl: 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Machine_Bicep_Curl/0.jpg',
    sourceName: 'Machine Bicep Curl'
  },
  'Extensión tríceps en polea': {
    imageUrl: 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Triceps_Pushdown/0.jpg',
    sourceName: 'Triceps Pushdown'
  },
  'Prensa inclinada': {
    imageUrl: 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Leg_Press/0.jpg',
    sourceName: 'Leg Press'
  },
  'Peso muerto rumano con mancuernas': {
    imageUrl: 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Romanian_Deadlift/0.jpg',
    sourceName: 'Romanian Deadlift'
  },
  'Jalón al pecho agarre neutro': {
    imageUrl: 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Close-Grip_Front_Lat_Pulldown/0.jpg',
    sourceName: 'Close-Grip Front Lat Pulldown'
  },
  'Remo bajo en polea': {
    imageUrl: 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Seated_Cable_Rows/0.jpg',
    sourceName: 'Seated Cable Rows'
  },
  'Dead bug': {
    imageUrl: '/exercises/dead-bug-reference.jpg',
    sourceName: 'Free Exercise DB'
  },
  'Sentadilla guiada': {
    imageUrl: 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Smith_Machine_Squat/0.jpg',
    sourceName: 'Smith Machine Squat'
  },
  'Sentadilla goblet con mancuerna': {
    imageUrl: 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Goblet_Squat/0.jpg',
    sourceName: 'Goblet Squat'
  },
  'Press pecho inclinado en máquina': {
    imageUrl: 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Machine_Bench_Press/0.jpg',
    sourceName: 'Machine Bench Press'
  },
  'Elevaciones laterales': {
    imageUrl: 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Side_Lateral_Raise/0.jpg',
    sourceName: 'Side Lateral Raise'
  },
  'Face pull en polea': {
    imageUrl: 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Face_Pull/0.jpg',
    sourceName: 'Face Pull'
  },
  'Curl bíceps con mancuernas': {
    imageUrl: '/exercises/curl-biceps-mancuernas-nanobanana.png',
    sourceName: 'NanoBanana custom'
  }
};

const statusText: Record<DayStatus, string> = {
  planned: 'Preparado para asignar rutina',
  done: 'Entrenamiento archivado',
  rest: 'Descanso / movilidad',
  focus: 'Primer día de vuelta'
};

type WarmupGuide = {
  title: string;
  duration: string;
  note: string;
  steps: string[];
};

type NutritionMeal = {
  id: string;
  name: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  mealType?: string;
  quantityText?: string;
  time?: string;
  items: {
    name: string;
    quantityText?: string;
    calories: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    fiber?: number;
  }[];
};

type NutritionDay = {
  consumedKcal: number;
  protein: number;
  carbs: number;
  fat: number;
  meals: NutritionMeal[];
};

type BodyMetrics = {
  weightKg: number;
  goalWeightKg: number;
  heightCm: number;
  bodyFatPct: number | null;
  bmi: number | null;
  bmrKcal: number | null;
  tdeeKcal: number | null;
  objective: string;
};

type NeoRecommendation = {
  title: string;
  body: string;
  tone: 'good' | 'watch' | 'neutral';
};

type TrainingReview = {
  summary: string;
  recommendationLevel: 'good' | 'watch' | 'info';
};

type NeoDayNote = {
  id: string;
  slotKey: string;
  title: string;
  body: string;
  tone: 'good' | 'watch' | 'neutral';
};

type WeeklyStatsDay = {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  planned: boolean;
  completed: boolean;
  energy: number | null;
  effort: number | null;
  weightKg: number | null;
  goalWeightKg: number | null;
  bodyFatPct: number | null;
};

type StatsRange = 'last7' | 'this_week' | 'previous_week' | 'last30';

type WeeklyStats = {
  mode?: StatsRange;
  label?: string;
  startDate?: string;
  endDate?: string;
  days: number;
  summary: {
    adherencePct: number;
    plannedDays: number;
    completedDays: number;
    trackedNutritionDays: number;
    avgCalories: number;
    avgProtein: number;
    avgCarbs: number;
    avgFat: number;
    avgEnergy: number | null;
    avgEffort: number | null;
    currentWeightKg: number | null;
    weightDeltaKg: number | null;
    goalWeightKg: number | null;
    macroTotals: { protein: number; carbs: number; fat: number };
  };
  daily: WeeklyStatsDay[];
};

const WARMUP_GUIDES: Record<string, WarmupGuide> = {
  '2026-03-23': {
    title: 'Calentamiento guiado de hoy',
    duration: '8-10 min',
    note: 'Objetivo: activar sin fatigarte. Hoy buscamos que el cuerpo vuelva a entrar en modo entrenamiento, no reventarte antes de empezar.',
    steps: [
      '4 min de cinta, bici o elíptica a ritmo suave para subir temperatura.',
      'Movilidad rápida: 8-10 círculos de hombros, 8-10 bisagras de cadera y 8-10 sentadillas al aire sin prisa.',
      'Haz 1 serie muy ligera del primer ejercicio y otra serie subiendo un poco el peso, sin acercarte al fallo.',
      'Empieza la rutina cuando notes articulaciones sueltas, respiración estable y el cuerpo “despierto”.'
    ]
  }
};

const DEFAULT_TRAINING_WARMUP: WarmupGuide = {
  title: 'Calentamiento recomendado',
  duration: '6-8 min',
  note: 'Calienta lo justo para entrar bien en la sesión. La idea es preparar, no gastar energía de más.',
  steps: [
    '3-4 min de cardio suave.',
    'Movilidad rápida de hombros, cadera y tobillos.',
    '1-2 series de aproximación del primer ejercicio antes del peso real.'
  ]
};

const FALLBACK_NUTRITION_BY_DATE: Record<string, NutritionDay> = {};

const SESSION_KCAL_BY_DATE: Record<string, number> = {
  '2026-03-23': 0,
  '2026-03-29': 420
};

function formatDateKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function getZurichDateInfo(now = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Zurich',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = formatter.formatToParts(now);
  const year = Number(parts.find((part) => part.type === 'year')?.value || now.getUTCFullYear());
  const month = Number(parts.find((part) => part.type === 'month')?.value || now.getUTCMonth() + 1);
  const day = Number(parts.find((part) => part.type === 'day')?.value || now.getUTCDate());
  return {
    year,
    month,
    day,
    dateKey: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    monthDate: new Date(Date.UTC(year, month - 1, 1))
  };
}

function formatGhostDate(dateKey: string) {
  if (!dateKey) return '';
  const date = new Date(`${dateKey}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return dateKey;
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC'
  }).format(date).replace('.', '');
}

function formatRelativeRefresh(date: Date | null) {
  if (!date) return 'Sin sincronizar';
  const diffSeconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (diffSeconds < 10) return 'Actualizado ahora';
  if (diffSeconds < 60) return `Actualizado hace ${diffSeconds} s`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `Actualizado hace ${diffMinutes} min`;
  const diffHours = Math.floor(diffMinutes / 60);
  return `Actualizado hace ${diffHours} h`;
}

function formatShortStatsDate(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  return new Intl.DateTimeFormat('es-ES', { weekday: 'short', timeZone: 'UTC' }).format(date).replace('.', '');
}

function describeWeightDelta(delta: number | null) {
  if (delta == null) return 'Sin suficiente histórico';
  if (Math.abs(delta) < 0.05) return 'Peso estable';
  return delta < 0 ? `${Math.abs(delta).toFixed(1)} kg menos` : `${delta.toFixed(1)} kg más`;
}

function buildCalendarCards(baseMonth: Date): DayCard[] {
  const year = baseMonth.getUTCFullYear();
  const monthIndex = baseMonth.getUTCMonth();
  const firstOfMonth = new Date(Date.UTC(year, monthIndex, 1));
  const jsWeekday = firstOfMonth.getUTCDay();
  const mondayOffset = (jsWeekday + 6) % 7;
  const gridStart = new Date(Date.UTC(year, monthIndex, 1 - mondayOffset));
  const todayKey = getZurichDateInfo().dateKey;

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setUTCDate(gridStart.getUTCDate() + index);
    const monthOffset = date.getUTCMonth() < monthIndex ? -1 : date.getUTCMonth() > monthIndex ? 1 : 0;
    const dateKey = formatDateKey(date);
    return {
      day: date.getUTCDate(),
      monthOffset: monthOffset as -1 | 0 | 1,
      status: dateKey === todayKey ? 'focus' : 'rest',
      label: dateKey === todayKey ? 'Día activo' : monthOffset === 0 ? 'Calendario' : 'Otro mes',
      energy: dateKey === todayKey ? 'Volver al sistema' : 'Contexto',
      accent: dateKey === todayKey ? 'focus' : 'rest'
    };
  });
}

function getTrainingDate(card: DayCard, baseMonth: Date) {
  const baseYear = baseMonth.getUTCFullYear();
  const baseMonthIndex = baseMonth.getUTCMonth();
  const target = new Date(Date.UTC(baseYear, baseMonthIndex + (card.monthOffset ?? 0), card.day));
  return formatDateKey(target);
}

function dateFromKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, (month || 1) - 1, day || 1));
}

export function SportDashboard() {
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => getZurichDateInfo().monthDate);
  const [selectedDay, setSelectedDay] = useState<DayCard>(() => {
    const { monthDate, day } = getZurichDateInfo();
    return buildCalendarCards(monthDate).find((d) => d.day === day && (d.monthOffset ?? 0) === 0) || buildCalendarCards(monthDate)[0];
  });
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [activeSection, setActiveSection] = useState<AppSection>('dashboard');
  const [dayViewMode, setDayViewMode] = useState<DayViewMode>('summary');
  const [menuOpen, setMenuOpen] = useState(false);
  const [timerModalOpen, setTimerModalOpen] = useState(false);
  const [dbStatus, setDbStatus] = useState<'loading' | 'online' | 'offline'>('loading');
  const [dbCounts, setDbCounts] = useState({ users: 0, workout_days: 0, workout_sessions: 0 });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [calendarStatusMap, setCalendarStatusMap] = useState<Record<string, string>>({});
  const [sessionStatus, setSessionStatus] = useState('');
  const [isSavingDay, setIsSavingDay] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState('');
  const [perceivedEnergy, setPerceivedEnergy] = useState('');
  const [perceivedEffort, setPerceivedEffort] = useState('');
  const [sessionNotes, setSessionNotes] = useState('');
  const [nutritionDay, setNutritionDay] = useState<NutritionDay>({ consumedKcal: 0, protein: 0, carbs: 0, fat: 0, meals: [] });
  const [activeMeal, setActiveMeal] = useState<NutritionMeal | null>(null);
  const [isRefreshingGhosts, setIsRefreshingGhosts] = useState(false);
  const [bodyMetrics, setBodyMetrics] = useState<BodyMetrics>({
    weightKg: 0,
    goalWeightKg: 0,
    heightCm: 0,
    bodyFatPct: null,
    bmi: null,
    bmrKcal: null,
    tdeeKcal: null,
    objective: ''
  });
  const [trainingReview, setTrainingReview] = useState<TrainingReview | null>(null);
  const [statsRange, setStatsRange] = useState<StatsRange>('last7');
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats | null>(null);
  const [neoDayNotes, setNeoDayNotes] = useState<NeoDayNote[]>([]);
  const [neoDayNoteIndex, setNeoDayNoteIndex] = useState(0);
  const neoCarouselRef = useRef<HTMLDivElement | null>(null);
  const [exerciseForms, setExerciseForms] = useState<ExerciseForm[]>([emptyExercise(), emptyExercise(), emptyExercise(), emptyExercise(), emptyExercise()]);
  const [activeExerciseIndex, setActiveExerciseIndex] = useState<number | null>(null);
  const [savedExercises, setSavedExercises] = useState<Record<number, boolean>>({});
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [savingExerciseIndex, setSavingExerciseIndex] = useState<number | null>(null);
  const [isSavingCloseout, setIsSavingCloseout] = useState(false);
  const [restSecondsLeft, setRestSecondsLeft] = useState(90);
  const [restInitialSeconds, setRestInitialSeconds] = useState(90);
  const [timerMinutesInput, setTimerMinutesInput] = useState('01');
  const [timerSecondsInput, setTimerSecondsInput] = useState('30');
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerReady, setTimerReady] = useState(false);
  const [timerStatusLabel, setTimerStatusLabel] = useState('Sincronizando cronómetro...');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const alarmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastTimerStatusRef = useRef<string>('idle');
  const lastFinishCountRef = useRef<number>(0);
  const [alarmTick, setAlarmTick] = useState(0);

  const month = useMemo(() => {
    const raw = monthFormatter.format(calendarMonth);
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }, [calendarMonth]);

  const renderedDayCardsBase = useMemo(() => buildCalendarCards(calendarMonth), [calendarMonth]);

  const trainingDate = useMemo(() => getTrainingDate(selectedDay, calendarMonth), [selectedDay, calendarMonth]);
  const warmupGuide = useMemo(() => {
    if (WARMUP_GUIDES[trainingDate]) return WARMUP_GUIDES[trainingDate];
    if (selectedDay.status === 'planned' || selectedDay.status === 'focus') return DEFAULT_TRAINING_WARMUP;
    return null;
  }, [trainingDate, selectedDay.status]);

  function updateExercise(index: number, patch: Partial<ExerciseForm>) {
    setExerciseForms((current) => current.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
    setSavedExercises((current) => ({ ...current, [index]: false }));
    setSessionCompleted(false);
  }

  function addExercise() {
    setExerciseForms((current) => {
      const nextIndex = current.length;
      setActiveExerciseIndex(nextIndex);
      return [...current, emptyExercise({ isCustom: true, exerciseType: 'cardio' })];
    });
    setSessionCompleted(false);
  }

  function openExerciseModal(index: number) {
    setActiveExerciseIndex(index);
  }

  function closeExerciseModal() {
    setActiveExerciseIndex(null);
  }

  function canDeleteExercise(item: ExerciseForm) {
    return item.isCustom || (
      item.exerciseType === 'cardio'
      && !item.targetSets
      && !item.targetReps
      && !item.targetWeightKg
    );
  }

  async function refreshHealthData() {
    try {
      const res = await fetch(`${apiBase}/api/health`, { cache: 'no-store' });
      if (!res.ok) throw new Error('health failed');
      const data = await res.json();
      setDbStatus('online');
      setDbCounts({
        users: data?.counts?.users ?? 0,
        workout_days: data?.counts?.workout_days ?? 0,
        workout_sessions: data?.counts?.workout_sessions ?? 0
      });
    } catch {
      setDbStatus('offline');
    }
  }

  async function refreshSessionData() {
    setSessionStatus('');
    try {
      const res = await fetch(`${apiBase}/api/session?user=migue&trainingDate=${trainingDate}`, { cache: 'no-store' });
      const data = await res.json();
      if (!data?.ok) return;
      if (data.session) {
        setDurationMinutes(data.session.duration_minutes ? String(data.session.duration_minutes) : '');
        setPerceivedEnergy(data.session.perceived_energy ? String(data.session.perceived_energy) : '');
        setPerceivedEffort(data.session.perceived_effort ? String(data.session.perceived_effort) : '');
        setSessionNotes(data.session.notes || '');
        setSessionCompleted(Boolean(data.session.completed_at));
      } else {
        setDurationMinutes('');
        setPerceivedEnergy('');
        setPerceivedEffort('');
        setSessionNotes('');
        setSessionCompleted(false);
      }

      if (Array.isArray(data.exercises) && data.exercises.length) {
        const sessionExercises = data.exercises;
        const mapped = sessionExercises.map((item: any) => ({
          exerciseName: item.exercise_name || '',
          exerciseType: (item.exercise_type || 'strength') as ExerciseType,
          isCustom: Boolean(item.is_custom),
          targetSets: item.target_sets ? String(item.target_sets) : '',
          targetReps: item.target_reps ? String(item.target_reps) : '',
          targetWeightKg: item.target_weight_kg ? String(item.target_weight_kg) : '',
          actualSets: item.actual_sets ? String(item.actual_sets) : '',
          actualReps: item.reps ? String(item.reps) : '',
          weightKg: item.weight_kg ? String(item.weight_kg) : '',
          actualDurationMinutes: item.actual_duration_minutes ? String(item.actual_duration_minutes) : '',
          actualDistanceKm: item.actual_distance_km ? String(item.actual_distance_km) : '',
          actualCaloriesBurned: item.actual_calories_burned ? String(item.actual_calories_burned) : '',
          difficulty: item.difficulty ? String(item.difficulty) : (item.set_effort ? String(item.set_effort) : ''),
          notes: item.actual_notes || item.set_notes || '',
          ghost: item.previous_reference
            ? {
                lastDate: String(item.previous_reference.training_date || '').slice(0, 10),
                lastSets: item.previous_reference.actual_sets != null ? String(item.previous_reference.actual_sets) : '',
                lastReps: item.previous_reference.reps != null ? String(item.previous_reference.reps) : '',
                lastWeightKg: item.previous_reference.weight_kg != null ? String(item.previous_reference.weight_kg) : '',
                lastDurationMinutes: item.previous_reference.actual_duration_minutes != null ? String(item.previous_reference.actual_duration_minutes) : '',
                lastDistanceKm: item.previous_reference.actual_distance_km != null ? String(item.previous_reference.actual_distance_km) : '',
                lastCaloriesBurned: item.previous_reference.actual_calories_burned != null ? String(item.previous_reference.actual_calories_burned) : '',
                lastDifficulty: item.previous_reference.difficulty != null ? String(item.previous_reference.difficulty) : '',
                lastNotes: item.previous_reference.notes ? String(item.previous_reference.notes) : ''
              }
            : null
        }));
        while (mapped.length < 5) mapped.push(emptyExercise());
        setExerciseForms(mapped);
        setSavedExercises(Object.fromEntries(sessionExercises.map((item: any, index: number) => [index, Boolean(item.is_logged)])));
        setActiveExerciseIndex(null);
      } else {
        setExerciseForms([emptyExercise(), emptyExercise(), emptyExercise(), emptyExercise(), emptyExercise()]);
        setSavedExercises({});
        setActiveExerciseIndex(null);
      }
    } catch {
      // noop
    }
  }

  async function refreshBodyAndNotesData() {
    try {
      const [metricsRes, reviewRes, notesRes, nutritionRes] = await Promise.all([
        fetch(`${apiBase}/api/body-metrics/latest?user=migue`, { cache: 'no-store' }),
        fetch(`${apiBase}/api/training-review/latest?user=migue`, { cache: 'no-store' }),
        fetch(`${apiBase}/api/neo-day-notes?user=migue&date=${trainingDate}`, { cache: 'no-store' }),
        fetch(`${apiBase}/api/nutrition?user=migue&date=${trainingDate}`, { cache: 'no-store' })
      ]);

      const metricsData = await metricsRes.json().catch(() => null);
      if (metricsData?.ok && metricsData.metrics) {
        setBodyMetrics({
          weightKg: Number(metricsData.metrics.weight_kg || 0),
          goalWeightKg: Number(metricsData.metrics.goal_weight_kg || 0),
          heightCm: Number(metricsData.metrics.height_cm || 0),
          bodyFatPct: metricsData.metrics.body_fat_pct != null ? Number(metricsData.metrics.body_fat_pct) : null,
          bmi: metricsData.metrics.bmi != null ? Number(metricsData.metrics.bmi) : null,
          bmrKcal: metricsData.metrics.bmr_kcal != null ? Number(metricsData.metrics.bmr_kcal) : null,
          tdeeKcal: metricsData.metrics.tdee_kcal != null ? Number(metricsData.metrics.tdee_kcal) : null,
          objective: metricsData.metrics.note || ''
        });
      }

      const reviewData = await reviewRes.json().catch(() => null);
      if (reviewData?.ok && reviewData.review) {
        setTrainingReview({
          summary: reviewData.review.summary || '',
          recommendationLevel: reviewData.review.recommendation_level || 'info'
        });
      } else {
        setTrainingReview(null);
      }

      const notesData = await notesRes.json().catch(() => null);
      if (notesData?.ok) {
        const notes = Array.isArray(notesData.notes)
          ? notesData.notes.map((note: any) => ({
              id: String(note.id),
              slotKey: String(note.slot_key || ''),
              title: String(note.title || ''),
              body: String(note.body || ''),
              tone: (note.tone || 'neutral') as 'good' | 'watch' | 'neutral'
            }))
          : [];
        setNeoDayNotes(notes);
        setNeoDayNoteIndex(0);
      }

      const nutritionData = await nutritionRes.json().catch(() => null);
      if (nutritionData?.ok) {
        const meals = Array.isArray(nutritionData.entries)
          ? nutritionData.entries.map((entry: any) => ({
              id: String(entry.id || ''),
              name: entry.title || 'Comida',
              calories: Number(entry.calories || 0),
              protein: Number(entry.protein_g || 0),
              carbs: Number(entry.carbs_g || 0),
              fat: Number(entry.fat_g || 0),
              fiber: Number(entry.fiber_g || 0),
              mealType: entry.meal_type || undefined,
              quantityText: entry.quantity_text || undefined,
              time: entry.meal_type || entry.consumed_at || undefined,
              items: Array.isArray(entry.items_json)
                ? entry.items_json.map((item: any) => ({
                    name: String(item.name || 'Alimento'),
                    quantityText: item.quantityText
                      ? String(item.quantityText)
                      : item.amount
                        ? String(item.amount)
                        : undefined,
                    calories: Number(item.calories || 0),
                    protein: Number(item.protein ?? item.protein_g ?? 0),
                    carbs: Number(item.carbs ?? item.carbs_g ?? 0),
                    fat: Number(item.fat ?? item.fat_g ?? 0),
                    fiber: Number(item.fiber ?? item.fiber_g ?? 0)
                  }))
                : []
            }))
          : [];
        setActiveMeal(null);
        setNutritionDay({
          consumedKcal: Number(nutritionData.totals?.calories || 0),
          protein: Number(nutritionData.totals?.protein_g || 0),
          carbs: Number(nutritionData.totals?.carbs_g || 0),
          fat: Number(nutritionData.totals?.fat_g || 0),
          meals
        });
      } else {
        setActiveMeal(null);
        setNutritionDay(FALLBACK_NUTRITION_BY_DATE[trainingDate] || { consumedKcal: 0, protein: 0, carbs: 0, fat: 0, meals: [] });
      }
    } catch {
      setTrainingReview(null);
      setNeoDayNotes([]);
      setNeoDayNoteIndex(0);
      setActiveMeal(null);
      setNutritionDay(FALLBACK_NUTRITION_BY_DATE[trainingDate] || { consumedKcal: 0, protein: 0, carbs: 0, fat: 0, meals: [] });
    }
  }

  async function refreshGhostsForDay() {
    setIsRefreshingGhosts(true);
    try {
      const res = await fetch(`${apiBase}/api/session/refresh-ghosts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: 'migue', trainingDate, updateTargets: true })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.message || 'No pude refrescar el fantasma');
      await refreshSessionData();
    } catch {
      // noop
    } finally {
      setIsRefreshingGhosts(false);
    }
  }

  async function refreshCalendarData() {
    const monthKeys = [-1, 0, 1].map((offset) => {
      const d = new Date(Date.UTC(calendarMonth.getUTCFullYear(), calendarMonth.getUTCMonth() + offset, 1));
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    });

    const results = await Promise.all(
      monthKeys.map((monthKey) =>
        fetch(`${apiBase}/api/calendar?user=migue&month=${monthKey}`, { cache: 'no-store' })
          .then((res) => (res.ok ? res.json() : { ok: false, days: [] }))
          .catch(() => ({ ok: false, days: [] }))
      )
    );

    const next: Record<string, string> = {};
    for (const result of results) {
      if (!result?.ok || !Array.isArray(result.days)) continue;
      for (const day of result.days) {
        if (day?.training_date) {
          const key = String(day.training_date).slice(0, 10);
          next[key] = day.status;
        }
      }
    }
    setCalendarStatusMap(next);
  }

  async function refreshWeeklyStats() {
    try {
      const res = await fetch(`${apiBase}/api/stats/weekly?user=migue&mode=${statsRange}`, { cache: 'no-store' });
      const data = await res.json();
      if (data?.ok) {
        setWeeklyStats({
          mode: data.mode,
          label: data.label,
          startDate: data.startDate,
          endDate: data.endDate,
          days: Number(data.days || 7),
          summary: data.summary,
          daily: Array.isArray(data.daily) ? data.daily : []
        });
      }
    } catch {
      // noop
    }
  }

  async function refreshAllData(options?: { silent?: boolean }) {
    const silent = options?.silent ?? false;
    if (!silent) setIsRefreshing(true);
    try {
      await Promise.all([
        refreshHealthData(),
        refreshSessionData(),
        refreshBodyAndNotesData(),
        refreshCalendarData(),
        refreshWeeklyStats()
      ]);
      setLastRefreshedAt(new Date());
    } finally {
      if (!silent) setIsRefreshing(false);
    }
  }

  function formatTime(totalSeconds: number) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  function getTimerParts(totalSeconds: number) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return {
      minutes: String(minutes).padStart(2, '0'),
      seconds: String(seconds).padStart(2, '0')
    };
  }

  function syncTimerDraftInputs(totalSeconds: number) {
    const parts = getTimerParts(totalSeconds);
    setTimerMinutesInput(parts.minutes);
    setTimerSecondsInput(parts.seconds);
  }

  function selectSection(section: AppSection) {
    setActiveSection(section);
    setMenuOpen(false);
  }

  function goToToday() {
    const { monthDate, day } = getZurichDateInfo();
    const todayCard = buildCalendarCards(monthDate).find((card) => card.day === day && (card.monthOffset ?? 0) === 0);
    setCalendarMonth(monthDate);
    if (todayCard) {
      setSelectedDay(todayCard);
    }
    setDayViewMode('summary');
    setActiveSection('day');
    setMenuOpen(false);
  }

  function goToDate(dateKey: string) {
    const targetDate = dateFromKey(dateKey);
    const monthDate = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), 1));
    const targetCard = buildCalendarCards(monthDate).find((card) => getTrainingDate(card, monthDate) === dateKey);
    setCalendarMonth(monthDate);
    if (targetCard) {
      setSelectedDay(targetCard);
    }
    setDayViewMode('summary');
    setActiveSection('day');
  }

  function shiftSelectedDay(delta: number) {
    const currentDate = dateFromKey(trainingDate);
    currentDate.setUTCDate(currentDate.getUTCDate() + delta);
    goToDate(formatDateKey(currentDate));
  }

  function openTimerModal() {
    syncTimerDraftInputs(restInitialSeconds);
    setTimerModalOpen(true);
    setMenuOpen(false);
  }

  function closeTimerModal() {
    setTimerModalOpen(false);
  }

  async function ensureAudioReady() {
    try {
      const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      const ctx = audioContextRef.current ?? new AudioCtx();
      audioContextRef.current = ctx;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      return ctx;
    } catch {
      return null;
    }
  }

  function scheduleTimerDeadlineSync(status: string, endAt: string | null | undefined, remainingSeconds: number) {
    if (alarmTimeoutRef.current) {
      clearTimeout(alarmTimeoutRef.current);
      alarmTimeoutRef.current = null;
    }

    if (status !== 'running') return;

    const targetTime = endAt ? new Date(endAt).getTime() : Date.now() + remainingSeconds * 1000;
    if (!Number.isFinite(targetTime)) return;

    const delay = Math.max(250, targetTime - Date.now() + 180);
    alarmTimeoutRef.current = setTimeout(() => {
      void syncTimer(true);
    }, delay);
  }

  async function syncTimer(playAlarmOnFinish = false) {
    try {
      const res = await fetch(`${apiBase}/api/rest-timer?user=migue`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data.ok || !data.timer) throw new Error(data.message || 'No pude sincronizar el cronómetro');

      const timer = data.timer;
      const nextStatus = String(timer.status || 'idle');
      const nextRemaining = Number(timer.remaining_seconds ?? 0);
      const nextDuration = Number(timer.duration_seconds ?? 90);
      const nextFinishCount = Number(timer.finish_count ?? 0);
      const hasNewFinish = nextFinishCount > lastFinishCountRef.current;

      if (playAlarmOnFinish && (hasNewFinish || (lastTimerStatusRef.current === 'running' && nextStatus === 'finished'))) {
        setAlarmTick(Date.now());
        void playTimerAlarm();
      }

      lastFinishCountRef.current = nextFinishCount;
      lastTimerStatusRef.current = nextStatus;
      scheduleTimerDeadlineSync(nextStatus, timer.end_at, nextRemaining);
      setRestInitialSeconds(nextDuration);
      setRestSecondsLeft(nextRemaining);
      setTimerRunning(nextStatus === 'running');
      setTimerReady(true);

      if (nextStatus === 'running') setTimerStatusLabel('Descanso en marcha');
      else if (nextStatus === 'paused') setTimerStatusLabel('Descanso pausado');
      else if (nextStatus === 'finished') setTimerStatusLabel('Descanso terminado');
      else setTimerStatusLabel('Listo para arrancar el descanso');
    } catch (error) {
      scheduleTimerDeadlineSync('idle', null, 0);
      setTimerReady(true);
      setTimerStatusLabel(error instanceof Error ? error.message : 'No pude sincronizar el cronómetro');
    }
  }

  async function sendTimerAction(action: 'start' | 'pause' | 'reset' | 'preset', seconds?: number) {
    const res = await fetch(`${apiBase}/api/rest-timer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: 'migue', action, seconds })
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.message || 'No pude actualizar el cronómetro');
    await syncTimer(false);
    return data;
  }

  async function setTimerPreset(seconds: number) {
    setAlarmTick(0);
    syncTimerDraftInputs(seconds);
    await sendTimerAction('preset', seconds);
  }

  function normalizeTimerInput(value: string, max: number) {
    const digitsOnly = value.replace(/\D/g, '');
    if (!digitsOnly) return '';
    return String(Math.min(max, Number(digitsOnly)));
  }

  async function applyTimerDraft() {
    const minutes = Math.max(0, Number(timerMinutesInput || 0));
    const seconds = Math.min(59, Math.max(0, Number(timerSecondsInput || 0)));
    const total = Math.max(5, minutes * 60 + seconds);
    await setTimerPreset(total);
  }

  async function toggleTimer() {
    if (!timerRunning) {
      await ensureAudioReady();
      setAlarmTick(0);
    }
    await sendTimerAction(timerRunning ? 'pause' : 'start');
  }

  async function resetTimer() {
    setAlarmTick(0);
    syncTimerDraftInputs(restInitialSeconds);
    const data = await sendTimerAction('reset');
    const nextFinishCount = Number(data?.timer?.finish_count ?? lastFinishCountRef.current ?? 0);
    const shouldPlay = Boolean(data?.timer?.alarm_on_reset) || nextFinishCount > lastFinishCountRef.current;
    lastFinishCountRef.current = nextFinishCount;
    if (shouldPlay) {
      setAlarmTick(Date.now());
      void playTimerAlarm();
    }
  }

  function handleNeoCarouselScroll(event: { currentTarget: HTMLDivElement }) {
    const container = event.currentTarget;
    const cardWidth = container.clientWidth * 0.88;
    if (!cardWidth) return;
    const nextIndex = Math.round(container.scrollLeft / cardWidth);
    setNeoDayNoteIndex(Math.max(0, Math.min(nextIndex, Math.max(neoDayNotes.length - 1, 0))));
  }

  function jumpToNeoNote(index: number) {
    setNeoDayNoteIndex(index);
    const container = neoCarouselRef.current;
    if (!container) return;
    const card = container.children[index] as HTMLElement | undefined;
    if (!card) return;
    container.scrollTo({ left: card.offsetLeft, behavior: 'smooth' });
  }

  async function playTimerAlarm() {
    try {
      const ctx = await ensureAudioReady();
      if (!ctx || ctx.state !== 'running') return;

      const now = ctx.currentTime;
      const sequence = [880, 1174, 1568, 1174, 1568, 1760];
      const timerAlarmPeakGain = 0.84;
      const repeats = 4;
      const repeatGapSeconds = 1.35;

      for (let repeatIndex = 0; repeatIndex < repeats; repeatIndex += 1) {
        const repeatOffset = repeatIndex * repeatGapSeconds;
        sequence.forEach((frequency, index) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const start = now + repeatOffset + index * 0.18;
          const end = start + 0.14;

          osc.type = index % 2 === 0 ? 'square' : 'sine';
          osc.frequency.setValueAtTime(frequency, start);
          gain.gain.setValueAtTime(0.0001, start);
          gain.gain.exponentialRampToValueAtTime(timerAlarmPeakGain, start + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.0001, end);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(start);
          osc.stop(end);
        });
      }

      if ('vibrate' in navigator) {
        navigator.vibrate([180, 120, 180, 260, 220, 120, 180, 260, 220, 120, 180, 260, 220, 120, 180, 320]);
      }
    } catch {
      // silencio si el navegador bloquea audio
    }
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
    const unlockAudio = () => {
      void ensureAudioReady();
    };

    window.addEventListener('pointerdown', unlockAudio, { passive: true });
    window.addEventListener('keydown', unlockAudio);

    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  useEffect(() => {
    if (!timerModalOpen && activeExerciseIndex == null) return;

    const { body, documentElement } = document;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyTouchAction = body.style.touchAction;
    const previousHtmlOverflow = documentElement.style.overflow;
    const previousHtmlTouchAction = documentElement.style.touchAction;

    body.style.overflow = 'hidden';
    body.style.touchAction = 'none';
    documentElement.style.overflow = 'hidden';
    documentElement.style.touchAction = 'none';

    return () => {
      body.style.overflow = previousBodyOverflow;
      body.style.touchAction = previousBodyTouchAction;
      documentElement.style.overflow = previousHtmlOverflow;
      documentElement.style.touchAction = previousHtmlTouchAction;
    };
  }, [timerModalOpen, activeExerciseIndex]);

  useEffect(() => {
    void syncTimer(false);

    intervalRef.current = setInterval(() => {
      void syncTimer(true);
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (alarmTimeoutRef.current) {
        clearTimeout(alarmTimeoutRef.current);
        alarmTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    void refreshAllData({ silent: true });
  }, [trainingDate, calendarMonth, statsRange]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void refreshAllData({ silent: true });
      }
    };

    const onFocus = () => {
      void refreshAllData({ silent: true });
    };

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
    };
  }, [trainingDate, calendarMonth, statsRange]);


  const renderedDayCards = useMemo(() => {
    return renderedDayCardsBase.map((card) => {
      const dateKey = getTrainingDate(card, calendarMonth);
      const dbStatus = calendarStatusMap[dateKey];
      if (dbStatus === 'done') return { ...card, status: 'done' as DayStatus, accent: 'done', label: 'Completado' };
      if (dbStatus === 'planned') return { ...card, status: 'planned' as DayStatus, accent: 'planned', label: 'Entreno' };
      if (dbStatus === 'rest' || dbStatus === 'skipped') return { ...card, status: 'rest' as DayStatus, accent: 'rest', label: 'Descanso' };

      const weekday = new Date(`${dateKey}T12:00:00Z`).getUTCDay();
      if (trainingWeekdays.has(weekday)) return { ...card, status: 'planned' as DayStatus, accent: 'planned', label: 'Entreno' };
      return { ...card, status: 'rest' as DayStatus, accent: 'rest', label: 'Descanso' };
    });
  }, [calendarMonth, calendarStatusMap, renderedDayCardsBase]);

  const currentSelectedDay = useMemo(() => {
    return renderedDayCards.find((card) => card.day === selectedDay.day && (card.monthOffset ?? 0) === (selectedDay.monthOffset ?? 0)) || selectedDay;
  }, [renderedDayCards, selectedDay]);

  const selectedSummary = useMemo(() => ({
    title: currentSelectedDay.status === 'done' ? 'Sesión cerrada' : currentSelectedDay.status === 'rest' ? 'Día de recuperación' : 'Sesión editable',
    subtitle: statusText[currentSelectedDay.status],
    cta: isCompleting ? 'Cerrando sesión...' : 'Completar sesión'
  }), [currentSelectedDay, isCompleting]);

  const dashboardStats = useMemo(() => {
    const currentMonthCards = renderedDayCards.filter((card) => (card.monthOffset ?? 0) === 0);
    const sessionsDone = currentMonthCards.filter((card) => card.status === 'done').length;
    const trainingDays = currentMonthCards.filter((card) => card.status === 'planned' || card.status === 'focus' || card.status === 'done').length;
    const monthDates = currentMonthCards.map((card) => getTrainingDate(card, calendarMonth));
    const burnedKcal = monthDates.reduce((sum, date) => sum + (SESSION_KCAL_BY_DATE[date] || 0), 0);
    const consumedKcal = nutritionDay.consumedKcal;
    return { sessionsDone, trainingDays, burnedKcal, consumedKcal };
  }, [calendarMonth, renderedDayCards, nutritionDay.consumedKcal]);

  const weightRemaining = useMemo(() => {
    if (!bodyMetrics.weightKg || !bodyMetrics.goalWeightKg) return null;
    return Number((bodyMetrics.weightKg - bodyMetrics.goalWeightKg).toFixed(1));
  }, [bodyMetrics.goalWeightKg, bodyMetrics.weightKg]);

  const bodyMetricsNote = bodyMetrics.objective.trim();
  const bodyMetricsHeroLabel = bodyMetricsNote
    ? bodyMetricsNote.startsWith('Actualizado desde báscula')
      ? 'Seguimiento corporal'
      : bodyMetricsNote
    : 'Perder peso · fuerza';

  const neoRecommendation = useMemo<NeoRecommendation>(() => {
    const currentNote = neoDayNotes[neoDayNoteIndex];
    if (currentNote) {
      return {
        title: currentNote.title,
        body: currentNote.body,
        tone: currentNote.tone
      };
    }
    if (trainingDate > '2026-03-23') {
      return {
        title: 'Aún no hay notas para este día',
        body: 'Cuando llegue el primer checkeo de Neo en ese día, aquí empezará a aparecer el historial de notas.',
        tone: 'neutral'
      };
    }
    if (trainingReview?.summary) {
      return {
        title: trainingReview.recommendationLevel === 'good'
          ? 'Lectura buena ahora mismo'
          : trainingReview.recommendationLevel === 'watch'
            ? 'Ojo con este punto'
            : 'Lectura actual de Neo',
        body: trainingReview.summary,
        tone: trainingReview.recommendationLevel === 'info' ? 'neutral' : trainingReview.recommendationLevel
      };
    }
    return {
      title: 'Todavía estamos montando señal útil',
      body: 'Sigue registrando comidas, peso y sensaciones del entreno. Con más días seguidos podré ajustar mucho mejor.',
      tone: 'neutral'
    };
  }, [neoDayNoteIndex, neoDayNotes, trainingDate, trainingReview]);

  const timerVisualState = useMemo(() => {
    if (alarmTick && restSecondsLeft === 0) return 'finished';
    if (timerRunning && restSecondsLeft <= 10) return 'warning';
    if (timerRunning) return 'running';
    return 'idle';
  }, [alarmTick, restSecondsLeft, timerRunning]);

  const refreshStatusText = useMemo(() => formatRelativeRefresh(lastRefreshedAt), [lastRefreshedAt]);

  const macroTotalForStats = useMemo(() => {
    if (!weeklyStats) return 0;
    const totals = weeklyStats.summary.macroTotals;
    return totals.protein + totals.carbs + totals.fat;
  }, [weeklyStats]);

  const calorieMaxForStats = useMemo(() => {
    if (!weeklyStats?.daily?.length) return 1;
    return Math.max(...weeklyStats.daily.map((day) => day.calories), 1);
  }, [weeklyStats]);

  const weightPoints = useMemo(() => {
    const days = weeklyStats?.daily?.filter((day) => day.weightKg != null) || [];
    if (days.length < 2) return '';
    const values = days.map((day) => Number(day.weightKg));
    const min = Math.min(...values);
    const max = Math.max(...values);
    return days.map((day, index) => {
      const x = (index / (days.length - 1)) * 100;
      const y = max === min ? 50 : 100 - (((Number(day.weightKg) - min) / (max - min)) * 100);
      return `${x},${y}`;
    }).join(' ');
  }, [weeklyStats]);

  useEffect(() => {
    const currentDateKey = getTrainingDate(selectedDay, calendarMonth);
    const visible = renderedDayCards.some((card) => getTrainingDate(card, calendarMonth) === currentDateKey && (card.monthOffset ?? 0) === 0);
    if (!visible) {
      const firstCurrentMonthDay = renderedDayCards.find((card) => (card.monthOffset ?? 0) === 0);
      if (firstCurrentMonthDay) setSelectedDay(firstCurrentMonthDay);
    }
  }, [calendarMonth, renderedDayCards, selectedDay]);

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
          exerciseType: item.exerciseType,
          isCustom: item.isCustom,
          sortOrder: index,
          targetSets: item.targetSets ? Number(item.targetSets) : null,
          targetReps: item.targetReps || null,
          targetWeightKg: item.targetWeightKg ? Number(item.targetWeightKg) : null,
          actualSets: item.actualSets ? Number(item.actualSets) : null,
          actualDurationMinutes: item.actualDurationMinutes ? Number(item.actualDurationMinutes) : null,
          actualDistanceKm: item.actualDistanceKm ? Number(item.actualDistanceKm) : null,
          actualCaloriesBurned: item.actualCaloriesBurned ? Number(item.actualCaloriesBurned) : null,
          isLogged: true,
          difficulty: item.difficulty ? Number(item.difficulty) : null,
          reps: item.actualReps ? Number(item.actualReps) : null,
          weightKg: item.weightKg ? Number(item.weightKg) : null,
          effort: item.difficulty ? Number(item.difficulty) : null,
          actualNotes: item.notes || null
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || 'No pude guardar el ejercicio');
      setSavedExercises((current) => ({ ...current, [index]: true }));
      setActiveExerciseIndex(null);
      if (!silent) setSessionStatus(`Ejercicio ${index + 1} guardado.`);
    } catch (error) {
      if (!silent) setSessionStatus(error instanceof Error ? error.message : 'No pude guardar el ejercicio');
      throw error;
    } finally {
      setSavingExerciseIndex(null);
    }
  }

  async function deleteExercise(index: number) {
    const item = exerciseForms[index];
    if (!item || !canDeleteExercise(item)) return;

    if (savedExercises[index]) {
      const res = await fetch(`${apiBase}/api/session/exercise`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: 'migue', trainingDate, sortOrder: index })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || 'No pude eliminar el ejercicio');
    }

    setExerciseForms((current) => current.filter((_, i) => i !== index));
    setSavedExercises((current) => Object.fromEntries(Object.entries(current).filter(([key]) => Number(key) !== index).map(([key, value]) => [Number(key) > index ? Number(key) - 1 : Number(key), value])));
    setActiveExerciseIndex((current) => {
      if (current == null) return null;
      if (current === index) return null;
      return current > index ? current - 1 : current;
    });
    setSessionStatus('Ejercicio extra eliminado.');
    setSessionCompleted(false);
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
      setSessionCompleted(true);
      setSessionStatus('Sesión cerrada. Queda pendiente de análisis por Neo.');
    } catch (error) {
      setSessionStatus(error instanceof Error ? error.message : 'No pude completar la sesión');
    } finally {
      setIsCompleting(false);
    }
  }

  async function saveCloseout() {
    setIsSavingCloseout(true);
    try {
      const res = await fetch(`${apiBase}/api/session/closeout`, {
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
      if (!res.ok || !data.ok) throw new Error(data.message || 'No pude guardar el cierre');
      setSessionStatus('Cierre del entreno guardado.');
    } catch (error) {
      setSessionStatus(error instanceof Error ? error.message : 'No pude guardar el cierre');
    } finally {
      setIsSavingCloseout(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="phone-frame">
        <div className="topbar">
          <div className="topbar-left">
            <div>
              <p className="eyebrow">Neo ⚡ · Sport OS</p>
              <h1>{activeSection === 'day' ? 'Pantalla del día' : activeSection === 'stats' ? 'Estadísticas' : 'Dashboard de entrenamiento'}</h1>
              <p className="refresh-status-inline">{refreshStatusText}</p>
            </div>
          </div>
          <div className="topbar-actions">
            <button className={`menu-toggle ${menuOpen ? 'active' : ''}`} aria-label="Abrir menú" onClick={() => setMenuOpen((current) => !current)}>
              <span />
              <span />
              <span />
            </button>
          </div>
        </div>

        {menuOpen ? (
          <>
            <button className="menu-backdrop" aria-label="Cerrar menú" onClick={() => setMenuOpen(false)} />
            <div className="menu-sheet glass">
              <div className="menu-sheet-head">
                <span className="tiny-label">Menú</span>
                <button className="menu-close-button" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú">✕</button>
              </div>
              <button className={`menu-item ${activeSection === 'dashboard' ? 'active' : ''}`} onClick={() => selectSection('dashboard')}>
                <span className="menu-item-kicker">Inicio</span>
                <strong>Resumen general</strong>
              </button>
              <button className={`menu-item ${activeSection === 'day' ? 'active' : ''}`} onClick={() => selectSection('day')}>
                <span className="menu-item-kicker">Día</span>
                <strong>Pantalla del día</strong>
              </button>
              <button className={`menu-item ${activeSection === 'stats' ? 'active' : ''}`} onClick={() => selectSection('stats')}>
                <span className="menu-item-kicker">Progreso</span>
                <strong>Estadísticas</strong>
              </button>
              <button className={`menu-item ${timerModalOpen ? 'active' : ''}`} onClick={openTimerModal}>
                <span className="menu-item-kicker">Herramienta</span>
                <strong>Cronómetro descanso</strong>
              </button>
              <div className="menu-utility-card">
                <div className="menu-utility-row">
                  <div>
                    <span className="menu-item-kicker">Apariencia</span>
                    <strong>{theme === 'dark' ? 'Modo oscuro' : 'Modo claro'}</strong>
                  </div>
                  <button
                    type="button"
                    className={`theme-switch ${theme === 'light' ? 'light' : 'dark'}`}
                    aria-label={`Cambiar a modo ${theme === 'dark' ? 'claro' : 'oscuro'}`}
                    aria-pressed={theme === 'light'}
                    onClick={() => setTheme((cur) => (cur === 'dark' ? 'light' : 'dark'))}
                  >
                    <span className="theme-switch-track">
                      <span className="theme-switch-thumb" />
                    </span>
                  </button>
                </div>
                <button className="menu-secondary-action" onClick={() => void refreshAllData()} disabled={isRefreshing}>
                  {isRefreshing ? 'Actualizando...' : '↻ Actualizar datos'}
                </button>
              </div>
            </div>
          </>
        ) : null}

        {(activeSection === 'dashboard' || activeSection === 'day' || activeSection === 'stats' || activeSection === 'timer') ? (
          <>
            {activeSection === 'dashboard' ? (
              <div className="hero-card glass compact-hero dashboard-hero-card">
                <div className="hero-title-row">
                  <div>
                    <p className="tiny-label">Home</p>
                    <h2>{bodyMetrics.weightKg ? `${bodyMetrics.weightKg.toFixed(1)} kg` : 'Dashboard'}</h2>
                    <p className="live-status">
                      {weightRemaining != null
                        ? `${weightRemaining.toFixed(1)} kg para tu objetivo · ${bodyMetrics.goalWeightKg.toFixed(1)} kg meta`
                        : dbStatus === 'online'
                          ? 'Base conectada'
                          : dbStatus === 'offline'
                            ? 'Base sin conexión'
                            : 'Comprobando base...'}
                    </p>
                  </div>
                  <span className="tiny-chip">{bodyMetricsHeroLabel}</span>
                </div>
                <div className="dashboard-hero-actions">
                  <button className="primary-button hero-today-button" onClick={goToToday}>Hoy</button>
                </div>
              </div>
            ) : null}

            {activeSection === 'dashboard' ? (
              <section className="grid-stack">
                <article className="calendar-card glass">
                  <div className="section-head">
                    <div>
                      <p className="tiny-label">Calendario</p>
                      <h3>{month}</h3>
                    </div>
                    <div className="calendar-nav-actions">
                      <button
                        className="tiny-action"
                        onClick={() => setCalendarMonth((current) => new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - 1, 1)))}
                      >
                        ← Mes anterior
                      </button>
                      <button
                        className="tiny-action"
                        onClick={() => setCalendarMonth((current) => new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 1)))}
                      >
                        Mes siguiente →
                      </button>
                      <button className="tiny-action" onClick={ensureDay} disabled={isSavingDay}>{isSavingDay ? 'Guardando...' : 'Guardar día'}</button>
                    </div>
                  </div>

                  <div className="calendar-weekdays">
                    {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((item) => <span key={item}>{item}</span>)}
                  </div>

                  <div className="calendar-grid">
                    {renderedDayCards.map((card, index) => (
                      <button
                        key={`${getTrainingDate(card, calendarMonth)}-${index}`}
                        className={`calendar-day ${card.accent} ${(card.monthOffset ?? 0) !== 0 ? 'muted-day' : ''} ${selectedDay.day === card.day && (selectedDay.monthOffset ?? 0) === (card.monthOffset ?? 0) ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedDay(card);
                          setDayViewMode('summary');
                          setActiveSection('day');
                        }}
                      >
                        <span className="calendar-dot">{card.status === 'done' ? '✓' : card.status === 'rest' ? '—' : '•'}</span>
                        <strong>{card.day}</strong>
                        <small>{shortMonthFormatter.format(new Date(`${getTrainingDate(card, calendarMonth)}T12:00:00Z`)).replace('.', '')}</small>
                      </button>
                    ))}
                  </div>
                </article>

                <article className="session-card glass dashboard-home-card redesigned-dashboard-card">
                  <div className="dashboard-home-stack">
                    <section className="dashboard-feature-card today-card">
                      <div className="section-head compact no-margin">
                        <div>
                          <p className="tiny-label">Hoy</p>
                          <h3>Resumen rápido</h3>
                          <p className="refresh-status-inline">{refreshStatusText}</p>
                        </div>
                        <span className={`status-badge ${currentSelectedDay.accent}`}>{currentSelectedDay.label}</span>
                      </div>
                      <div className="today-summary-grid">
                        <div className="today-main-metric">
                          <span>Calorías</span>
                          <strong>{dashboardStats.consumedKcal.toFixed(0)} kcal</strong>
                          <p>{nutritionDay.meals.length} comidas registradas hoy.</p>
                        </div>
                        <div className="today-macro-strip">
                          <div><span>Proteína</span><strong>{nutritionDay.protein.toFixed(1)} g</strong></div>
                          <div><span>Carbs</span><strong>{nutritionDay.carbs.toFixed(1)} g</strong></div>
                          <div><span>Grasas</span><strong>{nutritionDay.fat.toFixed(1)} g</strong></div>
                        </div>
                      </div>
                    </section>

                    <section className={`dashboard-feature-card neo-card ${neoRecommendation.tone}`}>
                      <div className="section-head compact no-margin">
                        <div>
                          <p className="tiny-label">Neo recomienda</p>
                          <h3>{neoDayNotes.length ? 'Notas del día' : neoRecommendation.title}</h3>
                        </div>
                        <span className="tiny-chip">{neoDayNotes.length ? `${Math.min(neoDayNoteIndex + 1, neoDayNotes.length)}/${neoDayNotes.length}` : 'lectura viva'}</span>
                      </div>

                      {neoDayNotes.length > 0 ? (
                        <>
                          <div className="neo-carousel" ref={neoCarouselRef} onScroll={handleNeoCarouselScroll}>
                            {neoDayNotes.map((note) => (
                              <article key={note.id} className={`neo-carousel-card ${note.tone}`}>
                                <div className="neo-carousel-card-head">
                                  <span className="neo-note-slot">{note.slotKey}</span>
                                  <span className="tiny-chip">{note.tone === 'good' ? 'bien' : note.tone === 'watch' ? 'ojo' : 'nota'}</span>
                                </div>
                                <h4>{note.title}</h4>
                                <p>{note.body}</p>
                              </article>
                            ))}
                          </div>
                          <div className="neo-carousel-dots" aria-label="Paginación notas Neo">
                            {neoDayNotes.map((note, index) => (
                              <button
                                key={note.id}
                                className={`neo-dot ${index === neoDayNoteIndex ? 'active' : ''}`}
                                aria-label={`Ir a nota ${index + 1}`}
                                onClick={() => jumpToNeoNote(index)}
                              />
                            ))}
                          </div>
                        </>
                      ) : (
                        <p>{neoRecommendation.body || 'Sigue registrando comidas, peso y sensaciones del entreno. En cuanto haya más señal seguida, aquí te dejaré una recomendación clara y accionable.'}</p>
                      )}
                    </section>

                    <section className="dashboard-secondary-grid">
                      <div className="dashboard-mini-card">
                        <span>Progreso objetivo</span>
                        <strong>{weightRemaining != null ? `${weightRemaining.toFixed(1)} kg` : '—'}</strong>
                        <p>Lo que falta para llegar a {bodyMetrics.goalWeightKg ? `${bodyMetrics.goalWeightKg.toFixed(1)} kg` : 'tu objetivo'}.</p>
                      </div>
                      <div className="dashboard-mini-card">
                        <span>Mes actual</span>
                        <strong>{dashboardStats.sessionsDone} sesiones</strong>
                        <p>{dashboardStats.trainingDays} días con entreno planificado o completado.</p>
                      </div>
                    </section>

                    <details className="dashboard-details-card">
                      <summary>Ver métricas corporales</summary>
                      <div className="dashboard-details-grid">
                        <div className="dashboard-detail-item"><span>Peso actual</span><strong>{bodyMetrics.weightKg ? `${bodyMetrics.weightKg.toFixed(1)} kg` : '—'}</strong></div>
                        <div className="dashboard-detail-item"><span>Peso objetivo</span><strong>{bodyMetrics.goalWeightKg ? `${bodyMetrics.goalWeightKg.toFixed(1)} kg` : '—'}</strong></div>
                        <div className="dashboard-detail-item"><span>% grasa</span><strong>{bodyMetrics.bodyFatPct != null ? `${bodyMetrics.bodyFatPct.toFixed(1)} %` : '—'}</strong></div>
                        <div className="dashboard-detail-item"><span>IMC</span><strong>{bodyMetrics.bmi != null ? bodyMetrics.bmi.toFixed(2) : '—'}</strong></div>
                        <div className="dashboard-detail-item"><span>BMR</span><strong>{bodyMetrics.bmrKcal != null ? `${bodyMetrics.bmrKcal.toFixed(0)} kcal` : '—'}</strong></div>
                        <div className="dashboard-detail-item"><span>TDEE</span><strong>{bodyMetrics.tdeeKcal != null ? `${bodyMetrics.tdeeKcal.toFixed(0)} kcal` : '—'}</strong></div>
                      </div>
                      {bodyMetricsNote ? <p className="dashboard-details-note">{bodyMetricsNote}</p> : null}
                    </details>
                  </div>
                </article>
              </section>
            ) : null}

            {activeSection === 'stats' ? (
              <section className="stats-screen-stack">
                <article className="session-card glass stats-hero-card">
                  <div className="section-head compact no-margin">
                    <div>
                      <p className="tiny-label">Estadísticas</p>
                      <h3>{weeklyStats?.label || 'Últimos 7 días'}</h3>
                      <p className="refresh-status-inline">{refreshStatusText}</p>
                    </div>
                    <span className="tiny-chip">{weeklyStats?.startDate && weeklyStats?.endDate ? `${weeklyStats.startDate} → ${weeklyStats.endDate}` : `${weeklyStats?.days || 7} días`}</span>
                  </div>

                  <div className="stats-range-tabs" role="tablist" aria-label="Rango de estadísticas">
                    <button type="button" className={`stats-range-tab ${statsRange === 'last7' ? 'active' : ''}`} onClick={() => setStatsRange('last7')}>Últ. 7 días</button>
                    <button type="button" className={`stats-range-tab ${statsRange === 'this_week' ? 'active' : ''}`} onClick={() => setStatsRange('this_week')}>Esta semana</button>
                    <button type="button" className={`stats-range-tab ${statsRange === 'previous_week' ? 'active' : ''}`} onClick={() => setStatsRange('previous_week')}>Semana pasada</button>
                    <button type="button" className={`stats-range-tab ${statsRange === 'last30' ? 'active' : ''}`} onClick={() => setStatsRange('last30')}>30 días</button>
                  </div>

                  <div className="stats-kpi-grid">
                    <div className="stats-kpi-card">
                      <span>Adherencia</span>
                      <strong>{weeklyStats?.summary.adherencePct ?? 0}%</strong>
                      <p>{weeklyStats?.summary.completedDays ?? 0}/{weeklyStats?.summary.plannedDays ?? 0} entrenos</p>
                    </div>
                    <div className="stats-kpi-card">
                      <span>Peso</span>
                      <strong>{weeklyStats?.summary.currentWeightKg != null ? `${weeklyStats.summary.currentWeightKg.toFixed(1)} kg` : '—'}</strong>
                      <p>{describeWeightDelta(weeklyStats?.summary.weightDeltaKg ?? null)}</p>
                    </div>
                    <div className="stats-kpi-card">
                      <span>Proteína media</span>
                      <strong>{weeklyStats ? `${weeklyStats.summary.avgProtein.toFixed(0)} g` : '—'}</strong>
                      <p>media diaria</p>
                    </div>
                    <div className="stats-kpi-card">
                      <span>Kcal medias</span>
                      <strong>{weeklyStats ? `${weeklyStats.summary.avgCalories.toFixed(0)}` : '—'}</strong>
                      <p>por día con registro</p>
                    </div>
                  </div>
                </article>

                <section className="stats-donut-grid">
                  <article className="session-card glass stats-panel-card">
                    <div className="section-head compact no-margin">
                      <div>
                        <p className="tiny-label">Entreno</p>
                        <h3>Cumplimiento semanal</h3>
                      </div>
                    </div>
                    <div className="stats-donut-block">
                      <div className="stats-donut-wrap">
                        <svg viewBox="0 0 120 120" className="stats-donut">
                          <circle cx="60" cy="60" r="44" className="stats-donut-track" />
                          <circle cx="60" cy="60" r="44" className="stats-donut-progress stats-donut-progress-accent" style={{ strokeDasharray: `${2 * Math.PI * 44}`, strokeDashoffset: `${2 * Math.PI * 44 * (1 - ((weeklyStats?.summary.adherencePct ?? 0) / 100))}` }} />
                        </svg>
                        <div className="stats-donut-center">
                          <strong>{weeklyStats?.summary.adherencePct ?? 0}%</strong>
                          <span>{weeklyStats?.summary.completedDays ?? 0}/{weeklyStats?.summary.plannedDays ?? 0}</span>
                        </div>
                      </div>
                    </div>
                  </article>

                  <article className="session-card glass stats-panel-card">
                    <div className="section-head compact no-margin">
                      <div>
                        <p className="tiny-label">Macros</p>
                        <h3>Reparto semanal</h3>
                      </div>
                    </div>
                    <div className="stats-donut-block">
                      <svg viewBox="0 0 120 120" className="stats-donut">
                        <circle cx="60" cy="60" r="44" className="stats-donut-track" />
                        <circle cx="60" cy="60" r="44" className="stats-donut-progress stats-donut-protein" style={{ strokeDasharray: `${(macroTotalForStats ? (weeklyStats!.summary.macroTotals.protein / macroTotalForStats) : 0) * 2 * Math.PI * 44} ${2 * Math.PI * 44}` }} />
                        <circle cx="60" cy="60" r="44" className="stats-donut-progress stats-donut-carbs" style={{ strokeDasharray: `${(macroTotalForStats ? (weeklyStats!.summary.macroTotals.carbs / macroTotalForStats) : 0) * 2 * Math.PI * 44} ${2 * Math.PI * 44}`, strokeDashoffset: `${-(macroTotalForStats ? (weeklyStats!.summary.macroTotals.protein / macroTotalForStats) : 0) * 2 * Math.PI * 44}` }} />
                        <circle cx="60" cy="60" r="44" className="stats-donut-progress stats-donut-fat" style={{ strokeDasharray: `${(macroTotalForStats ? (weeklyStats!.summary.macroTotals.fat / macroTotalForStats) : 0) * 2 * Math.PI * 44} ${2 * Math.PI * 44}`, strokeDashoffset: `${-((macroTotalForStats ? (weeklyStats!.summary.macroTotals.protein / macroTotalForStats) : 0) + (macroTotalForStats ? (weeklyStats!.summary.macroTotals.carbs / macroTotalForStats) : 0)) * 2 * Math.PI * 44}` }} />
                      </svg>
                      <div className="stats-legend">
                        <span><i className="protein" />Prote {weeklyStats ? weeklyStats.summary.macroTotals.protein.toFixed(0) : '0'} g</span>
                        <span><i className="carbs" />Carbs {weeklyStats ? weeklyStats.summary.macroTotals.carbs.toFixed(0) : '0'} g</span>
                        <span><i className="fat" />Grasas {weeklyStats ? weeklyStats.summary.macroTotals.fat.toFixed(0) : '0'} g</span>
                      </div>
                    </div>
                  </article>
                </section>

                <article className="session-card glass stats-panel-card">
                  <div className="section-head compact no-margin">
                    <div>
                      <p className="tiny-label">Tendencias</p>
                      <h3>Calorías y proteína por día</h3>
                    </div>
                  </div>
                  <div className="stats-bar-grid">
                    {(weeklyStats?.daily || []).map((day) => (
                      <div key={day.date} className="stats-bar-col">
                        <div className="stats-bar-stack">
                          <div className="stats-calorie-bar" style={{ height: `${Math.max(10, (day.calories / calorieMaxForStats) * 140)}px` }} />
                          <div className="stats-protein-cap">{day.protein.toFixed(0)}g</div>
                        </div>
                        <strong>{day.calories.toFixed(0)}</strong>
                        <span>{formatShortStatsDate(day.date)}</span>
                      </div>
                    ))}
                  </div>
                </article>

                <section className="stats-bottom-grid">
                  <article className="session-card glass stats-panel-card">
                    <div className="section-head compact no-margin">
                      <div>
                        <p className="tiny-label">Peso</p>
                        <h3>Tendencia semanal</h3>
                      </div>
                    </div>
                    <div className="stats-weight-chart">
                      {weightPoints ? (
                        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                          <polyline fill="none" stroke="currentColor" strokeWidth="3" points={weightPoints} />
                        </svg>
                      ) : (
                        <p>Necesitamos más de una medición para pintar la curva.</p>
                      )}
                    </div>
                  </article>

                  <article className="session-card glass stats-panel-card">
                    <div className="section-head compact no-margin">
                      <div>
                        <p className="tiny-label">Lectura rápida</p>
                        <h3>Cómo vas</h3>
                      </div>
                    </div>
                    <div className="stats-reading-list">
                      <p>Entrenos completados: <strong>{weeklyStats?.summary.completedDays ?? 0}</strong> de <strong>{weeklyStats?.summary.plannedDays ?? 0}</strong>.</p>
                      <p>Nutrición registrada en <strong>{weeklyStats?.summary.trackedNutritionDays ?? 0}</strong> días.</p>
                      <p>Proteína media: <strong>{weeklyStats ? weeklyStats.summary.avgProtein.toFixed(0) : '0'} g</strong> y energía media: <strong>{weeklyStats?.summary.avgEnergy != null ? weeklyStats.summary.avgEnergy.toFixed(1) : '—'}</strong>.</p>
                      <p>Peso actual: <strong>{weeklyStats?.summary.currentWeightKg != null ? `${weeklyStats.summary.currentWeightKg.toFixed(1)} kg` : '—'}</strong> · {describeWeightDelta(weeklyStats?.summary.weightDeltaKg ?? null)}.</p>
                    </div>
                  </article>
                </section>
              </section>
            ) : null}

            {activeSection === 'day' ? (
              <section className="day-screen-stack">
                <article className="session-card glass day-header-card">
                  <div className="section-head compact day-header-top">
                    <button type="button" className="day-nav-arrow" aria-label="Ir al día anterior" onClick={() => shiftSelectedDay(-1)}>
                      ←
                    </button>
                    <div className="day-header-center">
                      <p className="tiny-label">Pantalla del día</p>
                      <h3>{trainingDate}</h3>
                      <p className="refresh-status-inline">{refreshStatusText}</p>
                    </div>
                    <button type="button" className="day-nav-arrow" aria-label="Ir al día siguiente" onClick={() => shiftSelectedDay(1)}>
                      →
                    </button>
                  </div>

                  <div className="session-overview">
                    <div>
                      <p className="tiny-label">Estado</p>
                      <h4>{selectedSummary.title}</h4>
                      <p>{selectedSummary.subtitle}</p>
                    </div>
                    <div className="energy-bubble">
                      <span>enfoque</span>
                      <strong>{currentSelectedDay.energy}</strong>
                    </div>
                  </div>
                </article>

                <div className="day-view-switch" role="tablist" aria-label="Cambiar vista del día">
                  <button
                    type="button"
                    className={`day-view-tab ${dayViewMode === 'summary' ? 'active' : ''}`}
                    onClick={() => setDayViewMode('summary')}
                  >
                    Resumen
                  </button>
                  <button
                    type="button"
                    className={`day-view-tab ${dayViewMode === 'training' ? 'active' : ''}`}
                    onClick={() => setDayViewMode('training')}
                  >
                    Entreno
                  </button>
                </div>

                {dayViewMode === 'training' ? (
                <article className="session-card glass">
                  <div className="section-head compact">
                    <div>
                      <p className="tiny-label">Entrenamiento</p>
                      <h3>Rutina del día</h3>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button className="tiny-action" onClick={refreshGhostsForDay} disabled={isRefreshingGhosts}>
                        {isRefreshingGhosts ? 'Actualizando…' : 'Actualizar fantasma'}
                      </button>
                      <button className="tiny-action" onClick={() => setActiveSection('dashboard')}>Volver al dashboard</button>
                    </div>
                  </div>

                  {warmupGuide ? (
                    <div className="warmup-card">
                      <div className="warmup-head">
                        <div>
                          <p className="tiny-label">Antes de empezar</p>
                          <h4>{warmupGuide.title}</h4>
                        </div>
                        <span className="warmup-duration">{warmupGuide.duration}</span>
                      </div>
                      <p className="warmup-note">{warmupGuide.note}</p>
                      <ol className="warmup-steps">
                        {warmupGuide.steps.map((step) => (
                          <li key={step}>{step}</li>
                        ))}
                      </ol>
                    </div>
                  ) : null}

                  <div className="exercise-list">
                    {exerciseForms.map((item, index) => {
                      const isSaved = Boolean(savedExercises[index]);
                      const cardToneClass = sessionCompleted ? 'exercise-card-complete' : (isSaved ? 'exercise-card-saved' : '');
                      const targetLine = item.exerciseType === 'cardio'
                        ? `${item.targetReps || 'Cardio libre'}${item.targetWeightKg ? ` · ${item.targetWeightKg} kg` : ''}`
                        : `${item.targetSets || '—'} series · ${item.targetReps || '—'} reps${item.targetWeightKg ? ` · ${item.targetWeightKg} kg` : ''}`;
                      const ghostLine = item.ghost
                        ? (item.exerciseType === 'cardio'
                            ? `${item.ghost.lastDurationMinutes ? `${item.ghost.lastDurationMinutes} min` : '—'}${item.ghost.lastDistanceKm ? ` · ${item.ghost.lastDistanceKm} km` : ''}${item.ghost.lastCaloriesBurned ? ` · ${item.ghost.lastCaloriesBurned} kcal` : ''}${item.ghost.lastDifficulty ? ` · Int ${item.ghost.lastDifficulty}` : ''}`
                            : `${item.ghost.lastWeightKg ? `${item.ghost.lastWeightKg} kg` : '—'}${item.ghost.lastReps ? ` · ${item.ghost.lastReps} reps` : ''}${item.ghost.lastSets ? ` · ${item.ghost.lastSets} series` : ''}${item.ghost.lastDifficulty ? ` · Dif ${item.ghost.lastDifficulty}` : ''}`)
                        : 'Sin referencia previa';
                      return (
                        <div key={index} className={`exercise-card ${cardToneClass}`}>
                          <div className="exercise-card-compact">
                            <div className="exercise-compact-content">
                              <div className="exercise-compact-toprow">
                                <div className="exercise-compact-heading">
                                  <strong className="exercise-title">{`${index + 1}. ${item.exerciseName || `Ejercicio ${index + 1}`}`}</strong>
                                </div>
                                <button className="ghost-button exercise-detail-button" onClick={() => openExerciseModal(index)}>
                                  Detalle
                                </button>
                              </div>

                              <div className="exercise-target-line">
                                <strong>{targetLine}</strong>
                              </div>

                              <div className="exercise-ghost-inline compact">
                                <span className="exercise-line-label">Última vez{item.ghost?.lastDate ? ` · ${formatGhostDate(item.ghost.lastDate)}` : ''}</span>
                                <strong>{ghostLine}</strong>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="training-bottom-actions">
                    <button className="ghost-button add-exercise-button" onClick={addExercise}>+ Añadir ejercicio</button>
                  </div>

                  <section className="training-closeout-editorial">
                    <div className="training-closeout-header">
                      <p className="tiny-label">Cierre del entreno</p>
                      <h4>Resumen final</h4>
                      <p className="training-closeout-intro">Guarda aquí duración, sensaciones y notas antes del cierre definitivo.</p>
                    </div>

                    <div className="session-form training-closeout-form">
                      <label><span>Duración (min)</span><input aria-label="Duración" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} inputMode="numeric" placeholder="45" /></label>
                      <label><span>Energía general (1-10)</span><input aria-label="Energía" value={perceivedEnergy} onChange={(e) => setPerceivedEnergy(e.target.value)} inputMode="numeric" placeholder="7" /></label>
                      <label><span>Esfuerzo global (1-10)</span><input aria-label="Esfuerzo global" value={perceivedEffort} onChange={(e) => setPerceivedEffort(e.target.value)} inputMode="numeric" placeholder="8" /></label>
                      <label className="full-field"><span>Notas / sensaciones</span><textarea aria-label="Notas de la sesión" value={sessionNotes} onChange={(e) => setSessionNotes(e.target.value)} placeholder="Cómo te sentiste, molestias, cardio extra, sensaciones generales..." /></label>
                    </div>

                    <div className="training-closeout-actions">
                      <button className="ghost-button training-closeout-save" onClick={saveCloseout} disabled={isSavingCloseout}>{isSavingCloseout ? 'Guardando...' : 'Guardar'}</button>
                    </div>

                    {sessionStatus ? <p className="session-status-message training-closeout-status">{sessionStatus}</p> : null}

                    <div className="training-final-submit">
                      <button className="primary-button full" onClick={completeSession} disabled={isCompleting}>{selectedSummary.cta}</button>
                    </div>
                  </section>
                </article>
                ) : (
                  <>
                    <article className="session-card glass nutrition-card">
                      <div className="day-neo-inline-card compact-day-note-card">
                        <div className="day-note-topbar">
                          <span className="tiny-chip">{neoDayNotes.length ? `${Math.min(neoDayNoteIndex + 1, neoDayNotes.length)}/${neoDayNotes.length}` : 'lectura viva'}</span>
                        </div>
                        {neoDayNotes.length > 0 ? (
                          <>
                            <div className="neo-carousel" ref={neoCarouselRef} onScroll={handleNeoCarouselScroll}>
                              {neoDayNotes.map((note) => (
                                <article key={note.id} className={`neo-carousel-card ${note.tone}`}>
                                  <div className="neo-carousel-card-head">
                                    <span className="neo-note-slot">{note.slotKey}</span>
                                    <span className="tiny-chip">{note.tone === 'good' ? 'bien' : note.tone === 'watch' ? 'ojo' : 'nota'}</span>
                                  </div>
                                  <h4>{note.title}</h4>
                                  <p>{note.body}</p>
                                </article>
                              ))}
                            </div>
                            <div className="neo-carousel-dots" aria-label="Paginación notas Neo">
                              {neoDayNotes.map((note, index) => (
                                <button
                                  key={note.id}
                                  className={`neo-dot ${index === neoDayNoteIndex ? 'active' : ''}`}
                                  aria-label={`Ir a nota ${index + 1}`}
                                  onClick={() => jumpToNeoNote(index)}
                                />
                              ))}
                            </div>
                          </>
                        ) : (
                          <p>{neoRecommendation.body || 'En cuanto haya suficiente señal útil del día, aquí verás una lectura rápida y accionable de Neo.'}</p>
                        )}
                      </div>
                    </article>

                    <article className="session-card glass nutrition-card">
                      <div className="section-head compact">
                        <div>
                          <p className="tiny-label">Nutrición</p>
                          <h3>Comidas del día</h3>
                        </div>
                        <span className="tiny-chip">Vista rápida</span>
                      </div>

                      <div className="nutrition-summary-grid">
                    <div className="nutrition-summary-tile">
                      <span>Consumidas</span>
                      <strong>{nutritionDay.consumedKcal.toFixed(0)} kcal</strong>
                      <p>Calorías registradas hoy.</p>
                    </div>
                    <div className="nutrition-summary-tile">
                      <span>Macros</span>
                      <strong>P {nutritionDay.protein.toFixed(1)} · C {nutritionDay.carbs.toFixed(1)} · G {nutritionDay.fat.toFixed(1)}</strong>
                      <p>Proteína, carbohidratos y grasas del día.</p>
                    </div>
                  </div>

                      {nutritionDay.meals.length ? (
                        <div className="meal-list">
                          {nutritionDay.meals.map((meal) => (
                            <button
                              type="button"
                              key={meal.id || `${meal.name}-${meal.time || 'na'}`}
                              className="meal-card meal-card-button"
                              onClick={() => setActiveMeal(meal)}
                            >
                              <div>
                                <strong>{meal.name}</strong>
                                <p>{meal.time || 'Hora pendiente'}</p>
                                <p className="meal-macros">
                                  P {meal.protein?.toFixed(1) || '0'} g · C {meal.carbs?.toFixed(1) || '0'} g · G {meal.fat?.toFixed(1) || '0'} g
                                </p>
                              </div>
                              <span>{meal.calories} kcal</span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="empty-nutrition-state">
                          <strong>Aún no hay comidas registradas</strong>
                          <p>Aquí añadiremos desayuno, comida, cena y snacks con sus calorías consumidas.</p>
                        </div>
                      )}
                    </article>
                  </>
                )}

                {dayViewMode === 'training' ? null : null}
              </section>
            ) : null}
          </>
        ) : null}

        <button className={`floating-timer-button ${timerVisualState}`} onClick={openTimerModal} aria-label="Abrir cronómetro de descanso">
          <span className="floating-timer-icon">⏱</span>
          <span className="floating-timer-text">{formatTime(restSecondsLeft)}</span>
        </button>

        {activeMeal ? (
          <div className="exercise-modal-backdrop" onClick={() => setActiveMeal(null)}>
            <div className="session-card glass exercise-modal" onClick={(event) => event.stopPropagation()}>
              <div className="exercise-modal-head">
                <div>
                  <p className="tiny-label">Detalle comida</p>
                  <h3>{activeMeal.name}</h3>
                </div>
                <button className="timer-close-button" onClick={() => setActiveMeal(null)} aria-label="Cerrar detalle comida">✕</button>
              </div>

              <div className="exercise-modal-summary glass">
                <span className="tiny-label">Resumen</span>
                <strong>{activeMeal.calories.toFixed(0)} kcal</strong>
                <p className="meal-detail-meta">
                  {activeMeal.mealType || 'Comida'}
                  {activeMeal.quantityText ? ` · ${activeMeal.quantityText}` : ''}
                </p>
              </div>

              <div className="meal-detail-grid">
                <div className="meal-detail-kpi">
                  <span>Proteína</span>
                  <strong>{(activeMeal.protein || 0).toFixed(1)} g</strong>
                </div>
                <div className="meal-detail-kpi">
                  <span>Carbs</span>
                  <strong>{(activeMeal.carbs || 0).toFixed(1)} g</strong>
                </div>
                <div className="meal-detail-kpi">
                  <span>Grasas</span>
                  <strong>{(activeMeal.fat || 0).toFixed(1)} g</strong>
                </div>
                <div className="meal-detail-kpi">
                  <span>Fibra</span>
                  <strong>{(activeMeal.fiber || 0).toFixed(1)} g</strong>
                </div>
              </div>

              {activeMeal.items.length ? (
                <div className="meal-breakdown-list">
                  {activeMeal.items.map((item, index) => (
                    <div className="meal-breakdown-item" key={`${item.name}-${index}`}>
                      <strong>{item.name}</strong>
                      {item.quantityText ? <p className="meal-item-quantity">{item.quantityText}</p> : null}
                      <p className="meal-item-macros">
                        {item.calories.toFixed(0)} kcal · P {(item.protein || 0).toFixed(1)} g · C {(item.carbs || 0).toFixed(1)} g · G {(item.fat || 0).toFixed(1)} g{item.fiber ? ` · Fibra ${item.fiber.toFixed(1)} g` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="meal-detail-meta">A esta comida aún no le hemos guardado desglose por alimento.</p>
              )}
            </div>
          </div>
        ) : null}

        {activeExerciseIndex != null && exerciseForms[activeExerciseIndex] ? (() => {
          const item = exerciseForms[activeExerciseIndex];
          const visual = item.exerciseName ? EXERCISE_VISUALS[item.exerciseName] : null;
          return (
            <div className="exercise-modal-backdrop" onClick={closeExerciseModal}>
              <div className="session-card glass exercise-modal" onClick={(e) => e.stopPropagation()}>
                <div className="exercise-modal-head">
                  <div>
                    <p className="tiny-label">Detalle ejercicio</p>
                    <h3>{item.exerciseName || `Ejercicio ${activeExerciseIndex + 1}`}</h3>
                  </div>
                  <button className="timer-close-button" onClick={closeExerciseModal} aria-label="Cerrar detalle ejercicio">✕</button>
                </div>

                <div className="exercise-modal-hero">
                  {visual ? (
                    <div className="exercise-modal-visual exercise-visual">
                      <img src={visual.imageUrl} alt={item.exerciseName || `Ejercicio ${activeExerciseIndex + 1}`} />
                    </div>
                  ) : (
                    <div className="exercise-modal-visual exercise-visual exercise-visual-placeholder">
                      <span>Ejercicio</span>
                    </div>
                  )}

                  <div className="exercise-modal-summary glass">
                    <span className="tiny-label">Objetivo</span>
                    <strong>
                      {item.exerciseType === 'cardio'
                        ? `${item.targetReps || 'Cardio libre'}${item.targetWeightKg ? ` · ${item.targetWeightKg} kg` : ''}`
                        : `${item.targetSets || '—'} series · ${item.targetReps || '—'} reps${item.targetWeightKg ? ` · ${item.targetWeightKg} kg` : ''}`}
                    </strong>
                    {item.ghost ? (
                      <p>
                        Última vez{item.ghost.lastDate ? ` · ${formatGhostDate(item.ghost.lastDate)}` : ''}:{' '}
                        {item.exerciseType === 'cardio'
                          ? `${item.ghost.lastDurationMinutes ? `${item.ghost.lastDurationMinutes} min` : '—'}${item.ghost.lastDistanceKm ? ` · ${item.ghost.lastDistanceKm} km` : ''}${item.ghost.lastCaloriesBurned ? ` · ${item.ghost.lastCaloriesBurned} kcal` : ''}${item.ghost.lastDifficulty ? ` · Int ${item.ghost.lastDifficulty}` : ''}`
                          : `${item.ghost.lastWeightKg ? `${item.ghost.lastWeightKg} kg` : '—'}${item.ghost.lastReps ? ` · ${item.ghost.lastReps} reps` : ''}${item.ghost.lastSets ? ` · ${item.ghost.lastSets} series` : ''}${item.ghost.lastDifficulty ? ` · Dif ${item.ghost.lastDifficulty}` : ''}`}
                      </p>
                    ) : (
                      <p>Sin referencia previa todavía.</p>
                    )}
                  </div>
                </div>

                {!item.exerciseName.trim() || item.isCustom ? (
                  <>
                    <div className="exercise-section-label">Configuración</div>
                    <div className="exercise-fields">
                      <label>
                        <span>Nombre</span>
                        <input aria-label={`Nombre ejercicio ${activeExerciseIndex + 1}`} value={item.exerciseName} onChange={(e) => updateExercise(activeExerciseIndex, { exerciseName: e.target.value })} placeholder="Ej. Elíptica" />
                      </label>
                      <label>
                        <span>Tipo</span>
                        <select aria-label={`Tipo ejercicio ${activeExerciseIndex + 1}`} value={item.exerciseType} onChange={(e) => updateExercise(activeExerciseIndex, { exerciseType: e.target.value as ExerciseType })}>
                          <option value="strength">Fuerza</option>
                          <option value="cardio">Cardio</option>
                          <option value="mobility">Movilidad</option>
                        </select>
                      </label>
                    </div>
                  </>
                ) : null}

                <div className="exercise-section-label">Resultado real</div>
                <div className="exercise-fields">
                  {item.exerciseType === 'cardio' ? (
                    <>
                      <label><span>Duración (min)</span><input aria-label={`Duración cardio ${activeExerciseIndex + 1}`} value={item.actualDurationMinutes} onChange={(e) => updateExercise(activeExerciseIndex, { actualDurationMinutes: e.target.value })} inputMode="numeric" placeholder="20" /></label>
                      <label><span>Distancia (km)</span><input aria-label={`Distancia cardio ${activeExerciseIndex + 1}`} value={item.actualDistanceKm} onChange={(e) => updateExercise(activeExerciseIndex, { actualDistanceKm: e.target.value })} inputMode="decimal" placeholder="3.5" /></label>
                      <label><span>Kcal quemadas</span><input aria-label={`Kcal cardio ${activeExerciseIndex + 1}`} value={item.actualCaloriesBurned} onChange={(e) => updateExercise(activeExerciseIndex, { actualCaloriesBurned: e.target.value })} inputMode="decimal" placeholder="220" /></label>
                    </>
                  ) : (
                    <>
                      <label><span>Series reales</span><input aria-label={`Series reales ${activeExerciseIndex + 1}`} value={item.actualSets} onChange={(e) => updateExercise(activeExerciseIndex, { actualSets: e.target.value })} inputMode="numeric" placeholder="3" /></label>
                      <label><span>Reps reales</span><input aria-label={`Reps reales ${activeExerciseIndex + 1}`} value={item.actualReps} onChange={(e) => updateExercise(activeExerciseIndex, { actualReps: e.target.value })} inputMode="numeric" placeholder="10" /></label>
                      <label><span>Peso real (kg)</span><input aria-label={`Peso real ${activeExerciseIndex + 1}`} value={item.weightKg} onChange={(e) => updateExercise(activeExerciseIndex, { weightKg: e.target.value })} inputMode="decimal" placeholder="25" /></label>
                    </>
                  )}
                  <div className="exercise-difficulty-field full-field">
                    <span>{item.exerciseType === 'cardio' ? 'Intensidad' : 'Dificultad'}</span>
                    <div className="difficulty-selector" role="group" aria-label={`${item.exerciseType === 'cardio' ? 'Intensidad' : 'Dificultad'} ${activeExerciseIndex + 1}`}>
                      {difficultyOptions.map((value) => (
                        <button
                          key={value}
                          type="button"
                          className={`difficulty-chip ${item.difficulty === value ? 'active' : ''}`}
                          aria-pressed={item.difficulty === value}
                          onClick={() => updateExercise(activeExerciseIndex, { difficulty: item.difficulty === value ? '' : value })}
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="full-field"><span>Notas</span><textarea aria-label={`Notas ejercicio ${activeExerciseIndex + 1}`} value={item.notes} onChange={(e) => updateExercise(activeExerciseIndex, { notes: e.target.value })} placeholder="Máquina, sensaciones, ajustes..." /></label>
                </div>

                <div className="exercise-card-footer exercise-modal-footer">
                  {canDeleteExercise(item) ? (
                    <button className="ghost-button exercise-delete-button" onClick={() => void deleteExercise(activeExerciseIndex)}>
                      Eliminar
                    </button>
                  ) : <span />}
                  <button className="ghost-button exercise-save-button" onClick={() => saveExercise(activeExerciseIndex)} disabled={savingExerciseIndex === activeExerciseIndex || !item.exerciseName.trim()}>
                    {savingExerciseIndex === activeExerciseIndex ? 'Guardando...' : 'Guardar y cerrar'}
                  </button>
                </div>
              </div>
            </div>
          );
        })() : null}

        {timerModalOpen ? (
          <div className="timer-modal-backdrop" onClick={closeTimerModal}>
            <div className={`session-card glass timer-card timer-modal ${timerVisualState}`} onClick={(e) => e.stopPropagation()}>
              <div className="timer-modal-head">
                <div>
                  <p className="tiny-label">Cronómetro descanso</p>
                </div>
                <button className="timer-close-button" onClick={closeTimerModal} aria-label="Cerrar cronómetro">✕</button>
              </div>

              <div className="timer-display-wrap compact">
                <div className={`timer-ring ${timerVisualState}`}>
                  <span>{formatTime(restSecondsLeft)}</span>
                </div>
                <p className="timer-caption">{timerStatusLabel}</p>
              </div>

              <div className="timer-native-picker-wrap compact">
                <label className="timer-native-picker-label">Duración</label>
                <div className="timer-quick-presets" role="group" aria-label="Presets rápidos de descanso">
                  <button type="button" className="ghost-button timer-chip-button" onClick={() => void setTimerPreset(30)} disabled={!timerReady}>30sg</button>
                  <button type="button" className="ghost-button timer-chip-button" onClick={() => void setTimerPreset(45)} disabled={!timerReady}>45sg</button>
                  <button type="button" className="ghost-button timer-chip-button" onClick={() => void setTimerPreset(60)} disabled={!timerReady}>1 min</button>
                  <button type="button" className="ghost-button timer-chip-button" onClick={() => void setTimerPreset(120)} disabled={!timerReady}>2 min</button>
                </div>
                <div className="timer-dual-picker">
                  <label>
                    <span>Min</span>
                    <input
                      className="timer-native-picker"
                      type="text"
                      inputMode="numeric"
                      value={timerMinutesInput}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setTimerMinutesInput(normalizeTimerInput(e.target.value, 59))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void applyTimerDraft();
                      }}
                    />
                  </label>
                  <label>
                    <span>Seg</span>
                    <input
                      className="timer-native-picker"
                      type="text"
                      inputMode="numeric"
                      value={timerSecondsInput}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setTimerSecondsInput(normalizeTimerInput(e.target.value, 59))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void applyTimerDraft();
                      }}
                    />
                  </label>
                </div>
              </div>

              <div className="timer-actions">
                <button className="ghost-button timer-secondary-button" onClick={() => void applyTimerDraft()} disabled={!timerReady}>Aplicar</button>
                <button className="primary-button timer-main-button" onClick={() => void toggleTimer()} disabled={!timerReady}>
                  {timerRunning ? 'Pausar' : restSecondsLeft === 0 ? 'Empezar otra vez' : 'Start'}
                </button>
                <button className="ghost-button timer-secondary-button" onClick={() => void resetTimer()} disabled={!timerReady}>Reset</button>
              </div>

            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
