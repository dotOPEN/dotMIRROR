/**
 * This is a module for handling Facebook, containing utilities and shits.
 * 
 * @file
 * @author AozoraDev
 */
import type { WebhookChanges } from "types";

/**
 * Resolve Facebook images to get (hopefully) high-quality images.
 * 
 * @param post - Post object from webhook
 * @returns URLs of resolved images
 */
export async function resolveImages(post: WebhookChanges) {
    const resolved: string[] = [];

    // Multiple photos
    if (post.value.item == "status" && post.value.photos) {
        for (let i = 0; i < 4; i++) { // Limit images to 4
            const photo: (string | undefined) = post.value.photos[i];
            if (photo) resolved.push(photo);
        }
    }

    // Single photo
    else if (post.value.item == "photo" && post.value.photo_id) {
        resolved.push(post.value.link);
    }

    return resolved;
}

/**
 * Validate which post parameters must be present before saving to the database.
 * 
 * @param post - Post object from webhook
 * @returns `true` if post object is passed validation, `false` if otherwise.
 */
export function postValidation(post: WebhookChanges) {
    /** URL validation regex */
    const regex = /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)/g;

    /** The data must be of type post */
    const isValidField: boolean = post.field === "feed" || !!post.value.post_id;
    /** The message must have url in it*/
    const isValidMessage: boolean = !!String(post.value.message).match(regex);
    const isValidAttachments: boolean = !!(post.value.photos || post.value.photo_id);

    return isValidField && isValidMessage && isValidAttachments;
}