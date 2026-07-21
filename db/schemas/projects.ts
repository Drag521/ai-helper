import { pgTable, serial, text, timestamp, varchar, integer } from 'drizzle-orm/pg-core'

export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  path: varchar('path', { length: 512 }).notNull().unique(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
})

export const logs = pgTable('logs', {
  id: serial('id').primaryKey(),
  project_id: integer('project_id').references(() => projects.id),
  command: text('command').notNull(),
  stdout: text('stdout'),
  stderr: text('stderr'),
  exit_code: integer('exit_code'),
  duration_ms: integer('duration_ms'),
  created_at: timestamp('created_at').defaultNow().notNull(),
})

export const scripts = pgTable('scripts', {
  id: serial('id').primaryKey(),
  project_id: integer('project_id').references(() => projects.id),
  name: varchar('name', { length: 255 }).notNull(),
  content: text('content').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
})
