import { Modal, Collapse } from "bootstrap";
import type { IBooruData } from "providers";

const endpoint = "";

const img: HTMLImageElement | null = document.querySelector(".content");
const imgLast: HTMLImageElement | null  = document.querySelector("#lastApproved");
const warningMessage: HTMLInputElement | null = document.querySelector("#warningMessage");
const customMessage: HTMLInputElement | null = document.querySelector("#customMessage");

const keyShift = document.getElementById("keyShift");
const keyEnter = document.getElementById("keyEnter");
const keyE = document.getElementById("keyE");
const keyQ = document.getElementById("keyQ");

/** Every 5, call caching function */
let counts = 0;
img!.onerror = img!.onload = () => {
    inProcess = false;
    img!.classList.remove("blur");

    if (counts >= 5) {
        caching(); // Cache another images every 5 images
        counts = 0;
    }
}

/** Flag current image as explicit or not */
let flagExplicit = false;
/** State of using smaller preview image */
let usingSmallerImg = false;
/** Cache of next fetching */
let cacheNext: IBooruData[] = [];
/** Cache of current fetching */
let cache: IBooruData[] = [];
/** State of current process */
let inProcess = true;
/** How much post have been approved */
let approved = 0;

const modalEle = document.getElementById("rulesModal");
const modal = new Modal(modalEle!);
// Show rules at the page load
modal.show();
// Set the process state to false when the modal is hidden now
modalEle?.addEventListener("hidden.bs.modal", () => {
    inProcess = false;

    // Initiation
    fetch(endpoint + "/client/verify")
    .then(res => res.json())
    .then((res: { token: string | null }) => {
        if (!res.token) return location.replace(endpoint + "/logout");

        sessionStorage.setItem("token", res.token);
        next(true);
    })
    .catch(() => location.replace(endpoint + "/logout"));
});

// Collapsable for Flag as Suggestive custom message
const warningELe = document.getElementById("collapseWarningMessage");
const collapseWarning = new Collapse(warningELe!, { toggle: false });
// Remove the value after the collapse hidden
warningELe?.addEventListener("hidden.bs.collapse", () => {
    warningMessage!.value = "";
});
// Alt key in message will unfocus
warningMessage!.onkeyup = customMessage!.onkeyup = (e) => {
    if (inProcess && e.key == "Alt") (e.target as HTMLInputElement).blur();
}
// Set the process state after unfocus/focus
warningMessage!.onfocus = warningMessage!.onblur =
customMessage!.onfocus = customMessage!.onblur = () => {
    inProcess = (inProcess) ? false : true;
}

// Key press //
document.onkeydown = (e) => {
    if (inProcess) return;

    switch (e.key) {
        case "Shift":
            if (e.ctrlKey) return; // Don't continue if ctrl key pressed 
            keyPress(keyShift);
        break;

        case "Enter":
            keyPress(keyEnter);
        break;

        case "e":
        case "E":
            keyPress(keyE);
        break;

        case "q":
        case "Q":
            keyPress(keyQ);
        break;
    }
}

document.onkeyup = async (e) => {
    if (inProcess) return;

    switch (e.key) {
        case "Shift":
            if (e.ctrlKey) return; // Don't continue if ctrl key pressed 
            keyUnpress(keyShift);
            await next();
        break;

        case "Enter":
            keyUnpress(keyEnter);

            // Don't approve if flag explicit enabled but warning message is empty
            if (flagExplicit && !warningMessage!.value) {
                return alert("Warning message must be added if Flag as Suggestive enabled.")
            }

            const data = cache[0];
            // If custom message value exist, add it to the first of the link
            if (customMessage!.value) data.message = `${customMessage!.value}\n${data.message}`;
            // Create some separator message to get warning message
            if (flagExplicit) data.message += `<>${warningMessage!.value}`;

            approve(data);
            await next();
        break;

        case "e":
        case "E":
            if (flagExplicit) {
                flagExplicit = false;

                collapseWarning.hide();
                keyUnpress(keyE);
                keyE!.nextElementSibling!.innerHTML = "Flag as Suggestive";
            } else {
                flagExplicit = true;

                collapseWarning.show();
                warningMessage?.focus();

                keyPress(keyE);
                keyE!.nextElementSibling!.innerHTML = "Unflag as Suggestive";
            }
        break;

        case "q":
        case "Q":
            keyUnpress(keyQ);
            const now = cache[0];

            if (usingSmallerImg) {
                usingSmallerImg = false;
                keyQ!.nextElementSibling!.innerHTML = "Switch to Smaller Preview";

                // (Konachan) cors image. Use uncors.
                const uncorsed = (!now.sample.includes(endpoint + "/client/uncors"))
                    ? endpoint + "/client/uncors?url=" + now.sample
                    : null;
                
                // Just keep use smaller sample if both original image not exist
                img!.src = uncorsed || now.sample || now.attachments[0] || now.smaller_sample;
            } else {
                usingSmallerImg = true;
                keyQ!.nextElementSibling!.innerHTML = "Switch to Original Preview";

                img!.src = now?.smaller_sample;
            }

            inProcess = true;
            img!.classList.add("blur");
        break;
    }
}

// Functions //
async function newImage() {
    const posts = await fetch(endpoint + "/client/posts", { 
        headers: { Authorization: sessionStorage.getItem("token") as string }
    })
    .then(res => res.json())
    .catch(() => []) as IBooruData[];
    
    // Throw error if cannot fetch image
    if (!posts.length) {
        throw new Error("Server is offline!");
    }

    if (!cacheNext.length && !cache.length) { // Both caches are empty
        cache = posts;
        console.log("Cache have been updated!");

        newImage(); // Call again to add cacheNext
    } else if (!cacheNext.length) { // CacheNext is empty but current cache is filled
        cacheNext = posts;
        console.log("Next cache have been updated!");
    } else { // Move cacheNext to current cache and use current fetch data to the next cache
        cache = cacheNext;
        cacheNext = posts;

        console.log("Cache and next cache have been updated!");
    }
}

async function next(init = false) {
    img!.classList.add("blur"); // Blur image
    customMessage!.value = ""; // Clear the custom message

    if (!init) cache.shift(); // remove first item
    inProcess = true; // Lock the process

    // If cache already has 0 item, call new image
    try {
        if (init || !cache.length) {
            await newImage();
            await caching();
        }
    } catch(e) {
        toggleError();
        throw e;
    }

    counts++; // Add counts
    const now = cache[0];

    if (!now.sample || !now.attachments[0]) next(); // Just call another if the image is not exist.
    // (Konachan) cors image. Use uncors.
    const sample = (!usingSmallerImg)
        ? endpoint + "/client/uncors?url=" + (now.sample || now.attachments[0])
        : now.smaller_sample;

    img!.src = sample; // Now add the image to the page
    updateMetadata(now);

    if (flagExplicit) {
        flagExplicit = false;
        warningMessage!.value = "";
        collapseWarning.hide();

        keyUnpress(keyE);
        keyE!.nextElementSibling!.innerHTML = "Flag as Suggestive";
    }
}

/** Approve a post */
async function approve(data: IBooruData) {
    toggleLoading(true);

    approved++;
    document.getElementById("approved")!.innerText = String(approved);
    imgLast!.src = endpoint + "/client/uncors?url=" + (data.sample || data.attachments[0])

    await fetch(endpoint + "/booru", {
        method: "post",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, isExplicit: flagExplicit })
    });

    toggleLoading(false);
}

/** Change the uploading loading to error */
function toggleError() {
    const loadingImage = document.getElementById("uploading");
    loadingImage!.className = "spinner-grow spinner text-danger position-absolute end-0 top-0 m-2";
}

/** Toggle the loading */
function toggleLoading(show: boolean) {
    const loadingImage = document.getElementById("uploading");
    if (show) {
        loadingImage!.classList.remove("opacity-0");
    } else {
        loadingImage!.classList.add("opacity-0");
    }
}

/** Load the current images cache on the background so that when loaded in html, it appears instantly */
async function caching() {
    let cached = 0;

    for (let i = 0; i < 9; i++) {
        const now = cache[i];
        if (!now) continue;
        const url = endpoint + "/client/uncors?url=" + (now.sample || now.attachments[0]);

        cached++;
        new Image().src = url;
    }

    document.getElementById("cached")!.innerText = String(cached);
}

/** Update metada of current post */
function updateMetadata(post: IBooruData) {
    document.getElementById("provider")!.innerText = post.provider_name || "No Provider";
    document.getElementById("page")!.innerText = String(post.pid);
    document.getElementById("source")!.innerText = post.message;
    document.getElementById("author")!.innerText = post.author;
    document.getElementById("size")!.innerText = `${post.width}x${post.height}`;
    document.getElementById("imagesLeft")!.innerText = String(cache.length);
}

/** Change button color when pressed. */
function keyPress(ele: HTMLElement | null) {
    // Prevent multiple press
    if (ele!.classList.contains("text-bg-primary")) return;

    ele!.classList.replace("text-bg-light", "text-bg-primary");
}

/** Change button color when unpressed. */
function keyUnpress(ele: HTMLElement | null) {
    ele!.classList.replace("text-bg-primary", "text-bg-light");
}
