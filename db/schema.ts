import {
  pgTable,
  serial,
  text,
  integer,
  real,
  boolean,
  timestamp,
  pgEnum,
} from 'drizzle-orm/pg-core';

export const recordTipoEnum = pgEnum('record_tipo', ['peso', 'distancia']);

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  email: text('email'),
  is_admin: boolean('is_admin').default(false),
  reset_token: text('reset_token'),
  reset_token_expires: timestamp('reset_token_expires'),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

export const semanas = pgTable('semanas', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id')
    .notNull()
    .references(() => users.id),
  anio: integer('anio').notNull(),
  semana_numero: integer('semana_numero').notNull(),
  foco: text('foco'),
  importada_at: timestamp('importada_at').defaultNow().notNull(),
});

export const sesiones = pgTable('sesiones', {
  id: serial('id').primaryKey(),
  semana_id: integer('semana_id')
    .notNull()
    .references(() => semanas.id),
  user_id: integer('user_id')
    .notNull()
    .references(() => users.id),
  fecha: text('fecha').notNull(),
  ejercicio: text('ejercicio').notNull(),
  categoria: text('categoria'),
  tipo: text('tipo'), // Fuerza | Running | Movilidad | Híbrido (per-day tag)
  series: integer('series'),
  reps: integer('reps'),
  peso_kg: real('peso_kg'),
  duracion_min: real('duracion_min'),
  distancia_km: real('distancia_km'),
  sensacion: integer('sensacion'),
  dolor: boolean('dolor').default(false),
  notas: text('notas'),
  orden: integer('orden').default(0),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

export const ejecuciones = pgTable('ejecuciones', {
  id: serial('id').primaryKey(),
  sesion_id: integer('sesion_id')
    .notNull()
    .references(() => sesiones.id),
  semana_id: integer('semana_id')
    .notNull()
    .references(() => semanas.id),
  user_id: integer('user_id')
    .notNull()
    .references(() => users.id),
  fecha: text('fecha').notNull(),
  ejercicio: text('ejercicio').notNull(),
  categoria: text('categoria'),
  tipo: text('tipo'), // mirrors sesion.tipo
  series: integer('series'),
  reps: integer('reps'),
  peso_kg: real('peso_kg'),
  duracion_min: real('duracion_min'),
  distancia_km: real('distancia_km'),
  sensacion: integer('sensacion'),
  dolor: boolean('dolor').default(false),
  notas: text('notas'),
  completado: boolean('completado').default(false),
  orden: integer('orden').default(0),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

export const records = pgTable('records', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id')
    .notNull()
    .references(() => users.id),
  ejercicio: text('ejercicio').notNull(),
  tipo: recordTipoEnum('tipo').notNull(),
  valor: real('valor').notNull(),
  fecha: text('fecha').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Semana = typeof semanas.$inferSelect;
export type NewSemana = typeof semanas.$inferInsert;
export type Sesion = typeof sesiones.$inferSelect;
export type NewSesion = typeof sesiones.$inferInsert;
export type Ejecucion = typeof ejecuciones.$inferSelect;
export type NewEjecucion = typeof ejecuciones.$inferInsert;
export type Record = typeof records.$inferSelect;
export type NewRecord = typeof records.$inferInsert;
