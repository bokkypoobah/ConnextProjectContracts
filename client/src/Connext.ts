import BN = require('bn.js')
import Web3 = require('web3')
// local imports
import { ChannelManager } from './typechain/ChannelManager'
const channelManagerAbi = require('./typechain/abi/ChannelManagerAbi')
import { Networking } from './helpers/networking'
import { ERC20 } from './typechain/ERC20'
import { Utils } from './Utils'
import {
  Validation,
  ChannelFlexibleValidatorOptions,
  ThreadValidatorOptions,
} from './Validation'
import {
  ConnextOptions,
  SignedChannelState,
  SignedChannelStateBN,
  ContractChannelState,
  ChannelStateUpdate,
  ChannelStateFingerprint,
  ThreadState,
  ThreadStateFingerprint,
  Balances,
  ExchangedBalances,
  PendingBalances,
  channelStateToPendingBalances,
  channelStateToBN,
  channelStateToChannelStateUpdate,
  threadStateToBN,
  channelStateToSignedChannelState,
} from './types'

// const tokenAbi = require('human-standard-token-abi')

// TO DO: get from typechain? or does contract do npm now
// const channelManagerAbi = require('../artifacts/LedgerChannel.json')

type Address = string
// anytime the hub is sending us something to sign we need a verify method that verifies that the hub isn't being a jerk
export class Connext {
  // declare properties to be instantiated in constructor
  web3: Web3
  hubAddress: Address
  hubUrl: string
  networking: Networking
  tokenAddress?: Address
  tokenName?: string

  channelManager: ChannelManager
  constructor(opts: ConnextOptions) {
    this.web3 = new Web3(opts.web3.currentProvider) // convert legacy web3 0.x to 1.x
    this.hubAddress = opts.hubAddress.toLowerCase()
    this.hubUrl = opts.hubUrl
    // TO DO: how to include abis?
    this.channelManager = new this.web3.eth.Contract(
      channelManagerAbi,
      opts.contractAddress,
    ) as ChannelManager
    this.networking = new Networking(opts.hubUrl)
    this.tokenAddress = opts.tokenAddress
    this.tokenName = opts.tokenName
  }

  static utils = new Utils()

  // validation lives here may be private in future
  static validation = new Validation()

  /*********************************
   *********** FLOW FNS ************
   *********************************/
  // these are functions that are called within the flow of certain operations

  // signs + submits all updates retrieved from 'sync' method
  // verifies cosigns and submits to hub all in one call
  verifyAndCosignAndSubmit = async (
    latestUpdate: ChannelStateUpdate,
    actionItems: ChannelStateUpdate[],
    user?: Address,
  ) => {
    // default user is accounts[0]
    user = user || (await this.getDefaultUser())
    const signedStateUpdates = await this.verifyAndCosign(
      latestUpdate,
      actionItems,
      user,
    )
    return await this.updateHub(
      latestUpdate.state.txCountGlobal,
      signedStateUpdates,
      user,
    )
  }

  // only returns the signed states to allow wallet to decide when and how they get submitted
  verifyAndCosign = async (
    latestUpdate: ChannelStateUpdate,
    actionItems: ChannelStateUpdate[],
    user?: Address,
  ) => {
    // hits hub unless dispute
    // default user is accounts[0]
    user = user || (await this.getDefaultUser())
    // verify and sign each item since pending deposit

    // wc: I am only passing in one update at a time so this will work.
    // however if I did pass in more than 1 update there is a problem with promise.alling here and it won't work
    // this is because if we pass in more than 1 update each update has the previous nonce as previous update not the nonce teh whole array started at

    const promises = actionItems.map(async (item, index) => {
      if (index + 1 === actionItems.length) {
        // at end of array
        // item is current state
        return this.createChannelStateUpdate({
          metadata: item.metadata,
          reason: item.reason,
          previous: latestUpdate.state, // use state at txCount - 1
          current: item.state,
        })
      } else {
        return this.createChannelStateUpdate({
          metadata: item.metadata,
          reason: actionItems[index + 1].reason,
          previous: item.state,
          current: actionItems[index + 1].state,
        })
      }
    })
    const signedStateUpdates = await Promise.all(promises)

    return signedStateUpdates
  }

  // user actions
  // should return a Promise<ContractChannelState> or a TransactionObject<void>
  // if depositing tokens, wallet must approve token transfers
  // before proposing a deposit
  proposeDeposit = async (deposit: Balances, user?: Address) => {
    // default user is accounts[0]
    user = user || (await this.getDefaultUser())
    const prevChannel = await this.getChannel(user)
    // post to the hub that you would like to propose deposit
    const hubDepositResponse = await this.requestDeposit(
      deposit,
      prevChannel.state.txCountGlobal,
      user,
    )
    const pending = channelStateToPendingBalances(hubDepositResponse.state)
    // gets passed into validators
    const signedChannel = await this.createChannelStateUpdate({
      metadata: hubDepositResponse.metadata,
      reason: hubDepositResponse.reason,
      previous: prevChannel.state,
      current: hubDepositResponse.state,
      pending, // input pending values to get to state
    })
    // calculate total money in channel, including bonded in threads
    const depositTx = await this.userAuthorizedDepositHandler(
      signedChannel.state,
    )

    return depositTx
  }

  proposeWithdrawal = async (withdrawal: Balances, user?: Address) => {
    // default user is accounts[0]
    user = user || (await this.getDefaultUser())
    const prevChannel = await this.getChannel(user)
    // post to the hub that you would like to propose deposit
    const hubWithdrawalResponse = await this.requestDeposit(
      withdrawal,
      prevChannel.state.txCountGlobal,
      user,
    )
    // gets passed into validators
    const pending = channelStateToPendingBalances(hubWithdrawalResponse.state)
    const opts = {
      reason: hubWithdrawalResponse.reason, // 'EXCHANGE'
      previous: prevChannel.state,
      current: hubWithdrawalResponse.state,
      pending,
    }
    const signedUpdate = await this.createChannelStateUpdate(opts)

    // calculate total money in channel, including bonded in threads
    const withdrawalTx = await this.userAuthorizedDepositHandler(
      signedUpdate.state,
    )

    return withdrawalTx
  }

  // TO DO: sync with will to implement fully
  proposeExchange = async (
    exchangeAmount: ExchangedBalances, // amount of wei/erc wanted
    desiredCurrency?: string,
    user?: Address,
  ): Promise<ChannelStateUpdate> => {
    // hits hub unless dispute, then hits sync and retry
    // NOTE: this may actually not be the case, will refer to diagrams
    // on implementation
    // default user is accounts[0]
    user = user || (await this.getDefaultUser())
    desiredCurrency = this.tokenName || 'WEI'
    // get channel
    const prevChannel = await this.getChannel(user)
    // post to the hub that you would like to propose deposit
    const hubExchangeResponse = await this.requestExchange(
      exchangeAmount,
      desiredCurrency,
      prevChannel.state.txCountGlobal + 1,
      user,
    )
    // gets passed into validators
    const opts = {
      reason: hubExchangeResponse.reason, // 'EXCHANGE'
      previous: prevChannel.state,
      current: hubExchangeResponse.state,
      exchangeAmount,
    } as ChannelFlexibleValidatorOptions
    const signedChannel = await this.createChannelStateUpdate(opts)
    return signedChannel
  }

  openThread = async (
    receiver: Address,
    balance: Balances,
    user?: Address,
  ): Promise<ChannelStateUpdate> => {
    // hits hub unless dispute
    // default user is accounts[0]
    user = user || (await this.getDefaultUser())
    // get channel
    const prevChannel = await this.getChannel(user)
    // create initial thread state
    const threadState = {
      contractAddress: prevChannel.state.contractAddress,
      user,
      sender: user, // should this be hub?
      receiver,
      balanceWeiReceiver: '0',
      balanceTokenReceiver: '0',
      balanceWeiSender: balance.balanceWei,
      balanceTokenSender: balance.balanceToken,
      txCount: 0,
    }
    const signedThreadState = await this.createThreadStateUpdate({
      current: threadState,
      payment: balance,
    })
    const prevBN = channelStateToBN(prevChannel.state)
    const balBN = Utils.balancesToBN(balance)
    // generate expected state
    const expectedWeiUser = prevBN.balanceWeiUser.sub(balBN.balanceWei)
    const expectedTokenUser = prevBN.balanceWeiUser.sub(balBN.balanceToken)
    // regenerate thread root on open
    let initialThreadStates = await this.getInitialThreadStates(user)
    initialThreadStates.push(threadState)
    const newThreadRoot = Utils.generateThreadRootHash(initialThreadStates)

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
    }

    const signedChannel = await this.createChannelStateUpdate({
      reason: 'OpenThread',
      previous: prevChannel.state,
      current: proposedChannel,
      receiver,
      threadState: signedThreadState,
    })
    return signedChannel
  }

  // TO DO: fix for performer closing thread
  closeThread = async (
    receiver: Address,
    user: Address,
    signer?: Address, // for testing
  ): Promise<ChannelStateUpdate> => {
    // default user is accounts[0]
    signer = signer || (await this.getDefaultUser())
    // see if it is the receiver closing
    const closerIsReceiver = signer.toLowerCase() === receiver.toLowerCase()
    // get latest thread state --> should wallet pass in?
    const latestThread = await this.getThreadByParties(receiver, user)
    // get channel
    const previousChannel = await this.getChannel(user)
    const prevBN = channelStateToBN(previousChannel.state)
    const threadBN = threadStateToBN(latestThread)
    // generate expected balances for channel
    let expectedTokenBalanceHub,
      expectedWeiBalanceHub,
      expectedTokenBalanceUser,
      expectedWeiBalanceUser
    if (closerIsReceiver) {
      expectedWeiBalanceHub = prevBN.balanceWeiHub.add(
        threadBN.balanceWeiSender,
      )
      expectedTokenBalanceHub = prevBN.balanceTokenHub.add(
        threadBN.balanceTokenSender,
      )
      expectedWeiBalanceUser = prevBN.balanceWeiHub.add(
        threadBN.balanceWeiReceiver,
      )
      expectedTokenBalanceUser = prevBN.balanceTokenHub.add(
        threadBN.balanceTokenReceiver,
      )
    } else {
      expectedWeiBalanceHub = prevBN.balanceWeiHub.add(
        threadBN.balanceWeiReceiver,
      )
      expectedTokenBalanceHub = prevBN.balanceTokenHub.add(
        threadBN.balanceTokenReceiver,
      )
      expectedWeiBalanceUser = prevBN.balanceWeiHub.add(
        threadBN.balanceWeiSender,
      )
      expectedTokenBalanceUser = prevBN.balanceTokenHub.add(
        threadBN.balanceTokenSender,
      )
    }

    // generate new root hash
    let initialThreadStates = await this.getInitialThreadStates(user)
    initialThreadStates = initialThreadStates.filter(
      (threadState: ThreadState) =>
        threadState.user !== user && threadState.receiver !== receiver,
    )
    const threads = await this.getThreads(user)
    const newThreads = threads.filter(
      threadState =>
        threadState.user !== user && threadState.receiver !== receiver,
    )
    const newThreadRoot = Utils.generateThreadRootHash(initialThreadStates)
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
      pendingWithdrawalTokenHub:
        previousChannel.state.pendingWithdrawalTokenHub,
      pendingWithdrawalTokenUser:
        previousChannel.state.pendingWithdrawalTokenUser,
      txCountGlobal: previousChannel.state.txCountGlobal + 1,
      txCountChain: previousChannel.state.txCountChain,
      threadRoot: newThreadRoot,
      threadCount: previousChannel.state.threadCount - 1,
      timeout: 0,
    }
    const signedChannel = await this.createChannelStateUpdate({
      reason: 'CloseThread',
      previous: previousChannel.state,
      current: proposedChannel,
      threadState: latestThread,
    })
    return signedChannel
  }

  threadPayment = async (
    payment: Balances,
    metadata: Object,
    receiver: Address,
    user?: Address,
  ): Promise<ThreadState> => {
    // hits hub unless dispute
    user = user || (await this.getDefaultUser())
    // get thread
    const prevThreadState = await this.getThreadByParties(receiver, user)
    let proposedThreadState = prevThreadState // does this just create a reference to it...?
    const paymentBN = Utils.balancesToBN(payment)
    const prevStateBN = Utils.threadStateToBN(prevThreadState)
    // generate expected update
    const proposedBalanceWeiSender = prevStateBN.balanceWeiSender.sub(
      paymentBN.balanceWei,
    )
    const proposedBalanceWeiReceiver = prevStateBN.balanceWeiReceiver.add(
      paymentBN.balanceWei,
    )
    const proposedBalanceTokenSender = prevStateBN.balanceTokenSender.sub(
      paymentBN.balanceToken,
    )
    const proposedBalanceTokenReceiver = prevStateBN.balanceTokenReceiver.add(
      paymentBN.balanceToken,
    )
    proposedThreadState.balanceTokenReceiver = proposedBalanceTokenReceiver.toString()
    proposedThreadState.balanceWeiReceiver = proposedBalanceWeiReceiver.toString()
    proposedThreadState.balanceTokenSender = proposedBalanceTokenSender.toString()
    proposedThreadState.balanceWeiSender = proposedBalanceWeiSender.toString()

    const signedThread = await this.createThreadStateUpdate({
      payment,
      previous: prevThreadState,
      current: proposedThreadState,
    })

    // TO DO: post to hub
    // const signedChannelHub = channelStateToChannelStateUpdate(
    //   'Payment',
    //   signedThread,
    //   metadata,
    // )

    return signedThread
  }

  channelPayment = async (
    payment: Balances,
    metadata: Object,
    user?: Address,
  ): Promise<ChannelStateUpdate> => {
    // hits hub unless dispute
    user = user || (await this.getDefaultUser())
    // get channel
    const previousChannel = await this.getChannel(user)
    const paymentBN = Utils.balancesToBN(payment)
    const prevStateBN = Utils.channelStateToBN(previousChannel.state)
    // generate expected update
    const proposedBalanceWeiUser = prevStateBN.balanceWeiUser.sub(
      paymentBN.balanceWei,
    )
    const proposedBalanceWeiHub = prevStateBN.balanceWeiHub.add(
      paymentBN.balanceWei,
    )
    const proposedBalanceTokenUser = prevStateBN.balanceTokenUser.sub(
      paymentBN.balanceToken,
    )
    const proposedBalanceTokenHub = prevStateBN.balanceTokenHub.add(
      paymentBN.balanceToken,
    )
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
      pendingWithdrawalTokenHub:
        previousChannel.state.pendingWithdrawalTokenHub,
      pendingWithdrawalTokenUser:
        previousChannel.state.pendingWithdrawalTokenUser,
      txCountGlobal: previousChannel.state.txCountGlobal + 1,
      txCountChain: previousChannel.state.txCountChain,
      threadRoot: previousChannel.state.threadRoot,
      threadCount: previousChannel.state.threadCount,
      timeout: 0,
    }

    const signedChannelUpdate = await this.createChannelStateUpdate({
      reason: 'Payment',
      previous: previousChannel.state,
      current: proposedState,
      payment,
      metadata: metadata,
    })

    // post to hub
    const hubResponse = await this.updateHub(
      proposedState.txCountGlobal,
      [signedChannelUpdate],
      user,
    )

    return hubResponse
  }

  // only here when working on happy case
  // TO DO: implement disputes
  enterDisputeCase = async (reason: any): Promise<any> => {}

  // top level functions
  // note: update meta should be consistent with what hub expects
  // for payments, signer primarily used for testing

  // public createThreadStateUpdate = createThreadStateUpdate

  /*********************************
   *********** HUB FNS *************
   *********************************/

  // return all open initial thread states
  getInitialThreadStates = async (user?: Address) => {
    // set default user
    user = user || (await this.getDefaultUser())
    // get the current channel state and return it
    try {
      const res = await this.networking.get(
        `channel/${user.toLowerCase()}/initial-thread-states`,
      )
      return res.data
    } catch (e) {
      if (e.status === 404) {
        return []
      }
      throw e
    }
  }

  // return channel for user
  getChannel = async (user?: Address): Promise<ChannelStateUpdate> => {
    // set default user
    user = user || (await this.getDefaultUser())
    // get the current channel state and return it
    try {
      const res = await this.networking.get(`channel/${user.toLowerCase()}`)
      return res.data
    } catch (e) {
      if (e.status === 404) {
        throw new Error(`Channel not found for user ${user}`)
      }
      throw e
    }
  }

  // hits the hubs sync endpoint to return all actionable states
  sync = async (txCountGlobal: number, user?: Address) => {
    // set default user
    user = user || (await this.getDefaultUser())
    try {
      const res = await this.networking.post(
        `channel/${user.toLowerCase()}/sync`,
        {
          txCount: txCountGlobal,
        },
      )
      return res.data
    } catch (e) {
      if (e.status === 404) {
        return []
      }
      throw e
    }
  }

  // return state at specified global nonce
  getChannelStateAtNonce = async (
    txCountGlobal: number,
    user?: Address,
  ): Promise<ChannelStateUpdate | null> => {
    // set default user
    user = user || (await this.getDefaultUser())
    // get the channel state at specified nonce
    const syncStates = await this.sync(txCountGlobal, user)
    return syncStates.find(
      (syncState: ChannelStateUpdate) =>
        syncState.state.txCountGlobal === txCountGlobal,
    )
  }

  getThreads = async (user?: Address): Promise<ThreadState[]> => {
    // set default user
    user = user || (await this.getDefaultUser())
    // get the current channel state and return it
    const response = await this.networking.get(
      `channel/${user.toLowerCase()}/threads`,
    )
    if (!response.data) {
      return []
    }
    return response.data
  }

  // return all threads bnetween 2 addresses
  getThreadByParties = async (
    receiver: Address,
    user?: Address,
  ): Promise<ThreadState> => {
    // set default user
    user = user || (await this.getDefaultUser())
    // get receiver threads
    const threads = await this.getThreads(receiver)
    const thread = threads.find((thread: ThreadState) => thread.user === user)
    if (!thread) {
      throw new Error(`No thread found for ${receiver} and ${user}`)
    }
    return thread
  }

  getThreadAtTxCount = async (
    txCount: number,
    receiver: Address,
    user?: Address,
  ): Promise<ThreadState> => {
    // set default user
    user = user || (await this.getDefaultUser())
    // get receiver threads
    const threads = await this.getThreads(receiver)
    if (!threads || threads.length === 0) {
      throw new Error(`ç`)
    }
    const thread = threads.find(
      (thread: ThreadState) =>
        thread.user === user && thread.txCount === txCount,
    )
    if (!thread) {
      throw new Error(
        `No thread found for ${receiver} and ${user} at txCount ${txCount}`,
      )
    }
    return thread
  }

  // post to hub telling user wants to deposit
  requestDeposit = async (
    deposit: Balances,
    txCount: number,
    user: Address,
  ): Promise<ChannelStateUpdate> => {
    const response = await this.networking.post(
      `channel/${user.toLowerCase()}/request-deposit`,
      {
        weiDeposit: deposit.balanceWei,
        tokenDeposit: deposit.balanceToken,
        txCount,
      },
    )
    return response.data
  }

  // post to hub telling user wants to deposit
  requestWithdrawal = async (
    withdrawal: Balances,
    txCount: number,
    user: Address,
  ): Promise<ChannelStateUpdate> => {
    const response = await this.networking.post(
      `channel/${user.toLowerCase()}/request-withdrawal`,
      {
        weiDeposit: withdrawal.balanceWei,
        tokenDeposit: withdrawal.balanceToken,
        txCount,
      },
    )
    return response.data
  }

  // post to hub telling user wants to exchange
  requestExchange = async (
    exchangeAmount: ExchangedBalances,
    desiredCurrency: string,
    txCount: number,
    user: Address,
  ): Promise<ChannelStateUpdate> => {
    const response = await this.networking.post(
      `channel/${user.toLowerCase()}/request-exchange`,
      {
        desiredCurrency,
        exchangeAmount,
        txCount,
      },
    )
    return response.data
  }

  // performer calls this when they wish to start a show
  // return the proposed deposit fro the hub which should then be verified and cosigned
  requestCollateral = async (
    txCount: number,
    user: Address,
  ): Promise<ChannelStateUpdate> => {
    const response = await this.networking.post(
      `channel/${user.toLowerCase()}/request-collateralization`,
      {
        txCount,
      },
    )
    return response.data
  }

  updateHub = async (
    txCount: number,
    updates: ChannelStateUpdate[],
    user: Address,
  ): Promise<ChannelStateUpdate> => {
    const response = await this.networking.post(
      `channel/${user.toLowerCase()}/update`,
      {
        txCount,
        updates,
      },
    )
    return response.data
  }

  /*********************************
   ********** HELPER FNS ***********
   *********************************/

  // get accounts[0] as default user
  getDefaultUser = async (): Promise<string> => {
    const accounts = await this.web3.eth.getAccounts()
    return accounts[0]
  }

  // function returns signature on each type of update
  createChannelStateUpdate = async (
    opts: ChannelFlexibleValidatorOptions,
    user?: Address,
  ): Promise<ChannelStateUpdate> => {
    // default signer to accounts[0] if it is not provided
    const { reason, previous, current } = opts
    user = user || (await this.getDefaultUser())
    const previousBN = Utils.channelStateToBN(previous)
    const proposedBN = Utils.channelStateToBN(current)
    // create a channel state update based on the reason
    let signedState: any
    switch (reason) {
      case 'Payment':
        // calculate payment
        // user2hub if hub balance increases in either dominatio
        const user2hub =
          previousBN.balanceTokenHub.lte(proposedBN.balanceTokenHub) &&
          previousBN.balanceWeiHub.lte(proposedBN.balanceWeiHub)
        const weiPayment = user2hub
          ? previousBN.balanceWeiUser.sub(proposedBN.balanceWeiUser)
          : previousBN.balanceWeiHub.sub(proposedBN.balanceWeiHub)
        const tokenPayment = user2hub
          ? previousBN.balanceTokenUser.sub(proposedBN.balanceTokenUser)
          : previousBN.balanceTokenHub.sub(proposedBN.balanceTokenHub)
        const calculatedPayment: Balances = {
          balanceWei: weiPayment.toString(),
          balanceToken: tokenPayment.toString(),
        }

        signedState = await this.signPaymentUpdate(
          opts.payment || calculatedPayment, // dpayment
          previous,
          current,
        )
        break
      case 'Exchange':
        // const test = (opts.updatedChannel = await this.signExchangeUpdate(
        //   opts.exchangeAmount,
        //   previous,
        //   current,
        // ))
        break
      case 'ProposePending':
        // calculate pending if not provided
        const pendingToPropose =
          opts.pending || channelStateToPendingBalances(current)
        signedState = await this.signProposedPendingUpdate(
          pendingToPropose,
          previous,
          current,
        )
        break
      case 'ConfirmPending':
        // calculate the pending amounts
        const pendingToConfirm =
          opts.pending || channelStateToPendingBalances(current)
        signedState = await this.signConfirmPendingUpdate(
          pendingToConfirm,
          previous,
          current,
        )
        break
      case 'OpenThread':
        signedState = await this.signOpenThreadUpdate(
          // TO DO: fix better
          //           Argument of type '_ThreadStateFingerprint<string> | undefin
          // ed' is not assignable to parameter of type '_ThreadStateFingerprint<string>'.
          opts.threadState as ThreadStateFingerprint,
          previous,
          current,
        )
        break
      case 'CloseThread':
        // TO DO:
        // retrieve the final thread state from previous channel state
        // if it doesnt exist (i.e sync)
        signedState = await this.signCloseThreadUpdate(
          opts.threadState as ThreadStateFingerprint,
          previous,
          current,
        )
        break
      default:
        // TO DO: ask wolever
        // @ts-ignore
        assertUnreachable(reason)
    }

    const updatedState = {
      state: signedState,
      metadata: opts.metadata,
      reason: opts.reason,
    }
    return updatedState
  }

  // handlers for update types
  // TO DO: implement
  signExchangeUpdate = async (
    exchangeAmount: ExchangedBalances,
    previousChannelState: SignedChannelState,
    proposedChannelState: ChannelStateFingerprint,
  ): Promise<SignedChannelState> => {
    // verify and cosign
    const validatorOpts = {
      reason: 'Exchange',
      previous: previousChannelState,
      current: proposedChannelState,
      hubAddress: this.hubAddress,
      exchangeAmount,
    } as ChannelFlexibleValidatorOptions
    const isValid = Validation.validateChannelStateUpdate(validatorOpts)
    if (!isValid) {
      throw new Error(`Error validating update: ${isValid}`)
    }

    console.log(
      'Account',
      proposedChannelState.user,
      ' is signing:',
      proposedChannelState,
    )
    const hash = Utils.createChannelStateUpdateHash(proposedChannelState)
    // sign
    // TO DO: personal sign is causing issues, sign params in weird order
    // is this a typescript issue
    // @ts-ignore
    const sigUser = await this.web3.eth.personal.sign(
      hash,
      proposedChannelState.user,
    )

    const signedState = channelStateToSignedChannelState(
      proposedChannelState,
      sigUser,
    )

    return signedState
  }

  signPaymentUpdate = async (
    payment: Balances,
    previousChannelState: SignedChannelState,
    proposedChannelState: ChannelStateFingerprint,
  ): Promise<SignedChannelState> => {
    // verify and sign
    const validatorOpts = {
      reason: 'Payment',
      previous: previousChannelState,
      current: proposedChannelState,
      hubAddress: this.hubAddress,
      payment,
    } as ChannelFlexibleValidatorOptions
    const isValid = Validation.validateChannelStateUpdate(validatorOpts)
    if (!isValid) {
      throw new Error(`Error validating update: ${isValid}`)
    }
    console.log(
      'Account',
      proposedChannelState.user,
      ' is signing:',
      proposedChannelState,
    )
    const hash = Utils.createChannelStateUpdateHash(proposedChannelState)
    // sign
    // TO DO: personal sign is causing issues, sign params in weird order
    // is this a typescript issue
    // @ts-ignore
    const sigUser = await this.web3.eth.personal.sign(
      hash,
      proposedChannelState.user,
    )

    const signedState = channelStateToSignedChannelState(
      proposedChannelState,
      sigUser,
    )

    return signedState
  }

  // TO DO: implement
  signOpenThreadUpdate = async (
    proposedThreadState: ThreadStateFingerprint,
    previousChannelState: SignedChannelState,
    proposedChannelState: ChannelStateFingerprint,
  ): Promise<SignedChannelState> => {
    // verify and sign
    const validatorOpts = {
      reason: 'OpenThread',
      previous: previousChannelState,
      current: proposedChannelState,
      hubAddress: this.hubAddress,
      threadState: proposedThreadState,
    } as ChannelFlexibleValidatorOptions
    const isValid = Validation.validateChannelStateUpdate(validatorOpts)
    if (!isValid) {
      throw new Error(`Error validating update: ${isValid}`)
    }
    console.log(
      'Account',
      proposedChannelState.user,
      ' is signing:',
      proposedChannelState,
    )
    const hash = Utils.createChannelStateUpdateHash(proposedChannelState)
    // sign
    // TO DO: personal sign is causing issues, sign params in weird order
    // is this a typescript issue
    // @ts-ignore
    const sigUser = await this.web3.eth.personal.sign(
      hash,
      proposedChannelState.user,
    )

    const signedState = channelStateToSignedChannelState(
      proposedChannelState,
      sigUser,
    )

    return signedState
  }

  // TO DO: implement
  signCloseThreadUpdate = async (
    finalThreadState: ThreadStateFingerprint,
    previousChannelState: SignedChannelState,
    proposedChannelState: ChannelStateFingerprint,
  ): Promise<SignedChannelState> => {
    // verify and sign
    const validatorOpts = {
      reason: 'CloseThread',
      previous: previousChannelState,
      current: proposedChannelState,
      hubAddress: this.hubAddress,
      threadState: finalThreadState,
    } as ChannelFlexibleValidatorOptions
    const isValid = Validation.validateChannelStateUpdate(validatorOpts)
    if (!isValid) {
      throw new Error(`Error validating update: ${isValid}`)
    }
    console.log(
      'Account',
      proposedChannelState.user,
      ' is signing:',
      proposedChannelState,
    )
    const hash = Utils.createChannelStateUpdateHash(proposedChannelState)
    // sign
    // TO DO: personal sign is causing issues, sign params in weird order
    // is this a typescript issue
    // @ts-ignore
    const sigUser = await this.web3.eth.personal.sign(
      hash,
      proposedChannelState.user,
    )

    const signedState = channelStateToSignedChannelState(
      proposedChannelState,
      sigUser,
    )

    return signedState
  }

  // get proposed exchange could be called
  signProposedPendingUpdate = async (
    pending: PendingBalances,
    previousChannelState: SignedChannelState,
    proposedChannelState: ChannelStateFingerprint,
  ): Promise<SignedChannelState> => {
    // verify and sign
    const validatorOpts = {
      reason: 'ProposePending',
      previous: previousChannelState,
      current: proposedChannelState,
      hubAddress: this.hubAddress,
      pending,
    } as ChannelFlexibleValidatorOptions
    const isValid = Validation.validateChannelStateUpdate(validatorOpts)
    if (!isValid) {
      throw new Error(`Error validating update: ${isValid}`)
    }
    console.log(
      'Account',
      proposedChannelState.user,
      ' is signing:',
      proposedChannelState,
    )
    const hash = Utils.createChannelStateUpdateHash(proposedChannelState)
    // sign
    // TO DO: personal sign is causing issues, sign params in weird order
    // is this a typescript issue
    // @ts-ignore
    const sigUser = await this.web3.eth.personal.sign(
      hash,
      proposedChannelState.user,
    )

    const signedState = channelStateToSignedChannelState(
      proposedChannelState,
      sigUser,
    )

    return signedState
  }

  signConfirmPendingUpdate = async (
    pending: PendingBalances,
    previousChannelState: SignedChannelState,
    proposedChannelState: ChannelStateFingerprint,
  ): Promise<SignedChannelState> => {
    // verify and sign
    const validatorOpts = {
      reason: 'ConfirmPending',
      previous: previousChannelState,
      current: proposedChannelState,
      hubAddress: this.hubAddress,
      pending,
    } as ChannelFlexibleValidatorOptions
    const isValid = Validation.validateChannelStateUpdate(validatorOpts)
    if (!isValid) {
      throw new Error(`Error validating update: ${isValid}`)
    }
    console.log(
      'Account',
      proposedChannelState.user,
      ' is signing:',
      proposedChannelState,
    )
    const hash = Utils.createChannelStateUpdateHash(proposedChannelState)
    // sign
    // TO DO: personal sign is causing issues, sign params in weird order
    // is this a typescript issue
    // @ts-ignore
    const sigUser = await this.web3.eth.personal.sign(
      hash,
      proposedChannelState.user,
    )

    const signedState = channelStateToSignedChannelState(
      proposedChannelState,
      sigUser,
    )

    return signedState
  }

  // function returns signature on thread updates
  // TO DO: finish
  createThreadStateUpdate = async (
    opts: ThreadValidatorOptions,
    meta?: Object,
  ): Promise<ThreadState> => {
    const isValid = Validation.validateThreadStateUpdate(opts)
    if (!isValid) {
      throw new Error(`Error validating update: ${isValid}`)
    }
    const hash = Utils.createThreadStateUpdateHash(opts.current)
    // TO DO: this is probably also poor form
    let signed = opts.current as ThreadState
    // @ts-ignore
    signed.sigA = await this.web3.eth.personal.sign(hash, opts.current.sender)
    return signed
  }

  /*********************************
   ********* CONTRACT FNS **********
   *********************************/
  userAuthorizedDepositHandler = async (stateStr: SignedChannelState) => {
    let bondedWei: any
    const state = channelStateToBN(stateStr)
    let threads = await this.getThreads(state.user)
    threads.reduce((prevStr: ThreadState, currStr: ThreadState) => {
      const prev = threadStateToBN(prevStr)
      const curr = threadStateToBN(currStr)
      if (prev.receiver !== state.user) {
        // user is payor
        const threadWei = prev.balanceWeiSender
          .add(prev.balanceWeiReceiver)
          .add(curr.balanceWeiSender)
          .add(curr.balanceWeiReceiver)
        return threadWei
      }
    }, bondedWei)

    let bondedToken: any
    threads.reduce((prevStr: ThreadState, currStr: ThreadState) => {
      const prev = threadStateToBN(prevStr)
      const curr = threadStateToBN(currStr)
      if (prev.receiver !== state.user) {
        // user is payor
        const threadToken = prev.balanceTokenReceiver
          .add(prev.balanceTokenSender)
          .add(curr.balanceTokenReceiver)
          .add(curr.balanceTokenSender)
        return threadToken
      }
    }, bondedToken)
    const channelTotalWei = state.balanceWeiHub
      .add(state.balanceWeiUser)
      .add(bondedWei)

    const channelTotalToken = state.balanceTokenHub
      .add(state.balanceTokenUser)
      .add(bondedToken)

    // deposit on the contract
    const tx = await this.channelManager.methods
      .userAuthorizedUpdate(
        state.user, // recipient
        [
          state.balanceWeiHub.toString(),
          state.balanceWeiUser.toString(),
          channelTotalWei.toString(),
        ],
        [
          state.balanceTokenHub.toString(),
          state.balanceTokenUser.toString(),
          channelTotalToken.toString(),
        ],
        [
          state.pendingDepositWeiHub.toString(),
          state.pendingWithdrawalWeiHub.toString(),
          state.pendingDepositWeiUser.toString(),
          state.pendingWithdrawalWeiUser.toString(),
        ],
        [
          state.pendingDepositTokenHub.toString(),
          state.pendingWithdrawalTokenHub.toString(),
          state.pendingDepositTokenUser.toString(),
          state.pendingWithdrawalTokenUser.toString(),
        ],
        [state.txCountGlobal, state.txCountChain],
        state.threadRoot,
        state.threadCount,
        state.timeout,
        // @ts-ignore WTF???
        state.sigHub,
      )
      .send({
        from: state.user,
        value: state.pendingDepositWeiUser.toString(),
      })

    return tx
  }

  /** TO DO: will we need any of these methods anymore or is this wallet level abstraction? */
  // @ts-ignore
  // closeAllThreads = async (user?: Address): Promise<ContractChannelState[]> => {}

  // depositAndExchange = async (
  //   userBalances: Balances,
  //   hubBalances: Balances,
  // ): Promise<any> => {}

  // deposit = async (
  //   userBalances: Balances,
  //   hubBalances: Balances,
  // ): Promise<any> => {}

  // exchangeAndWithdraw = async (
  //   userBalances: Balances,
  //   hubBalances: Balances,
  // ): Promise<any> => {}

  // withdraw = async (
  //   userBalances: Balances,
  //   hubBalances: Balances,
  // ): Promise<any> => {}
}
