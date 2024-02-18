#!/usr/bin/env bun

/**
 * This script works as a receiver of webhook data.
 * Any data that is received and passes the check will be stored in the database for use by service.ts.
 * 
 * @file
 * @author AozoraDev
 */

import type { WebhookFeed, WebhookChanges, Post } from "types";

import express from "express";
import session from "express-session";
import cors from "cors";
import crypto from "node:crypto";
import nunjucks from "nunjucks";
import { resolveImages, postValidation } from "handlers/facebook";
import { isFacebookPostExist, savePost, getUser } from "utils/db";
import { dotMOE } from "consts";
import providers, { shuffle, type IBooruData } from "providers";
import path from "node:path";
import webP from "utils/webp";
import "utils/console";

const app = express();
app.enable("trust proxy");
app.use(cors({
    origin: (Bun.env.NODE_ENV == "production") ? dotMOE.BASEURL : "*"
}));
app.use(express.urlencoded({ extended: true }));

// Setup session
app.use(session({
    secret: generateRandomToken(),
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: (Bun.env.NODE_ENV == "production"),
        httpOnly: (Bun.env.NODE_ENV != "production"),
        path: "/"
    }
}));

app.set("view engine", "njk");
nunjucks.configure(import.meta.dir + "/client", {
    autoescape: true,
    express: app,
    // Watch the njk changes if run in development
    watch: Bun.env.NODE_ENV != "production"
});

/** The endpoint used by the receiver where the webhook sends data. */
const endpoint = Bun.env["ENDPOINT"] || dotMOE.ENDPOINT;

app.get(endpoint, (_req, res) => res.redirect(dotMOE.ACCOUNT_URL));
app.use(endpoint, (req, res, next) => {
    const excludes = ["njk", "ts"];
    const ext = path.extname(req.path);

    if (excludes.includes(ext)) {
        res.sendStatus(404);
    } else {
        next();
    }
}, express.static(import.meta.dir + "/client"));

// Facebook Only //
// See [https://developers.facebook.com/docs/graph-api/webhooks/getting-started#configure-webhooks-product] for more information
app.get(endpoint + "/facebook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    
    if (mode && token) {
        // AUTH_TOKEN env is your random token for authenticating webhook
        if (mode === "subscribe" && token === Bun.env["AUTH_TOKEN"]) {
            console.log("Webhook registered!");
            res.status(200).send(challenge);
        } else {
            res.sendStatus(401);
        }
    } else {
        res.redirect("https://sakurajima.moe/@dotmoe");
    }
});

// Webhook receiver //
// Facebook //
app.post(endpoint + "/facebook",
    express.json({ verify: (req, _res, buf) => {
        const hmac = crypto.createHmac("sha256", Bun.env["APP_TOKEN"] || "0")
            .update(buf)
            .digest("hex");
        
        const signature = req.headers["x-hub-signature-256"];
        const expectedSignature = "sha256=" + hmac;

        if (signature !== expectedSignature) throw new Error("Signature not match");
    } }),
    async (req, res) => {
        // Gotta tell the webhook first that we receive the post
        res.sendStatus(200);
        
        const body: WebhookFeed = req.body;
        // Throw error if body is empty or body doesn't have entry and object property
        // or the value of object property is not page
        if (!body || !(body.entry && body.object) || body.object !== "page") {
            throw new Error("Received data is empty or not from webhook.");
        }

        /** The received data */
        const data: WebhookChanges = body.entry[0].changes[0];
        // Stop if the current post ID is already exist
        if (isFacebookPostExist(data.value.post_id)) return;

        if (postValidation(data)) {
            console.log(`New post from ${data.value.from.name}`);
            savePost({
                post_id: data.value.post_id,
                author: data.value.from.name,
                author_link: "https://facebook.com/" + data.value.from.id,
                message: data.value.message as string, // It will always string because postValidation will check it
                attachments: (await resolveImages(data)),
                provider: "Facebook"
            });
        }
    }
);

// .MOE Booru Client
app.get(endpoint + "/login", (req, res) => {
    if (req.session.user) {
        res.redirect(endpoint + "/client")
    } else {
        res.render("login", { loginPage: true });
    }
});

app.post(endpoint + "/login", (req, res) => {
    if (!req.body.email && !req.body.password) {
        return res.sendStatus(403);
    }

    // Do check email and password
    const user = getUser(req.body.email);
    if (!user || Bun.password.verifySync(req.body.password, user.password_hash)) {
        return res.render("login", { loginPage: true, incorrect: true });
    }

    // Create new session
    req.session.regenerate((err) => {
        if (err) {
            console.error("Error regenerating session:", err);
            return res.sendStatus(500);
        }    

        console.log(`${user.email} logged in!`);
        req.session.user = generateRandomToken();
        req.session.email = user.email;

        res.redirect(endpoint + "/client");
    });
});

app.get(endpoint + "/logout", (req, res) => {
    req.session.destroy(() => res.redirect(endpoint + "/login"));
});

// This endpoint for saving post from custom client Booru.
app.post(endpoint + "/booru", express.json(), (req, res) => {
    if (!req.session.user) {
        console.error("New post just declined from being saved.");
        return res.sendStatus(403);
    }

    const body: Post = req.body;
    savePost(body, true);
    let message = `New post from ${body.author} is added from ${req.session.email}!`;
    
    console.log(message);
    res.sendStatus(200);
});

// .MOE Booru Client
app.get(endpoint + "/client", async (req, res) => {
    if (req.session.user) {
        let script: string | undefined;

        if (Bun.env["NODE_ENV"] != "production") {
            // In development, build the typescript into browser js
            console.debug("Generating script for client...");
            const build = await Bun.build({
                entrypoints: [import.meta.dir + "/client/scripts/client.ts"],
                target: "browser"
            });

            if (!build.success) {
                console.error(build.logs);
            } else {
                console.debug("Script generated!");
                script = await build.outputs[0].text();
                script = `<script type="module">` + script + "</script>";
            }
        }
        
        res.render("client", { inlineScript: script });
    } else {
        res.redirect(endpoint + "/login");
    }
});

app.get(endpoint + "/client/uncors", async (req, res) => {
    const url = req.query["url"] as string | undefined;

    if (!req.session.user || !url) {
        return res.sendStatus(403);
    }

    if (Bun.env.NODE_ENV != "production") console.debug(`Fetching ${url}`);
    const file = await fetch(url).then(res => res.arrayBuffer());

    if (Bun.env.NODE_ENV != "production") console.debug(`WebP called!`);
    const webp = new webP(file, {
        quality: 80,
        preset: "photo"
    });
    
    if (Bun.env.NODE_ENV != "production") console.debug(`Compressing ${url}...`);
    // Don't process gif
    const img = (url.includes(".gif"))
        ? file
        : await webp.executeToArrayBuffer() 
    
    // Send
    if (Bun.env.NODE_ENV != "production") console.debug(`Buffer (${url}) is generated!`);
    res.status(200)
        .header({
            "Content-Type": "image/webp",
            "Cache-Control": "public, max-age=60"
        })
        .send(Buffer.from(img));
});

app.get(endpoint + "/client/verify", (req, res) => {
    res.status(200).json({ token: req.session.user || null });
});

app.get(endpoint + "/client/posts", async (req, res) => {
    if (!req.session.user || req.headers.authorization !== req.session.user) {
        return res.sendStatus(403);
    }
    
    const posts: IBooruData[] = [];
    for (const provider of providers) {
        const data = await provider.fetch();
        
        // If error, skip 
        if ("error" in data) {
            console.error(`[${provider.name}] ${data.error}`);
            continue;
        }

        for (const post of data) post.provider_name = provider.name;
        posts.push(...data);
    }
    shuffle(posts);

    console.log("Posts requested by " + req.session.email);
    res.status(200).json(posts);
});

app.listen(Bun.env["PORT"] || 8080, () => {
    console.log("Listening!");
});

process.on("uncaughtException", err => {
    console.error(err);
});

// Functions //
/**
 * Generate random token
 * 
 * @param length - The length of the token. Default is 16.
 */
function generateRandomToken(length = 16) {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let token = "";
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        token += characters[randomIndex];
    }

    return token;
}