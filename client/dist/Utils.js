"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/*********************************
 *********** UTIL FNS ************
 *********************************/
var util = require("ethereumjs-util");
var merkleUtils_1 = require("./helpers/merkleUtils");
var merkleTree_1 = __importDefault(require("./helpers/merkleTree"));
var Web3 = require("web3");
var types_1 = require("./types");
// import types from connext
// define the utils functions
var Utils = /** @class */ (function () {
    function Utils() {
    }
    Utils.emptyRootHash = '0x0000000000000000000000000000000000000000000000000000000000000000';
    Utils.emptyAddress = '0x0000000000000000000000000000000000000000';
    Utils.channelStateToBN = types_1.channelStateToBN;
    Utils.channelStateToString = types_1.channelStateToString;
    Utils.threadStateToBN = types_1.threadStateToBN;
    Utils.threadStateToString = types_1.threadStateToString;
    Utils.balancesToBN = types_1.balancesToBN;
    Utils.balancesToString = types_1.balancesToString;
    Utils.createChannelStateUpdateHash = function (channelState) {
        var contractAddress = channelState.contractAddress, user = channelState.user, recipient = channelState.recipient, balanceWeiHub = channelState.balanceWeiHub, balanceWeiUser = channelState.balanceWeiUser, balanceTokenHub = channelState.balanceTokenHub, balanceTokenUser = channelState.balanceTokenUser, pendingDepositWeiHub = channelState.pendingDepositWeiHub, pendingDepositWeiUser = channelState.pendingDepositWeiUser, pendingDepositTokenHub = channelState.pendingDepositTokenHub, pendingDepositTokenUser = channelState.pendingDepositTokenUser, pendingWithdrawalWeiHub = channelState.pendingWithdrawalWeiHub, pendingWithdrawalWeiUser = channelState.pendingWithdrawalWeiUser, pendingWithdrawalTokenHub = channelState.pendingWithdrawalTokenHub, pendingWithdrawalTokenUser = channelState.pendingWithdrawalTokenUser, txCountGlobal = channelState.txCountGlobal, txCountChain = channelState.txCountChain, threadRoot = channelState.threadRoot, threadCount = channelState.threadCount, timeout = channelState.timeout;
        // hash data
        var hash = Web3.utils.soliditySha3({ type: 'address', value: contractAddress }, 
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
    Utils.recoverSignerFromChannelStateUpdate = function (channelState, 
    // could be hub or user
    sig) {
        var fingerprint = Utils.createChannelStateUpdateHash(channelState);
        fingerprint = util.toBuffer(String(fingerprint));
        var prefix = util.toBuffer('\x19Ethereum Signed Message:\n');
        var prefixedMsg = util.keccak256(Buffer.concat([
            prefix,
            util.toBuffer(String(fingerprint.length)),
            fingerprint,
        ]));
        var res = util.fromRpcSig(sig);
        var pubKey = util.ecrecover(util.toBuffer(prefixedMsg), res.v, res.r, res.s);
        var addrBuf = util.pubToAddress(pubKey);
        var addr = util.bufferToHex(addrBuf);
        console.log('recovered:', addr);
        return addr;
    };
    Utils.createThreadStateUpdateHash = function (threadState) {
        var contractAddress = threadState.contractAddress, user = threadState.user, sender = threadState.sender, receiver = threadState.receiver, balanceWeiSender = threadState.balanceWeiSender, balanceWeiReceiver = threadState.balanceWeiReceiver, balanceTokenSender = threadState.balanceTokenSender, balanceTokenReceiver = threadState.balanceTokenReceiver, txCount = threadState.txCount;
        // convert ChannelState to ChannelStateFingerprint
        var hash = Web3.utils.soliditySha3({ type: 'address', value: contractAddress }, { type: 'address', value: user }, { type: 'address', value: sender }, { type: 'address', value: receiver }, 
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
    Utils.recoverSignerFromThreadStateUpdate = function (threadState, sig) {
        var fingerprint = Utils.createThreadStateUpdateHash(threadState);
        fingerprint = util.toBuffer(String(fingerprint));
        var prefix = util.toBuffer('\x19Ethereum Signed Message:\n');
        var prefixedMsg = util.keccak256(Buffer.concat([
            prefix,
            util.toBuffer(String(fingerprint.length)),
            fingerprint,
        ]));
        var res = util.fromRpcSig(sig);
        var pubKey = util.ecrecover(prefixedMsg, res.v, res.r, res.s);
        var addrBuf = util.pubToAddress(pubKey);
        var addr = util.bufferToHex(addrBuf);
        console.log('recovered:', addr);
        return addr;
    };
    Utils.generateThreadMerkleTree = function (threadInitialStates) {
        // TO DO: should this just return emptyRootHash?
        if (threadInitialStates.length === 0) {
            throw new Error('Cannot create a Merkle tree with 0 leaves.');
        }
        var merkle;
        var elems = threadInitialStates.map(function (threadInitialState) {
            // hash each initial state and convert hash to buffer
            var hash = Utils.createThreadStateUpdateHash(threadInitialState);
            var buf = merkleUtils_1.MerkleUtils.hexToBuffer(hash);
            return buf;
        });
        if (elems.length % 2 !== 0) {
            // cant have odd number of leaves
            elems.push(merkleUtils_1.MerkleUtils.hexToBuffer(Utils.emptyRootHash));
        }
        merkle = new merkleTree_1.default(elems);
        return merkle;
    };
    Utils.generateThreadRootHash = function (threadInitialStates) {
        var threadRootHash;
        if (threadInitialStates.length === 0) {
            // reset to initial value -- no open VCs
            threadRootHash = Utils.emptyRootHash;
        }
        else {
            var merkle = Utils.generateThreadMerkleTree(threadInitialStates);
            threadRootHash = merkleUtils_1.MerkleUtils.bufferToHex(merkle.getRoot());
        }
        return threadRootHash;
    };
    Utils.generateThreadProof = function (thread, threads) {
        // generate hash
        var hash = Utils.createThreadStateUpdateHash(thread);
        // generate merkle tree
        var merkle = Utils.generateThreadMerkleTree(threads);
        var mproof = merkle.proof(merkleUtils_1.MerkleUtils.hexToBuffer(hash));
        var proof = [];
        for (var i = 0; i < mproof.length; i++) {
            proof.push(merkleUtils_1.MerkleUtils.bufferToHex(mproof[i]));
        }
        proof.unshift(hash);
        proof = merkleUtils_1.MerkleUtils.marshallState(proof);
        return proof;
    };
    return Utils;
}());
exports.Utils = Utils;
// remove utils
// import * as utils from './utils'
// import {generateThreadRootHash} from './utils'
// class Connext {
//     utils = utils
// }
