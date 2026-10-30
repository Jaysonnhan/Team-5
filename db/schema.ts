import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const projects = sqliteTable('projects', {
 id: text('id').primaryKey(), ownerId: text('owner_id').notNull(), document: text('document').notNull(),
 version: integer('version').notNull().default(1), published: integer('published').notNull().default(0),
 createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(),
}, t=>[uniqueIndex('projects_owner').on(t.ownerId),index('projects_public').on(t.published,t.updatedAt)]);
export const files = sqliteTable('files', {
 id: text('id').primaryKey(), projectId: text('project_id').notNull().references(()=>projects.id),
 kind: text('kind').notNull(), day: integer('day'), name: text('name').notNull(), type: text('type').notNull(),
 size: integer('size').notNull(), objectKey: text('object_key').notNull(), createdAt: text('created_at').notNull(),
},t=>[index('files_project').on(t.projectId)]);
