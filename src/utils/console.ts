const oldConsole = console; // Prevent stack overflow

export default console = {
    ...oldConsole,
    log: (string) => {
        oldConsole.log(`[.MOE] [LOG] [${timestamp()}]`, string);
    },
    error: (string) => {
        oldConsole.error(`[.MOE] [ERROR] [${timestamp()}]`, string);
    },
    warn: (string) => {
        oldConsole.warn(`[.MOE] [WARN] [${timestamp()}]`, string);
    },
    debug: (string) => {
        oldConsole.warn(`[.MOE] [DEBUG] [${timestamp()}]`, string);
    }
}

function timestamp() {
    const date = new Date();
    const ss = date.getSeconds().toString().padStart(2, "0");
    const mm = date.getMinutes().toString().padStart(2, "0");
    const hh = date.getHours().toString().padStart(2, "0");
    
    return `${hh}:${mm}:${ss}`;
}