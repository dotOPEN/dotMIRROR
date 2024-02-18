import type { iRealCUGAN } from "types";

// .MOE
export const dotMOE = {
    BASEURL: "https://dotmoe.aozora.my.id",
    INSTANCE_URL: "https://sakurajima.moe",
    ACCOUNT_URL: "https://sakurajima.moe/@dotmoe",
    TAGS: "#cute #moe #anime #artwork #mastoart #dotmoe",
    MAX_TRIES: 3,
    ENDPOINT: ""
}

// Real-CUGAN
export const RealCUGAN: iRealCUGAN = {
    MAGIC_NUMBERS: {
        jpeg: "FFD8FFEE",
        jpg: "FFD8FFE0",
        png: "89504E47",
        webp: "52494646"
    },
    USE_CUGAN: ["Facebook"]
}