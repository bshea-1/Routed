#!/usr/bin/env -S node --no-warnings=ExperimentalWarning
const originalEmitWarning = process.emitWarning;
process.emitWarning = function (warning, ...args) {
    if (typeof warning === 'string' && warning.includes('SQLite is an experimental feature')) {
        return;
    }
    if (typeof warning === 'object' && warning?.name === 'ExperimentalWarning' && String(warning?.message).includes('SQLite')) {
        return;
    }
    return originalEmitWarning.call(process, warning, ...args);
};
import { main } from '../dist/index.js';
main(process.argv.slice(2)).catch((err) => {
    console.error(err);
    process.exit(1);
});
