import fs from 'node:fs';
import { createRequire } from 'node:module';
import { ensureDataDirectories } from '../config/paths.js';
const require = createRequire(import.meta.url);
export class RoutedDatabase {
    db = null;
    dbPath;
    isJsonFallback = false;
    jsonStore = {
        skills: {},
        environments: {},
        embeddings: {},
        meta: {},
    };
    constructor(customPath) {
        const paths = ensureDataDirectories();
        this.dbPath = customPath || paths.databasePath;
        this.initDatabase();
    }
    initDatabase() {
        try {
            const { DatabaseSync } = process.getBuiltinModule
                ? process.getBuiltinModule('node:sqlite')
                : (awaitImportSqlite());
            if (DatabaseSync) {
                this.db = new DatabaseSync(this.dbPath);
                this.initTables();
                return;
            }
        }
        catch {
        }
        this.initJsonFallback();
    }
    initTables() {
        if (!this.db)
            return;
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT
      );

      CREATE TABLE IF NOT EXISTS skills (
        path TEXT PRIMARY KEY,
        id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        source_host TEXT NOT NULL,
        aliases_json TEXT,
        keywords_json TEXT,
        tags_json TEXT,
        file_hash TEXT,
        modified_at INTEGER,
        body_preview TEXT
      );

      CREATE TABLE IF NOT EXISTS environments (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        detected INTEGER,
        skill_paths_json TEXT,
        last_scanned INTEGER
      );

      CREATE TABLE IF NOT EXISTS embeddings (
        skill_id TEXT PRIMARY KEY,
        vector_json TEXT NOT NULL,
        file_hash TEXT NOT NULL,
        model_name TEXT NOT NULL,
        embedded_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_skills_name ON skills(name);
      CREATE INDEX IF NOT EXISTS idx_skills_host ON skills(source_host);
    `);
        this.setMeta('schema_version', '2');
    }
    initJsonFallback() {
        this.isJsonFallback = true;
        const jsonPath = this.dbPath.endsWith('.db') ? this.dbPath.replace(/\.db$/, '.json') : `${this.dbPath}.json`;
        if (fs.existsSync(jsonPath)) {
            try {
                const raw = fs.readFileSync(jsonPath, 'utf-8');
                this.jsonStore = JSON.parse(raw);
            }
            catch {
            }
        }
    }
    saveJsonFallback() {
        if (!this.isJsonFallback)
            return;
        const jsonPath = this.dbPath.endsWith('.db') ? this.dbPath.replace(/\.db$/, '.json') : `${this.dbPath}.json`;
        fs.writeFileSync(jsonPath, JSON.stringify(this.jsonStore, null, 2), 'utf-8');
    }
    setMeta(key, value) {
        if (this.db) {
            const stmt = this.db.prepare(`
        INSERT INTO meta (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `);
            stmt.run(key, value);
        }
        else {
            this.jsonStore.meta[key] = value;
            this.saveJsonFallback();
        }
    }
    getMeta(key) {
        if (this.db) {
            const stmt = this.db.prepare(`SELECT value FROM meta WHERE key = ?`);
            const row = stmt.get(key);
            return row ? row.value : null;
        }
        return this.jsonStore.meta[key] || null;
    }
    upsertSkill(skill) {
        if (this.db) {
            const stmt = this.db.prepare(`
        INSERT INTO skills (
          id, name, description, path, source_host,
          aliases_json, keywords_json, tags_json,
          file_hash, modified_at, body_preview
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(path) DO UPDATE SET
          id = excluded.id,
          name = excluded.name,
          description = excluded.description,
          source_host = excluded.source_host,
          aliases_json = excluded.aliases_json,
          keywords_json = excluded.keywords_json,
          tags_json = excluded.tags_json,
          file_hash = excluded.file_hash,
          modified_at = excluded.modified_at,
          body_preview = excluded.body_preview
      `);
            stmt.run(skill.id, skill.name, skill.description, skill.path, skill.sourceHost, JSON.stringify(skill.aliases), JSON.stringify(skill.keywords), JSON.stringify(skill.tags), skill.fileHash, skill.modifiedAt, skill.bodyPreview);
        }
        else {
            this.jsonStore.skills[skill.path] = skill;
            this.saveJsonFallback();
        }
    }
    getAllSkills() {
        if (this.db) {
            const stmt = this.db.prepare(`SELECT * FROM skills ORDER BY name ASC`);
            const rows = stmt.all();
            return rows.map((row) => ({
                id: String(row.id),
                name: String(row.name),
                description: String(row.description || ''),
                path: String(row.path),
                sourceHost: String(row.source_host),
                aliases: JSON.parse(String(row.aliases_json || '[]')),
                keywords: JSON.parse(String(row.keywords_json || '[]')),
                tags: JSON.parse(String(row.tags_json || '[]')),
                fileHash: String(row.file_hash || ''),
                modifiedAt: Number(row.modified_at || 0),
                bodyPreview: String(row.body_preview || ''),
            }));
        }
        return Object.values(this.jsonStore.skills);
    }
    getSkillByPath(filePath) {
        if (this.db) {
            const stmt = this.db.prepare(`SELECT * FROM skills WHERE path = ?`);
            const row = stmt.get(filePath);
            if (!row)
                return null;
            return {
                id: String(row.id),
                name: String(row.name),
                description: String(row.description || ''),
                path: String(row.path),
                sourceHost: String(row.source_host),
                aliases: JSON.parse(String(row.aliases_json || '[]')),
                keywords: JSON.parse(String(row.keywords_json || '[]')),
                tags: JSON.parse(String(row.tags_json || '[]')),
                fileHash: String(row.file_hash || ''),
                modifiedAt: Number(row.modified_at || 0),
                bodyPreview: String(row.body_preview || ''),
            };
        }
        return this.jsonStore.skills[filePath] || null;
    }
    deleteSkillByPath(filePath) {
        const existing = this.getSkillByPath(filePath);
        if (!existing)
            return false;
        if (this.db) {
            this.db.prepare(`DELETE FROM skills WHERE path = ?`).run(filePath);
            this.db.prepare(`DELETE FROM embeddings WHERE skill_id = ?`).run(existing.id);
        }
        else {
            delete this.jsonStore.skills[filePath];
            delete this.jsonStore.embeddings[existing.id];
            this.saveJsonFallback();
        }
        return true;
    }
    removeMissingSkills(validPaths) {
        let removed = 0;
        if (this.db) {
            const all = this.getAllSkills();
            const deleteStmt = this.db.prepare(`DELETE FROM skills WHERE path = ?`);
            for (const skill of all) {
                if (!validPaths.has(skill.path)) {
                    deleteStmt.run(skill.path);
                    removed++;
                }
            }
        }
        else {
            for (const p of Object.keys(this.jsonStore.skills)) {
                if (!validPaths.has(p)) {
                    delete this.jsonStore.skills[p];
                    removed++;
                }
            }
            if (removed > 0)
                this.saveJsonFallback();
        }
        return removed;
    }
    saveEnvironments(environments) {
        if (this.db) {
            const stmt = this.db.prepare(`
        INSERT INTO environments (id, name, detected, skill_paths_json, last_scanned)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          detected = excluded.detected,
          skill_paths_json = excluded.skill_paths_json,
          last_scanned = excluded.last_scanned
      `);
            const now = Date.now();
            for (const env of environments) {
                stmt.run(env.id, env.name, env.detected ? 1 : 0, JSON.stringify(env.skillPaths), now);
            }
        }
        else {
            for (const env of environments) {
                this.jsonStore.environments[env.id] = env;
            }
            this.saveJsonFallback();
        }
    }
    getEnvironments() {
        if (this.db) {
            const stmt = this.db.prepare(`SELECT * FROM environments`);
            const rows = stmt.all();
            return rows.map((r) => ({
                id: String(r.id),
                name: String(r.name),
                detected: Boolean(r.detected),
                skillPaths: JSON.parse(String(r.skill_paths_json || '[]')),
                adapterSupported: true,
            }));
        }
        return Object.values(this.jsonStore.environments);
    }
    upsertEmbedding(embedding) {
        if (this.db) {
            const stmt = this.db.prepare(`
        INSERT INTO embeddings (skill_id, vector_json, file_hash, model_name, embedded_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(skill_id) DO UPDATE SET
          vector_json = excluded.vector_json,
          file_hash = excluded.file_hash,
          model_name = excluded.model_name,
          embedded_at = excluded.embedded_at
      `);
            stmt.run(embedding.skillId, JSON.stringify(embedding.vector), embedding.fileHash, embedding.modelName, embedding.embeddedAt);
        }
        else {
            this.jsonStore.embeddings[embedding.skillId] = embedding;
            this.saveJsonFallback();
        }
    }
    getEmbedding(skillId) {
        if (this.db) {
            const stmt = this.db.prepare(`SELECT * FROM embeddings WHERE skill_id = ?`);
            const row = stmt.get(skillId);
            if (!row)
                return null;
            return {
                skillId: String(row.skill_id),
                vector: JSON.parse(String(row.vector_json || '[]')),
                fileHash: String(row.file_hash),
                modelName: String(row.model_name),
                embeddedAt: Number(row.embedded_at),
            };
        }
        return this.jsonStore.embeddings[skillId] || null;
    }
    getAllEmbeddings() {
        if (this.db) {
            const stmt = this.db.prepare(`SELECT * FROM embeddings`);
            const rows = stmt.all();
            return rows.map((r) => ({
                skillId: String(r.skill_id),
                vector: JSON.parse(String(r.vector_json || '[]')),
                fileHash: String(r.file_hash),
                modelName: String(r.model_name),
                embeddedAt: Number(r.embedded_at),
            }));
        }
        return Object.values(this.jsonStore.embeddings);
    }
    removeMissingEmbeddings(validSkillIds) {
        let removed = 0;
        if (this.db) {
            const all = this.getAllEmbeddings();
            const deleteStmt = this.db.prepare(`DELETE FROM embeddings WHERE skill_id = ?`);
            for (const emb of all) {
                if (!validSkillIds.has(emb.skillId)) {
                    deleteStmt.run(emb.skillId);
                    removed++;
                }
            }
        }
        else {
            for (const id of Object.keys(this.jsonStore.embeddings)) {
                if (!validSkillIds.has(id)) {
                    delete this.jsonStore.embeddings[id];
                    removed++;
                }
            }
            if (removed > 0)
                this.saveJsonFallback();
        }
        return removed;
    }
    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }
}
function awaitImportSqlite() {
    try {
        return require('node:sqlite');
    }
    catch {
        throw new Error('node:sqlite not available');
    }
}
//# sourceMappingURL=database.js.map