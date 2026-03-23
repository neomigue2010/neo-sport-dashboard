# Neo Sport Dashboard

MVP visual mobile-first para una futura app de entrenamiento conectada con Neo.

## Qué incluye
- Calendario navegable (estructura visual)
- Tarjeta de sesión del día
- Espacios UX para ejercicios, pesos, repeticiones y dificultad
- Tema dark / light
- Diseño mobile-first orientado a uso real desde el gimnasio

## Próximos pasos
- Persistencia real de sesiones
- Rutinas dinámicas
- Cierre de sesión + análisis de Neo
- Historial por ejercicio


## Base de datos (VPS)
- Motor: PostgreSQL 16
- Esquema SQL: `db/schema.sql`
- Variables de entorno: `.env.example`
- Health endpoint (si `DATABASE_URL` está configurada): `/api/health/db`
