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
Object.defineProperty(exports, "__esModule", { value: true });
var Web3 = require("web3");
var networking_1 = require("./helpers/networking");
var Utils_1 = require("./Utils");
var Validation_1 = require("./Validation");
var types_1 = require("./types");
// anytime the hub is sending us something to sign we need a verify method that verifies that the hub isn't being a jerk
var Connext = /** @class */ (function () {
    function Connext(opts) {
        var _this = this;
        // do we actually need this?
        // contractHandlers: ContractHandlers // maybe we dont want to publicly expose
        // will be handled in the top-level wrappers
        // top level-wrappers represent wallet actions
        /*********************************
         *********** FLOW FNS ************
         *********************************/
        // these are functions that are called within the flow of certain operations
        // signs all updates retrieved from 'sync' method
        // TO DO: - must return signed hub responses
        this.verifyAndCosign = function (latestUpdate, actionItems, user) { return __awaiter(_this, void 0, void 0, function () {
            var _this = this;
            var _a, promises, signedStateUpdates;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = user;
                        if (_a) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.getDefaultUser()];
                    case 1:
                        _a = (_b.sent());
                        _b.label = 2;
                    case 2:
                        // hits hub unless dispute
                        // default user is accounts[0]
                        user = _a;
                        promises = actionItems.map(function (item, index) { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                if (index + 1 === actionItems.length) {
                                    // at end of array
                                    // item is current state
                                    return [2 /*return*/, this.createChannelStateUpdate({
                                            metadata: item.metadata,
                                            reason: item.reason,
                                            previous: latestUpdate.state,
                                            current: item.state,
                                        })];
                                }
                                else {
                                    return [2 /*return*/, this.createChannelStateUpdate({
                                            metadata: item.metadata,
                                            reason: actionItems[index + 1].reason,
                                            previous: item.state,
                                            current: actionItems[index + 1].state,
                                        })];
                                }
                                return [2 /*return*/];
                            });
                        }); });
                        return [4 /*yield*/, Promise.all(promises)
                            // post to hub
                            // get synced nonce
                        ];
                    case 3:
                        signedStateUpdates = _b.sent();
                        return [4 /*yield*/, this.updateHub(latestUpdate.state.txCountGlobal, signedStateUpdates, user)];
                    case 4: 
                    // post to hub
                    // get synced nonce
                    return [2 /*return*/, _b.sent()];
                }
            });
        }); };
        // user actions
        // should return a Promise<ContractChannelState> or a TransactionObject<void>
        // if depositing tokens, wallet must approve token transfers
        // before proposing a deposit
        this.proposeDeposit = function (deposit, user) { return __awaiter(_this, void 0, void 0, function () {
            var _a, prevChannel, hubDepositResponse, pending, signedChannel, depositTx;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = user;
                        if (_a) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.getDefaultUser()];
                    case 1:
                        _a = (_b.sent());
                        _b.label = 2;
                    case 2:
                        // default user is accounts[0]
                        user = _a;
                        return [4 /*yield*/, this.getChannel(user)
                            // post to the hub that you would like to propose deposit
                        ];
                    case 3:
                        prevChannel = _b.sent();
                        return [4 /*yield*/, this.requestDeposit(deposit, prevChannel.state.txCountGlobal, user)];
                    case 4:
                        hubDepositResponse = _b.sent();
                        pending = types_1.channelStateToPendingBalances(hubDepositResponse.state);
                        return [4 /*yield*/, this.createChannelStateUpdate({
                                metadata: hubDepositResponse.metadata,
                                reason: hubDepositResponse.reason,
                                previous: prevChannel.state,
                                current: hubDepositResponse.state,
                                pending: pending,
                            })
                            // calculate total money in channel, including bonded in threads
                        ];
                    case 5:
                        signedChannel = _b.sent();
                        return [4 /*yield*/, this.userAuthorizedDepositHandler(signedChannel.state)];
                    case 6:
                        depositTx = _b.sent();
                        return [2 /*return*/, depositTx];
                }
            });
        }); };
        this.proposeWithdrawal = function (withdrawal, user) { return __awaiter(_this, void 0, void 0, function () {
            var _a, prevChannel, hubWithdrawalResponse, pending, opts, signedUpdate, withdrawalTx;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = user;
                        if (_a) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.getDefaultUser()];
                    case 1:
                        _a = (_b.sent());
                        _b.label = 2;
                    case 2:
                        // default user is accounts[0]
                        user = _a;
                        return [4 /*yield*/, this.getChannel(user)
                            // post to the hub that you would like to propose deposit
                        ];
                    case 3:
                        prevChannel = _b.sent();
                        return [4 /*yield*/, this.requestDeposit(withdrawal, prevChannel.state.txCountGlobal, user)
                            // gets passed into validators
                        ];
                    case 4:
                        hubWithdrawalResponse = _b.sent();
                        pending = types_1.channelStateToPendingBalances(hubWithdrawalResponse.state);
                        opts = {
                            reason: hubWithdrawalResponse.reason,
                            previous: prevChannel.state,
                            current: hubWithdrawalResponse.state,
                            pending: pending,
                        };
                        return [4 /*yield*/, this.createChannelStateUpdate(opts)
                            // calculate total money in channel, including bonded in threads
                        ];
                    case 5:
                        signedUpdate = _b.sent();
                        return [4 /*yield*/, this.userAuthorizedDepositHandler(signedUpdate.state)];
                    case 6:
                        withdrawalTx = _b.sent();
                        return [2 /*return*/, withdrawalTx];
                }
            });
        }); };
        // TO DO: sync with will to implement fully
        this.proposeExchange = function (exchangeAmount, // amount of wei/erc wanted
        desiredCurrency, user) { return __awaiter(_this, void 0, void 0, function () {
            var _a, prevChannel, hubExchangeResponse, opts, signedChannel;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = user;
                        if (_a) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.getDefaultUser()];
                    case 1:
                        _a = (_b.sent());
                        _b.label = 2;
                    case 2:
                        // hits hub unless dispute, then hits sync and retry
                        // NOTE: this may actually not be the case, will refer to diagrams
                        // on implementation
                        // default user is accounts[0]
                        user = _a;
                        desiredCurrency = this.tokenName || 'WEI';
                        return [4 /*yield*/, this.getChannel(user)
                            // post to the hub that you would like to propose deposit
                        ];
                    case 3:
                        prevChannel = _b.sent();
                        return [4 /*yield*/, this.requestExchange(exchangeAmount, desiredCurrency, prevChannel.state.txCountGlobal + 1, user)
                            // gets passed into validators
                        ];
                    case 4:
                        hubExchangeResponse = _b.sent();
                        opts = {
                            reason: hubExchangeResponse.reason,
                            previous: prevChannel.state,
                            current: hubExchangeResponse.state,
                            exchangeAmount: exchangeAmount,
                        };
                        return [4 /*yield*/, this.createChannelStateUpdate(opts)];
                    case 5:
                        signedChannel = _b.sent();
                        return [2 /*return*/, signedChannel];
                }
            });
        }); };
        this.openThread = function (receiver, balance, user) { return __awaiter(_this, void 0, void 0, function () {
            var _a, prevChannel, threadState, signedThreadState, prevBN, balBN, expectedWeiUser, expectedTokenUser, initialThreadStates, newThreadRoot, proposedChannel, signedChannel;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = user;
                        if (_a) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.getDefaultUser()];
                    case 1:
                        _a = (_b.sent());
                        _b.label = 2;
                    case 2:
                        // hits hub unless dispute
                        // default user is accounts[0]
                        user = _a;
                        return [4 /*yield*/, this.getChannel(user)
                            // create initial thread state
                        ];
                    case 3:
                        prevChannel = _b.sent();
                        threadState = {
                            contractAddress: prevChannel.state.contractAddress,
                            user: user,
                            sender: user,
                            receiver: receiver,
                            balanceWeiReceiver: '0',
                            balanceTokenReceiver: '0',
                            balanceWeiSender: balance.balanceWei,
                            balanceTokenSender: balance.balanceToken,
                            txCount: 0,
                        };
                        return [4 /*yield*/, this.createThreadStateUpdate({
                                current: threadState,
                                payment: balance,
                            })];
                    case 4:
                        signedThreadState = _b.sent();
                        prevBN = types_1.channelStateToBN(prevChannel.state);
                        balBN = Utils_1.Utils.balancesToBN(balance);
                        expectedWeiUser = prevBN.balanceWeiUser.sub(balBN.balanceWei);
                        expectedTokenUser = prevBN.balanceWeiUser.sub(balBN.balanceToken);
                        return [4 /*yield*/, this.getInitialThreadStates(user)];
                    case 5:
                        initialThreadStates = _b.sent();
                        initialThreadStates.push(threadState);
                        newThreadRoot = Utils_1.Utils.generateThreadRootHash(initialThreadStates);
                        proposedChannel = {
                            contractAddress: prevChannel.state.contractAddress,
                            user: prevChannel.state.user,
                            recipient: prevChannel.state.recipient,
                            balanceWeiHub: prevChannel.state.balanceWeiHub,
                            balanceWeiUser: expectedWeiUser.toString(),
                            balanceTokenHub: prevChannel.state.balanceTokenHub,
                            balanceTokenUser: expectedTokenUser.toString(),
                            pendingDepositWeiHub: prevChannel.state.pendingDepositWeiHub,
                            pendingDepositWeiUser: prevChannel.state.pendingDepositWeiUser,
                            pendingDepositTokenHub: prevChannel.state.pendingDepositTokenHub,
                            pendingDepositTokenUser: prevChannel.state.pendingDepositTokenUser,
                            pendingWithdrawalWeiHub: prevChannel.state.pendingWithdrawalWeiHub,
                            pendingWithdrawalWeiUser: prevChannel.state.pendingWithdrawalWeiUser,
                            pendingWithdrawalTokenHub: prevChannel.state.pendingWithdrawalTokenHub,
                            pendingWithdrawalTokenUser: prevChannel.state.pendingWithdrawalTokenUser,
                            txCountGlobal: prevChannel.state.txCountGlobal + 1,
                            txCountChain: prevChannel.state.txCountChain,
                            threadRoot: newThreadRoot,
                            threadCount: prevChannel.state.threadCount - 1,
                            timeout: 0,
                        };
                        return [4 /*yield*/, this.createChannelStateUpdate({
                                reason: 'OpenThread',
                                previous: prevChannel.state,
                                current: proposedChannel,
                                receiver: receiver,
                                threadState: signedThreadState,
                            })];
                    case 6:
                        signedChannel = _b.sent();
                        return [2 /*return*/, signedChannel];
                }
            });
        }); };
        // TO DO: fix for performer closing thread
        this.closeThread = function (receiver, user, signer) { return __awaiter(_this, void 0, void 0, function () {
            var _a, closerIsReceiver, latestThread, previousChannel, prevBN, threadBN, expectedTokenBalanceHub, expectedWeiBalanceHub, expectedTokenBalanceUser, expectedWeiBalanceUser, initialThreadStates, threads, newThreads, newThreadRoot, proposedChannel, signedChannel;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = signer;
                        if (_a) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.getDefaultUser()];
                    case 1:
                        _a = (_b.sent());
                        _b.label = 2;
                    case 2:
                        // default user is accounts[0]
                        signer = _a;
                        closerIsReceiver = signer.toLowerCase() === receiver.toLowerCase();
                        return [4 /*yield*/, this.getThreadByParties(receiver, user)
                            // get channel
                        ];
                    case 3:
                        latestThread = _b.sent();
                        return [4 /*yield*/, this.getChannel(user)];
                    case 4:
                        previousChannel = _b.sent();
                        prevBN = types_1.channelStateToBN(previousChannel.state);
                        threadBN = types_1.threadStateToBN(latestThread);
                        if (closerIsReceiver) {
                            expectedWeiBalanceHub = prevBN.balanceWeiHub.add(threadBN.balanceWeiSender);
                            expectedTokenBalanceHub = prevBN.balanceTokenHub.add(threadBN.balanceTokenSender);
                            expectedWeiBalanceUser = prevBN.balanceWeiHub.add(threadBN.balanceWeiReceiver);
                            expectedTokenBalanceUser = prevBN.balanceTokenHub.add(threadBN.balanceTokenReceiver);
                        }
                        else {
                            expectedWeiBalanceHub = prevBN.balanceWeiHub.add(threadBN.balanceWeiReceiver);
                            expectedTokenBalanceHub = prevBN.balanceTokenHub.add(threadBN.balanceTokenReceiver);
                            expectedWeiBalanceUser = prevBN.balanceWeiHub.add(threadBN.balanceWeiSender);
                            expectedTokenBalanceUser = prevBN.balanceTokenHub.add(threadBN.balanceTokenSender);
                        }
                        return [4 /*yield*/, this.getInitialThreadStates(user)];
                    case 5:
                        initialThreadStates = _b.sent();
                        initialThreadStates = initialThreadStates.filter(function (threadState) {
                            return threadState.user !== user && threadState.receiver !== receiver;
                        });
                        return [4 /*yield*/, this.getThreads(user)];
                    case 6:
                        threads = _b.sent();
                        newThreads = threads.filter(function (threadState) {
                            return threadState.user !== user && threadState.receiver !== receiver;
                        });
                        newThreadRoot = Utils_1.Utils.generateThreadRootHash(initialThreadStates);
                        proposedChannel = {
                            contractAddress: previousChannel.state.contractAddress,
                            user: previousChannel.state.user,
                            recipient: previousChannel.state.recipient,
                            balanceWeiHub: expectedWeiBalanceHub.toString(),
                            balanceWeiUser: expectedWeiBalanceUser.toString(),
                            balanceTokenHub: expectedTokenBalanceHub.toString(),
                            balanceTokenUser: expectedTokenBalanceUser.toString(),
                            pendingDepositWeiHub: previousChannel.state.pendingDepositWeiHub,
                            pendingDepositWeiUser: previousChannel.state.pendingDepositWeiUser,
                            pendingDepositTokenHub: previousChannel.state.pendingDepositTokenHub,
                            pendingDepositTokenUser: previousChannel.state.pendingDepositTokenUser,
                            pendingWithdrawalWeiHub: previousChannel.state.pendingWithdrawalWeiHub,
                            pendingWithdrawalWeiUser: previousChannel.state.pendingWithdrawalWeiUser,
                            pendingWithdrawalTokenHub: previousChannel.state.pendingWithdrawalTokenHub,
                            pendingWithdrawalTokenUser: previousChannel.state.pendingWithdrawalTokenUser,
                            txCountGlobal: previousChannel.state.txCountGlobal + 1,
                            txCountChain: previousChannel.state.txCountChain,
                            threadRoot: newThreadRoot,
                            threadCount: previousChannel.state.threadCount - 1,
                            timeout: 0,
                        };
                        return [4 /*yield*/, this.createChannelStateUpdate({
                                reason: 'CloseThread',
                                previous: previousChannel.state,
                                current: proposedChannel,
                                threadState: latestThread,
                            })];
                    case 7:
                        signedChannel = _b.sent();
                        return [2 /*return*/, signedChannel];
                }
            });
        }); };
        this.threadPayment = function (payment, metadata, receiver, user) { return __awaiter(_this, void 0, void 0, function () {
            var _a, prevThreadState, proposedThreadState, paymentBN, prevStateBN, proposedBalanceWeiSender, proposedBalanceWeiReceiver, proposedBalanceTokenSender, proposedBalanceTokenReceiver, signedThread;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = user;
                        if (_a) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.getDefaultUser()];
                    case 1:
                        _a = (_b.sent());
                        _b.label = 2;
                    case 2:
                        // hits hub unless dispute
                        user = _a;
                        return [4 /*yield*/, this.getThreadByParties(receiver, user)];
                    case 3:
                        prevThreadState = _b.sent();
                        proposedThreadState = prevThreadState // does this just create a reference to it...?
                        ;
                        paymentBN = Utils_1.Utils.balancesToBN(payment);
                        prevStateBN = Utils_1.Utils.threadStateToBN(prevThreadState);
                        proposedBalanceWeiSender = prevStateBN.balanceWeiSender.sub(paymentBN.balanceWei);
                        proposedBalanceWeiReceiver = prevStateBN.balanceWeiReceiver.add(paymentBN.balanceWei);
                        proposedBalanceTokenSender = prevStateBN.balanceTokenSender.sub(paymentBN.balanceToken);
                        proposedBalanceTokenReceiver = prevStateBN.balanceTokenReceiver.add(paymentBN.balanceToken);
                        proposedThreadState.balanceTokenReceiver = proposedBalanceTokenReceiver.toString();
                        proposedThreadState.balanceWeiReceiver = proposedBalanceWeiReceiver.toString();
                        proposedThreadState.balanceTokenSender = proposedBalanceTokenSender.toString();
                        proposedThreadState.balanceWeiSender = proposedBalanceWeiSender.toString();
                        return [4 /*yield*/, this.createThreadStateUpdate({
                                payment: payment,
                                previous: prevThreadState,
                                current: proposedThreadState,
                            })
                            // TO DO: post to hub
                            // const signedChannelHub = channelStateToChannelStateUpdate(
                            //   'Payment',
                            //   signedThread,
                            //   metadata,
                            // )
                        ];
                    case 4:
                        signedThread = _b.sent();
                        // TO DO: post to hub
                        // const signedChannelHub = channelStateToChannelStateUpdate(
                        //   'Payment',
                        //   signedThread,
                        //   metadata,
                        // )
                        return [2 /*return*/, signedThread];
                }
            });
        }); };
        this.channelPayment = function (payment, metadata, user) { return __awaiter(_this, void 0, void 0, function () {
            var _a, previousChannel, paymentBN, prevStateBN, proposedBalanceWeiUser, proposedBalanceWeiHub, proposedBalanceTokenUser, proposedBalanceTokenHub, proposedState, signedChannelUpdate, hubResponse;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = user;
                        if (_a) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.getDefaultUser()];
                    case 1:
                        _a = (_b.sent());
                        _b.label = 2;
                    case 2:
                        // hits hub unless dispute
                        user = _a;
                        return [4 /*yield*/, this.getChannel(user)];
                    case 3:
                        previousChannel = _b.sent();
                        paymentBN = Utils_1.Utils.balancesToBN(payment);
                        prevStateBN = Utils_1.Utils.channelStateToBN(previousChannel.state);
                        proposedBalanceWeiUser = prevStateBN.balanceWeiUser.sub(paymentBN.balanceWei);
                        proposedBalanceWeiHub = prevStateBN.balanceWeiHub.add(paymentBN.balanceWei);
                        proposedBalanceTokenUser = prevStateBN.balanceTokenUser.sub(paymentBN.balanceToken);
                        proposedBalanceTokenHub = prevStateBN.balanceTokenHub.add(paymentBN.balanceToken);
                        proposedState = {
                            contractAddress: previousChannel.state.contractAddress,
                            user: previousChannel.state.user,
                            recipient: previousChannel.state.recipient,
                            balanceWeiHub: proposedBalanceWeiHub.toString(),
                            balanceWeiUser: proposedBalanceWeiUser.toString(),
                            balanceTokenHub: proposedBalanceTokenHub.toString(),
                            balanceTokenUser: proposedBalanceTokenUser.toString(),
                            pendingDepositWeiHub: previousChannel.state.pendingDepositWeiHub,
                            pendingDepositWeiUser: previousChannel.state.pendingDepositWeiUser,
                            pendingDepositTokenHub: previousChannel.state.pendingDepositTokenHub,
                            pendingDepositTokenUser: previousChannel.state.pendingDepositTokenUser,
                            pendingWithdrawalWeiHub: previousChannel.state.pendingWithdrawalWeiHub,
                            pendingWithdrawalWeiUser: previousChannel.state.pendingWithdrawalWeiUser,
                            pendingWithdrawalTokenHub: previousChannel.state.pendingWithdrawalTokenHub,
                            pendingWithdrawalTokenUser: previousChannel.state.pendingWithdrawalTokenUser,
                            txCountGlobal: previousChannel.state.txCountGlobal + 1,
                            txCountChain: previousChannel.state.txCountChain,
                            threadRoot: previousChannel.state.threadRoot,
                            threadCount: previousChannel.state.threadCount,
                            timeout: 0,
                        };
                        return [4 /*yield*/, this.createChannelStateUpdate({
                                reason: 'Payment',
                                previous: previousChannel.state,
                                current: proposedState,
                                payment: payment,
                                metadata: metadata,
                            })
                            // post to hub
                        ];
                    case 4:
                        signedChannelUpdate = _b.sent();
                        return [4 /*yield*/, this.updateHub(proposedState.txCountGlobal, [signedChannelUpdate], user)];
                    case 5:
                        hubResponse = _b.sent();
                        return [2 /*return*/, hubResponse];
                }
            });
        }); };
        // only here when working on happy case
        // TO DO: implement disputes
        this.enterDisputeCase = function (reason) { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
            return [2 /*return*/];
        }); }); };
        // top level functions
        // note: update meta should be consistent with what hub expects
        // for payments, signer primarily used for testing
        // public createThreadStateUpdate = createThreadStateUpdate
        /*********************************
         *********** HUB FNS *************
         *********************************/
        // return all open initial thread states
        this.getInitialThreadStates = function (user) { return __awaiter(_this, void 0, void 0, function () {
            var _a, res, e_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = user;
                        if (_a) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.getDefaultUser()];
                    case 1:
                        _a = (_b.sent());
                        _b.label = 2;
                    case 2:
                        // set default user
                        user = _a;
                        _b.label = 3;
                    case 3:
                        _b.trys.push([3, 5, , 6]);
                        return [4 /*yield*/, this.networking.get("channel/" + user.toLowerCase() + "/initial-thread-states")];
                    case 4:
                        res = _b.sent();
                        return [2 /*return*/, res.data];
                    case 5:
                        e_1 = _b.sent();
                        if (e_1.status === 404) {
                            return [2 /*return*/, []];
                        }
                        throw e_1;
                    case 6: return [2 /*return*/];
                }
            });
        }); };
        // return channel for user
        this.getChannel = function (user) { return __awaiter(_this, void 0, void 0, function () {
            var _a, res, e_2;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = user;
                        if (_a) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.getDefaultUser()];
                    case 1:
                        _a = (_b.sent());
                        _b.label = 2;
                    case 2:
                        // set default user
                        user = _a;
                        _b.label = 3;
                    case 3:
                        _b.trys.push([3, 5, , 6]);
                        return [4 /*yield*/, this.networking.get("channel/" + user.toLowerCase())];
                    case 4:
                        res = _b.sent();
                        return [2 /*return*/, res.data];
                    case 5:
                        e_2 = _b.sent();
                        if (e_2.status === 404) {
                            throw new Error("Channel not found for user " + user);
                        }
                        throw e_2;
                    case 6: return [2 /*return*/];
                }
            });
        }); };
        // hits the hubs sync endpoint to return all actionable states
        this.sync = function (txCountGlobal, user) { return __awaiter(_this, void 0, void 0, function () {
            var _a, res, e_3;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = user;
                        if (_a) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.getDefaultUser()];
                    case 1:
                        _a = (_b.sent());
                        _b.label = 2;
                    case 2:
                        // set default user
                        user = _a;
                        _b.label = 3;
                    case 3:
                        _b.trys.push([3, 5, , 6]);
                        return [4 /*yield*/, this.networking.post("channel/" + user.toLowerCase() + "/sync", {
                                txCount: txCountGlobal,
                            })];
                    case 4:
                        res = _b.sent();
                        return [2 /*return*/, res.data];
                    case 5:
                        e_3 = _b.sent();
                        if (e_3.status === 404) {
                            return [2 /*return*/, []];
                        }
                        throw e_3;
                    case 6: return [2 /*return*/];
                }
            });
        }); };
        // return state at specified global nonce
        this.getChannelStateAtNonce = function (txCountGlobal, user) { return __awaiter(_this, void 0, void 0, function () {
            var _a, syncStates;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = user;
                        if (_a) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.getDefaultUser()];
                    case 1:
                        _a = (_b.sent());
                        _b.label = 2;
                    case 2:
                        // set default user
                        user = _a;
                        return [4 /*yield*/, this.sync(txCountGlobal, user)];
                    case 3:
                        syncStates = _b.sent();
                        return [2 /*return*/, syncStates.find(function (syncState) {
                                return syncState.state.txCountGlobal === txCountGlobal;
                            })];
                }
            });
        }); };
        this.getThreads = function (user) { return __awaiter(_this, void 0, void 0, function () {
            var _a, response;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = user;
                        if (_a) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.getDefaultUser()];
                    case 1:
                        _a = (_b.sent());
                        _b.label = 2;
                    case 2:
                        // set default user
                        user = _a;
                        return [4 /*yield*/, this.networking.get("channel/" + user.toLowerCase() + "/threads")];
                    case 3:
                        response = _b.sent();
                        if (!response.data) {
                            return [2 /*return*/, []];
                        }
                        return [2 /*return*/, response.data];
                }
            });
        }); };
        // return all threads bnetween 2 addresses
        this.getThreadByParties = function (receiver, user) { return __awaiter(_this, void 0, void 0, function () {
            var _a, threads, thread;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = user;
                        if (_a) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.getDefaultUser()];
                    case 1:
                        _a = (_b.sent());
                        _b.label = 2;
                    case 2:
                        // set default user
                        user = _a;
                        return [4 /*yield*/, this.getThreads(receiver)];
                    case 3:
                        threads = _b.sent();
                        thread = threads.find(function (thread) { return thread.user === user; });
                        if (!thread) {
                            throw new Error("No thread found for " + receiver + " and " + user);
                        }
                        return [2 /*return*/, thread];
                }
            });
        }); };
        this.getThreadAtTxCount = function (txCount, receiver, user) { return __awaiter(_this, void 0, void 0, function () {
            var _a, threads, thread;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = user;
                        if (_a) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.getDefaultUser()];
                    case 1:
                        _a = (_b.sent());
                        _b.label = 2;
                    case 2:
                        // set default user
                        user = _a;
                        return [4 /*yield*/, this.getThreads(receiver)];
                    case 3:
                        threads = _b.sent();
                        if (!threads || threads.length === 0) {
                            throw new Error("\u00E7");
                        }
                        thread = threads.find(function (thread) {
                            return thread.user === user && thread.txCount === txCount;
                        });
                        if (!thread) {
                            throw new Error("No thread found for " + receiver + " and " + user + " at txCount " + txCount);
                        }
                        return [2 /*return*/, thread];
                }
            });
        }); };
        // post to hub telling user wants to deposit
        this.requestDeposit = function (deposit, txCount, user) { return __awaiter(_this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.networking.post("channel/" + user.toLowerCase() + "/request-deposit", {
                            weiDeposit: deposit.balanceWei,
                            tokenDeposit: deposit.balanceToken,
                            txCount: txCount,
                        })];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response.data];
                }
            });
        }); };
        // post to hub telling user wants to deposit
        this.requestWithdrawal = function (withdrawal, txCount, user) { return __awaiter(_this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.networking.post("channel/" + user.toLowerCase() + "/request-withdrawal", {
                            weiDeposit: withdrawal.balanceWei,
                            tokenDeposit: withdrawal.balanceToken,
                            txCount: txCount,
                        })];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response.data];
                }
            });
        }); };
        // post to hub telling user wants to exchange
        this.requestExchange = function (exchangeAmount, desiredCurrency, txCount, user) { return __awaiter(_this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.networking.post("channel/" + user.toLowerCase() + "/request-exchange", {
                            desiredCurrency: desiredCurrency,
                            exchangeAmount: exchangeAmount,
                            txCount: txCount,
                        })];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response.data];
                }
            });
        }); };
        // performer calls this when they wish to start a show
        // return the proposed deposit fro the hub which should then be verified and cosigned
        this.requestCollateral = function (txCount, user) { return __awaiter(_this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.networking.post("channel/" + user.toLowerCase() + "/request-collateralization", {
                            txCount: txCount,
                        })];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response.data];
                }
            });
        }); };
        this.updateHub = function (txCount, updates, user) { return __awaiter(_this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.networking.post("channel/" + user.toLowerCase() + "/update", {
                            txCount: txCount,
                            updates: updates,
                        })];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response.data];
                }
            });
        }); };
        /*********************************
         ********** HELPER FNS ***********
         *********************************/
        // get accounts[0] as default user
        this.getDefaultUser = function () { return __awaiter(_this, void 0, void 0, function () {
            var accounts;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.web3.eth.getAccounts()];
                    case 1:
                        accounts = _a.sent();
                        return [2 /*return*/, accounts[0]];
                }
            });
        }); };
        // function returns signature on each type of update
        this.createChannelStateUpdate = function (opts, user) { return __awaiter(_this, void 0, void 0, function () {
            var reason, previous, current, _a, previousBN, proposedBN, signedState, _b, user2hub, weiPayment, tokenPayment, calculatedPayment, pendingToPropose, pendingToConfirm, updatedState;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        reason = opts.reason, previous = opts.previous, current = opts.current;
                        _a = user;
                        if (_a) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.getDefaultUser()];
                    case 1:
                        _a = (_c.sent());
                        _c.label = 2;
                    case 2:
                        user = _a;
                        previousBN = Utils_1.Utils.channelStateToBN(previous);
                        proposedBN = Utils_1.Utils.channelStateToBN(current);
                        _b = reason;
                        switch (_b) {
                            case 'Payment': return [3 /*break*/, 3];
                            case 'Exchange': return [3 /*break*/, 5];
                            case 'ProposePending': return [3 /*break*/, 6];
                            case 'ConfirmPending': return [3 /*break*/, 8];
                            case 'OpenThread': return [3 /*break*/, 10];
                            case 'CloseThread': return [3 /*break*/, 12];
                        }
                        return [3 /*break*/, 14];
                    case 3:
                        user2hub = previousBN.balanceTokenHub.lte(proposedBN.balanceTokenHub) &&
                            previousBN.balanceWeiHub.lte(proposedBN.balanceWeiHub);
                        weiPayment = user2hub
                            ? previousBN.balanceWeiUser.sub(proposedBN.balanceWeiUser)
                            : previousBN.balanceWeiHub.sub(proposedBN.balanceWeiHub);
                        tokenPayment = user2hub
                            ? previousBN.balanceTokenUser.sub(proposedBN.balanceTokenUser)
                            : previousBN.balanceTokenHub.sub(proposedBN.balanceTokenHub);
                        calculatedPayment = {
                            balanceWei: weiPayment.toString(),
                            balanceToken: tokenPayment.toString(),
                        };
                        return [4 /*yield*/, this.signPaymentUpdate(opts.payment || calculatedPayment, // dpayment
                            previous, current)];
                    case 4:
                        signedState = _c.sent();
                        return [3 /*break*/, 15];
                    case 5: 
                    // const test = (opts.updatedChannel = await this.signExchangeUpdate(
                    //   opts.exchangeAmount,
                    //   previous,
                    //   current,
                    // ))
                    return [3 /*break*/, 15];
                    case 6:
                        pendingToPropose = opts.pending || types_1.channelStateToPendingBalances(current);
                        return [4 /*yield*/, this.signProposedPendingUpdate(pendingToPropose, previous, current)];
                    case 7:
                        signedState = _c.sent();
                        return [3 /*break*/, 15];
                    case 8:
                        pendingToConfirm = opts.pending || types_1.channelStateToPendingBalances(current);
                        return [4 /*yield*/, this.signConfirmPendingUpdate(pendingToConfirm, previous, current)];
                    case 9:
                        signedState = _c.sent();
                        return [3 /*break*/, 15];
                    case 10: return [4 /*yield*/, this.signOpenThreadUpdate(
                        // TO DO: fix better
                        //           Argument of type '_ThreadStateFingerprint<string> | undefin
                        // ed' is not assignable to parameter of type '_ThreadStateFingerprint<string>'.
                        opts.threadState, previous, current)];
                    case 11:
                        signedState = _c.sent();
                        return [3 /*break*/, 15];
                    case 12: return [4 /*yield*/, this.signCloseThreadUpdate(opts.threadState, previous, current)];
                    case 13:
                        // TO DO:
                        // retrieve the final thread state from previous channel state
                        // if it doesnt exist (i.e sync)
                        signedState = _c.sent();
                        return [3 /*break*/, 15];
                    case 14:
                        // TO DO: ask wolever
                        // @ts-ignore
                        assertUnreachable(reason);
                        _c.label = 15;
                    case 15:
                        updatedState = {
                            state: signedState,
                            metadata: opts.metadata,
                            reason: opts.reason,
                        };
                        return [2 /*return*/, updatedState];
                }
            });
        }); };
        // handlers for update types
        // TO DO: implement
        this.signExchangeUpdate = function (exchangeAmount, previousChannelState, proposedChannelState) { return __awaiter(_this, void 0, void 0, function () {
            var validatorOpts, isValid, hash, sigUser, signedState;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        validatorOpts = {
                            reason: 'Exchange',
                            previous: previousChannelState,
                            current: proposedChannelState,
                            hubAddress: this.hubAddress,
                            exchangeAmount: exchangeAmount,
                        };
                        isValid = Validation_1.Validation.validateChannelStateUpdate(validatorOpts);
                        if (!isValid) {
                            throw new Error("Error validating update: " + isValid);
                        }
                        console.log('Account', proposedChannelState.user, ' is signing:', proposedChannelState);
                        hash = Utils_1.Utils.createChannelStateUpdateHash(proposedChannelState);
                        return [4 /*yield*/, this.web3.eth.personal.sign(hash, proposedChannelState.user)];
                    case 1:
                        sigUser = _a.sent();
                        signedState = types_1.channelStateToSignedChannelState(proposedChannelState, sigUser);
                        return [2 /*return*/, signedState];
                }
            });
        }); };
        this.signPaymentUpdate = function (payment, previousChannelState, proposedChannelState) { return __awaiter(_this, void 0, void 0, function () {
            var validatorOpts, isValid, hash, sigUser, signedState;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        validatorOpts = {
                            reason: 'Payment',
                            previous: previousChannelState,
                            current: proposedChannelState,
                            hubAddress: this.hubAddress,
                            payment: payment,
                        };
                        isValid = Validation_1.Validation.validateChannelStateUpdate(validatorOpts);
                        if (!isValid) {
                            throw new Error("Error validating update: " + isValid);
                        }
                        console.log('Account', proposedChannelState.user, ' is signing:', proposedChannelState);
                        hash = Utils_1.Utils.createChannelStateUpdateHash(proposedChannelState);
                        return [4 /*yield*/, this.web3.eth.personal.sign(hash, proposedChannelState.user)];
                    case 1:
                        sigUser = _a.sent();
                        signedState = types_1.channelStateToSignedChannelState(proposedChannelState, sigUser);
                        return [2 /*return*/, signedState];
                }
            });
        }); };
        // TO DO: implement
        this.signOpenThreadUpdate = function (proposedThreadState, previousChannelState, proposedChannelState) { return __awaiter(_this, void 0, void 0, function () {
            var validatorOpts, isValid, hash, sigUser, signedState;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        validatorOpts = {
                            reason: 'OpenThread',
                            previous: previousChannelState,
                            current: proposedChannelState,
                            hubAddress: this.hubAddress,
                            threadState: proposedThreadState,
                        };
                        isValid = Validation_1.Validation.validateChannelStateUpdate(validatorOpts);
                        if (!isValid) {
                            throw new Error("Error validating update: " + isValid);
                        }
                        console.log('Account', proposedChannelState.user, ' is signing:', proposedChannelState);
                        hash = Utils_1.Utils.createChannelStateUpdateHash(proposedChannelState);
                        return [4 /*yield*/, this.web3.eth.personal.sign(hash, proposedChannelState.user)];
                    case 1:
                        sigUser = _a.sent();
                        signedState = types_1.channelStateToSignedChannelState(proposedChannelState, sigUser);
                        return [2 /*return*/, signedState];
                }
            });
        }); };
        // TO DO: implement
        this.signCloseThreadUpdate = function (finalThreadState, previousChannelState, proposedChannelState) { return __awaiter(_this, void 0, void 0, function () {
            var validatorOpts, isValid, hash, sigUser, signedState;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        validatorOpts = {
                            reason: 'CloseThread',
                            previous: previousChannelState,
                            current: proposedChannelState,
                            hubAddress: this.hubAddress,
                            threadState: finalThreadState,
                        };
                        isValid = Validation_1.Validation.validateChannelStateUpdate(validatorOpts);
                        if (!isValid) {
                            throw new Error("Error validating update: " + isValid);
                        }
                        console.log('Account', proposedChannelState.user, ' is signing:', proposedChannelState);
                        hash = Utils_1.Utils.createChannelStateUpdateHash(proposedChannelState);
                        return [4 /*yield*/, this.web3.eth.personal.sign(hash, proposedChannelState.user)];
                    case 1:
                        sigUser = _a.sent();
                        signedState = types_1.channelStateToSignedChannelState(proposedChannelState, sigUser);
                        return [2 /*return*/, signedState];
                }
            });
        }); };
        // get proposed exchange could be called
        this.signProposedPendingUpdate = function (pending, previousChannelState, proposedChannelState) { return __awaiter(_this, void 0, void 0, function () {
            var validatorOpts, isValid, hash, sigUser, signedState;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        validatorOpts = {
                            reason: 'ProposePending',
                            previous: previousChannelState,
                            current: proposedChannelState,
                            hubAddress: this.hubAddress,
                            pending: pending,
                        };
                        isValid = Validation_1.Validation.validateChannelStateUpdate(validatorOpts);
                        if (!isValid) {
                            throw new Error("Error validating update: " + isValid);
                        }
                        console.log('Account', proposedChannelState.user, ' is signing:', proposedChannelState);
                        hash = Utils_1.Utils.createChannelStateUpdateHash(proposedChannelState);
                        return [4 /*yield*/, this.web3.eth.personal.sign(hash, proposedChannelState.user)];
                    case 1:
                        sigUser = _a.sent();
                        signedState = types_1.channelStateToSignedChannelState(proposedChannelState, sigUser);
                        return [2 /*return*/, signedState];
                }
            });
        }); };
        this.signConfirmPendingUpdate = function (pending, previousChannelState, proposedChannelState) { return __awaiter(_this, void 0, void 0, function () {
            var validatorOpts, isValid, hash, sigUser, signedState;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        validatorOpts = {
                            reason: 'ConfirmPending',
                            previous: previousChannelState,
                            current: proposedChannelState,
                            hubAddress: this.hubAddress,
                            pending: pending,
                        };
                        isValid = Validation_1.Validation.validateChannelStateUpdate(validatorOpts);
                        if (!isValid) {
                            throw new Error("Error validating update: " + isValid);
                        }
                        console.log('Account', proposedChannelState.user, ' is signing:', proposedChannelState);
                        hash = Utils_1.Utils.createChannelStateUpdateHash(proposedChannelState);
                        return [4 /*yield*/, this.web3.eth.personal.sign(hash, proposedChannelState.user)];
                    case 1:
                        sigUser = _a.sent();
                        signedState = types_1.channelStateToSignedChannelState(proposedChannelState, sigUser);
                        return [2 /*return*/, signedState];
                }
            });
        }); };
        // function returns signature on thread updates
        // TO DO: finish
        this.createThreadStateUpdate = function (opts, meta) { return __awaiter(_this, void 0, void 0, function () {
            var isValid, hash, signed, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        isValid = Validation_1.Validation.validateThreadStateUpdate(opts);
                        if (!isValid) {
                            throw new Error("Error validating update: " + isValid);
                        }
                        hash = Utils_1.Utils.createThreadStateUpdateHash(opts.current);
                        signed = opts.current;
                        // @ts-ignore
                        _a = signed;
                        return [4 /*yield*/, this.web3.eth.personal.sign(hash, opts.current.sender)];
                    case 1:
                        // @ts-ignore
                        _a.sigA = _b.sent();
                        return [2 /*return*/, signed];
                }
            });
        }); };
        /*********************************
         ********* CONTRACT FNS **********
         *********************************/
        this.userAuthorizedDepositHandler = function (stateStr) { return __awaiter(_this, void 0, void 0, function () {
            var bondedWei, state, threads, bondedToken, channelTotalWei, channelTotalToken, tx;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        state = types_1.channelStateToBN(stateStr);
                        return [4 /*yield*/, this.getThreads(state.user)];
                    case 1:
                        threads = _a.sent();
                        threads.reduce(function (prevStr, currStr) {
                            var prev = types_1.threadStateToBN(prevStr);
                            var curr = types_1.threadStateToBN(currStr);
                            if (prev.receiver !== state.user) {
                                // user is payor
                                var threadWei = prev.balanceWeiSender
                                    .add(prev.balanceWeiReceiver)
                                    .add(curr.balanceWeiSender)
                                    .add(curr.balanceWeiReceiver);
                                return threadWei;
                            }
                        }, bondedWei);
                        threads.reduce(function (prevStr, currStr) {
                            var prev = types_1.threadStateToBN(prevStr);
                            var curr = types_1.threadStateToBN(currStr);
                            if (prev.receiver !== state.user) {
                                // user is payor
                                var threadToken = prev.balanceTokenReceiver
                                    .add(prev.balanceTokenSender)
                                    .add(curr.balanceTokenReceiver)
                                    .add(curr.balanceTokenSender);
                                return threadToken;
                            }
                        }, bondedToken);
                        channelTotalWei = state.balanceWeiHub
                            .add(state.balanceWeiUser)
                            .add(bondedWei);
                        channelTotalToken = state.balanceTokenHub
                            .add(state.balanceTokenUser)
                            .add(bondedToken);
                        return [4 /*yield*/, this.channelManager.methods
                                .userAuthorizedUpdate(state.user, // recipient
                            [
                                state.balanceWeiHub.toString(),
                                state.balanceWeiUser.toString(),
                                channelTotalWei.toString(),
                            ], [
                                state.balanceTokenHub.toString(),
                                state.balanceTokenUser.toString(),
                                channelTotalToken.toString(),
                            ], [
                                state.pendingDepositWeiHub.toString(),
                                state.pendingWithdrawalWeiHub.toString(),
                                state.pendingDepositWeiUser.toString(),
                                state.pendingWithdrawalWeiUser.toString(),
                            ], [
                                state.pendingDepositTokenHub.toString(),
                                state.pendingWithdrawalTokenHub.toString(),
                                state.pendingDepositTokenUser.toString(),
                                state.pendingWithdrawalTokenUser.toString(),
                            ], [state.txCountGlobal, state.txCountChain], state.threadRoot, state.threadCount, state.timeout, 
                            // @ts-ignore WTF???
                            state.sigHub)
                                .send({
                                from: state.user,
                                value: state.pendingDepositWeiUser.toString(),
                            })];
                    case 2:
                        tx = _a.sent();
                        return [2 /*return*/, tx];
                }
            });
        }); };
        this.web3 = new Web3(opts.web3.currentProvider); // convert legacy web3 0.x to 1.x
        this.hubAddress = opts.hubAddress.toLowerCase();
        this.hubUrl = opts.hubUrl;
        // TO DO: how to include abis?
        // this.channelManager = new this.web3.eth.Contract(
        //   channelManagerAbi,
        //   opts.contractAddress,
        // ) as ChannelManager
        // TO DO: contract must compile and deploy, doesnt atm
        this.channelManager = null; // TODO: fix
        this.networking = new networking_1.Networking(opts.hubUrl);
        this.tokenAddress = opts.tokenAddress;
        this.tokenName = opts.tokenName;
        // this.token = opts.tokenAddress
        //   ? (new this.web3.eth.Contract(tokenAbi, opts.tokenAddress) as ERC20)
        //   : null
    }
    Connext.utils = new Utils_1.Utils();
    // validation lives here may be private in future
    Connext.validation = new Validation_1.Validation();
    return Connext;
}());
exports.Connext = Connext;
