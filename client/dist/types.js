"use strict";
var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
var BN = require("bn.js");
exports.isUnsignedChannelState = function (state) {
    var keys = Object.keys(state);
    return keys.indexOf('sigUser') === -1 && keys.indexOf('sigHub') === -1;
};
exports.channelStateToSignedChannelState = function (channel, sig, isUser) {
    if (isUser === void 0) { isUser = true; }
    return {
        contractAddress: channel.contractAddress,
        user: channel.user,
        recipient: channel.recipient,
        balanceWeiHub: channel.balanceWeiHub,
        balanceWeiUser: channel.balanceWeiUser,
        balanceTokenHub: channel.balanceTokenHub,
        balanceTokenUser: channel.balanceTokenUser,
        pendingDepositWeiHub: channel.pendingDepositWeiHub,
        pendingDepositWeiUser: channel.pendingDepositWeiUser,
        pendingDepositTokenHub: channel.pendingDepositTokenHub,
        pendingDepositTokenUser: channel.pendingDepositTokenUser,
        pendingWithdrawalWeiHub: channel.pendingWithdrawalWeiHub,
        pendingWithdrawalWeiUser: channel.pendingWithdrawalWeiUser,
        pendingWithdrawalTokenHub: channel.pendingWithdrawalTokenHub,
        pendingWithdrawalTokenUser: channel.pendingWithdrawalTokenUser,
        txCountGlobal: channel.txCountGlobal,
        txCountChain: channel.txCountChain,
        threadRoot: channel.threadRoot,
        threadCount: channel.threadCount,
        timeout: channel.timeout,
        sigUser: isUser ? sig : '',
        sigHub: isUser ? '' : sig,
    };
};
// channel status
exports.ChannelStatus = {
    Open: 'Open',
    ChannelDispute: 'ChannelDispute',
    ThreadDispute: 'ThreadDispute',
};
// channel update reasons
exports.ChannelUpdateReasons = {
    Payment: 'Payment',
    Exchange: 'Exchange',
    ProposePending: 'ProposePending',
    ConfirmPending: 'ConfirmPending',
    OpenThread: 'OpenThread',
    CloseThread: 'CloseThread',
};
exports.channelStateToChannelStateUpdate = function (reason, state, metadata) {
    return {
        reason: reason,
        state: state,
        metadata: metadata,
    };
};
exports.ChannelStateUpdateToContractChannelState = function (hubState) {
    return hubState.state;
};
function channelStateToPendingBalances(channelState) {
    return {
        hubWithdrawal: {
            balanceWei: channelState.pendingWithdrawalWeiHub,
            balanceToken: channelState.pendingWithdrawalTokenHub,
        },
        hubDeposit: {
            balanceWei: channelState.pendingDepositWeiHub,
            balanceToken: channelState.pendingDepositTokenHub,
        },
        userWithdrawal: {
            balanceWei: channelState.pendingWithdrawalTokenUser,
            balanceToken: channelState.pendingWithdrawalWeiUser,
        },
        userDeposit: {
            balanceWei: channelState.pendingDepositWeiUser,
            balanceToken: channelState.pendingDepositTokenUser,
        },
    };
}
exports.channelStateToPendingBalances = channelStateToPendingBalances;
/*********************************
 ******* TYPE CONVERSIONS ********
 *********************************/
// util to convert from string to bn for all types
var channelFieldsToConvert = [
    'balanceWeiUser',
    'balanceWeiHub',
    'balanceTokenUser',
    'balanceTokenHub',
    'pendingDepositWeiUser',
    'pendingDepositWeiHub',
    'pendingDepositTokenUser',
    'pendingDepositTokenHub',
    'pendingWithdrawalWeiUser',
    'pendingWithdrawalWeiHub',
    'pendingWithdrawalTokenUser',
    'pendingWithdrawalTokenHub',
];
var threadFieldsToConvert = [
    'balanceWeiSender',
    'balanceWeiReceiver',
    'balanceTokenSender',
    'balanceTokenReceiver',
];
var balanceFieldsToConvert = ['balanceWei', 'balanceToken'];
function channelStateToBN(channelState) {
    return stringToBN(channelFieldsToConvert, channelState);
}
exports.channelStateToBN = channelStateToBN;
function channelStateToString(channelState) {
    return BNtoString(channelFieldsToConvert, channelState);
}
exports.channelStateToString = channelStateToString;
function signedChannelStateToBN(channelState) {
    return stringToBN(channelFieldsToConvert, channelState);
}
exports.signedChannelStateToBN = signedChannelStateToBN;
function signedChannelStateToString(channelState) {
    return BNtoString(channelFieldsToConvert, channelState);
}
exports.signedChannelStateToString = signedChannelStateToString;
function threadStateToBN(threadState) {
    return stringToBN(threadFieldsToConvert, threadState);
}
exports.threadStateToBN = threadStateToBN;
function threadStateToString(threadState) {
    return BNtoString(threadFieldsToConvert, threadState);
}
exports.threadStateToString = threadStateToString;
function balancesToBN(balances) {
    return stringToBN(balanceFieldsToConvert, balances);
}
exports.balancesToBN = balancesToBN;
function balancesToString(balances) {
    return BNtoString(balanceFieldsToConvert, balances);
}
exports.balancesToString = balancesToString;
function pendingBalancesToBN(pending) {
    return {
        hubDeposit: stringToBN(balanceFieldsToConvert, pending.hubDeposit),
        userDeposit: stringToBN(balanceFieldsToConvert, pending.userDeposit),
        hubWithdrawal: stringToBN(balanceFieldsToConvert, pending.hubWithdrawal),
        userWithdrawal: stringToBN(balanceFieldsToConvert, pending.userWithdrawal),
    };
}
exports.pendingBalancesToBN = pendingBalancesToBN;
function pendingBalancesToString(pending) {
    return {
        hubDeposit: BNtoString(balanceFieldsToConvert, pending.hubDeposit),
        userDeposit: BNtoString(balanceFieldsToConvert, pending.userDeposit),
        hubWithdrawal: BNtoString(balanceFieldsToConvert, pending.hubWithdrawal),
        userWithdrawal: BNtoString(balanceFieldsToConvert, pending.userWithdrawal),
    };
}
exports.pendingBalancesToString = pendingBalancesToString;
function stringToBN(fields, obj) {
    if (!obj) {
        return obj;
    }
    var out = __assign({}, obj);
    fields.forEach(function (field) {
        out[field] = new BN(out[field]);
    });
    return out;
}
exports.stringToBN = stringToBN;
function BNtoString(fields, obj) {
    if (!obj) {
        return obj;
    }
    var out = __assign({}, obj);
    fields.forEach(function (field) {
        out[field] = out[field].toString();
    });
    return out;
}
exports.BNtoString = BNtoString;
