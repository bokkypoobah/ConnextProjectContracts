"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai = require("chai");
//
// chai
//
chai.use(require('chai-subset'));
exports.assert = chai.assert;
function expandSuccinctChannel(s) {
    let res = {};
    Object.entries(s).forEach(([name, value]) => {
        if (Array.isArray(value)) {
            let suffixes = ['Hub', 'User'];
            let cast = (x) => x.toString();
            if (name == 'txCount') {
                suffixes = ['Global', 'Chain'];
                cast = (x) => x;
            }
            res[name + suffixes[0]] = cast(value[0]);
            res[name + suffixes[1]] = cast(value[1]);
        }
        else {
            if (name.endsWith('Hub') || name.endsWith('User'))
                value = (!value && value != 0) ? value : value.toString();
            res[name] = value;
        }
    });
    return res;
}
exports.expandSuccinctChannel = expandSuccinctChannel;
function expandSuccinctThread(s) {
    let res = {};
    Object.entries(s).forEach(([name, value]) => {
        if (Array.isArray(value)) {
            let suffixes = ['Sender', 'Receiver'];
            let cast = (x) => x.toString();
            res[name + suffixes[0]] = cast(value[0]);
            res[name + suffixes[1]] = cast(value[1]);
        }
        else {
            if (name.endsWith('Sender') || name.endsWith('Receiver'))
                value = (!value && value != 0) ? value : value.toString();
            res[name] = value;
        }
    });
    return res;
}
exports.expandSuccinctThread = expandSuccinctThread;
function makeSuccinctChannel(s) {
    let res = {};
    Object.entries(s).forEach(([name, value]) => {
        let didMatchSuffix = false;
        ['Hub', 'User', 'Global', 'Chain'].forEach((suffix, idx) => {
            if (name.endsWith(suffix)) {
                name = name.replace(suffix, '');
                if (!res[name])
                    res[name] = ['0', '0'];
                res[name][idx % 2] = idx < 2 ? value && value.toString() : value;
                didMatchSuffix = true;
            }
        });
        if (!didMatchSuffix)
            res[name] = value;
    });
    return res;
}
exports.makeSuccinctChannel = makeSuccinctChannel;
function makeSuccinctThread(s) {
    let res = {};
    Object.entries(s).forEach(([name, value]) => {
        let didMatchSuffix = false;
        ['Sender', 'Receiver'].forEach((suffix, idx) => {
            if (name.endsWith(suffix)) {
                name = name.replace(suffix, '');
                if (!res[name])
                    res[name] = ['0', '0'];
                res[name][idx % 2] = idx < 2 ? value && value.toString() : value;
                didMatchSuffix = true;
            }
        });
        if (!didMatchSuffix)
            res[name] = value;
    });
    return res;
}
exports.makeSuccinctThread = makeSuccinctThread;
function mkAddress(prefix = '0x') {
    return prefix.padEnd(42, '0');
}
exports.mkAddress = mkAddress;
function mkHash(prefix = '0x') {
    return prefix.padEnd(66, '0');
}
exports.mkHash = mkHash;
function updateChannelState(s, ...rest) {
    let res = expandSuccinctChannel(s);
    for (let s of rest) {
        res = Object.assign({}, res, expandSuccinctChannel(s));
    }
    return res;
}
exports.updateChannelState = updateChannelState;
function updateThreadState(s, ...rest) {
    let res = expandSuccinctThread(s);
    for (let s of rest) {
        res = Object.assign({}, res, expandSuccinctThread(s));
    }
    return res;
}
exports.updateThreadState = updateThreadState;
const initialChannelStates = {
    'full': () => ({
        contractAddress: mkAddress('0xCCC'),
        user: mkAddress('0xAAA'),
        recipient: mkAddress('0x222'),
        balanceWeiHub: '1',
        balanceWeiUser: '2',
        balanceTokenHub: '3',
        balanceTokenUser: '4',
        pendingDepositWeiHub: '4',
        pendingDepositWeiUser: '5',
        pendingDepositTokenHub: '6',
        pendingDepositTokenUser: '7',
        pendingWithdrawalWeiHub: '8',
        pendingWithdrawalWeiUser: '9',
        pendingWithdrawalTokenHub: '10',
        pendingWithdrawalTokenUser: '11',
        txCountGlobal: 13,
        txCountChain: 12,
        threadRoot: mkHash('0x141414'),
        threadCount: 14,
        timeout: 15,
        sigUser: mkHash('siguser'),
        sigHub: mkHash('sighub'),
    }),
    'empty': () => ({
        contractAddress: mkAddress('0xCCC'),
        user: mkAddress('0xAAA'),
        recipient: mkAddress('0x222'),
        balanceWeiHub: '0',
        balanceWeiUser: '0',
        balanceTokenHub: '0',
        balanceTokenUser: '0',
        pendingDepositWeiHub: '0',
        pendingDepositWeiUser: '0',
        pendingDepositTokenHub: '0',
        pendingDepositTokenUser: '0',
        pendingWithdrawalWeiHub: '0',
        pendingWithdrawalWeiUser: '0',
        pendingWithdrawalTokenHub: '0',
        pendingWithdrawalTokenUser: '0',
        txCountGlobal: 1,
        txCountChain: 1,
        threadRoot: mkHash('0x0'),
        threadCount: 0,
        timeout: 0,
        sigUser: '',
        sigHub: '',
    }),
};
const initialThreadStates = {
    'full': () => ({
        contractAddress: mkAddress('0xCCC'),
        user: mkAddress('0xAAA'),
        sender: mkAddress('0x222'),
        receiver: mkAddress('0x333'),
        balanceWeiSender: '1',
        balanceWeiReceiver: '2',
        balanceTokenSender: '3',
        balanceTokenReceiver: '4',
        txCount: 22,
        sigA: mkHash('siga'),
    }),
    'empty': () => ({
        contractAddress: mkAddress('0xCCC'),
        user: mkAddress('0xAAA'),
        sender: mkAddress('0x222'),
        receiver: mkAddress('0x333'),
        balanceWeiSender: '0',
        balanceWeiReceiver: '0',
        balanceTokenSender: '0',
        balanceTokenReceiver: '0',
        txCount: 1,
        sigA: '',
    }),
};
function getChannelState(type, ...overrides) {
    return updateChannelState(initialChannelStates[type](), ...overrides);
}
exports.getChannelState = getChannelState;
function getThreadState(type, ...overrides) {
    return updateThreadState(initialThreadStates[type](), ...overrides);
}
exports.getThreadState = getThreadState;
function assertChannelStateEqual(actual, expected) {
    exports.assert.containSubset(expandSuccinctChannel(actual), expandSuccinctChannel(expected));
}
exports.assertChannelStateEqual = assertChannelStateEqual;
function assertThreadStateEqual(actual, expected) {
    exports.assert.containSubset(expandSuccinctThread(actual), expandSuccinctThread(expected));
}
exports.assertThreadStateEqual = assertThreadStateEqual;
//# sourceMappingURL=testing.js.map