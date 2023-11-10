/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at http://mozilla.org/MPL/2.0/.

Copyright (C) 2023 Michael Hall <https://github.com/mikeshardmind>
*/

import { DEC_TABLE } from "./DEC_TABLE.js";
import { ENC_TABLE } from "./ENC_TABLE.js";


const TAIL = ["།", "༎", "༏", "༐", "༑", "༆", "༈", "༒"];

const ZERO_SET = new Set(DEC_TABLE.reduce((acc, value, idx) => {
    if (value === 0xFFFF) {
        acc.push(idx);
    }
    return acc;
}, []));

class DecodeError extends Error {}

export const encode = uint8Array => {
    const ret = [];
    let stage = 0;
    let remaining = 0;
    for (const byte of uint8Array) {
        const need = 11 - remaining;
        if (need < 8) {
            remaining = 8 - need;
            const index = (stage << need) | (byte >> remaining);
            ret.push(ENC_TABLE[index]);
            stage = byte & ((1 << remaining) - 1);
        } else {
            stage = (stage << 8) | byte;
            remaining += 8;
        }
    }
    if (remaining > 0) {
        ret.push(remaining <= 3 ? TAIL[stage] : ENC_TABLE[stage]);
    }
    return ret.join("");
};

export const decode = str => {
    const ret = [];
    let remaining = 0;
    let stage = 0;
    let residue = 0;
    for (var i = 0; i < str.length; i++) {
        residue = (residue + 11) % 8;
        const c = str.charAt(i);
        const numeric = c.charCodeAt(0);
        if (numeric > 4339) {
            const msg = `Invalid character ${i}: [${numeric}]`;
            throw new DecodeError(msg);
        }
        let n_new_bits = 0;
        let new_bits = 0;
        if (ZERO_SET.has(numeric)) {
            if (i + 1 < str.length) {
                const msg = `Unexpected character ${i+1}: [${str.charAt(i+1)}] after termination sequence ${i}: [${c}]`;
                throw new DecodeError(msg);
            }
            try {
                const index = TAIL.indexOf(c);
                if (index === -1) {
                    const msg = `Invalid termination character ${i}: [${c}]`;
                    throw new DecodeError(msg);
                }
                const need = 8 - remaining;
                if (index < (1 << need)) {
                    n_new_bits = need;
                    new_bits = index;
                } else {
                    const msg = `Invalid tail character ${i}: [${c}]`;
                    throw new DecodeError(msg);
                }
            } catch (error) {
                throw new DecodeError(error.message);
            }
        } else {
            new_bits = DEC_TABLE[numeric];
            n_new_bits = i + 1 < str.length ? 11 : 11 - residue;
        }
        remaining += n_new_bits;
        stage = (stage << n_new_bits) | new_bits;
        while (remaining > 8) {
            remaining -= 8;
            ret.push(stage >> remaining);
            stage &= (1 << remaining) - 1;
        }
    }
    if (remaining > 0) {
        ret.push(stage >> (8 - remaining));
    }
    return new Uint8Array(ret);
};