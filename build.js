import "./src/utils/console";
import { rmSync, cpSync } from "fs";

console.log("Building...");
const config = {
    entrypoints: ["src/index.ts", "src/service.ts", "src/addUser.ts"],
    outdir: "dist",
    minify: true,
    sourcemap: "linked",
    //splitting: true,
    target: "bun"
}

// Delete the dist folder
rmSync(config.outdir, { recursive: true, force: true });

// Build the executable
const scripts = await Bun.build(config);
if (!scripts.success) throw new Error(out.logs);

// The custom client
cpSync("src/client", "dist/client", { recursive: true });
const client = await Bun.build({
    entrypoints: ["src/client/scripts/client.ts"],
    outdir: "dist/client/scripts",
    target: "browser",
    minify: true,
    sourcemap: "linked"
});
if (!client.success) throw new Error(out.logs);

const output = [...scripts.outputs, ...client.outputs]
console.log("Building is successfully!");
console.log(`- Output dir: ${config.outdir}/`);
console.log(`- Output files: ${output.map(file => file.path.split("/").pop()).join(", ")}`);