"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Web3 = require('web3');
class MerkleUtils {
}
MerkleUtils.getBytes = (input) => {
    if (Buffer.isBuffer(input))
        input = '0x' + input.toString('hex');
    if (66 - input.length <= 0)
        return Web3.utils.toHex(input);
    return MerkleUtils.padBytes32(Web3.utils.toHex(input));
};
MerkleUtils.marshallState = (inputs) => {
    var m = MerkleUtils.getBytes(inputs[0]);
    for (var i = 1; i < inputs.length; i++) {
        let x = MerkleUtils.getBytes(inputs[i]);
        m += x.substr(2, x.length);
    }
    return m;
};
MerkleUtils.getCTFaddress = (_r) => {
    return Web3.utils.sha3(_r, { encoding: 'hex' });
};
MerkleUtils.getCTFstate = (_contract, _signers, _args) => {
    _args.unshift(_contract);
    var _m = MerkleUtils.marshallState(_args);
    _signers.push(_contract.length);
    _signers.push(_m);
    var _r = MerkleUtils.marshallState(_signers);
    return _r;
};
MerkleUtils.padBytes32 = (data) => {
    // TODO: check input is hex / move to TS
    let l = 66 - data.length;
    let x = data.substr(2, data.length);
    for (var i = 0; i < l; i++) {
        x = 0 + x;
    }
    return '0x' + x;
};
MerkleUtils.rightPadBytes32 = (data) => {
    let l = 66 - data.length;
    for (var i = 0; i < l; i++) {
        data += 0;
    }
    return data;
};
MerkleUtils.hexToBuffer = (hexString) => {
    return new Buffer(hexString.substr(2, hexString.length), 'hex');
};
MerkleUtils.bufferToHex = (buffer) => {
    return '0x' + buffer.toString('hex');
};
MerkleUtils.isHash = (buffer) => {
    return buffer.length === 32 && Buffer.isBuffer(buffer);
};
exports.MerkleUtils = MerkleUtils;
//# sourceMappingURL=merkleUtils.js.map