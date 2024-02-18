import { XMLParser } from "fast-xml-parser";

export default [{
    name: "Safebooru",
    async fetch() {
        try {
            const tags = [
                "-rating:explicit",
                "-*boy*",
                "-*gundam*",
                "-mecha",
                "-ass",
                "-no_humans"
            ];

            const page = Math.floor(Math.random() * 8000);
            const booru = await fetch(`https://safebooru.org/index.php?&page=dapi&s=post&q=index&pid=${page}&limit=20&tags=${tags.join("+")}`)
                .then(res => res.text());
            
            // Do XML convert
            const parser = new XMLParser({
                allowBooleanAttributes: true,
                parseAttributeValue: true,
                ignoreAttributes : false,
                attributeNamePrefix: ""
            });
            const data: { posts?: { post: ISafebooru[] } } = parser.parse(booru);

            // Sometimes when Safebootu overload, it didn't return anything.
            if (!data.posts) throw new Error("Server overload!");

            const shuffled: IBooruData[] = [];
            for (const ele of data.posts.post) {
                const post_id = ele.id || ele.parent_id;
                // Skip if post id not found or has blocked URL
                if (isSourceHasBlockedURL(ele.source) || !post_id) continue;

                shuffled.push({
                    post_id: String(post_id),
                    author: "Safebooru",
                    author_link: "https://safebooru.org/",
                    message: (notAcceptedSource(ele.source)) 
                        ? ele.source 
                        : `https://safebooru.org/index.php?page=post&s=view&id=${post_id}`,
                    sample: ele.sample_url,
                    smaller_sample: ele.preview_url,
                    attachments: [ele.file_url],
                    provider: null,
                    width: ele.width,
                    height: ele.height,
                    pid: page
                });
            }
            shuffle(shuffled); // Shuffle

            return shuffled;
        } catch (e) {
            let error = "Failed to proceed.";
            if (e instanceof Error) {
                error = e.message;
            }

            return { error };
        }
    }
},
{
    name: "Konachan",
    async fetch() {
        try {
            const page = Math.floor(Math.random() * 8000);
            const data = await fetch(`https://konachan.net/post.json?limit=20&page=${page}&tags=rating:s`)
                .then(res => res.json()) as IKonachan[];

            // Sometimes when Konachan overload, it didn't return anything.
            if (!data) throw new Error("Server overload!");

            const shuffled: IBooruData[] = [];
            for (const ele of data) {
                const post_id = ele.id || ele.parent_id;
                // Skip if post id not found or has blocked URL
                if (isSourceHasBlockedURL(ele.source) || !post_id) continue;

                shuffled.push({
                    post_id: String(post_id),
                    author: ele.author,
                    author_link: `https://konachan.net/user/show/${ele.creator_id}`,
                    message: (notAcceptedSource(ele.source))
                        ? ele.source
                        : `https://konachan.net/post/show/${post_id}`,
                    sample: ele.sample_url,
                    smaller_sample: ele.preview_url,
                    attachments: [ele.file_url],
                    provider: "Konachan",
                    width: ele.width,
                    height: ele.height,
                    pid: page
                });
            }
            shuffle(shuffled); // Shuffle

            return shuffled;
        } catch (e) {
            let error = "Failed to proceed.";
            if (e instanceof Error) {
                error = e.message;
            }

            return { error };
        }
    }
}];

/**
 * Shuffle values of array
 * 
 * @param arr - Array to shuffle
 */
export function shuffle(arr: Array<any>) {
    for (let i = arr.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        let k = arr[i];
        arr[i] = arr[j];
        arr[j] = k;
    }
}

/**
 * Check if the source link is legit.
 * For example, not having extension at the end.
 * 
 * @param source - The source link
 */
function notAcceptedSource(source: string) {
    return !(!source
        || source.includes(".jpg")
        || source.includes(".jpeg")
        || source.includes(".png")
    )
}

/**
 * Check if the source has some inappropriate url or just not having url
 * 
 * @param source - The source link
 * @todo i'll update this later
 */
function isSourceHasBlockedURL(source: string) {
    return !(
        source.startsWith("http") ||
        source.startsWith("www")
    )
}

interface ISafebooru {
    height: number,
    score: number,
    file_url: string,
    parent_id: string,
    sample_url: string,
    sample_width: number,
    sample_height: number,
    preview_url: string,
    rating: "s" | "q" | "e",
    tags: string,
    id: number,
    width: number,
    change: number,
    md5: string,
    creator_id: number,
    has_children: boolean,
    created_at: string,
    /** What i know is just "active" */
    status: string,
    source: string,
    has_notes: boolean,
    has_comments: boolean,
    preview_width: number,
    preview_height: number
}

interface IKonachan {
    id: number,
    tags: string,
    created_at: number,
    creator_id: number,
    author: string,
    change: number,
    source: string,
    score: number,
    md5: string,
    file_size: number,
    file_url: string,
    is_shown_in_index: boolean,
    preview_url: string,
    preview_width: number,
    preview_height: number,
    actual_preview_width: number,
    actual_preview_height: number,
    sample_url: string,
    sample_width: number,
    sample_height: number,
    sample_file_size: number,
    jpeg_url: string,
    jpeg_width: number,
    jpeg_height: number,
    jpeg_file_size: number,
    rating: "s" | "q" | "e",
    has_children: boolean,
    parent_id: number | null,
    status: string,
    width: number,
    height: number,
    is_held: boolean
}

export interface IBooruData {
    post_id: string,
    author: string,
    author_link: string,
    message: string,
    sample: string,
    smaller_sample: string,
    attachments: string[],
    provider?: string | null,
    provider_name?: string,
    width: number,
    height: number,
    pid: number,

    error?: boolean
}