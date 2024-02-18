/**
 * A module for handling database (SQLite).
 * The database file saved as database.db in root of the project
 * 
 * @file
 * @author AozoraDev
 */

import path from "path";
import { readdirSync } from "node:fs";
import { Database } from "bun:sqlite";
import type { Post, PostSQLite } from "types";

const db = new Database("database.db");
const users = new Database("users.db");

// Some initiation stuff if the database is empty //
// The SQL code below is version 1 but migration code will take care of new database format //
db.run(`
    CREATE TABLE IF NOT EXISTS Version (
        id INTEGER PRIMARY KEY,
        version INTEGER
    );
    INSERT OR IGNORE INTO Version (id, version) VALUES (1, 1);
`);
db.run(`
    CREATE TABLE IF NOT EXISTS Token (
        id VARCHAR(20) PRIMARY KEY,
        token VARCHAR(255)
    );

    CREATE TABLE IF NOT EXISTS DelayedPosts (
        post_id VARCHAR(50) PRIMARY KEY,
        author VARCHAR(50),
        author_link TEXT,
        message TEXT,
        attachments TEXT
    );

    CREATE TABLE IF NOT EXISTS BooruDelayedPosts (
        post_id VARCHAR(50) PRIMARY KEY,
        author VARCHAR(50),
        author_link TEXT,
        message TEXT,
        tags TEXT,
        isExplicit BOOLEAN,
        attachments TEXT
    );
`);
users.run(`
    CREATE TABLE IF NOT EXISTS users (
        email TEXT PRIMARY KEY,
        password_hash TEXT
    );
`);

/**
 * Get user detail from database
 * 
 * @param email - user email
 */
export function getUser(email: string) {
    return users.query("SELECT email, password_hash FROM users WHERE email = ?")
        .get(email) as { email: string, password_hash: string } | null;
}

/**
 * Add user to users database
 * 
 * @param email - New email
 * @param password - New password
 */
export function addUser(email: string, password: string) {
    users.query(`
        INSERT OR IGNORE INTO users (email, password_hash)
        VALUES (?, ?)`
    ).run(email, Bun.password.hashSync(password));
}

// Check migration before starting everything
const migrationsPath = path.join(process.cwd(), "db-migrations");
const migrationsFiles = readdirSync(migrationsPath);
migrationsFiles.sort();

const latestMigration = parseInt(migrationsFiles.at(-1) || "1");
if (getDBVersion() < latestMigration) {
    console.warn(`Database version is obselete (${getDBVersion()}). Will start migration now!`);

    // TODO:
    // Should be read the range between current db version and the latest migration file.
    // But since the migration file here is just one, i don't need to think about it for now.
    for (const migration of migrationsFiles) {
        console.log(`Executing ${migration}...`);

        const update = await import(path.join(migrationsPath, migration));
        update.default();
    }

    console.log(`Database updated to version ${getDBVersion()}!`);
}

/**
 * Get database version
 */
function getDBVersion() {
    const version = db.query("SELECT version FROM Version")
        .get() as { version: number }; // Will always have value

    return version.version;
}

/**
 * Save a post to the database
 * 
 * @param post - Post data object
 * @param isBooru - If this is true, the post will be saved in BooruDelayedPosts table
 */
export function savePost(post: Post, isBooru: boolean = false) {
    const table = (isBooru) ? "BooruDelayedPosts" : "DelayedPosts";
    const specialColumn = (isBooru) ? "isExplicit" : "links";

    db.prepare(
        `INSERT OR IGNORE INTO ${table}
        (post_id, author, author_link, message, attachments, ${specialColumn}, provider)
        VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
        post.post_id, // 1st column: post_id
        post.author, // 2nd column: author
        post.author_link, // 3rd column: author_link
        post.message, // 4th column: message
        JSON.stringify(post.attachments), // 5th column: attachments
        (isBooru) ? !!post.isExplicit : (post.links || null), // 6th column: isExplicit/links
        post.provider // 7th column: provider
    );
}

/**
 * Get the first post from the database.
 * It will prioritize AOTM post first and then default if AOTM posts not exist. 
 * 
 * @param isBooru - If this is true, it will try to get post from BooruDelayedPosts table
 * @return The first post from the table, `null` if not found
 */
export function getFirstPost(isBooru: boolean = false) {
    const table = (isBooru) ? "BooruDelayedPosts" : "DelayedPosts";
    const data = db.prepare(
        `SELECT * FROM ${table} 
        WHERE post_id LIKE '%aotm%' 
        OR NOT EXISTS (SELECT * FROM ${table} WHERE post_id LIKE '%aotm%')`
    ).get() as (PostSQLite & { id: number } | null);

    return data;
}

/**
 * Remove post from database
 * 
 * @param id - Post ID on database
 * @param isBooru - If this is true, it will try to remove post from BooruDelayedPosts table
 */
export function removePost(id: number, isBooru: boolean = false) {
    const table = (isBooru) ? "BooruDelayedPosts" : "DelayedPosts";
    db.prepare(`DELETE FROM ${table} WHERE id = ?`)
        .run(id);
}

/**
 * Check if the facebook post already exist in datababse
 * 
 * @param postID - The post id
 * @return `true` if the post already exists in the database, `false` if not.
 */
export function isFacebookPostExist(postID: string) {
    const post = db.prepare(
        `SELECT post_id FROM DelayedPosts WHERE post_id = ?`
    ).get(postID) as (string | null);

    return !!post;
}