/**
 * Database Version 2
 * 
 * * Summary *
 * On Saturday May 18 2024, there's a weirdy bug where db.ts failed to delete the the post from db after fetching.
 * This happens because sometimes, post_id value can be null even when the column is PRIMARY KEY.
 * It makes the code failed to delete the post from database because the code cannot find the post_id to remove.
 * As a result, everytime service.ts executed, it just posting the same post again and again.
 * 
 * * Solution *
 * This migration will create new column as primary (ROWID) and dropping post_id as primary.
 * db.ts is also modified to delete from ROWID instead of post_id.
 * Also, i'm adding "provider" column for saving provider's name for the future need.
 */

import { Database } from "bun:sqlite";
const db = new Database("database.db");

export default function() {
    db.run(
        `CREATE TABLE IF NOT EXISTS DelayedPosts_new (
            id INTEGER NOT NULL PRIMARY KEY,
            post_id TEXT,
            author TEXT,
            author_link TEXT,
            message TEXT,
            attachments TEXT,
            provider TEXT
        );
        INSERT INTO DelayedPosts_new (
            post_id,
            author,
            author_link,
            message,
            attachments
        )
        SELECT post_id, author, author_link, message, attachments
        FROM DelayedPosts;
        DROP TABLE DelayedPosts;
        ALTER TABLE DelayedPosts_new RENAME TO DelayedPosts;`
    );

    // Booru Delayed Posts
    db.run(
        `CREATE TABLE IF NOT EXISTS BooruDelayedPosts_new (
            id INTEGER NOT NULL PRIMARY KEY,
            post_id TEXT,
            author TEXT,
            author_link TEXT,
            message TEXT,
            attachments TEXT,
            isExplicit BOOLEAN,
            provider TEXT
        );
        INSERT INTO BooruDelayedPosts_new (
            post_id,
            author,
            author_link,
            message,
            attachments,
            isExplicit
        )
        SELECT post_id, author, author_link, message, attachments, isExplicit
        FROM BooruDelayedPosts;
        DROP TABLE BooruDelayedPosts;
        ALTER TABLE BooruDelayedPosts_new RENAME TO BooruDelayedPosts;`
    );

    // Update version to 2
    db.prepare("UPDATE Version SET version=? WHERE id=1")
        .run(2);
}