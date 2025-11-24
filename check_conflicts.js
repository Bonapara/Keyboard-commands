
const fs = require('fs');
const path = require('path');

const commandsPath = path.join(process.cwd(), 'src/commands.ts');
const content = fs.readFileSync(commandsPath, 'utf8');

// Regex to find aliases
const aliasRegex = /alias:\s*\[(.*?)\]/g;
const allAliases = new Map(); // alias -> commandName

let match;
// We need to track which command we are in. 
// This is a rough parser. 
const lines = content.split('\n');
let currentCommand = '';

lines.forEach((line, index) => {
    const commandMatch = line.match(/^\s*(\w+):\s*{/);
    if (commandMatch) {
        currentCommand = commandMatch[1];
    }

    const aliasMatch = line.match(/alias:\s*\[(.*?)\]/);
    if (aliasMatch) {
        const aliases = aliasMatch[1].split(',').map(a => a.trim().replace(/['"]/g, ''));
        aliases.forEach(alias => {
            if (allAliases.has(alias)) {
                console.log(`CONFLICT: Alias '${alias}' is used by '${allAliases.get(alias)}' and '${currentCommand}'`);
            } else {
                allAliases.set(alias, currentCommand);
            }
        });
    }
});

console.log('Check complete.');
