#!/usr/bin/env node

import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// --- PRE-IMPORTS Debugging & Environment Setup ---
console.error(`[DEBUG cli.ts PRE-IMPORTS] INIT CLI`);
console.error(`[DEBUG cli.ts PRE-IMPORTS] Original CWD: ${process.cwd()}`);
console.error(`[DEBUG cli.ts PRE-IMPORTS] __dirname: ${__dirname}`);

let projectRoot: string;

// Determine project root. This logic is crucial for npx execution.
// When compiled to dist/cli.js, __dirname will be .../dist.
// So, path.resolve(__dirname, '..') should be the project root.
if (__dirname.endsWith('/src')) { // Likely running with ts-node from src directory
    projectRoot = path.resolve(__dirname, '..');
    console.error(`[DEBUG cli.ts PRE-IMPORTS] Running in ts-node or similar (dev mode). Project root: ${projectRoot}`);
} else { // Likely running compiled version from dist, or globally installed npx package
    projectRoot = path.resolve(__dirname, '..'); 
    console.error(`[DEBUG cli.ts PRE-IMPORTS] Running compiled version (e.g., dist/cli.js or npx global). Tentative project root: ${projectRoot}`);
    // For npx, if it's globally installed, __dirname might be deep within node_modules.
    // A more robust check for package.json might be needed if this isn't reliable.
    // For now, assuming standard 'dist' output or direct execution from package root via npx cache.
}

console.error(`[DEBUG cli.ts PRE-IMPORTS] Final calculated projectRoot: ${projectRoot}`);

const envPath = path.join(projectRoot, '.env');
console.error(`[DEBUG cli.ts PRE-IMPORTS] Attempting to load .env from: ${envPath}`);

try {
    if (fs.existsSync(envPath)) {
        console.error(`[DEBUG cli.ts PRE-IMPORTS] .env file found at ${envPath}. Loading...`);
        dotenv.config({ path: envPath, override: true }); // override to ensure .env takes precedence
        console.error(`[DEBUG cli.ts PRE-IMPORTS] .env loaded successfully from ${envPath}.`);
        console.error(`[DEBUG cli.ts PRE-IMPORTS] Values after .env load:`);
        console.error(`[DEBUG cli.ts PRE-IMPORTS]   API_NAME: ${process.env.API_NAME}`);
        console.error(`[DEBUG cli.ts PRE-IMPORTS]   OPENAPI_SPEC_URL: ${process.env.OPENAPI_SPEC_URL}`);
        console.error(`[DEBUG cli.ts PRE-IMPORTS]   API_BASE_URL: ${process.env.API_BASE_URL}`);
        console.error(`[DEBUG cli.ts PRE-IMPORTS]   CONFIG_FILE: ${process.env.CONFIG_FILE}`);
        console.error(`[DEBUG cli.ts PRE-IMPORTS]   MCP_CONFIG_FILE: ${process.env.MCP_CONFIG_FILE}`);
    } else {
        console.error(`[DEBUG cli.ts PRE-IMPORTS] .env file NOT found at ${envPath}. Relying on globally set or command-line env vars.`);
    }
} catch (e: any) {
    console.error(`[ERROR cli.ts PRE-IMPORTS] Error during .env processing: ${e.message}`);
}
console.error(`[DEBUG cli.ts PRE-IMPORTS] --- End of PRE-IMPORTS debug logs & .env setup ---`);

// Dynamically import the main server logic to ensure env vars are set first
async function runServer() {
    try {
        console.error('[DEBUG cli.ts runServer] Importing server logic from ./index.js...');
        const { startUniversalOpenApiMcpServer } = await import('./index.js');
        console.error('[DEBUG cli.ts runServer] Server logic imported. Starting server...');
        await startUniversalOpenApiMcpServer();
        console.error('[DEBUG cli.ts runServer] startUniversalOpenApiMcpServer() completed.');
    } catch (error) {
        console.error('[FATAL ERROR cli.ts runServer] Failed to start or run the MCP server:');
        if (error instanceof Error) {
            console.error(`[FATAL ERROR cli.ts runServer] Message: ${error.message}`);
            console.error(`[FATAL ERROR cli.ts runServer] Stack: ${error.stack}`);
        } else {
            console.error('[FATAL ERROR cli.ts runServer] Unknown error:', error);
        }
        process.exit(1); // Exit with error code
    }
}

// Global error handlers specifically for cli.ts context, if needed before app logic takes over
process.on('unhandledRejection', (reason, promise) => {
    console.error('[FATAL cli.ts unhandledRejection] Reason:', reason);
    // console.error('[FATAL cli.ts unhandledRejection] Promise:', promise);
    // process.exit(1); // Avoid multiple exits if app also handles this
});

process.on('uncaughtException', (error) => {
    console.error('[FATAL cli.ts uncaughtException] Error:', error);
    // process.exit(1); // Avoid multiple exits
});

runServer();
