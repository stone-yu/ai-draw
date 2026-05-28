import Dexie, {type EntityTable} from 'dexie';
import type {Group, Project, StoredChatMessage, VersionHistory} from '@/types';

interface Config {
  key: string;
  value: any;
}

const db = new Dexie('AiDrawDatabase') as Dexie & {
  projects: EntityTable<Project, 'id'>;
  groups: EntityTable<Group, 'id'>;
  versions: EntityTable<VersionHistory, 'id'>;
  configs: EntityTable<Config, 'key'>;
  chatMessages: EntityTable<StoredChatMessage, 'id'>;
};

db.version(1).stores({
  projects: 'id, title, engineType, groupId, createdAt, updatedAt',
  groups: 'id, name, createdAt, updatedAt',
  versions: 'id, projectId, timestamp',
  configs: 'key'
});

// v2: index styleVariant on projects for the html engine (no data migration
// needed — the field is optional and old rows simply have it undefined).
db.version(2).stores({
  projects: 'id, title, engineType, styleVariant, groupId, createdAt, updatedAt',
  groups: 'id, name, createdAt, updatedAt',
  versions: 'id, projectId, timestamp',
  configs: 'key'
  chatMessages: 'id, projectId, timestamp, [projectId+timestamp]'
});

export { db };

