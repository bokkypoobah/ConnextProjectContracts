"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
require('dotenv').config();
const Web3 = require('web3');
const HttpProvider = require(`ethjs-provider-http`);
const chai_1 = require("chai");
const Utils_1 = require("./Utils");
const merkleUtils_1 = require("./helpers/merkleUtils");
// import { MerkleTree } from './helpers/merkleTree'
const merkleTree_1 = require("./helpers/merkleTree");
const t = require("./testing");
describe('Utils', () => {
    let web3;
    let accounts;
    let partyA;
    before('instantiate web3', () => __awaiter(this, void 0, void 0, function* () {
        // instantiate web3
        web3 = new Web3(new HttpProvider('http://localhost:8545'));
        accounts = yield web3.eth.getAccounts();
        partyA = accounts[1];
    }));
    it('should recover the signer from the channel update when there are no threads', () => __awaiter(this, void 0, void 0, function* () {
        // create and sign channel state update
        const channelStateFingerprint = t.getChannelState('full', {
            balanceWei: [100, 200],
        });
        // generate hash
        const hash = Utils_1.Utils.createChannelStateUpdateHash(channelStateFingerprint);
        // sign
        const sig = yield web3.eth.sign(hash, partyA);
        console.log(hash); // log harcode hash for other hash test
        // recover signer
        const signer = Utils_1.Utils.recoverSignerFromChannelStateUpdate(channelStateFingerprint, sig);
        chai_1.expect(signer).to.equal(partyA.toLowerCase());
    }));
    it('should recover the signer from the thread state update', () => __awaiter(this, void 0, void 0, function* () {
        // create and sign channel state update
        const threadStateFingerprint = t.getThreadState('full', {
            balanceWei: [100, 200],
        });
        // generate hash
        const hash = Utils_1.Utils.createThreadStateUpdateHash(threadStateFingerprint);
        // sign
        const sig = yield web3.eth.sign(hash, partyA);
        console.log(hash); // log harcode hash for other hash test
        // recover signer
        const signer = Utils_1.Utils.recoverSignerFromThreadStateUpdate(threadStateFingerprint, sig);
        chai_1.expect(signer).to.equal(partyA.toLowerCase());
    }));
    it('should return the correct root hash', () => __awaiter(this, void 0, void 0, function* () {
        const threadStateFingerprint = t.getThreadState('empty', {
            balanceWei: [100, 0],
        });
        // TO DO: merkle tree class imports not working...?
        // generate hash
        const hash = Utils_1.Utils.createThreadStateUpdateHash(threadStateFingerprint);
        // construct elements
        const elements = [
            merkleUtils_1.MerkleUtils.hexToBuffer(hash),
            merkleUtils_1.MerkleUtils.hexToBuffer(Utils_1.Utils.emptyRootHash),
        ];
        const merkle = new merkleTree_1.default(elements);
        const expectedRoot = merkleUtils_1.MerkleUtils.bufferToHex(merkle.getRoot());
        const generatedRootHash = Utils_1.Utils.generateThreadRootHash([
            threadStateFingerprint,
        ]);
        chai_1.expect(generatedRootHash).to.equal(expectedRoot);
    }));
});
//# sourceMappingURL=utils.test.js.map