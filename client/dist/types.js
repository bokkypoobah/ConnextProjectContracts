"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const BN = require("bn.js");
exports.isUnsignedChannelState = (state) => {
    const keys = Object.keys(state);
    return keys.indexOf('sigUser') === -1 && keys.indexOf('sigHub') === -1;
};
exports.channelStateToSignedChannelState = (channel, sig, isUser = true) => {
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
exports.channelStateToChannelStateUpdate = (reason, state, metadata) => {
    return {
        reason,
        state,
        metadata,
    };
};
exports.ChannelStateUpdateToContractChannelState = (hubState) => {
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
exports.channelNumericFields = [
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
exports.threadNumericFields = [
    'balanceWeiSender',
    'balanceWeiReceiver',
    'balanceTokenSender',
    'balanceTokenReceiver',
];
exports.balanceNumericFields = ['balanceWei', 'balanceToken'];
function channelStateToBN(channelState) {
    return stringToBN(exports.channelNumericFields, channelState);
}
exports.channelStateToBN = channelStateToBN;
function channelStateToString(channelState) {
    return BNtoString(exports.channelNumericFields, channelState);
}
exports.channelStateToString = channelStateToString;
function signedChannelStateToBN(channelState) {
    return stringToBN(exports.channelNumericFields, channelState);
}
exports.signedChannelStateToBN = signedChannelStateToBN;
function signedChannelStateToString(channelState) {
    return BNtoString(exports.channelNumericFields, channelState);
}
exports.signedChannelStateToString = signedChannelStateToString;
function threadStateToBN(threadState) {
    return stringToBN(exports.threadNumericFields, threadState);
}
exports.threadStateToBN = threadStateToBN;
function threadStateToString(threadState) {
    return BNtoString(exports.threadNumericFields, threadState);
}
exports.threadStateToString = threadStateToString;
function balancesToBN(balances) {
    return stringToBN(exports.balanceNumericFields, balances);
}
exports.balancesToBN = balancesToBN;
function balancesToString(balances) {
    return BNtoString(exports.balanceNumericFields, balances);
}
exports.balancesToString = balancesToString;
function pendingBalancesToBN(pending) {
    return {
        hubDeposit: stringToBN(exports.balanceNumericFields, pending.hubDeposit),
        userDeposit: stringToBN(exports.balanceNumericFields, pending.userDeposit),
        hubWithdrawal: stringToBN(exports.balanceNumericFields, pending.hubWithdrawal),
        userWithdrawal: stringToBN(exports.balanceNumericFields, pending.userWithdrawal),
    };
}
exports.pendingBalancesToBN = pendingBalancesToBN;
function pendingBalancesToString(pending) {
    return {
        hubDeposit: BNtoString(exports.balanceNumericFields, pending.hubDeposit),
        userDeposit: BNtoString(exports.balanceNumericFields, pending.userDeposit),
        hubWithdrawal: BNtoString(exports.balanceNumericFields, pending.hubWithdrawal),
        userWithdrawal: BNtoString(exports.balanceNumericFields, pending.userWithdrawal),
    };
}
exports.pendingBalancesToString = pendingBalancesToString;
function stringToBN(fields, obj) {
    if (!obj) {
        return obj;
    }
    const out = Object.assign({}, obj);
    fields.forEach(field => {
        out[field] = new BN(out[field]);
    });
    return out;
}
exports.stringToBN = stringToBN;
function BNtoString(fields, obj) {
    if (!obj) {
        return obj;
    }
    const out = Object.assign({}, obj);
    fields.forEach(field => {
        out[field] = out[field].toString();
    });
    return out;
}
exports.BNtoString = BNtoString;
//# sourceMappingURL=types.js.map