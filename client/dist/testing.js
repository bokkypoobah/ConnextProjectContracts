"use strict";
var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
var chai = __importStar(require("chai"));
//
// chai
//
chai.use(require('chai-subset'));
exports.assert = chai.assert;
function expandSussinct(s) {
    var res = {};
    Object.entries(s).forEach(function (_a) {
        var name = _a[0], value = _a[1];
        if (Array.isArray(value)) {
            res[name + 'Hub'] = value[0].toString();
            res[name + 'User'] = value[1].toString();
        }
        else {
            if (name.endsWith('Hub') || name.endsWith('User'))
                value = (!value && value != 0) ? value : value.toString();
            res[name] = value;
        }
    });
    return res;
}
exports.expandSussinct = expandSussinct;
function makeSussinct(s) {
    var res = {};
    Object.entries(s).forEach(function (_a) {
        var name = _a[0], value = _a[1];
        var didMatchSuffix = false;
        ['Hub', 'User'].forEach(function (suffix, idx) {
            if (name.endsWith(suffix)) {
                name = name.replace(suffix, '');
                if (!res[name])
                    res[name] = [];
                res[name][idx] = value && value.toString();
                didMatchSuffix = true;
            }
        });
        if (!didMatchSuffix)
            res[name] = value;
    });
    return res;
}
exports.makeSussinct = makeSussinct;
function mkAddress(prefix) {
    if (prefix === void 0) { prefix = '0x'; }
    return prefix.padEnd(42, '0');
}
exports.mkAddress = mkAddress;
function mkHash(prefix) {
    if (prefix === void 0) { prefix = '0x'; }
    return prefix.padEnd(66, '0');
}
exports.mkHash = mkHash;
function updateState(s) {
    var rest = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        rest[_i - 1] = arguments[_i];
    }
    var res = expandSussinct(s);
    for (var _a = 0, rest_1 = rest; _a < rest_1.length; _a++) {
        var s_1 = rest_1[_a];
        res = __assign({}, res, expandSussinct(s_1));
    }
    return res;
}
exports.updateState = updateState;
function getChannelState(overrides) {
    return updateState({
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
        txCountGlobal: 1,
        txCountChain: 1,
        threadRoot: mkHash(),
        threadCount: 0,
        timeout: 0,
        sigUser: '',
        sigHub: '',
    }, overrides || {});
}
exports.getChannelState = getChannelState;
function assertStateEqual(actual, expected) {
    exports.assert.containSubset(expandSussinct(actual), expandSussinct(expected));
}
exports.assertStateEqual = assertStateEqual;
