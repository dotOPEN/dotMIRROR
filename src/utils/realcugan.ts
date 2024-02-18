/**
 * Some social media API like Facebook compress the post image until it's broken as frick.
 * That's why Real-CUGAN is here. Not really a good solution but at least it's doing the job good.
 * I want to use Waifu2x tho but i have no idea how to deal with ONNX model...
 * 
 * @fileoverview
 * @author AozoraDev
 */

import path from "path";
import { $ } from "bun";
import { tmpdir } from "os";
import { mkdtemp, exists, rm, readFile } from "fs/promises" ;
import { RealCUGAN } from "consts";

/**
 * Upscale and denoise the image using Real-CUGAN model
 * 
 * @param buf - Buffer of the image
 * @returns ArrayBuffer of upscaled image
 */
export default async function(buf: ArrayBuffer) {
    const exe = path.join(process.cwd(), "realcugan", "realcugan");
    if (!await exists(exe)) throw new Error("Real-CUGAN executable not found");
    
    const tempDir = await mkdtemp(path.join(tmpdir(), "realcugan-"));
    const outPath = path.join(tempDir, "generated");
    
    await Bun.write(outPath, buf);

    let type = await readImageType(outPath);
    if (!type) throw new Error("Image file type unsupported");
    type = "." + type; // Add dot at the first

    try {
        await $`${exe} -i ${outPath} -o ${outPath + type} -n 2 -t 64 -j 2:2:2 -g -1`;

        const outBuf = await Bun.file(outPath + type).arrayBuffer();
        return outBuf;
    } finally {
        await rm(tempDir, { recursive: true });
    }
}

/**
 * Read image type by its magic number
 * 
 * @param path - Path to the file
 */
async function readImageType(path: string) {
    const magic = await readFile(path, { encoding: "hex" })
        .then(res => res.slice(0, 8).toUpperCase());
    
    for (const key of Object.keys(RealCUGAN.MAGIC_NUMBERS)) {
        const expectedMagic = RealCUGAN.MAGIC_NUMBERS[key];
        if (magic == expectedMagic) {
            return key as ("webp" | "png" | "jpeg" | "jpg");
        }
    }

    return null; // If loop didn't return anything, return null instead
}