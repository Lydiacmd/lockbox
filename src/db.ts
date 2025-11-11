import * as SQLite from 'expo-sqlite';
import { DocumentEntry, CreateDocumentParams } from './types';

/**
 * Gestion SQlite des metadonnées des documents
 */

let db: SQLite.SQLiteDatabase | null = null;

// Initialisation de la base de données et création des tables si nécessaire
// reourns: Promise<void> (rien)
export async function initDatabase(): Promise<void> {
    try {
        // ouverir/creer de la base de données
        db = await SQLite.openDatabaseAsync('lockbox.db');

        await db.execAsync(`
            CREATE TABLE IF NOT EXISTS entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                filename TEXT NOT NULL UNIQUE,
                mime TEXT NOT NULL,
                nonce TEXT NOT NULL,
                category TEXT,
                created_at INTEGER NOT NULL,
                size INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_date ON entries (created_at);
            CREATE INDEX IF NOT EXISTS idx_cat ON entries (category);
        `);

        console.log('Base de données initialisée');
    } catch (error) {
        console.error('!! Erreur initialisation base de données:', error);
        throw error;
    }   
}


// Verifier que la base de données est initialisée
function checkDb(): SQLite.SQLiteDatabase {
    if (!db) {
        throw new Error('Base de données non initialisée. Appelez initDatabase() d\'abord.');
    }
    return db;
}

// Ajouter une nouveau document en DB
export async function insertDocument(params: CreateDocumentParams): Promise<number> {
    const database = checkDb();
    try {
        const result = await database.runAsync(
            'INSERT INTO entries (title, filename, mime, nonce, category, created_at, size) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
                params.title,
                params.filename,
                params.mime,
                params.nonce,
                params.category || null,
                Date.now(),
                params.size
            ]
        );
        console.log(`Document inséré avec ID:, ${result.lastInsertRowId}`);
        return result.lastInsertRowId;
    } catch (error) {
        console.error('!! Erreur insertion document:', error);
        throw error;
    }
}

    
// Récupérer la liste des documents (plus recents en 1er)
export async function getAllDocuments(): Promise<DocumentEntry[]> {
    const database = checkDb();
    try {
        const results = await database.getAllAsync<DocumentEntry>(
            'SELECT * FROM entries ORDER BY created_at DESC'
        );
        return results;
    } catch (error) {
        console.error('!! Erreur récupération documents:', error);
        throw error;
    }
}

// Récupérer un document par son ID
export async function getDocumentById(id: number): Promise<DocumentEntry | null> {
    const database = checkDb();
    try {
        const result = await database.getFirstAsync<DocumentEntry>(
            'SELECT * FROM entries WHERE id = ?',
            [id]
        );
        return result || null;
    } catch (error) {
        console.error('!! Erreur récupération document par ID:', error);
        throw error;
    }
}

// Recupérer un document par categorie
export async function getDocumentsByCategory(category: string): Promise<DocumentEntry[]> {
    const database = checkDb();
    try {
        const results = await database.getAllAsync<DocumentEntry>(
            'SELECT * FROM entries WHERE category = ? ORDER BY created_at DESC',
            [category]
        );
        return results;
    } catch (error) {
        console.error('!! Erreur récupération documents par catégorie:', error);
        throw error;
    }
}

// Changer le titre d'un document
export async function updateDocumentTitle(id: number, newTitle: string): Promise<void> {
    const database = checkDb();
    try {
        await database.runAsync(
            'UPDATE entries SET title = ? WHERE id = ?',
            [newTitle, id]
        );
        console.log(`Titre du document ID ${id} mis à jour`);
    } catch (error) {
        console.error('!! Erreur mise à jour titre document:', error);
        throw error;
    }
}

// Changer la catégorie d'un document
export async function updateDocumentCategory(id: number, category: string | null): Promise<void> {
    const database = checkDb();
    try {
        await database.runAsync(
            'UPDATE entries SET category = ? WHERE id = ?',
            [category, id]
        );
        console.log(`Catégorie du document ID ${id} mise à jour`);
    } catch (error) {
        console.error('!! Erreur mise à jour catégorie document:', error);
        throw error;
    }
}

// Supprimer un document de la base de données
export async function deleteDocument(id: number): Promise<void> {
    const database = checkDb();
    try {
        await database.runAsync(
            'DELETE FROM entries WHERE id = ?',
            [id]
        );
        console.log(`Document ID ${id} supprimé de la base de données`);
    } catch (error) {
        console.error('!! Erreur suppression document:', error);
        throw error;
    }
}

// Rechercher des documents par titres
export async function searchDocuments(query: string): Promise<DocumentEntry[]> {
    const database = checkDb();
    try {
        const results = await database.getAllAsync<DocumentEntry>(
            'SELECT * FROM entries WHERE title LIKE ? ORDER BY created_at DESC',
            [`%${query}%`]
        );
        return results;
    } catch (error) {
        console.error('!! Erreur recherche documents:', error);
        throw error;
    }
}

// Compter le nombre total de documents
export async function getDocumentCount(): Promise<number> {
    const database = checkDb();
    try {
        const result = await database.getFirstAsync<{ count: number }>(
            'SELECT COUNT(*) as count FROM entries'
        );
        return result?.count || 0;
    } catch (error) {
        console.error('!! Erreur comptage documents:', error);
        throw error;
    }
}

// !!! Vider la base de données (supprimer tous les documents) 
export async function clearDatabase(): Promise<void> {
    const database = checkDb();
    try {
        await database.runAsync('DELETE FROM entries');
        console.log('Base de données vidée (tous les documents supprimés)');
    } catch (error) {
        console.error('!! Erreur vidage base de données:', error);
        throw error;
    }
}

// Fermer la base de données
export async function closeDatabase(): Promise<void> {
    if (db) {
        await db.closeAsync();
        db = null;
        console.log('Base de données fermée');
    }
}
