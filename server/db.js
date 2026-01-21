import sqlite3 from 'sqlite3';
import {open} from 'sqlite';
import path from 'path';
import fs from 'fs-extra';
import {fileURLToPath} from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Determine Data Directory (Same logic as index.js)
let DATA_DIR = process.env.DATA_DIR || '/app/data';
try {
  fs.ensureDirSync(DATA_DIR);
  const testFile = path.join(DATA_DIR, '.test');
  fs.writeFileSync(testFile, 'test');
  fs.removeSync(testFile);
  console.log(`[DB] Using storage directory: ${DATA_DIR}`);
} catch (err) {
  DATA_DIR = path.join(process.cwd(), 'data', 'aidraw');
  fs.ensureDirSync(DATA_DIR);
  console.log(`[DB] Using storage directory: ${DATA_DIR}`);
}

const DB_FILE = path.join(DATA_DIR, 'database.sqlite');

// JSON File Paths for Migration
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');
const GROUPS_FILE = path.join(DATA_DIR, 'groups.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const EXAMPLE_PROJECTS_FILE = path.join(DATA_DIR, 'example-projects.json');
const VERSIONS_DIR = path.join(DATA_DIR, 'versions');

let db;

export async function initDB() {
  if (db) return db;

  console.log('[DB] Initializing database...');
  db = await open({
    filename: DB_FILE,
    driver: sqlite3.Database
  });

  // Enable WAL mode for better concurrency
  await db.exec('PRAGMA journal_mode = WAL;');

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE,
      password TEXT,
      role TEXT,
      nickname TEXT,
      access_password TEXT,
      ai_config TEXT,
      created_at TEXT,
      last_seen_at TEXT
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      title TEXT,
      engine_type TEXT,
      thumbnail TEXT,
      group_id TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      name TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS versions (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      content TEXT,
      change_summary TEXT,
      timestamp TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_versions_project_id ON versions(project_id);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS example_projects (
      id TEXT PRIMARY KEY,
      title TEXT,
      engine_type TEXT,
      content TEXT,
      thumbnail TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS local_users (
      id TEXT PRIMARY KEY,
      ip_address TEXT,
      first_seen_at TEXT,
      last_seen_at TEXT
    );

    CREATE TABLE IF NOT EXISTS ai_chat_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      user_type TEXT, -- 'cloud' or 'local'
      model_name TEXT,
      ip_address TEXT,
      timestamp TEXT,
      details TEXT -- JSON string with more info if needed
    );

    CREATE TABLE IF NOT EXISTS file_creation_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      user_type TEXT, -- 'cloud' or 'local'
      file_id TEXT,
      file_title TEXT,
      ip_address TEXT,
      timestamp TEXT
    );
  `);

  await migrateData();

  // Add last_seen_at column if it doesn't exist
  try {
    await db.exec('ALTER TABLE users ADD COLUMN last_seen_at TEXT');
    console.log('[DB] Added last_seen_at column to users table');
  } catch (e) {
    // Column already exists, ignore error
  }

  return db;
}

async function migrateData() {
  // 1. Users
  if (await fs.pathExists(USERS_FILE)) {
    console.log('[DB] Migrating users from JSON...');
    try {
      const users = await fs.readJson(USERS_FILE);
      for (const user of users) {
        await db.run(
          `INSERT OR IGNORE INTO users (id, username, password, role, nickname, access_password, ai_config, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            user.id,
            user.username,
            user.password,
            user.role,
            user.nickname,
            user.accessPassword,
            JSON.stringify(user.aiConfig || {}),
            user.createdAt
          ]
        );
      }
      await fs.move(USERS_FILE, `${USERS_FILE}.bak`);
      console.log('[DB] Users migration completed.');
    } catch (e) {
      console.error('[DB] Failed to migrate users:', e);
    }
  }

  // 2. Groups
  if (await fs.pathExists(GROUPS_FILE)) {
    console.log('[DB] Migrating groups from JSON...');
    try {
      const groups = await fs.readJson(GROUPS_FILE);
      for (const group of groups) {
        await db.run(
          `INSERT OR IGNORE INTO groups (id, user_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
          [group.id, group.userId, group.name, group.createdAt, group.updatedAt]
        );
      }
      await fs.move(GROUPS_FILE, `${GROUPS_FILE}.bak`);
      console.log('[DB] Groups migration completed.');
    } catch (e) {
      console.error('[DB] Failed to migrate groups:', e);
    }
  }

  // 3. Projects
  if (await fs.pathExists(PROJECTS_FILE)) {
    console.log('[DB] Migrating projects from JSON...');
    try {
      const projects = await fs.readJson(PROJECTS_FILE);
      for (const project of projects) {
        await db.run(
          `INSERT OR IGNORE INTO projects (id, user_id, title, engine_type, thumbnail, group_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            project.id,
            project.userId,
            project.title,
            project.engineType,
            project.thumbnail,
            project.groupId,
            project.createdAt,
            project.updatedAt
          ]
        );
      }
      await fs.move(PROJECTS_FILE, `${PROJECTS_FILE}.bak`);
      console.log('[DB] Projects migration completed.');
    } catch (e) {
      console.error('[DB] Failed to migrate projects:', e);
    }
  }

  // 4. Settings
  if (await fs.pathExists(SETTINGS_FILE)) {
    console.log('[DB] Migrating settings from JSON...');
    try {
      const settings = await fs.readJson(SETTINGS_FILE);
      await db.run(
        `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
        ['main', JSON.stringify(settings)]
      );
      await fs.move(SETTINGS_FILE, `${SETTINGS_FILE}.bak`);
      console.log('[DB] Settings migration completed.');
    } catch (e) {
      console.error('[DB] Failed to migrate settings:', e);
    }
  }

  // 5. Example Projects
  if (await fs.pathExists(EXAMPLE_PROJECTS_FILE)) {
    console.log('[DB] Migrating example projects from JSON...');
    try {
      const examples = await fs.readJson(EXAMPLE_PROJECTS_FILE);
      for (const ex of examples) {
        await db.run(
          `INSERT OR IGNORE INTO example_projects (id, title, engine_type, content, thumbnail, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [ex.id, ex.title, ex.engineType, ex.content, ex.thumbnail, ex.createdAt, ex.updatedAt]
        );
      }
      await fs.move(EXAMPLE_PROJECTS_FILE, `${EXAMPLE_PROJECTS_FILE}.bak`);
      console.log('[DB] Example projects migration completed.');
    } catch (e) {
      console.error('[DB] Failed to migrate example projects:', e);
    }
  }

  // 6. Versions
  if (await fs.pathExists(VERSIONS_DIR)) {
    console.log('[DB] Migrating versions from JSON...');
    try {
      const files = await fs.readdir(VERSIONS_DIR);
      let count = 0;
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(VERSIONS_DIR, file);
          try {
            const versions = await fs.readJson(filePath);
            for (const v of versions) {
               await db.run(
                `INSERT OR IGNORE INTO versions (id, project_id, content, change_summary, timestamp) VALUES (?, ?, ?, ?, ?)`,
                [v.id, v.projectId, v.content, v.changeSummary, v.timestamp]
              );
            }
            await fs.move(filePath, `${filePath}.bak`);
            count++;
          } catch (e) {
            console.error(`[DB] Failed to migrate version file ${file}:`, e);
          }
        }
      }
      console.log(`[DB] Versions migration completed. Migrated ${count} files.`);
    } catch (e) {
      console.error('[DB] Failed to migrate versions:', e);
    }
  }
}

export function getDB() {
  if (!db) throw new Error('Database not initialized');
  return db;
}

