"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Web3 = require('web3');
var MerkleUtils = /** @class */ (function () {
    function MerkleUtils() {
    }
    MerkleUtils.getBytes = function (input) {
        if (Buffer.isBuffer(input))
            input = '0x' + input.toString('hex');
        if (66 - input.length <= 0)
            return Web3.utils.toHex(input);
        return MerkleUtils.padBytes32(Web3.utils.toHex(input));
    };
    MerkleUtils.marshallState = function (inputs) {
        var m = MerkleUtils.getBytes(inputs[0]);
        for (var i = 1; i < inputs.length; i++) {
            var x = MerkleUtils.getBytes(inputs[i]);
            m += x.substr(2, x.length);
        }
        return m;
    };
    MerkleUtils.getCTFaddress = function (_r) {
        return Web3.utils.sha3(_r, { encoding: 'hex' });
    };
    MerkleUtils.getCTFstate = function (_contract, _signers, _args) {
        _args.unshift(_contract);
        var _m = MerkleUtils.marshallState(_args);
        _signers.push(_contract.length);
        _signers.push(_m);
        var _r = MerkleUtils.marshallState(_signers);
        return _r;
    };
    MerkleUtils.padBytes32 = function (data) {
        // TODO: check input is hex / move to TS
        var l = 66 - data.length;
        var x = data.substr(2, data.length);
        for (var i = 0; i < l; i++) {
            x = 0 + x;
        }
        return '0x' + x;
    };
    MerkleUtils.rightPadBytes32 = function (data) {
        var l = 66 - data.length;
        for (var i = 0; i < l; i++) {
            data += 0;
        }
        return data;
    };
    MerkleUtils.hexToBuffer = function (hexString) {
        return new Buffer(hexString.substr(2, hexString.length), 'hex');
    };
    MerkleUtils.bufferToHex = function (buffer) {
        return '0x' + buffer.toString('hex');
    };
    MerkleUtils.isHash = function (buffer) {
        return buffer.length === 32 && Buffer.isBuffer(buffer);
    };
    return MerkleUtils;
}());
exports.MerkleUtils = MerkleUtils;
