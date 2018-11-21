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
const Web3 = require("web3");
const channelManagerAbi = require('./typechain/abi/ChannelManagerAbi');
const networking_1 = require("./helpers/networking");
const Utils_1 = require("./Utils");
const Validation_1 = require("./Validation");
const types_1 = require("./types");
// anytime the hub is sending us something to sign we need a verify method that verifies that the hub isn't being a jerk
class Connext {
    constructor(opts) {
        /*********************************
         *********** FLOW FNS ************
         *********************************/
        // these are functions that are called within the flow of certain operations
        // signs + submits all updates retrieved from 'sync' method
        // verifies cosigns and submits to hub all in one call
        this.verifyAndCosignAndSubmit = (latestUpdate, actionItems, user) => __awaiter(this, void 0, void 0, function* () {
            // default user is accounts[0]
            user = user || (yield this.getDefaultUser());
            const signedStateUpdates = yield this.verifyAndCosign(latestUpdate, actionItems, user);
            return yield this.updateHub(latestUpdate.state.txCountGlobal, signedStateUpdates, user);
        });
        // only returns the signed states to allow wallet to decide when and how they get submitted
        this.verifyAndCosign = (latestUpdate, actionItems, user) => __awaiter(this, void 0, void 0, function* () {
            // hits hub unless dispute
            // default user is accounts[0]
            user = user || (yield this.getDefaultUser());
            // verify and sign each item since pending deposit
            // wc: I am only passing in one update at a time so this will work.
            // however if I did pass in more than 1 update there is a problem with promise.alling here and it won't work
            // this is because if we pass in more than 1 update each update has the previous nonce as previous update not the nonce teh whole array started at
            const promises = actionItems.map((item, index) => __awaiter(this, void 0, void 0, function* () {
                if (index + 1 === actionItems.length) {
                    // at end of array
                    // item is current state
                    return this.createChannelStateUpdate({
                        metadata: item.metadata,
                        reason: item.reason,
                        previous: latestUpdate.state,
                        current: item.state,
                    });
                }
                else {
                    return this.createChannelStateUpdate({
                        metadata: item.metadata,
                        reason: actionItems[index + 1].reason,
                        previous: item.state,
                        current: actionItems[index + 1].state,
                    });
                }
            }));
            const signedStateUpdates = yield Promise.all(promises);
            return signedStateUpdates;
        });
        // user actions
        // should return a Promise<ContractChannelState> or a TransactionObject<void>
        // if depositing tokens, wallet must approve token transfers
        // before proposing a deposit
        this.proposeDeposit = (deposit, user) => __awaiter(this, void 0, void 0, function* () {
            // default user is accounts[0]
            user = user || (yield this.getDefaultUser());
            const prevChannel = yield this.getChannel(user);
            // post to the hub that you would like to propose deposit
            const hubDepositResponse = yield this.requestDeposit(deposit, prevChannel.state.txCountGlobal, user);
            const pending = types_1.channelStateToPendingBalances(hubDepositResponse.state);
            // gets passed into validators
            const signedChannel = yield this.createChannelStateUpdate({
                metadata: hubDepositResponse.metadata,
                reason: hubDepositResponse.reason,
                previous: prevChannel.state,
                current: hubDepositResponse.state,
                pending,
            });
            // calculate total money in channel, including bonded in threads
            const depositTx = yield this.userAuthorizedDepositHandler(signedChannel.state);
            return depositTx;
        });
        this.proposeWithdrawal = (withdrawal, user) => __awaiter(this, void 0, void 0, function* () {
            // default user is accounts[0]
            user = user || (yield this.getDefaultUser());
            const prevChannel = yield this.getChannel(user);
            // post to the hub that you would like to propose deposit
            const hubWithdrawalResponse = yield this.requestDeposit(withdrawal, prevChannel.state.txCountGlobal, user);
            // gets passed into validators
            const pending = types_1.channelStateToPendingBalances(hubWithdrawalResponse.state);
            const opts = {
                reason: hubWithdrawalResponse.reason,
                previous: prevChannel.state,
                current: hubWithdrawalResponse.state,
                pending,
            };
            const signedUpdate = yield this.createChannelStateUpdate(opts);
            // calculate total money in channel, including bonded in threads
            const withdrawalTx = yield this.userAuthorizedDepositHandler(signedUpdate.state);
            return withdrawalTx;
        });
        // TO DO: sync with will to implement fully
        this.proposeExchange = (exchangeAmount, // amount of wei/erc wanted
        desiredCurrency, user) => __awaiter(this, void 0, void 0, function* () {
            // hits hub unless dispute, then hits sync and retry
            // NOTE: this may actually not be the case, will refer to diagrams
            // on implementation
            // default user is accounts[0]
            user = user || (yield this.getDefaultUser());
            desiredCurrency = this.tokenName || 'WEI';
            // get channel
            const prevChannel = yield this.getChannel(user);
            // post to the hub that you would like to propose deposit
            const hubExchangeResponse = yield this.requestExchange(exchangeAmount, desiredCurrency, prevChannel.state.txCountGlobal + 1, user);
            // gets passed into validators
            const opts = {
                reason: hubExchangeResponse.reason,
                previous: prevChannel.state,
                current: hubExchangeResponse.state,
                exchangeAmount,
            };
            const signedChannel = yield this.createChannelStateUpdate(opts);
            return signedChannel;
        });
        this.openThread = (receiver, balance, user) => __awaiter(this, void 0, void 0, function* () {
            // hits hub unless dispute
            // default user is accounts[0]
            user = user || (yield this.getDefaultUser());
            // get channel
            const prevChannel = yield this.getChannel(user);
            // create initial thread state
            const threadState = {
                contractAddress: prevChannel.state.contractAddress,
                user,
                sender: user,
                receiver,
                balanceWeiReceiver: '0',
                balanceTokenReceiver: '0',
                balanceWeiSender: balance.balanceWei,
                balanceTokenSender: balance.balanceToken,
                txCount: 0,
            };
            const signedThreadState = yield this.createThreadStateUpdate({
                current: threadState,
                payment: balance,
            });
            const prevBN = types_1.channelStateToBN(prevChannel.state);
            const balBN = Utils_1.Utils.balancesToBN(balance);
            // generate expected state
            const expectedWeiUser = prevBN.balanceWeiUser.sub(balBN.balanceWei);
            const expectedTokenUser = prevBN.balanceWeiUser.sub(balBN.balanceToken);
            // regenerate thread root on open
            let initialThreadStates = yield this.getInitialThreadStates(user);
            initialThreadStates.push(threadState);
            const newThreadRoot = Utils_1.Utils.generateThreadRootHash(initialThreadStates);
            // generate expected state
            let proposedChannel = {
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
            const signedChannel = yield this.createChannelStateUpdate({
                reason: 'OpenThread',
                previous: prevChannel.state,
                current: proposedChannel,
                receiver,
                threadState: signedThreadState,
            });
            return signedChannel;
        });
        // TO DO: fix for performer closing thread
        this.closeThread = (receiver, user, signer) => __awaiter(this, void 0, void 0, function* () {
            // default user is accounts[0]
            signer = signer || (yield this.getDefaultUser());
            // see if it is the receiver closing
            const closerIsReceiver = signer.toLowerCase() === receiver.toLowerCase();
            // get latest thread state --> should wallet pass in?
            const latestThread = yield this.getThreadByParties(receiver, user);
            // get channel
            const previousChannel = yield this.getChannel(user);
            const prevBN = types_1.channelStateToBN(previousChannel.state);
            const threadBN = types_1.threadStateToBN(latestThread);
            // generate expected balances for channel
            let expectedTokenBalanceHub, expectedWeiBalanceHub, expectedTokenBalanceUser, expectedWeiBalanceUser;
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
            // generate new root hash
            let initialThreadStates = yield this.getInitialThreadStates(user);
            initialThreadStates = initialThreadStates.filter((threadState) => threadState.user !== user && threadState.receiver !== receiver);
            const threads = yield this.getThreads(user);
            const newThreads = threads.filter(threadState => threadState.user !== user && threadState.receiver !== receiver);
            const newThreadRoot = Utils_1.Utils.generateThreadRootHash(initialThreadStates);
            // generate expected state
            let proposedChannel = {
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
            const signedChannel = yield this.createChannelStateUpdate({
                reason: 'CloseThread',
                previous: previousChannel.state,
                current: proposedChannel,
                threadState: latestThread,
            });
            return signedChannel;
        });
        this.threadPayment = (payment, metadata, receiver, user) => __awaiter(this, void 0, void 0, function* () {
            // hits hub unless dispute
            user = user || (yield this.getDefaultUser());
            // get thread
            const prevThreadState = yield this.getThreadByParties(receiver, user);
            let proposedThreadState = prevThreadState; // does this just create a reference to it...?
            const paymentBN = Utils_1.Utils.balancesToBN(payment);
            const prevStateBN = Utils_1.Utils.threadStateToBN(prevThreadState);
            // generate expected update
            const proposedBalanceWeiSender = prevStateBN.balanceWeiSender.sub(paymentBN.balanceWei);
            const proposedBalanceWeiReceiver = prevStateBN.balanceWeiReceiver.add(paymentBN.balanceWei);
            const proposedBalanceTokenSender = prevStateBN.balanceTokenSender.sub(paymentBN.balanceToken);
            const proposedBalanceTokenReceiver = prevStateBN.balanceTokenReceiver.add(paymentBN.balanceToken);
            proposedThreadState.balanceTokenReceiver = proposedBalanceTokenReceiver.toString();
            proposedThreadState.balanceWeiReceiver = proposedBalanceWeiReceiver.toString();
            proposedThreadState.balanceTokenSender = proposedBalanceTokenSender.toString();
            proposedThreadState.balanceWeiSender = proposedBalanceWeiSender.toString();
            const signedThread = yield this.createThreadStateUpdate({
                payment,
                previous: prevThreadState,
                current: proposedThreadState,
            });
            // TO DO: post to hub
            // const signedChannelHub = channelStateToChannelStateUpdate(
            //   'Payment',
            //   signedThread,
            //   metadata,
            // )
            return signedThread;
        });
        this.channelPayment = (payment, metadata, user) => __awaiter(this, void 0, void 0, function* () {
            // hits hub unless dispute
            user = user || (yield this.getDefaultUser());
            // get channel
            const previousChannel = yield this.getChannel(user);
            const paymentBN = Utils_1.Utils.balancesToBN(payment);
            const prevStateBN = Utils_1.Utils.channelStateToBN(previousChannel.state);
            // generate expected update
            const proposedBalanceWeiUser = prevStateBN.balanceWeiUser.sub(paymentBN.balanceWei);
            const proposedBalanceWeiHub = prevStateBN.balanceWeiHub.add(paymentBN.balanceWei);
            const proposedBalanceTokenUser = prevStateBN.balanceTokenUser.sub(paymentBN.balanceToken);
            const proposedBalanceTokenHub = prevStateBN.balanceTokenHub.add(paymentBN.balanceToken);
            // generate expected state
            const proposedState = {
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
            const signedChannelUpdate = yield this.createChannelStateUpdate({
                reason: 'Payment',
                previous: previousChannel.state,
                current: proposedState,
                payment,
                metadata: metadata,
            });
            // post to hub
            const hubResponse = yield this.updateHub(proposedState.txCountGlobal, [signedChannelUpdate], user);
            return hubResponse;
        });
        // only here when working on happy case
        // TO DO: implement disputes
        this.enterDisputeCase = (reason) => __awaiter(this, void 0, void 0, function* () { });
        // top level functions
        // note: update meta should be consistent with what hub expects
        // for payments, signer primarily used for testing
        // public createThreadStateUpdate = createThreadStateUpdate
        /*********************************
         *********** HUB FNS *************
         *********************************/
        // return all open initial thread states
        this.getInitialThreadStates = (user) => __awaiter(this, void 0, void 0, function* () {
            // set default user
            user = user || (yield this.getDefaultUser());
            // get the current channel state and return it
            try {
                const res = yield this.networking.get(`channel/${user.toLowerCase()}/initial-thread-states`);
                return res.data;
            }
            catch (e) {
                if (e.status === 404) {
                    return [];
                }
                throw e;
            }
        });
        // return channel for user
        this.getChannel = (user) => __awaiter(this, void 0, void 0, function* () {
            // set default user
            user = user || (yield this.getDefaultUser());
            // get the current channel state and return it
            try {
                const res = yield this.networking.get(`channel/${user.toLowerCase()}`);
                return res.data;
            }
            catch (e) {
                if (e.status === 404) {
                    throw new Error(`Channel not found for user ${user}`);
                }
                throw e;
            }
        });
        // hits the hubs sync endpoint to return all actionable states
        this.sync = (txCountGlobal, user) => __awaiter(this, void 0, void 0, function* () {
            // set default user
            user = user || (yield this.getDefaultUser());
            try {
                const res = yield this.networking.post(`channel/${user.toLowerCase()}/sync`, {
                    txCount: txCountGlobal,
                });
                return res.data;
            }
            catch (e) {
                if (e.status === 404) {
                    return [];
                }
                throw e;
            }
        });
        // return state at specified global nonce
        this.getChannelStateAtNonce = (txCountGlobal, user) => __awaiter(this, void 0, void 0, function* () {
            // set default user
            user = user || (yield this.getDefaultUser());
            // get the channel state at specified nonce
            const syncStates = yield this.sync(txCountGlobal, user);
            return syncStates.find((syncState) => syncState.state.txCountGlobal === txCountGlobal);
        });
        this.getThreads = (user) => __awaiter(this, void 0, void 0, function* () {
            // set default user
            user = user || (yield this.getDefaultUser());
            // get the current channel state and return it
            const response = yield this.networking.get(`channel/${user.toLowerCase()}/threads`);
            if (!response.data) {
                return [];
            }
            return response.data;
        });
        // return all threads bnetween 2 addresses
        this.getThreadByParties = (receiver, user) => __awaiter(this, void 0, void 0, function* () {
            // set default user
            user = user || (yield this.getDefaultUser());
            // get receiver threads
            const threads = yield this.getThreads(receiver);
            const thread = threads.find((thread) => thread.user === user);
            if (!thread) {
                throw new Error(`No thread found for ${receiver} and ${user}`);
            }
            return thread;
        });
        this.getThreadAtTxCount = (txCount, receiver, user) => __awaiter(this, void 0, void 0, function* () {
            // set default user
            user = user || (yield this.getDefaultUser());
            // get receiver threads
            const threads = yield this.getThreads(receiver);
            if (!threads || threads.length === 0) {
                throw new Error(`ç`);
            }
            const thread = threads.find((thread) => thread.user === user && thread.txCount === txCount);
            if (!thread) {
                throw new Error(`No thread found for ${receiver} and ${user} at txCount ${txCount}`);
            }
            return thread;
        });
        // post to hub telling user wants to deposit
        this.requestDeposit = (deposit, txCount, user) => __awaiter(this, void 0, void 0, function* () {
            const response = yield this.networking.post(`channel/${user.toLowerCase()}/request-deposit`, {
                weiDeposit: deposit.balanceWei,
                tokenDeposit: deposit.balanceToken,
                txCount,
            });
            return response.data;
        });
        // post to hub telling user wants to deposit
        this.requestWithdrawal = (withdrawal, txCount, user) => __awaiter(this, void 0, void 0, function* () {
            const response = yield this.networking.post(`channel/${user.toLowerCase()}/request-withdrawal`, {
                weiDeposit: withdrawal.balanceWei,
                tokenDeposit: withdrawal.balanceToken,
                txCount,
            });
            return response.data;
        });
        // post to hub telling user wants to exchange
        this.requestExchange = (exchangeAmount, desiredCurrency, txCount, user) => __awaiter(this, void 0, void 0, function* () {
            const response = yield this.networking.post(`channel/${user.toLowerCase()}/request-exchange`, {
                desiredCurrency,
                exchangeAmount,
                txCount,
            });
            return response.data;
        });
        // performer calls this when they wish to start a show
        // return the proposed deposit fro the hub which should then be verified and cosigned
        this.requestCollateral = (txCount, user) => __awaiter(this, void 0, void 0, function* () {
            const response = yield this.networking.post(`channel/${user.toLowerCase()}/request-collateralization`, {
                txCount,
            });
            return response.data;
        });
        this.updateHub = (txCount, updates, user) => __awaiter(this, void 0, void 0, function* () {
            const response = yield this.networking.post(`channel/${user.toLowerCase()}/update`, {
                txCount,
                updates,
            });
            return response.data;
        });
        /*********************************
         ********** HELPER FNS ***********
         *********************************/
        // get accounts[0] as default user
        this.getDefaultUser = () => __awaiter(this, void 0, void 0, function* () {
            const accounts = yield this.web3.eth.getAccounts();
            return accounts[0];
        });
        // function returns signature on each type of update
        this.createChannelStateUpdate = (opts, user) => __awaiter(this, void 0, void 0, function* () {
            // default signer to accounts[0] if it is not provided
            const { reason, previous, current } = opts;
            user = user || (yield this.getDefaultUser());
            const previousBN = Utils_1.Utils.channelStateToBN(previous);
            const proposedBN = Utils_1.Utils.channelStateToBN(current);
            // create a channel state update based on the reason
            let signedState;
            switch (reason) {
                case 'Payment':
                    // calculate payment
                    // user2hub if hub balance increases in either dominatio
                    const user2hub = previousBN.balanceTokenHub.lte(proposedBN.balanceTokenHub) &&
                        previousBN.balanceWeiHub.lte(proposedBN.balanceWeiHub);
                    const weiPayment = user2hub
                        ? previousBN.balanceWeiUser.sub(proposedBN.balanceWeiUser)
                        : previousBN.balanceWeiHub.sub(proposedBN.balanceWeiHub);
                    const tokenPayment = user2hub
                        ? previousBN.balanceTokenUser.sub(proposedBN.balanceTokenUser)
                        : previousBN.balanceTokenHub.sub(proposedBN.balanceTokenHub);
                    const calculatedPayment = {
                        balanceWei: weiPayment.toString(),
                        balanceToken: tokenPayment.toString(),
                    };
                    signedState = yield this.signPaymentUpdate(opts.payment || calculatedPayment, // dpayment
                    previous, current);
                    break;
                case 'Exchange':
                    // const test = (opts.updatedChannel = await this.signExchangeUpdate(
                    //   opts.exchangeAmount,
                    //   previous,
                    //   current,
                    // ))
                    break;
                case 'ProposePending':
                    // calculate pending if not provided
                    const pendingToPropose = opts.pending || types_1.channelStateToPendingBalances(current);
                    signedState = yield this.signProposedPendingUpdate(pendingToPropose, previous, current);
                    break;
                case 'ConfirmPending':
                    // calculate the pending amounts
                    const pendingToConfirm = opts.pending || types_1.channelStateToPendingBalances(current);
                    signedState = yield this.signConfirmPendingUpdate(pendingToConfirm, previous, current);
                    break;
                case 'OpenThread':
                    signedState = yield this.signOpenThreadUpdate(
                    // TO DO: fix better
                    //           Argument of type '_ThreadStateFingerprint<string> | undefin
                    // ed' is not assignable to parameter of type '_ThreadStateFingerprint<string>'.
                    opts.threadState, previous, current);
                    break;
                case 'CloseThread':
                    // TO DO:
                    // retrieve the final thread state from previous channel state
                    // if it doesnt exist (i.e sync)
                    signedState = yield this.signCloseThreadUpdate(opts.threadState, previous, current);
                    break;
                default:
                    // TO DO: ask wolever
                    // @ts-ignore
                    assertUnreachable(reason);
            }
            const updatedState = {
                state: signedState,
                metadata: opts.metadata,
                reason: opts.reason,
            };
            return updatedState;
        });
        // handlers for update types
        // TO DO: implement
        this.signExchangeUpdate = (exchangeAmount, previousChannelState, proposedChannelState) => __awaiter(this, void 0, void 0, function* () {
            // verify and cosign
            const validatorOpts = {
                reason: 'Exchange',
                previous: previousChannelState,
                current: proposedChannelState,
                hubAddress: this.hubAddress,
                exchangeAmount,
            };
            const isValid = Validation_1.Validation.validateChannelStateUpdate(validatorOpts);
            if (!isValid) {
                throw new Error(`Error validating update: ${isValid}`);
            }
            console.log('Account', proposedChannelState.user, ' is signing:', proposedChannelState);
            const hash = Utils_1.Utils.createChannelStateUpdateHash(proposedChannelState);
            // sign
            // TO DO: personal sign is causing issues, sign params in weird order
            // is this a typescript issue
            // @ts-ignore
            const sigUser = yield this.web3.eth.personal.sign(hash, proposedChannelState.user);
            const signedState = types_1.channelStateToSignedChannelState(proposedChannelState, sigUser);
            return signedState;
        });
        this.signPaymentUpdate = (payment, previousChannelState, proposedChannelState) => __awaiter(this, void 0, void 0, function* () {
            // verify and sign
            const validatorOpts = {
                reason: 'Payment',
                previous: previousChannelState,
                current: proposedChannelState,
                hubAddress: this.hubAddress,
                payment,
            };
            const isValid = Validation_1.Validation.validateChannelStateUpdate(validatorOpts);
            if (!isValid) {
                throw new Error(`Error validating update: ${isValid}`);
            }
            console.log('Account', proposedChannelState.user, ' is signing:', proposedChannelState);
            const hash = Utils_1.Utils.createChannelStateUpdateHash(proposedChannelState);
            // sign
            // TO DO: personal sign is causing issues, sign params in weird order
            // is this a typescript issue
            // @ts-ignore
            const sigUser = yield this.web3.eth.personal.sign(hash, proposedChannelState.user);
            const signedState = types_1.channelStateToSignedChannelState(proposedChannelState, sigUser);
            return signedState;
        });
        // TO DO: implement
        this.signOpenThreadUpdate = (proposedThreadState, previousChannelState, proposedChannelState) => __awaiter(this, void 0, void 0, function* () {
            // verify and sign
            const validatorOpts = {
                reason: 'OpenThread',
                previous: previousChannelState,
                current: proposedChannelState,
                hubAddress: this.hubAddress,
                threadState: proposedThreadState,
            };
            const isValid = Validation_1.Validation.validateChannelStateUpdate(validatorOpts);
            if (!isValid) {
                throw new Error(`Error validating update: ${isValid}`);
            }
            console.log('Account', proposedChannelState.user, ' is signing:', proposedChannelState);
            const hash = Utils_1.Utils.createChannelStateUpdateHash(proposedChannelState);
            // sign
            // TO DO: personal sign is causing issues, sign params in weird order
            // is this a typescript issue
            // @ts-ignore
            const sigUser = yield this.web3.eth.personal.sign(hash, proposedChannelState.user);
            const signedState = types_1.channelStateToSignedChannelState(proposedChannelState, sigUser);
            return signedState;
        });
        // TO DO: implement
        this.signCloseThreadUpdate = (finalThreadState, previousChannelState, proposedChannelState) => __awaiter(this, void 0, void 0, function* () {
            // verify and sign
            const validatorOpts = {
                reason: 'CloseThread',
                previous: previousChannelState,
                current: proposedChannelState,
                hubAddress: this.hubAddress,
                threadState: finalThreadState,
            };
            const isValid = Validation_1.Validation.validateChannelStateUpdate(validatorOpts);
            if (!isValid) {
                throw new Error(`Error validating update: ${isValid}`);
            }
            console.log('Account', proposedChannelState.user, ' is signing:', proposedChannelState);
            const hash = Utils_1.Utils.createChannelStateUpdateHash(proposedChannelState);
            // sign
            // TO DO: personal sign is causing issues, sign params in weird order
            // is this a typescript issue
            // @ts-ignore
            const sigUser = yield this.web3.eth.personal.sign(hash, proposedChannelState.user);
            const signedState = types_1.channelStateToSignedChannelState(proposedChannelState, sigUser);
            return signedState;
        });
        // get proposed exchange could be called
        this.signProposedPendingUpdate = (pending, previousChannelState, proposedChannelState) => __awaiter(this, void 0, void 0, function* () {
            // verify and sign
            const validatorOpts = {
                reason: 'ProposePending',
                previous: previousChannelState,
                current: proposedChannelState,
                hubAddress: this.hubAddress,
                pending,
            };
            const isValid = Validation_1.Validation.validateChannelStateUpdate(validatorOpts);
            if (!isValid) {
                throw new Error(`Error validating update: ${isValid}`);
            }
            console.log('Account', proposedChannelState.user, ' is signing:', proposedChannelState);
            const hash = Utils_1.Utils.createChannelStateUpdateHash(proposedChannelState);
            // sign
            // TO DO: personal sign is causing issues, sign params in weird order
            // is this a typescript issue
            // @ts-ignore
            const sigUser = yield this.web3.eth.personal.sign(hash, proposedChannelState.user);
            const signedState = types_1.channelStateToSignedChannelState(proposedChannelState, sigUser);
            return signedState;
        });
        this.signConfirmPendingUpdate = (pending, previousChannelState, proposedChannelState) => __awaiter(this, void 0, void 0, function* () {
            // verify and sign
            const validatorOpts = {
                reason: 'ConfirmPending',
                previous: previousChannelState,
                current: proposedChannelState,
                hubAddress: this.hubAddress,
                pending,
            };
            const isValid = Validation_1.Validation.validateChannelStateUpdate(validatorOpts);
            if (!isValid) {
                throw new Error(`Error validating update: ${isValid}`);
            }
            console.log('Account', proposedChannelState.user, ' is signing:', proposedChannelState);
            const hash = Utils_1.Utils.createChannelStateUpdateHash(proposedChannelState);
            // sign
            // TO DO: personal sign is causing issues, sign params in weird order
            // is this a typescript issue
            // @ts-ignore
            const sigUser = yield this.web3.eth.personal.sign(hash, proposedChannelState.user);
            const signedState = types_1.channelStateToSignedChannelState(proposedChannelState, sigUser);
            return signedState;
        });
        // function returns signature on thread updates
        // TO DO: finish
        this.createThreadStateUpdate = (opts, meta) => __awaiter(this, void 0, void 0, function* () {
            const isValid = Validation_1.Validation.validateThreadStateUpdate(opts);
            if (!isValid) {
                throw new Error(`Error validating update: ${isValid}`);
            }
            const hash = Utils_1.Utils.createThreadStateUpdateHash(opts.current);
            // TO DO: this is probably also poor form
            let signed = opts.current;
            // @ts-ignore
            signed.sigA = yield this.web3.eth.personal.sign(hash, opts.current.sender);
            return signed;
        });
        /*********************************
         ********* CONTRACT FNS **********
         *********************************/
        this.userAuthorizedDepositHandler = (stateStr) => __awaiter(this, void 0, void 0, function* () {
            let bondedWei;
            const state = types_1.channelStateToBN(stateStr);
            let threads = yield this.getThreads(state.user);
            threads.reduce((prevStr, currStr) => {
                const prev = types_1.threadStateToBN(prevStr);
                const curr = types_1.threadStateToBN(currStr);
                if (prev.receiver !== state.user) {
                    // user is payor
                    const threadWei = prev.balanceWeiSender
                        .add(prev.balanceWeiReceiver)
                        .add(curr.balanceWeiSender)
                        .add(curr.balanceWeiReceiver);
                    return threadWei;
                }
            }, bondedWei);
            let bondedToken;
            threads.reduce((prevStr, currStr) => {
                const prev = types_1.threadStateToBN(prevStr);
                const curr = types_1.threadStateToBN(currStr);
                if (prev.receiver !== state.user) {
                    // user is payor
                    const threadToken = prev.balanceTokenReceiver
                        .add(prev.balanceTokenSender)
                        .add(curr.balanceTokenReceiver)
                        .add(curr.balanceTokenSender);
                    return threadToken;
                }
            }, bondedToken);
            const channelTotalWei = state.balanceWeiHub
                .add(state.balanceWeiUser)
                .add(bondedWei);
            const channelTotalToken = state.balanceTokenHub
                .add(state.balanceTokenUser)
                .add(bondedToken);
            // deposit on the contract
            const tx = yield this.channelManager.methods
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
            });
            return tx;
        });
        this.web3 = new Web3(opts.web3.currentProvider); // convert legacy web3 0.x to 1.x
        this.hubAddress = opts.hubAddress.toLowerCase();
        this.hubUrl = opts.hubUrl;
        // TO DO: how to include abis?
        this.channelManager = new this.web3.eth.Contract(channelManagerAbi, opts.contractAddress);
        this.networking = new networking_1.Networking(opts.hubUrl);
        this.tokenAddress = opts.tokenAddress;
        this.tokenName = opts.tokenName;
    }
}
Connext.utils = new Utils_1.Utils();
// validation lives here may be private in future
Connext.validation = new Validation_1.Validation();
exports.Connext = Connext;
//# sourceMappingURL=Connext.js.map