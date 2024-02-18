/**
 * This will handle image compression using WebP (sharp) algorithm.
 * 
 * @file
 * @author AozoraDev
 */

import { join } from "path";
import { rmSync, mkdtempSync } from "fs"
import { tmpdir } from "os";
import sharp from "sharp";

export default class WebP {
    private sharp: sharp.Sharp;
    private metadata?: sharp.Metadata;

    private tempDir = mkdtempSync(join(tmpdir(), "webpEncoded-"));
    private encodedPath = join(this.tempDir, "encoded.webp");

    constructor(buf: ArrayBuffer, opts?: sharp.WebpOptions) {
        this.sharp = sharp(buf).webp(opts);
    }

    public async getMetadata() {
        if (this.metadata) return this.metadata;

        return this.metadata = await this.sharp.metadata();
    }

    /** Execute the compression and get the output as ArrayBuffer */
    public async executeToArrayBuffer() {
        return (await this.sharp.toBuffer()).buffer;
    }

    /** Execute the compression and get the output as Blob */
    public async executeToBlob() {
        return new Blob([await this.sharp.toBuffer()]);
    }

    /** Execute the compression and get the output as BunFile */
    public async executeToBunFile() {
        const blob = await this.executeToBlob();

        await Bun.write(this.encodedPath, blob);
        return Bun.file(this.encodedPath);
    }

    /** Gotta be used when using executeToBunFile */
    public removeEncodedFile() {
        rmSync(this.tempDir, { force: true, recursive: true });
    }

    // Options //
    /** Resize the image */
    public resize(width: number) {
        return this.sharp.resize(width);
    }
}