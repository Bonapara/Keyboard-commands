import { COMMAND_DEFINITIONS, COMMANDS } from './commands';
const ATTACHED_FORMAT_REGEX = /^([a-zA-Z]+)(-?\d+)$/;
const COLON_FORMAT_REGEX = /^([^:]+):(-?\d+)$/;
function findCommand(cmd) {
    return COMMANDS.find((c) => cmd.toLowerCase() === c.alias.toLowerCase() ||
        cmd.toLowerCase() === c.name.toLowerCase());
}
export function processCommand(commandName, value) {
    const definition = COMMAND_DEFINITIONS[commandName];
    if (definition) {
        definition.execute(value);
    }
}
export function executeCommand(cmd) {
    if (!cmd)
        return;
    console.log(`Executing command: ${cmd}`);
    // First check for exact matches without values
    const exactCommand = findCommand(cmd);
    if (exactCommand && !exactCommand.requiresValue) {
        processCommand(exactCommand.name);
        return;
    }
    // Check attached format (like mx-4)
    const attachedFormat = cmd.match(ATTACHED_FORMAT_REGEX);
    if (attachedFormat) {
        const [_, cmdName, value] = attachedFormat;
        const command = COMMANDS.find((c) => cmdName.toLowerCase() === c.alias.toLowerCase() ||
            cmdName.toLowerCase() === c.name.toLowerCase());
        if (command === null || command === void 0 ? void 0 : command.requiresValue) {
            processCommand(command.name, parseInt(value, 10));
            return;
        }
    }
    // Check for colon format (Name:Value)
    const colonMatch = cmd.match(COLON_FORMAT_REGEX);
    if (colonMatch) {
        const [, cmdName, value] = colonMatch;
        const command = COMMANDS.find((c) => cmdName.toLowerCase() === c.name.toLowerCase());
        if (command === null || command === void 0 ? void 0 : command.requiresValue) {
            processCommand(command.name, parseInt(value, 10));
            return;
        }
    }
    // If partial command without value
    const partialCommand = COMMANDS.find((c) => c.alias.toLowerCase().startsWith(cmd.toLowerCase()) ||
        c.name.toLowerCase().startsWith(cmd.toLowerCase()));
    if (partialCommand && !partialCommand.requiresValue) {
        processCommand(partialCommand.name);
    }
}
