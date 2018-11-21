"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = y[op[0] & 2 ? "return" : op[0] ? "throw" : "next"]) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [0, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _this = this;
Object.defineProperty(exports, "__esModule", { value: true });
require('dotenv').config();
var Web3 = require('web3');
var HttpProvider = require("ethjs-provider-http");
var chai_1 = require("chai");
var Utils_1 = require("./Utils");
var merkleUtils_1 = require("./helpers/merkleUtils");
// import { MerkleTree } from './helpers/merkleTree'
var merkleTree_1 = __importDefault(require("./helpers/merkleTree"));
describe('Utils', function () {
    var web3;
    var accounts;
    var partyA;
    before('instantiate web3', function () { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // instantiate web3
                    web3 = new Web3(new HttpProvider('http://localhost:8545'));
                    return [4 /*yield*/, web3.eth.getAccounts()];
                case 1:
                    accounts = _a.sent();
                    partyA = accounts[1];
                    return [2 /*return*/];
            }
        });
    }); });
    it('should recover the signer from the channel update when there are no threads', function () { return __awaiter(_this, void 0, void 0, function () {
        var channelStateFingerprint, hash, sig, signer;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    channelStateFingerprint = {
                        contractAddress: partyA,
                        user: partyA,
                        recipient: partyA,
                        balanceWeiHub: '10',
                        balanceWeiUser: '10',
                        balanceTokenHub: '10',
                        balanceTokenUser: '10',
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
                        threadRoot: Utils_1.Utils.emptyRootHash,
                        threadCount: 0,
                        timeout: 0,
                    };
                    hash = Utils_1.Utils.createChannelStateUpdateHash(channelStateFingerprint);
                    return [4 /*yield*/, web3.eth.sign(hash, partyA)];
                case 1:
                    sig = _a.sent();
                    console.log(hash); // log harcode hash for other hash test
                    signer = Utils_1.Utils.recoverSignerFromChannelStateUpdate(channelStateFingerprint, sig);
                    chai_1.expect(signer).to.equal(partyA.toLowerCase());
                    return [2 /*return*/];
            }
        });
    }); });
    it('should recover the signer from the thread state update', function () { return __awaiter(_this, void 0, void 0, function () {
        var threadStateFingerprint, hash, sig, signer;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    threadStateFingerprint = {
                        contractAddress: partyA,
                        user: partyA,
                        sender: partyA,
                        receiver: partyA,
                        balanceWeiSender: '10',
                        balanceWeiReceiver: '10',
                        balanceTokenReceiver: '10',
                        balanceTokenSender: '10',
                        txCount: 1,
                    };
                    hash = Utils_1.Utils.createThreadStateUpdateHash(threadStateFingerprint);
                    return [4 /*yield*/, web3.eth.sign(hash, partyA)];
                case 1:
                    sig = _a.sent();
                    console.log(hash); // log harcode hash for other hash test
                    signer = Utils_1.Utils.recoverSignerFromThreadStateUpdate(threadStateFingerprint, sig);
                    chai_1.expect(signer).to.equal(partyA.toLowerCase());
                    return [2 /*return*/];
            }
        });
    }); });
    it('should return the correct root hash', function () { return __awaiter(_this, void 0, void 0, function () {
        var threadStateFingerprint, hash, elements, merkle, expectedRoot, generatedRootHash;
        return __generator(this, function (_a) {
            threadStateFingerprint = {
                contractAddress: partyA,
                user: partyA,
                sender: partyA,
                receiver: partyA,
                balanceWeiSender: '10',
                balanceWeiReceiver: '10',
                balanceTokenReceiver: '10',
                balanceTokenSender: '10',
                txCount: 1,
            };
            hash = Utils_1.Utils.createThreadStateUpdateHash(threadStateFingerprint);
            elements = [
                merkleUtils_1.MerkleUtils.hexToBuffer(hash),
                merkleUtils_1.MerkleUtils.hexToBuffer(Utils_1.Utils.emptyRootHash),
            ];
            merkle = new merkleTree_1.default(elements);
            expectedRoot = merkleUtils_1.MerkleUtils.bufferToHex(merkle.getRoot());
            generatedRootHash = Utils_1.Utils.generateThreadRootHash([
                threadStateFingerprint,
            ]);
            chai_1.expect(generatedRootHash).to.equal(expectedRoot);
            return [2 /*return*/];
        });
    }); });
});
