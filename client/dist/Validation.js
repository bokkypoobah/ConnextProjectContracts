"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var BN = require("bn.js");
var ethereumjs_util_1 = require("ethereumjs-util");
var types_1 = require("./types");
var isBN = function (x) { return x instanceof BN; }; // Need?
/*********************************
 ********** VALIDATION ***********
 *********************************/
var Validation = /** @class */ (function () {
    function Validation() {
    }
    Validation.validateChannelStateUpdate = function (opts) {
        // perform basic validation across all reasons
        // previous channel status must be open
        // if (previous.status !== 'Open') {
        //   return `Cannot create a channel update while previous channel is not open (previous: ${previous}, current: ${current})`
        // }
        // timeout created must be 0 or not already passed
        // Timeout should be specific since this library may be called at any time
        var reason = opts.reason, previous = opts.previous, current = opts.current, hubAddress = opts.hubAddress;
        // NOTE: THIS DOES NOT CHECK TIMEOUTS
        // can only increase the global nonce by 1
        if (current.txCountGlobal - previous.txCountGlobal !== 1) {
            return "Can only increase the global nonce by 1";
        }
        // chain nonce can only increase by 1 or 0
        if (current.txCountChain - previous.txCountChain !== 1 &&
            current.txCountChain !== previous.txCountChain) {
            return "Can only increase the chain nonce by 1 or not at all (previous: " + previous + ", current: " + current + ")";
        }
        // TO DO: fix signer type
        // // if the current state has the sigUser, it should be correct
        // if (current.sigUser) {
        //   const signer = Utils.recoverSignerFromChannelStateUpdate(
        //     current,
        //     current.sigUser,
        //   )
        //   if (signer !== current.user) {
        //     return `Incorrect signer detected for sigUser in current channel (previous: ${previous}, current: ${current})`
        //   }
        // }
        // // if the current state has the sigHub, it should be correct
        // if (current.sigHub) {
        //   const signer = Utils.recoverSignerFromChannelStateUpdate(
        //     current,
        //     current.sigHub,
        //   )
        //   if (signer !== hubAddress) {
        //     return `Incorrect signer detected for sigUser in current channel (previous: ${previous}, current: ${current})`
        //   }
        // }
        return Validation.channelValidators[opts.reason](opts);
    };
    Validation.channelValidators = {
        Payment: function (opts) {
            var previous = opts.previous, current = opts.current, payment = opts.payment;
            // cannot change pending operations in payment
            if (previous.pendingDepositTokenHub !== current.pendingDepositTokenHub &&
                previous.pendingDepositTokenUser !== current.pendingDepositTokenUser) {
                return "Cannot update pending token deposits in payment update type (previous: " + previous + ", current: " + current + ")";
            }
            if (previous.pendingDepositWeiHub !== current.pendingDepositWeiHub &&
                previous.pendingDepositWeiUser !== current.pendingDepositWeiUser) {
                return "Cannot update pending wei deposits in payment update type (previous: " + previous + ", current: " + current + ")";
            }
            if (previous.pendingWithdrawalTokenHub !==
                current.pendingWithdrawalTokenHub &&
                previous.pendingWithdrawalTokenUser !==
                    current.pendingWithdrawalTokenUser) {
                return "Cannot update pending token withdrawals in payment update type (previous: " + previous + ", current: " + current + ")";
            }
            if (previous.pendingWithdrawalWeiHub !== current.pendingWithdrawalWeiHub &&
                previous.pendingWithdrawalWeiUser !== current.pendingWithdrawalWeiUser) {
                return "Cannot update pending wei deposits in payment update type (previous: " + previous + ", current: " + current + ")";
            }
            // wei balance must be conserved
            var prevChannelBalanceWei = new BN(previous.balanceWeiHub).add(new BN(previous.balanceWeiUser));
            var currChannelBalanceWei = new BN(current.balanceWeiHub).add(new BN(current.balanceWeiUser));
            if (!prevChannelBalanceWei.eq(currChannelBalanceWei)) {
                return "Channel wei balance must be conserved (previous: " + previous + ", current: " + current + ")";
            }
            // token balance must be conserved
            var prevChannelBalanceToken = new BN(previous.balanceTokenHub).add(new BN(previous.balanceTokenUser));
            var currChannelBalanceToken = new BN(current.balanceTokenHub).add(new BN(current.balanceTokenUser));
            if (!prevChannelBalanceToken.eq(currChannelBalanceToken)) {
                return "Channel token balance must be conserved (previous: " + previous + ", current: " + current + ")";
            }
            // payment updates should not change threads
            return Validation.validateNoThreadChanges(previous, current);
        },
        ProposePending: function (opts) {
            var previous = opts.previous, current = opts.current, pending = opts.pending;
            // previous state should have no existing pending ops
            var noPending = Validation.validateNoPendingOps(previous);
            if (noPending) {
                return "Previous state cannot have pending ops when proposing deposit. " + noPending + " \n (previous: " + previous + ", current: " + current + ")";
            }
            // no operating balances should change
            var noOperatingBalanceChanges = Validation.validateNoOperatingBalanceChanges(previous, current);
            if (noOperatingBalanceChanges) {
                return "Cannot change operating balances while proposing deposit. " + noOperatingBalanceChanges + ". \n (previous: " + previous + ", current: " + current + ")";
            }
            // propose pending updates should not change threads
            return Validation.validateNoThreadChanges(previous, current);
        },
        ConfirmPending: function (opts) {
            var previous = opts.previous, current = opts.current, pending = opts.pending;
            // should move previous state pending balances
            // into current state operating balances
            var prevBN = types_1.channelStateToBN(previous);
            var currBN = types_1.channelStateToBN(current);
            // calculate expected values from depositss
            var expectedWeiBalanceHub = prevBN.balanceWeiHub.add(prevBN.pendingDepositWeiHub);
            var expectedWeiBalanceUser = prevBN.balanceWeiUser.add(prevBN.pendingDepositWeiUser);
            var expectedTokenBalanceHub = prevBN.balanceTokenHub.add(prevBN.pendingDepositTokenHub);
            var expectedTokenBalanceUser = prevBN.balanceTokenUser.add(prevBN.pendingDepositTokenUser);
            if (!currBN.balanceWeiHub.eq(expectedWeiBalanceHub)) {
                return "Hub wei deposit added to balance incorrectly (previous: " + previous + ", current: " + current + ")";
            }
            if (!currBN.balanceTokenHub.eq(expectedTokenBalanceHub)) {
                return "Hub token deposit added to balance incorrectly (previous: " + previous + ", current: " + current + ")";
            }
            if (!currBN.balanceWeiUser.eq(expectedWeiBalanceUser)) {
                return "User wei deposit added to balance incorrectly (previous: " + previous + ", current: " + current + ")";
            }
            if (!currBN.balanceTokenUser.eq(expectedTokenBalanceUser)) {
                return "User token deposit added to balance incorrectly (previous: " + previous + ", current: " + current + ")";
            }
            // confirm pending updates should not change threads
            return Validation.validateNoThreadChanges(previous, current);
        },
        Exchange: function (opts) {
            var previous = opts.previous, current = opts.current, exchangeAmount = opts.exchangeAmount;
            // exchange pending updates should not change threads
            return Validation.validateNoThreadChanges(previous, current);
        },
        OpenThread: function (opts) {
            var previous = opts.previous, current = opts.current, receiver = opts.receiver, threadState = opts.threadState;
            return null;
        },
        CloseThread: function (opts) {
            var previous = opts.previous, current = opts.current, receiver = opts.receiver, threadState = opts.threadState;
            return null;
        },
    };
    Validation.validateThreadStateUpdate = function (opts) {
        var previous = opts.previous, current = opts.current, payment = opts.payment;
        return null;
    };
    Validation.validateAddress = function (address) {
        if (!ethereumjs_util_1.isValidAddress(address)) {
            throw new Error("Not a valid address " + address);
        }
        return address;
    };
    Validation.validateNoOperatingBalanceChanges = function (previous, current) {
        // existing weiBalances should not change
        if (previous.balanceWeiHub !== current.balanceWeiHub) {
            return "Channel hub wei balances cannot change (previous: " + previous + ", current: " + current + ")";
        }
        if (previous.balanceWeiUser !== current.balanceWeiUser) {
            return "Channel user wei balances cannot change (previous: " + previous + ", current: " + current + ")";
        }
        // existing tokenBalances should not change
        if (previous.balanceTokenHub !== current.balanceTokenHub) {
            return "Channel hub token balances cannot change (previous: " + previous + ", current: " + current + ")";
        }
        if (previous.balanceTokenUser !== current.balanceTokenUser) {
            return "Channel user token balances cannot change (previous: " + previous + ", current: " + current + ")";
        }
        return null;
    };
    Validation.validateNoThreadChanges = function (previous, current) {
        // thread root hash should stay the same
        if (previous.threadRoot !== current.threadRoot) {
            return "Incorrect threadRoot detected for in current channel (previous: " + previous + ", current: " + current + ")";
        }
        // thread count should stay the same
        if (previous.threadCount !== current.threadCount) {
            return "Incorrect threadCount detected for in current channel (previous: " + previous + ", current: " + current + ")";
        }
        return null;
    };
    Validation.validateNoPendingOps = function (state) {
        if (state.pendingDepositWeiHub !== '0') {
            return "Pending hub wei deposit exists (state: " + state + ")";
        }
        if (state.pendingDepositTokenHub !== '0') {
            return "Pending hub token deposit exists (state: " + state + ")";
        }
        if (state.pendingDepositWeiUser !== '0') {
            return "Pending user wei deposit exists (state: " + state + ")";
        }
        if (state.pendingDepositTokenUser !== '0') {
            return "Pending user token deposit exists (state: " + state + ")";
        }
        if (state.pendingWithdrawalWeiHub !== '0') {
            return "Pending hub wei withdrawal exists (state: " + state + ")";
        }
        if (state.pendingWithdrawalTokenHub !== '0') {
            return "Pending hub token withdrawal exists (state: " + state + ")";
        }
        if (state.pendingWithdrawalWeiUser !== '0') {
            return "Pending user wei withdrawal exists (state: " + state + ")";
        }
        if (state.pendingWithdrawalTokenUser !== '0') {
            return "Pending user token withdrawal exists (state: " + state + ")";
        }
        return null;
    };
    return Validation;
}());
exports.Validation = Validation;
