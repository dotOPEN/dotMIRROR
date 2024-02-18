/**
 * A module to communicate with Mastodon.
 * "TOKEN" should be added to (.)env with the Mastodon token value.
 * 
 * @file
 * @author AozoraDev
 * @todo Due to Bun's lack of compatibility with masto.js regarding Blob,
 *       the temporary solution used was to write the file to temp dir and then create Blob from the file.
 */

import WebP from "utils/webp";
import Realcugan from "utils/realcugan";
import { createRestAPIClient, type mastodon } from "masto";
import { dotMOE, RealCUGAN } from "consts";
import type { Post } from "types";

const client = createRestAPIClient({
    url: dotMOE.INSTANCE_URL,
    accessToken: Bun.env["TOKEN"]
});
const visibility = Bun.env["VISIBILITY"] as (mastodon.v1.StatusVisibility | undefined) || "public";

/**
 * Upload images to the Mastodon instance.
 * 
 * @param urls - An array containing the url to the file. Local file not supported rn.
 * @param provider - Provider of this images. Used for special treatment for certain providers.
 * @returns An array containing the IDs of attachments that have been uploaded. Can be empty if all images fetching are failed.
 */
export async function uploadImages(urls: string[], provider: string) {
    /** All uploaded images IDs */
    const attachments: string[] = [];
    
    for (const url of urls) {
        console.log(`Fetching ${url}...`);

        let img: ArrayBuffer | undefined;
        try {
            if (url.startsWith("file://")) {
                img = await Bun.file(new URL(url) as URL).arrayBuffer();
            } else {
                img = await fetch(url).then(res => res.arrayBuffer());
            }
        } catch (e) {
            console.error(e);
        }
        
        // Skip current if fetching Blob is failed or temp folder is failed to be created.
        if (!img) {
            console.warn(`Fetching attachment failed for url "${url}". Skipped!`);
            continue;
        }

        // Use Real-CUGAN for certains platform
        if (RealCUGAN.USE_CUGAN.includes(provider)) {
            try {
                console.log("Real-CUGAN executed!");
                img = await Realcugan(img);
            } catch (err) {
                console.error("Failed to execute Real-CUGAN: " + err);
                console.warn("Real-CUGAN execution is skipped!");
            }
        }

        const webp = new WebP(img, { quality: 100 });
        try {
            const metadata = await webp.getMetadata();
            /** @todo Resize image at the exact max image size */
            if (metadata.width && metadata.width > 3840) {
                webp.resize(2500);
                console.info(`Image have been resized!`);
            }

            console.log("Uploading image to Mastodon instance...");
            const file = await webp.executeToBunFile();

            const uploaded = await client.v2.media.create({
                file: new Blob([file])
            });

            console.log("Image uploaded with ID: " + uploaded.id);
            attachments.push(uploaded.id);
        } catch (e) {
            console.error(`Failed to upload the image: ${e}`);
        }

        webp.removeEncodedFile();
    }

    return attachments;
}

/**
 * Publish post to the Mastodon account
 * 
 * @param post - A post object
 * @returns Status object of the uploaded post
 * @throws {Error} The post failed to upload or the saved post has no attachments
 */
export async function publishPost(post: Post) {
    const attachments = await uploadImages(post.attachments, post.provider);
    if (!attachments.length) throw new Error("The post has no attachments");

    const splitedMessage = post.message.split("<>"); // Split the actual message and the suggestive reason
    let caption = splitedMessage[0];
    caption += "\n\n"; // 2 Newline

    // AOTM: Change "Posted By" to "Artist of the Month"
    // AOTM: And also change the author from uploader to artist
    if (post.links) {
        caption += `Artist of the Month (AOTM): [${post.author}](${post.author_link})`;
    } else {
        if (post.provider) {
            caption += `Posted by: [${post.author} (${post.provider})](${post.author_link})`;
        } else {
            caption += `Posted by: [${post.author}](${post.author_link})`;
        }
    }

    if (RealCUGAN.USE_CUGAN.includes(post.provider)) {
        caption += "\nUpscaled by: [Real-CUGAN](https://github.com/bilibili/ailab/tree/main/Real-CUGAN)"
    }

    // AOTM: Add artist's socmed to caption
    if (post.links) {
        // The key here is the artist's social media name and the value is the URL.
        const links = Object.entries(JSON.parse(post.links))
            .map(([key, value]) => `- [${key}](${value})`);
        
        caption += "\n" + links.join("\n");
    }

    caption += "\n\n"; // 2 Newline
    caption += dotMOE.TAGS;

    // AOTM: Add #aotm to post caption
    if (post.links) caption += " #aotm";

    console.log("Publishing post....");
    const flagMessage = (post.isExplicit)
        ? "⚠️ Flagged as suggestive. Reason: " + (splitedMessage[1] || "Idk, looks suggestive to me.")
        : null;
    const status = await client.v1.statuses.create({
        status: caption,
        visibility: visibility,
        mediaIds: attachments,
        spoilerText: flagMessage
    });

    return status;
}