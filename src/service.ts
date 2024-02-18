#!/usr/bin/env bun

/**
 * This is a script to run the posting function to Mastodon.
 * Each post stored in the database will be posted at a certain interval.
 * Please pay attention to the rules of each instance before determining the posting interval.
 * The script needs to be run using cronjob.
 * 
 * @file
 * @author AozoraDev
 */

import { publishPost } from "mastodon";
import { dotMOE } from "consts";
import { getFirstPost, removePost } from "utils/db";
import type { Post } from "types";
import "utils/console";

let currentTries = 0;

async function main() {
    let isBooru = false; // tell the removePost which table will it use 
    let post = getFirstPost();

    // Try booru table if default table is empty
    if (!post) {
        isBooru = true;
        post = getFirstPost(isBooru);
    }
    // If still empty, just exit already
    if (!post) process.exit(0);

    const resolved: Post = {
        ...post,
        attachments: JSON.parse(post.attachments)
    }

    try {
        console.log(`Publishing post from ${post.author}...`);
        const status = await publishPost(resolved);
        console.log(`Published with id ${status.id}!`);
        removePost(post.id, isBooru);
    } catch (err) {
        console.error(err);

        currentTries++;
        if (currentTries >= dotMOE.MAX_TRIES) {
            console.error("Publishing failed and has reached the try limit. Execution will be stopped.");
        } else {
            console.error("Publishing failed. Will skipping this one and try with another post.");
            removePost(post.id, isBooru);
            return main();
        }
    }

    // Sometimes the process doesn't exit even after execution
    process.exit(0);
}

main();