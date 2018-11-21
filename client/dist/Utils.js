"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/*********************************
 *********** UTIL FNS ************
 *********************************/
const util = require("ethereumjs-util");
const merkleUtils_1 = require("./helpers/merkleUtils");
const merkleTree_1 = require("./helpers/merkleTree");
const Web3 = require("web3");
const types_1 = require("./types");
// import types from connext
// define the utils functions
class Utils {
}
Utils.emptyRootHash = '0x0000000000000000000000000000000000000000000000000000000000000000';
Utils.emptyAddress = '0x0000000000000000000000000000000000000000';
Utils.channelStateToBN = types_1.channelStateToBN;
Utils.channelStateToString = types_1.channelStateToString;
Utils.threadStateToBN = types_1.threadStateToBN;
Utils.threadStateToString = types_1.threadStateToString;
Utils.balancesToBN = types_1.balancesToBN;
Utils.balancesToString = types_1.balancesToString;
Utils.createChannelStateUpdateHash = (channelState) => {
    const { contractAddress, user, recipient, balanceWeiHub, balanceWeiUser, balanceTokenHub, balanceTokenUser, pendingDepositWeiHub, pendingDepositWeiUser, pendingDepositTokenHub, pendingDepositTokenUser, pendingWithdrawalWeiHub, pendingWithdrawalWeiUser, pendingWithdrawalTokenHub, pendingWithdrawalTokenUser, txCountGlobal, txCountChain, threadRoot, threadCount, timeout, } = channelState;
    // hash data
    const hash = Web3.utils.soliditySha3({ type: 'address', value: contractAddress }, 
    // @ts-ignore TODO wtf??!
    { type: 'address[2]', value: [user, recipient] }, {
        type: 'uint256[2]',
        value: [balanceWeiHub, balanceWeiUser],
    }, {
        type: 'uint256[2]',
        value: [balanceTokenHub, balanceTokenUser],
    }, {
        type: 'uint256[4]',
        value: [
            pendingDepositWeiHub,
            pendingWithdrawalWeiHub,
            pendingDepositWeiUser,
            pendingWithdrawalWeiUser,
        ],
    }, {
        type: 'uint256[4]',
        value: [
            pendingDepositTokenHub,
            pendingWithdrawalTokenHub,
            pendingDepositTokenUser,
            pendingWithdrawalTokenUser,
        ],
    }, {
        type: 'uint256[2]',
        value: [txCountGlobal, txCountChain],
    }, { type: 'bytes32', value: threadRoot }, { type: 'uint256', value: threadCount }, { type: 'uint256', value: timeout });
    return hash;
};
Utils.recoverSignerFromChannelStateUpdate = (channelState, 
// could be hub or user
sig) => {
    let fingerprint = Utils.createChannelStateUpdateHash(channelState);
    fingerprint = util.toBuffer(String(fingerprint));
    const prefix = util.toBuffer('\x19Ethereum Signed Message:\n');
    const prefixedMsg = util.keccak256(Buffer.concat([
        prefix,
        util.toBuffer(String(fingerprint.length)),
        fingerprint,
    ]));
    const res = util.fromRpcSig(sig);
    const pubKey = util.ecrecover(util.toBuffer(prefixedMsg), res.v, res.r, res.s);
    const addrBuf = util.pubToAddress(pubKey);
    const addr = util.bufferToHex(addrBuf);
    console.log('recovered:', addr);
    return addr;
};
Utils.createThreadStateUpdateHash = (threadState) => {
    const { contractAddress, user, sender, receiver, balanceWeiSender, balanceWeiReceiver, balanceTokenSender, balanceTokenReceiver, txCount, } = threadState;
    // convert ChannelState to ChannelStateFingerprint
    const hash = Web3.utils.soliditySha3({ type: 'address', value: contractAddress }, { type: 'address', value: user }, { type: 'address', value: sender }, { type: 'address', value: receiver }, 
    // @ts-ignore TODO wtf??!
    {
        type: 'uint256',
        value: [balanceWeiSender, balanceWeiReceiver],
    }, {
        type: 'uint256',
        value: [balanceTokenSender, balanceTokenReceiver],
    }, { type: 'uint256', value: txCount });
    return hash;
};
Utils.recoverSignerFromThreadStateUpdate = (threadState, sig) => {
    let fingerprint = Utils.createThreadStateUpdateHash(threadState);
    fingerprint = util.toBuffer(String(fingerprint));
    const prefix = util.toBuffer('\x19Ethereum Signed Message:\n');
    const prefixedMsg = util.keccak256(Buffer.concat([
        prefix,
        util.toBuffer(String(fingerprint.length)),
        fingerprint,
    ]));
    const res = util.fromRpcSig(sig);
    const pubKey = util.ecrecover(prefixedMsg, res.v, res.r, res.s);
    const addrBuf = util.pubToAddress(pubKey);
    const addr = util.bufferToHex(addrBuf);
    console.log('recovered:', addr);
    return addr;
};
Utils.generateThreadMerkleTree = (threadInitialStates) => {
    // TO DO: should this just return emptyRootHash?
    if (threadInitialStates.length === 0) {
        throw new Error('Cannot create a Merkle tree with 0 leaves.');
    }
    let merkle;
    let elems = threadInitialStates.map(threadInitialState => {
        // hash each initial state and convert hash to buffer
        const hash = Utils.createThreadStateUpdateHash(threadInitialState);
        const buf = merkleUtils_1.MerkleUtils.hexToBuffer(hash);
        return buf;
    });
    if (elems.length % 2 !== 0) {
        // cant have odd number of leaves
        elems.push(merkleUtils_1.MerkleUtils.hexToBuffer(Utils.emptyRootHash));
    }
    merkle = new merkleTree_1.default(elems);
    return merkle;
};
Utils.generateThreadRootHash = (threadInitialStates) => {
    let threadRootHash;
    if (threadInitialStates.length === 0) {
        // reset to initial value -- no open VCs
        threadRootHash = Utils.emptyRootHash;
    }
    else {
        const merkle = Utils.generateThreadMerkleTree(threadInitialStates);
        threadRootHash = merkleUtils_1.MerkleUtils.bufferToHex(merkle.getRoot());
    }
    return threadRootHash;
};
Utils.generateThreadProof = (thread, threads) => {
    // generate hash
    const hash = Utils.createThreadStateUpdateHash(thread);
    // generate merkle tree
    let merkle = Utils.generateThreadMerkleTree(threads);
    let mproof = merkle.proof(merkleUtils_1.MerkleUtils.hexToBuffer(hash));
    let proof = [];
    for (var i = 0; i < mproof.length; i++) {
        proof.push(merkleUtils_1.MerkleUtils.bufferToHex(mproof[i]));
    }
    proof.unshift(hash);
    proof = merkleUtils_1.MerkleUtils.marshallState(proof);
    return proof;
};
exports.Utils = Utils;
// remove utils
// import * as utils from './utils'
// import {generateThreadRootHash} from './utils'
// class Connext {
//     utils = utils
// }
//# sourceMappingURL=Utils.js.map