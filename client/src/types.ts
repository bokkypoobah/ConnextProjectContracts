import BN = require('bn.js')
import Web3 = require('web3')

// define the common interfaces
export type Address = string

/*********************************
 ****** CONSTRUCTOR TYPES ********
 *********************************/
// contract constructor options
export interface ContractOptions {
  hubAddress: string
  tokenAddress: string
}

// connext constructor options
// NOTE: could extend ContractOptions, doesnt for future readability
export interface ConnextOptions {
  web3: Web3
  hubUrl: string
  contractAddress: string
  hubAddress: Address
  tokenAddress?: Address
  tokenName?: string
}

/*********************************
 ********* CHANNEL TYPES *********
 *********************************/
// channel state fingerprint
// this is what must be signed in all channel updates
export type ChannelStateFingerprint<T=string> = {
  contractAddress: Address
  user: Address
  recipient: Address
  balanceWeiHub: T
  balanceWeiUser: T
  balanceTokenHub: T
  balanceTokenUser: T
  pendingDepositWeiHub: T
  pendingDepositWeiUser: T
  pendingDepositTokenHub: T
  pendingDepositTokenUser: T
  pendingWithdrawalWeiHub: T
  pendingWithdrawalWeiUser: T
  pendingWithdrawalTokenHub: T
  pendingWithdrawalTokenUser: T
  txCountGlobal: number
  txCountChain: number
  threadRoot: string
  threadCount: number
  timeout: number
}

export type ChannelStateFingerprintBN = ChannelStateFingerprint<BN>

// signed channel state
// this is what must be submitted to any recover functions
// may have either sigUser or sigHub, or both
export type SignedChannelState<T=string> = ChannelStateFingerprint<T> &
  (
    | ({ sigUser: string; sigHub: string })
    | ({ sigHub: string; sigUser?: string })
    | ({ sigUser: string; sigHub?: string }))

export type SignedChannelStateBN = SignedChannelState<BN>

export const isUnsignedChannelState = (
  state: ChannelStateFingerprint | SignedChannelState,
) => {
  const keys = Object.keys(state)
  return keys.indexOf('sigUser') === -1 && keys.indexOf('sigHub') === -1
}

export const channelStateToSignedChannelState = (
  channel: ChannelStateFingerprint,
  sig: string,
  isUser: boolean = true,
): SignedChannelState => {
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
  }
}

// channel status
export const ChannelStatus = {
  Open: 'Open',
  ChannelDispute: 'ChannelDispute',
  ThreadDispute: 'ThreadDispute',
}

export type ChannelStatus = keyof typeof ChannelStatus

// channel state
// this is all channel information
export type ContractChannelState<T=string> = SignedChannelState<T> &
  ({
    status: ChannelStatus
    channelClosingTime?: number
    threadClosingTime?: number
    // all threads for this user
    threads?: ThreadState<T>[]
  })

export type ContractChannelStateBN = ContractChannelState<BN>

// channel update reasons
export const ChannelUpdateReasons = {
  Payment: 'Payment',
  Exchange: 'Exchange',
  ProposePending: 'ProposePending', // changes in pending
  ConfirmPending: 'ConfirmPending', // changes in balance
  OpenThread: 'OpenThread',
  CloseThread: 'CloseThread',
}
export type ChannelUpdateReason = keyof typeof ChannelUpdateReasons

// type used when getting or sending states to hub
export type ChannelStateUpdate<T=string> = {
  reason: ChannelUpdateReason
  state: SignedChannelState<T>
  metadata?: Object
}

export type ChannelStateUpdateBN = ChannelStateUpdate<BN>

export const channelStateToChannelStateUpdate = (
  reason: ChannelUpdateReason,
  state: SignedChannelState,
  metadata?: Object,
): ChannelStateUpdate => {
  return {
    reason,
    state,
    metadata,
  }
}

export const ChannelStateUpdateToContractChannelState = (
  hubState: ChannelStateUpdate,
): SignedChannelState => {
  return hubState.state as SignedChannelState
}

/*********************************
 ********* THREAD TYPES **********
 *********************************/
// this is everything included in a thread update sig
export type ThreadStateFingerprint<T=string> = {
  contractAddress: Address
  user: Address
  sender: Address
  receiver: Address
  balanceWeiSender: T
  balanceWeiReceiver: T
  balanceTokenSender: T
  balanceTokenReceiver: T
  txCount: number
}

export type ThreadStateFingerprintBN = ThreadStateFingerprint<BN>

// what is submitted to thread recover fns
export type SignedThreadState<T=string> = ThreadStateFingerprint<T> &
  ({
    sigA: string
  })

export type SignedThreadStateBN = SignedThreadState<BN>

// contract thread state
export type ThreadState<T=string> = SignedThreadState<T> &
  ({
    inDispute?: boolean
  })

export type ThreadStateBN = ThreadState<BN>

/*********************************
 ********* WALLET TYPES **********
 *********************************/

// what the wallet submits to client createUpdate functions
export type Balances<T=string> = {
  balanceWei: T
  balanceToken: T
}

export type BalancesBN = Balances<BN>

// used in validation
// to validate potential hub and user combined pending ops
export type PendingBalances<T=string> = {
  hubWithdrawal: Balances<T>
  hubDeposit: Balances<T>
  userWithdrawal: Balances<T>
  userDeposit: Balances<T>
}
export type PendingBalancesBN = PendingBalances<BN>

export type ExchangedBalances<T=string> = {
  hubWei: Balances<T>
  hubToken: Balances<T>
  userWei: Balances<T>
  userToken: Balances<T>
}
export type ExchangedBalancesBN = ExchangedBalances<BN>

export function channelStateToPendingBalances(
  channelState: SignedChannelState | ChannelStateFingerprint,
): PendingBalances {
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
  }
}

/*********************************
 ******* TYPE CONVERSIONS ********
 *********************************/
// util to convert from string to bn for all types
export const channelNumericFields = [
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
]

export const threadNumericFields = [
  'balanceWeiSender',
  'balanceWeiReceiver',
  'balanceTokenSender',
  'balanceTokenReceiver',
]

export const balanceNumericFields = ['balanceWei', 'balanceToken']

export function channelStateToBN(
  channelState: ChannelStateFingerprint,
): ChannelStateFingerprintBN {
  return stringToBN(channelNumericFields, channelState)
}

export function channelStateToString(
  channelState: ChannelStateFingerprintBN,
): ChannelStateFingerprint {
  return BNtoString(channelNumericFields, channelState)
}

export function signedChannelStateToBN(
  channelState: SignedChannelState,
): SignedChannelStateBN {
  return stringToBN(channelNumericFields, channelState)
}

export function signedChannelStateToString(
  channelState: SignedChannelStateBN,
): SignedChannelState {
  return BNtoString(channelNumericFields, channelState)
}

export function threadStateToBN(threadState: ThreadState): ThreadStateBN {
  return stringToBN(threadNumericFields, threadState)
}

export function threadStateToString(threadState: ThreadStateBN): ThreadState {
  return BNtoString(threadNumericFields, threadState)
}

export function balancesToBN(balances: Balances): BalancesBN {
  return stringToBN(balanceNumericFields, balances)
}

export function balancesToString(balances: BalancesBN): Balances {
  return BNtoString(balanceNumericFields, balances)
}

export function pendingBalancesToBN(
  pending: PendingBalances,
): PendingBalancesBN {
  return {
    hubDeposit: stringToBN(balanceNumericFields, pending.hubDeposit),
    userDeposit: stringToBN(balanceNumericFields, pending.userDeposit),
    hubWithdrawal: stringToBN(balanceNumericFields, pending.hubWithdrawal),
    userWithdrawal: stringToBN(balanceNumericFields, pending.userWithdrawal),
  }
}

export function pendingBalancesToString(
  pending: PendingBalancesBN,
): PendingBalances {
  return {
    hubDeposit: BNtoString(balanceNumericFields, pending.hubDeposit),
    userDeposit: BNtoString(balanceNumericFields, pending.userDeposit),
    hubWithdrawal: BNtoString(balanceNumericFields, pending.hubWithdrawal),
    userWithdrawal: BNtoString(balanceNumericFields, pending.userWithdrawal),
  }
}

export function stringToBN(fields: string[], obj: any) {
  if (!obj) {
    return obj
  }
  const out = { ...obj }
  fields.forEach(field => {
    out[field] = new BN(out[field])
  })
  return out
}

export function BNtoString(fields: string[], obj: any) {
  if (!obj) {
    return obj
  }
  const out = { ...obj }
  fields.forEach(field => {
    out[field] = out[field].toString()
  })
  return out
}
