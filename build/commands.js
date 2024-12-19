import { resizeWidth } from './functions/resizeWidth';
import { resizeHeight } from './functions/resizeHeight';
import { rotate } from './functions/rotate';
import { moveX } from './functions/moveX';
import { moveY } from './functions/moveY';
import { scale } from './functions/scale';
import { flipHorizontal } from './functions/flipHorizontal';
import { flipVertical } from './functions/flipVertical';
import { group } from './functions/group';
import { ungroup } from './functions/ungroup';
import { deleteSelection } from './functions/deleteSelection';
import { clipContent } from './functions/clipContent';
import { duplicate } from './functions/duplicate';
export const COMMAND_DEFINITIONS = {
    Width: {
        alias: 'w',
        requiresValue: true,
        execute: (value) => {
            if (value === undefined)
                throw new Error('No value provided');
            resizeWidth(value);
        }
    },
    Height: {
        alias: 'h',
        requiresValue: true,
        execute: (value) => {
            if (value === undefined)
                throw new Error('No value provided');
            resizeHeight(value);
        }
    },
    Rotate: {
        alias: 'r',
        requiresValue: true,
        execute: (value) => {
            if (value === undefined)
                throw new Error('No value provided');
            rotate(value);
        }
    },
    MoveX: {
        alias: 'mx',
        requiresValue: true,
        execute: (value) => {
            if (value === undefined)
                throw new Error('No value provided');
            moveX(value);
        }
    },
    MoveY: {
        alias: 'my',
        requiresValue: true,
        execute: (value) => {
            if (value === undefined)
                throw new Error('No value provided');
            moveY(value);
        }
    },
    Scale: {
        alias: 's',
        requiresValue: true,
        execute: (value) => {
            if (value === undefined)
                throw new Error('No value provided');
            scale(value);
        }
    },
    FlipHorizontal: {
        alias: 'fh',
        requiresValue: false,
        execute: () => flipHorizontal()
    },
    FlipVertical: {
        alias: 'fv',
        requiresValue: false,
        execute: () => flipVertical()
    },
    Group: {
        alias: 'g',
        requiresValue: false,
        execute: () => group()
    },
    Ungroup: {
        alias: 'u',
        requiresValue: false,
        execute: () => ungroup()
    },
    Delete: {
        alias: 'd',
        requiresValue: false,
        execute: () => deleteSelection()
    },
    ClipContent: {
        alias: 'cc',
        requiresValue: false,
        execute: () => clipContent()
    },
    Duplicate: {
        alias: 'du',
        requiresValue: false,
        execute: () => duplicate()
    }
};
export const COMMANDS = Object.keys(COMMAND_DEFINITIONS).map((name) => {
    const def = COMMAND_DEFINITIONS[name];
    return { name, alias: def.alias, requiresValue: def.requiresValue };
});
