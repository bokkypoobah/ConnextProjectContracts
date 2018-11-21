"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
var t = __importStar(require("./testing"));
var testing_1 = require("./testing");
describe('makeSussinct', function () {
    it('should work', function () {
        testing_1.assert.deepEqual(t.makeSussinct({
            balanceWeiHub: '1',
            balanceWeiUser: '2',
            timeout: 69,
        }), {
            balanceWei: ['1', '2'],
            timeout: 69,
        });
    });
});
describe('expandSussinct', function () {
    it('should work', function () {
        testing_1.assert.deepEqual(t.expandSussinct({
            balanceWei: ['1', '2'],
            timeout: 69,
        }), {
            balanceWeiHub: '1',
            balanceWeiUser: '2',
            timeout: 69,
        });
    });
});
describe('assertStateEqual', function () {
    it('should work', function () {
        var state = t.getChannelState({
            balanceWei: [100, 200],
        });
        t.assertStateEqual(state, {
            balanceWeiHub: '100',
            balanceWeiUser: '200',
        });
        state = t.updateState(state, {
            timeout: 69,
            balanceWeiUser: 42,
            balanceToken: [6, 9],
        });
        t.assertStateEqual(state, {
            balanceWei: [100, 42],
            balanceTokenHub: '6',
            balanceTokenUser: '9',
            timeout: 69,
        });
    });
});
