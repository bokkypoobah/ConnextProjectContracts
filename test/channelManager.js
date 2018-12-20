const should = require("chai")
const HttpProvider = require("ethjs-provider-http")
const ethjsUtil = require('ethereumjs-util')
const EthRPC = require("ethjs-rpc")
const chai = require('chai');
const BN = require('bn.js')
const privKeys = require("./privKeys.json")
const CM = artifacts.require("./ChannelManager.sol")
const HST = artifacts.require("./HumanStandardToken.sol")

/* Connext Client */
const { Utils } = require("../client/dist/Utils.js");
const { StateGenerator } = require("../client/dist/StateGenerator.js")
const { Validator } = require("../client/dist/validator.js")
const { convertChannelState, convertDeposit, convertExchange, convertWithdrawal } = require("../client/dist/types")
const { mkAddress, getChannelState, getThreadState, getDepositArgs, getWithdrawalArgs, getExchangeArgs, getPaymentArgs, assertThreadStateEqual, assertChannelStateEqual } = require("../client/dist/testing")
const clientUtils = new Utils()
const sg = new StateGenerator()

const data = require('../data.json')

should.use(require("chai-as-promised")).use(require('chai-bignumber')(BN)).should()

const ethRPC = new EthRPC(new HttpProvider('http://localhost:8545'))
const emptyRootHash =
  "0x0000000000000000000000000000000000000000000000000000000000000000"

const emptyAddress = "0x0000000000000000000000000000000000000000"

const SolRevert = 'VM Exception while processing transaction: revert'

const secondsFromNow = (seconds) => seconds + Math.floor(new Date().getTime() / 1000)
const minutesFromNow = (minutes) => secondsFromNow(minutes * 60)

async function snapshot() {
  return new Promise((accept, reject) => {
    ethRPC.sendAsync({ method: `evm_snapshot` }, (err, result) => {
      if (err) {
        reject(err)
      } else {
        accept(result)
      }
    })
  })
}

async function restore(snapshotId) {
  return new Promise((accept, reject) => {
    ethRPC.sendAsync({ method: `evm_revert`, params: [snapshotId] }, (err, result) => {
      if (err) {
        reject(err)
      } else {
        accept(result)
      }
    })
  })
}

async function moveForwardSecs(secs) {
  await ethRPC.sendAsync({
    jsonrpc: '2.0', method: `evm_increaseTime`,
    params: [secs],
    id: 0
  }, (err) => { `error increasing time` })
  const start = Date.now()
  await ethRPC.sendAsync({ method: `evm_mine` }, (err) => { })
  return true
}

async function getBlockTimeByTxHash(txHash) {
  const blockNumber = (await web3.eth.getTransaction(txHash)).blockNumber
  return +(await web3.eth.getBlock(blockNumber)).timestamp
}

function getEventParams(tx, event) {
  if (tx.logs.length > 0) {
    for (let idx = 0; idx < tx.logs.length; idx++) {
      if (tx.logs[idx].event == event) {
        return tx.logs[idx].args
      }
    }
  }
  return false
}

// takes a Connext channel state and converts it to the contract format
function normalize(state) {
  state = convertChannelState("bn", state)
  return ({
    ...state,
    user: state.user,
    recipient: state.recipient,
    weiBalances: [state.balanceWeiHub, state.balanceWeiUser],
    tokenBalances: [state.balanceTokenHub, state.balanceTokenUser],
    pendingWeiUpdates: [
      state.pendingDepositWeiHub,
      state.pendingWithdrawalWeiHub,
      state.pendingDepositWeiUser,
      state.pendingWithdrawalWeiUser,
    ],
    pendingTokenUpdates: [
      state.pendingDepositTokenHub,
      state.pendingWithdrawalTokenHub,
      state.pendingDepositTokenUser,
      state.pendingWithdrawalTokenUser,
    ],
    txCount: [state.txCountGlobal, state.txCountChain],
    threadRoot: state.threadRoot,
    threadCount: state.threadCount,
    timeout: state.timeout
  })
}

async function getSig(state, account) {
  const hash = clientUtils.createChannelStateHash(state)
  const { signature } = await web3.eth.accounts.sign(hash, account.pk)
  return signature
}

// Generates an array of incorrect sigs to test each element of state for _verifySig
async function generateIncorrectSigs(state, signer) {
  let sigArray = new Array()
  let i = 0

  //methodology: save element to temp, change element and sign, restore element from temp
  for (var element in state) {
    let temp = state[element]
    //The below if/else gates ensure that state[element] is always changed
    //if the element is not already it's initial value, reinitialize
    if(state[element] != getChannelState("empty")[element])
      state[element] = getChannelState("empty")[element]
    //else (i.e. element == initial value) increment that value
    else
      state[element] = getChannelState("empty")[element] + 1
    //edge case: if element is threadRoot, set to 0x01
    if (element == "threadRoot")
      state[element] = "0x0100000000000000000000000000000000000000000000000000000000000000"
    
    sigArray[i] = await getSig(state, signer)
    state[element] = temp
    i++
  }

  //for final sig, signer needs to be incorrect
  //if the expected signer is viewer or performer, then have hub sign
  if (signer != hub)
    sigArray[i] = await getSig(state, hub)
  //if the expected signer is hub, then have viewer sign
  else
    sigArray[i] = await getSig(state, viewer)

  return sigArray
}

// channel update fn wrappers
async function userAuthorizedUpdate(state, account, wei = 0) {
  state = normalize(state)
  return await cm.userAuthorizedUpdate(
    state.recipient,
    state.weiBalances,
    state.tokenBalances,
    state.pendingWeiUpdates,
    state.pendingTokenUpdates,
    state.txCount,
    state.threadRoot,
    state.threadCount,
    state.timeout,
    state.sigHub,
    { from: account.address, value: wei }
  )
}

async function hubAuthorizedUpdate(state, account, wei = 0) {
  state = normalize(state)
  return await cm.hubAuthorizedUpdate(
    state.user,
    state.recipient,
    state.weiBalances,
    state.tokenBalances,
    state.pendingWeiUpdates,
    state.pendingTokenUpdates,
    state.txCount,
    state.threadRoot,
    state.threadCount,
    state.timeout,
    state.sigUser,
    { from: account.address, value: wei }
  )
}

// channel dispute fn wrappers
async function startExit(state, account, wei = 0) {
  return await cm.startExit(state.user, { from: account.address, value: wei })
}

async function startExitWithUpdate(state, account, wei = 0) {
  state = normalize(state)
  return await cm.startExitWithUpdate(
    [state.user, state.recipient],
    state.weiBalances,
    state.tokenBalances,
    state.pendingWeiUpdates,
    state.pendingTokenUpdates,
    state.txCount,
    state.threadRoot,
    state.threadCount,
    state.timeout,
    state.sigHub,
    state.sigUser,
    { from: account.address, value: wei }
  )
}

async function emptyChannelWithChallenge(state, account, wei = 0) {
  state = normalize(state)
  return await cm.exitChannelWithChallenge(
    [state.user, state.recipient],
    state.weiAmount,
    state.tokenBalances,
    state.pendingWeiUpdates,
    state.pendingTokenUpdates,
    state.txCount,
    state.threadRoot,
    state.threadCount,
    state.timeout,
    state.sigHub,
    state.sigUser,
  )
}

async function emptyChannel(account, wei = 0) {
  return await cm.startExit(account.address, { from: account.address, value: wei })
}

async function submitUserAuthorized(userAccount, hubAccount, wei = 0, ...overrides) {
  let state = getChannelState("empty", {
    user: userAccount.address,
    recipient: userAccount.address,
    balanceToken: [3, 0],
    balanceWei: [0, 2],
    pendingDepositWei: [0, wei],
    pendingDepositToken: [7, 0],
    txCount: [1, 1]
  }, overrides)
  state.sigHub = getSig(state, hubAccount)
  return await userAuthorizedUpdate(state, userAccount, wei)
}

async function submitHubAuthorized(userAccount, hubAccount, wei = 0, ...overrides) {
  let state = getChannelState("empty", {
    user: userAccount.address,
    recipient: userAccount.address,
    balanceToken: [3, 0],
    balanceWei: [0, 2],
    pendingDepositWei: [0, wei],
    pendingDepositToken: [7, 0],
    txCount: [1, 1]
  }, overrides)
  state.sigUser = getSig(state, userAccount)
  return await hubAuthorizedUpdate(state, hubAccount, wei)
}

let cm, token, hub, performer, viewer, state, validator, initHubReserveWei,
  initHubReserveToken, challengePeriod

// TODO - because we're testing the JS, we should also be testing
// that we properly handle BigNumbers, and use them in our tests
// Specifically, test the high possible value of uint256

contract("ChannelManager", accounts => {
  let snapshotId

  // TODO add verification of reserves by including initital reserve values

  // asserts that the onchain-channel state matches provided offchain state

  const verifyChannelBalances = async (account, state) => {
    const stateBN = convertChannelState("bn", state)
    const channelBalances = await cm.getChannelBalances(account.address)

    // Wei balances are equal
    channelBalances.weiHub.should.be.bignumber.equal(stateBN.balanceWeiHub);
    channelBalances.weiUser.should.be.bignumber.equal(stateBN.balanceWeiUser);
    channelBalances.weiTotal.should.be.bignumber.equal(
      stateBN.balanceWeiHub.add(stateBN.balanceWeiUser)
    )

    // Token balances are equal
    channelBalances.tokenHub.should.be.bignumber.equal(stateBN.balanceTokenHub);
    channelBalances.tokenUser.should.be.bignumber.equal(stateBN.balanceTokenUser);
    channelBalances.tokenTotal.should.be.bignumber.equal(
      stateBN.balanceTokenHub.add(stateBN.balanceTokenUser)
    )
  }

  // status, exitInitiator, and channelClosingTime must be explicitely
  // set on the state object or are assumed to be 0, emptyAddress, and 0
  const verifyChannelDetails = async (account, state) => {
    const stateBN = convertChannelState("bn", state)
    const channelDetails = await cm.getChannelDetails(account.address)
    // Tx counts are equal to the original update (state increments)
    channelDetails.txCountGlobal.should.be.bignumber.equal(stateBN.txCountGlobal)
    channelDetails.txCountChain.should.be.bignumber.equal(stateBN.txCountChain)

    // Thread states are equal
    assert.equal(channelDetails.threadRoot, state.threadRoot)
    assert.equal(channelDetails.threadCount, state.threadCount)

    // check exit params
    channelDetails.channelClosingTime.should.be.bignumber.equal(
      state.channelClosingTime ? state.channelClosingTime : 0
    )
    assert.equal(channelDetails.exitInitiator, state.exitInitiator || emptyAddress)
    assert.equal(channelDetails.status, state.status ? state.status : 0)
  }

  const verifyAuthorizedUpdate = async (account, update, tx, isHub) => {
    const confirmed = await validator.generateConfirmPending(update, {
      transactionHash: tx.tx
    })

    // verify channel balances match the confirmed offchain values
    await verifyChannelBalances(account, confirmed)

    // use update for verifying channel details b/c txCounts will match
    await verifyChannelDetails(account, update)

    const updateBN = convertChannelState("bn", update)

    const event = getEventParams(tx, 'DidUpdateChannel')
    assert.equal(event.user, account.address)
    assert.equal(event.senderIdx, isHub ? 0 : 1)
    event.weiBalances[0].should.be.bignumber.equal(updateBN.balanceWeiHub)
    event.weiBalances[1].should.be.bignumber.equal(updateBN.balanceWeiUser)
    event.tokenBalances[0].should.be.bignumber.equal(updateBN.balanceTokenHub)
    event.tokenBalances[1].should.be.bignumber.equal(updateBN.balanceTokenUser)
    event.pendingWeiUpdates[0].should.be.bignumber.equal(updateBN.pendingDepositWeiHub)
    event.pendingWeiUpdates[1].should.be.bignumber.equal(updateBN.pendingWithdrawalWeiHub)
    event.pendingWeiUpdates[2].should.be.bignumber.equal(updateBN.pendingDepositWeiUser)
    event.pendingWeiUpdates[3].should.be.bignumber.equal(updateBN.pendingWithdrawalWeiUser)
    event.pendingTokenUpdates[0].should.be.bignumber.equal(updateBN.pendingDepositTokenHub)
    event.pendingTokenUpdates[1].should.be.bignumber.equal(updateBN.pendingWithdrawalTokenHub)
    event.pendingTokenUpdates[2].should.be.bignumber.equal(updateBN.pendingDepositTokenUser)
    event.pendingTokenUpdates[3].should.be.bignumber.equal(updateBN.pendingWithdrawalTokenUser)
    assert.equal(+event.txCount[0], update.txCountGlobal)
    assert.equal(+event.txCount[1], update.txCountChain)
    assert.equal(event.threadRoot, emptyRootHash)
    assert.equal(event.threadCount, 0)
  }

  const verifyUserAuthorizedUpdate = async (account, update, tx) => {
    await verifyAuthorizedUpdate(account, update, tx, false)
  }

  const verifyHubAuthorizedUpdate = async (account, update, tx) => {
    await verifyAuthorizedUpdate(account, update, tx, true)
  }

  const verifyStartExit = async (account, update, tx, isHub) => {
    const blockTime = await getBlockTimeByTxHash(tx.tx)

    // explicitely set so they can be checked by verifyChannelDetails
    update.exitInitiator = isHub ? hub.address : account.address
    update.status = 1
    update.channelClosingTime = blockTime + challengePeriod

    await verifyChannelBalances(account, update)
    await verifyChannelDetails(account, update)

    const updateBN = convertChannelState("bn", update)

    const event = getEventParams(tx, 'DidStartExitChannel')
    assert.equal(event.user, account.address)
    assert.equal(event.senderIdx, isHub ? 0 : 1)
    event.weiBalances[0].should.be.bignumber.equal(updateBN.balanceWeiHub)
    event.weiBalances[1].should.be.bignumber.equal(updateBN.balanceWeiUser)
    event.tokenBalances[0].should.be.bignumber.equal(updateBN.balanceTokenHub)
    event.tokenBalances[1].should.be.bignumber.equal(updateBN.balanceTokenUser)
    assert.equal(+event.txCount[0], update.txCountGlobal)
    assert.equal(+event.txCount[1], update.txCountChain)
    assert.equal(event.threadRoot, emptyRootHash)
    assert.equal(event.threadCount, 0)
  }

  before('deploy contracts', async () => {
    cm = await CM.deployed()
    token = await HST.deployed()

    hub = {
      address: accounts[0],
      pk: privKeys[0]
    }
    performer = {
      address: accounts[1],
      pk: privKeys[1]
    }
    viewer = {
      address: accounts[2],
      pk: privKeys[2]
    }

    validator = new Validator(web3, hub.address)

    challengePeriod = +(await cm.challengePeriod.call()).toString()
  })

  beforeEach(async () => {
    snapshotId = await snapshot()

    state = getChannelState("empty", {
      contractAddress: cm.address,
      user: viewer.address,
      recipient: viewer.address,
      txCountGlobal: 0,
      txCountChain: 0
    })
  })

  afterEach(async () => {
    await restore(snapshotId)
  })

  describe('contract deployment', () => {
    it("verify init parameters", async () => {
      const hubAddress = await cm.hub.call()
      assert.equal(hubAddress, hub.address)
      // challengePeriod set in *before* block
      assert.equal(+data.channelManager.challengePeriod, challengePeriod)
      const approvedToken = await cm.approvedToken.call()
      assert.equal(token.address, approvedToken)
    })
  })

  describe('reserve management', () => {
    it("accept ETH - getHubReserveWei", async () => {
      const weiAmount = 1
      await web3.eth.sendTransaction({ from: hub.address, to: cm.address, value: weiAmount })
      const reserveWei = await cm.getHubReserveWei()
      assert.equal(reserveWei, weiAmount)
    })

    it("accept tokens - getHubReserveTokenss", async () => {
      const tokenAmount = 1
      await token.transfer(cm.address, tokenAmount, { from: hub.address })
      const reserveToken = await cm.getHubReserveTokens()
      assert.equal(reserveToken, tokenAmount)
    })

    describe("hubContractWithdraw", () => {
      it("happy case", async () => {
        const weiAmount = 1
        const tokenAmount = 1
        const hubInitialToken = await token.balanceOf(hub.address)
        await web3.eth.sendTransaction({ from: hub.address, to: cm.address, value: weiAmount })
        await token.transfer(cm.address, tokenAmount, { from: hub.address })
        await cm.hubContractWithdraw(weiAmount, tokenAmount)
        const reserveToken = await cm.getHubReserveTokens()
        const reserveWei = await cm.getHubReserveWei()
        assert.equal(reserveWei, 0)
        assert.equal(reserveToken, 0)

        const hubFinalToken = await web3.eth.getBalance(hub.address)
        assert.equal(hubInitialToken, hubInitialToken)
      })

      it("fails with insufficient ETH", async () => {
        const weiAmount = 1
        const tokenAmount = 1
        const weiToWithdraw = weiAmount + 1
        await web3.eth.sendTransaction({ from: hub.address, to: cm.address, value: weiAmount })
        await token.transfer(cm.address, tokenAmount, { from: hub.address })
        await cm.hubContractWithdraw(weiToWithdraw, tokenAmount).should.be.rejectedWith(
          `${SolRevert} hubContractWithdraw: Contract wei funds not sufficient to withdraw`
        )
      })

      it("fails with insufficient token", async () => {
        const weiAmount = 1
        const tokenAmount = 1
        const tokenToWithdraw = tokenAmount + 1
        await web3.eth.sendTransaction({ from: hub.address, to: cm.address, value: weiAmount })
        await token.transfer(cm.address, tokenAmount, { from: hub.address })
        await cm.hubContractWithdraw(weiAmount, tokenToWithdraw).should.be.rejectedWith(
          `${SolRevert} hubContractWithdraw: Contract token funds not sufficient to withdraw`
        )
      })
    })
  })

  describe("userAuthorizedUpdate - deposit", () => {
    beforeEach(async () => {
      const userTokenBalance = 1000
      await token.transfer(viewer.address, userTokenBalance, { from: hub.address })
      await token.approve(cm.address, userTokenBalance, { from: viewer.address })
    })

    describe("happy case", () => {
      it('user deposit wei', async () => {
        const timeout = minutesFromNow(5)
  
        // Applying and generating args
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiUser: 10,
          timeout
        })
        const update = validator.generateProposePendingDeposit(state, deposit)
  
        update.sigHub = await getSig(update, hub)
        const tx = await userAuthorizedUpdate(update, viewer, 10)
  
        await verifyUserAuthorizedUpdate(viewer, update, tx)
  
        const totalChannelWei = await cm.totalChannelWei.call()
        assert.equal(+totalChannelWei, 10)
  
        const hubReserveWei = await cm.getHubReserveWei()
        assert.equal(hubReserveWei, 0)
      })
  
      it('user deposit token', async () => {
        const timeout = minutesFromNow(5)
  
        // Applying and generating args
        const deposit = getDepositArgs("empty", {
          ...state,
          depositTokenUser: 10,
          timeout
        })
        const update = validator.generateProposePendingDeposit(state, deposit)
  
        update.sigHub = await getSig(update, hub)
        const tx = await userAuthorizedUpdate(update, viewer, 0)
  
        await verifyUserAuthorizedUpdate(viewer, update, tx)
  
        const totalChannelWei = await cm.totalChannelWei.call()
        assert.equal(+totalChannelWei, 0)
  
        const hubReserveWei = await cm.getHubReserveWei()
        assert.equal(hubReserveWei, 0)
      })
    })

    describe("failing requires", () => {
      it('fails when sent wei does not match pending wei deposit', async () => {
        const timeout = minutesFromNow(5)
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiUser: 10,
          timeout
        })
        const update = validator.generateProposePendingDeposit(state, deposit)
        update.sigHub = await getSig(update, hub)

        // sending 20 wei
        await userAuthorizedUpdate(update, viewer, 20).should.be.rejectedWith('msg.value is not equal to pending user deposit.')
      })

      //TODO it('hubAuthorizedUpdate - fails when channel status is not "Open"')

      it('fails when timeout expired', async () => {
        const timeout = 1
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiUser: 10,
          timeout
        })
        const update = validator.generateProposePendingDeposit(state, deposit)
        update.sigHub = await getSig(update, hub)
        await userAuthorizedUpdate(update, viewer, 10).should.be.rejectedWith('the timeout must be zero or not have passed.')
      })

      it('fails when txCount[0] <= channel.txCount[0]', async () => {
        // Part 1 - txCount[0] = channel.txCount[0]

        // First submit a deposit at default txCountGlobal = 0
        const timeout = minutesFromNow(5)
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiUser: 10,
          timeout
        })
        const update = validator.generateProposePendingDeposit(state, deposit)
        update.sigHub = await getSig(update, hub)
        await userAuthorizedUpdate(update, viewer, 10)

        // Then submit another deposit at the same txCountGlobal = 0
        // (will be the same because we're using the same initital state to gen)
        const newUpdate = validator.generateProposePendingDeposit(state, deposit)
        newUpdate.sigHub = await getSig(newUpdate, hub)

        await userAuthorizedUpdate(newUpdate, viewer, 10).should.be.rejectedWith('global txCount must be higher than the current global txCount')
      })

      it('fails when txCount[0] <= channel.txCount[0]', async () => {
        // Part 2 - txCount[0] < channel.txCount[0]

        // First submit a deposit at default txCountGlobal = 1
        const timeout = minutesFromNow(5)
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiUser: 10,
          timeout
        })
        const update = validator.generateProposePendingDeposit(state, deposit)
        update.txCountGlobal = 1
        update.sigHub = await getSig(update, hub)
        await userAuthorizedUpdate(update, viewer, 10)

        // Then submit another deposit at the same txCountGlobal = 0
        const newUpdate = validator.generateProposePendingDeposit(state, deposit)
        newUpdate.txCountGlobal = 0
        newUpdate.sigHub = await getSig(newUpdate, hub)

        await userAuthorizedUpdate(newUpdate, viewer, 10).should.be.rejectedWith('global txCount must be higher than the current global txCount')
       })

      it('fails when txCount[1] < channel.txCount[1]', async () => {
        //First submit a deposit at default txCountChain
        const timeout = minutesFromNow(5)
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiUser: 10,
          timeout
        })
        const update = validator.generateProposePendingDeposit(state, deposit)
        //txCountGlobal = 1
        update.txCountChain = 1
        update.sigHub = await getSig(update, hub)
        await userAuthorizedUpdate(update, viewer, 10)

        // Then submit another deposit at the same txCountChain
        const newUpdate = validator.generateProposePendingDeposit(state, deposit)
        newUpdate.txCountGlobal = 2 // have to increment global count here to pass above test
        newUpdate.txCountChain = 0
        newUpdate.sigHub = await getSig(newUpdate, hub)

        await userAuthorizedUpdate(newUpdate, viewer, 10).should.be.rejectedWith('onchain txCount must be higher or equal to the current onchain txCount')
      })

      it.only('fails when wei is not conserved', async () => {
        const timeout = minutesFromNow(5)
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiUser: 10,
          timeout
        })
        const update = validator.generateProposePendingDeposit(state, deposit)
        update.balanceWeiUser = 20
        update.sigHub = await getSig(update, hub)

        await userAuthorizedUpdate(update, viewer, 10).should.be.rejectedWith('wei must be conserved')
      })

      it.only('fails when token are not conserved', async () => {
        const timeout = minutesFromNow(5)
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiUser: 10,
          timeout
        })
        const update = validator.generateProposePendingDeposit(state, deposit)
        update.balanceTokenUser = 20
        update.sigHub = await getSig(update, hub)

        await userAuthorizedUpdate(update, viewer, 10).should.be.rejectedWith('tokens must be conserved')
      })

      it('fails when insufficient reserve wei', async () => {
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiHub: 1001
        })
        const update = sg.proposePendingDeposit(state, deposit)
        update.sigUser = await getSig(update, viewer)

        await hubAuthorizedUpdate(update, hub, 0).should.be.rejectedWith('insufficient reserve wei for deposits')
      })

      it('fails when insufficient reserve token', async () => {
        const deposit = getDepositArgs("empty", {
          ...state,
          depositTokenHub: 1001
        })
        const update = sg.proposePendingDeposit(state, deposit)
        update.sigUser = await getSig(update, viewer)

        await hubAuthorizedUpdate(update, hub, 0).should.be.rejectedWith('insufficient reserve tokens for deposits')
      })

      it('fails when current total channel wei + both deposits is less than final balances + withdrawals', async () => {
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiHub: 10,
        })
        const update = sg.proposePendingDeposit(state, deposit)
        update.pendingWithdrawalWeiUser = 20 //also tested here with hub withdrawal
        update.sigUser = await getSig(update, viewer)

        await hubAuthorizedUpdate(update, hub, 0).should.be.rejectedWith('insufficient wei')
      })

      it('fails when current total channel token + both deposits is less than final balances + withdrawals', async () => {
        const deposit = getDepositArgs("empty", {
          ...state,
          depositTokenHub: 10,
        })
        const update = sg.proposePendingDeposit(state, deposit)
        update.pendingWithdrawalTokenUser = 20 //also tested here with hub withdrawal
        update.sigUser = await getSig(update, viewer)

        await hubAuthorizedUpdate(update, hub, 0).should.be.rejectedWith('insufficient token')
      })

      it('fails if sender is hub', async () => {
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiHub: 10
        })
        const update = sg.proposePendingDeposit(state, deposit)
        update.user = hub.address
        update.sigUser = await getSig(update, viewer)

        await hubAuthorizedUpdate(update, hub, 0).should.be.rejectedWith('user can not be hub')
      })

      it('fails when sender is contract', async () => {
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiHub: 10
        })
        const update = sg.proposePendingDeposit(state, deposit)
        update.user = cm.address
        update.sigUser = await getSig(update, viewer)

        await hubAuthorizedUpdate(update, hub, 0).should.be.rejectedWith('user can not be channel manager')
      })

      it('fails when hub signature is incorrect (long test)', async () => {
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiHub: 10
        })
        const update = sg.proposePendingDeposit(state, deposit)
        const sigArrayUser = await generateIncorrectSigs(update, viewer)
        //iterate over incorrect sigs and try each one to make sure it fails
        for(i=0; i<sigArrayUser.length; i++){
          update.sigUser = sigArrayUser[i]
          console.log("Now testing signature: " + update.sigUser)
          await hubAuthorizedUpdate(update, hub, 0).should.be.rejectedWith('user signature invalid')
        }
      })
      
    })

  })

  describe("hubAuthorizedUpdate", () => {
    beforeEach(async () => {
      await token.transfer(cm.address, 1000, { from: hub.address })
      await web3.eth.sendTransaction({ from: hub.address, to: cm.address, value: 700 })
      initHubReserveWei = await cm.getHubReserveWei()
      initHubReserveToken = await cm.getHubReserveTokens()
    })

    describe("happy case", () => {
      it('hub deposit wei', async () => {
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiHub: 10
        })
        const update = sg.proposePendingDeposit(state, deposit)
        update.sigUser = await getSig(update, viewer)
        const tx = await hubAuthorizedUpdate(update, hub, 0)

        const totalChannelWei = await cm.totalChannelWei.call()
        assert.equal(+totalChannelWei, 10)

        const hubReserveWei = await cm.getHubReserveWei()
        assert.equal(hubReserveWei, initHubReserveWei - 10)
      })

      it('hub deposit token', async () => {
        const deposit = getDepositArgs("empty", {
          ...state,
          depositTokenHub: 10
        })
        const update = sg.proposePendingDeposit(state, deposit)
        update.sigUser = await getSig(update, viewer)
        const tx = await hubAuthorizedUpdate(update, hub, 0)

        await verifyHubAuthorizedUpdate(viewer, update, tx, true)

        const totalChannelToken = await cm.totalChannelToken.call()
        assert.equal(+totalChannelToken, 10)

        const hubReserveToken = await cm.getHubReserveTokens()
        assert.equal(hubReserveToken, initHubReserveToken - 10)
      })

      it('hub deposit wei for user', async () => {
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiUser: 10
        })
        const update = sg.proposePendingDeposit(state, deposit)
        update.sigUser = await getSig(update, viewer)
        const tx = await hubAuthorizedUpdate(update, hub, 0)

        await verifyHubAuthorizedUpdate(viewer, update, tx, true)

        const totalChannelWei = await cm.totalChannelWei.call()
        assert.equal(+totalChannelWei, 10)

        const hubReserveWei = await cm.getHubReserveWei()
        assert.equal(hubReserveWei, initHubReserveWei - 10)
      })

      it('hub deposit token for user', async () => {
        const deposit = getDepositArgs("empty", {
          ...state,
          depositTokenUser: 10
        })
        const update = sg.proposePendingDeposit(state, deposit)
        update.sigUser = await getSig(update, viewer)
        const tx = await hubAuthorizedUpdate(update, hub, 0)

        await verifyHubAuthorizedUpdate(viewer, update, tx, true)

        const totalChannelToken = await cm.totalChannelToken.call()
        assert.equal(+totalChannelToken, 10)

        const hubReserveToken = await cm.getHubReserveTokens()
        assert.equal(hubReserveToken, initHubReserveToken - 10)
      })

      it('hub deposit wei/token for itself and user', async () => {
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiHub: 5,
          depositTokenHub: 7,
          depositWeiUser: 8,
          depositTokenUser: 10
        })
        const update = sg.proposePendingDeposit(state, deposit)
        update.sigUser = await getSig(update, viewer)
        const tx = await hubAuthorizedUpdate(update, hub, 0)

        await verifyHubAuthorizedUpdate(viewer, update, tx, true)

        const totalChannelToken = await cm.totalChannelToken.call()
        assert.equal(+totalChannelToken, 17) // 7 + 10

        const hubReserveToken = await cm.getHubReserveTokens()
        assert.equal(hubReserveToken, initHubReserveToken - 17)

        const totalChannelWei = await cm.totalChannelWei.call()
        assert.equal(+totalChannelWei, 13) // 5 + 8

        const hubReserveWei = await cm.getHubReserveWei()
        assert.equal(hubReserveWei, initHubReserveWei - 13)
      })

      it('user withdrawal wei direct from hub deposit', async () => {
        const withdrawal = getWithdrawalArgs("empty", {
          ...state,
          additionalWeiHubToUser: 5
        })
        const update = sg.proposePendingWithdrawal(
          convertChannelState("bn", state),
          convertWithdrawal("bn", withdrawal)
        )

        update.sigUser = await getSig(update, viewer)
        const tx = await hubAuthorizedUpdate(update, hub, 0)
        await verifyHubAuthorizedUpdate(viewer, update, tx, true)

        const totalChannelToken = await cm.totalChannelToken.call()
        assert.equal(+totalChannelToken, 0)

        const hubReserveToken = await cm.getHubReserveTokens()
        hubReserveToken.should.be.bignumber.equal(initHubReserveToken);

        const totalChannelWei = await cm.totalChannelWei.call()
        assert.equal(+totalChannelWei, 0)

        const hubReserveWei = await cm.getHubReserveWei()
        hubReserveWei.should.be.bignumber.equal(initHubReserveWei - 5);
      })

      it('user withdrawal token direct from hub deposit', async () => {
        const withdrawal = getWithdrawalArgs("empty", {
          ...state,
          additionalTokenHubToUser: 5
        })
        const update = sg.proposePendingWithdrawal(
          convertChannelState("bn", state),
          convertWithdrawal("bn", withdrawal)
        )

        update.sigUser = await getSig(update, viewer)
        const tx = await hubAuthorizedUpdate(update, hub, 0)
        await verifyHubAuthorizedUpdate(viewer, update, tx, true)

        const totalChannelToken = await cm.totalChannelToken.call()
        assert.equal(+totalChannelToken, 0)

        const hubReserveToken = await cm.getHubReserveTokens()
        hubReserveToken.should.be.bignumber.equal(initHubReserveToken - 5);

        const totalChannelWei = await cm.totalChannelWei.call()
        assert.equal(+totalChannelWei, 0)

        const hubReserveWei = await cm.getHubReserveWei()
        hubReserveWei.should.be.bignumber.equal(initHubReserveWei);
      })

      it('hub deposit wei for user, user pays hub, hub checkpoints', async () => {
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiUser: 10
        })
        const update = sg.proposePendingDeposit(state, deposit)
        update.sigUser = await getSig(update, viewer)
        const tx = await hubAuthorizedUpdate(update, hub, 0)

        await verifyHubAuthorizedUpdate(viewer, update, tx, true)

        const confirmed = await validator.generateConfirmPending(update, {
          transactionHash: tx.tx
        })

        // apply payment and send to chain
        const payment = getDepositArgs("empty", {
          ...confirmed,
          amountWei: 3,
          amountToken: 0,
          recipient: 'hub'
        })
        const update2 = validator.generateChannelPayment(confirmed, payment)
        update2.sigUser = await getSig(update2, viewer)
        const tx2 = await hubAuthorizedUpdate(update2, hub, 0)
        await verifyHubAuthorizedUpdate(viewer, update2, tx2, true)

        const totalChannelWei = await cm.totalChannelWei.call()
        totalChannelWei.should.be.bignumber.equal(10);

        const hubReserveWei = await cm.getHubReserveWei()
        hubReserveWei.should.be.bignumber.equal(initHubReserveWei - 10);
      })

      it('hub deposit wei for user, user pays hub, they both withdraw', async () => {
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiUser: 10
        })
        const update = sg.proposePendingDeposit(state, deposit)
        update.sigUser = await getSig(update, viewer)
        const tx = await hubAuthorizedUpdate(update, hub, 0)

        await verifyHubAuthorizedUpdate(viewer, update, tx, true)

        const confirmed = await validator.generateConfirmPending(update, {
          transactionHash: tx.tx
        })

        // apply payment but don't send to chain
        const payment = getDepositArgs("empty", {
          ...confirmed,
          amountWei: 3,
          amountToken: 0,
          recipient: 'hub'
        })
        const update2 = validator.generateChannelPayment(confirmed, payment)

        // withdraw all wei
        const withdrawal = getWithdrawalArgs("empty", {
          ...update2,
          targetWeiUser: 0,
          targetWeiHub: 0
        })
        const update3 = validator.generateProposePendingWithdrawal(
          update2,
          convertWithdrawal("bn", withdrawal)
        )
        update3.sigUser = await getSig(update3, viewer)
        const tx2 = await hubAuthorizedUpdate(update3, hub, 0)
        await verifyHubAuthorizedUpdate(viewer, update3, tx2, true)

        const totalChannelWei = await cm.totalChannelWei.call()
        totalChannelWei.should.be.bignumber.equal(0);

        const hubReserveWei = await cm.getHubReserveWei()
        hubReserveWei.should.be.bignumber.equal(initHubReserveWei - 7);
      })

      it('hub deposit token for user, user pays hub, they both withdraw', async () => {
        const deposit = getDepositArgs("empty", {
          ...state,
          depositTokenUser: 10
        })
        const update = sg.proposePendingDeposit(state, deposit)
        update.sigUser = await getSig(update, viewer)
        const tx = await hubAuthorizedUpdate(update, hub, 0)

        await verifyHubAuthorizedUpdate(viewer, update, tx, true)

        const confirmed = await validator.generateConfirmPending(update, {
          transactionHash: tx.tx
        })

        // apply payment but don't send to chain
        const payment = getDepositArgs("empty", {
          ...confirmed,
          amountWei: 0,
          amountToken: 3,
          recipient: 'hub'
        })
        const update2 = validator.generateChannelPayment(confirmed, payment)

        // withdraw all token
        const withdrawal = getWithdrawalArgs("empty", {
          ...update2,
          targetTokenUser: 0,
          targetTokenHub: 0
        })
        const update3 = validator.generateProposePendingWithdrawal(
          update2,
          convertWithdrawal("bn", withdrawal)
        )
        update3.sigUser = await getSig(update3, viewer)
        const tx2 = await hubAuthorizedUpdate(update3, hub, 0)
        await verifyHubAuthorizedUpdate(viewer, update3, tx2, true)

        const totalChannelToken = await cm.totalChannelToken.call()
        totalChannelToken.should.be.bignumber.equal(0);

        const hubReserveToken = await cm.getHubReserveTokens()
        hubReserveToken.should.be.bignumber.equal(initHubReserveToken - 7);
      })

      // TODO exchange in channel, then withdraw
    })

    describe("failing requires", () => {
      // Tests based on the initial happy case where the hub deposits 10 wei

      it('fails when sent wei (no payable)', async () => {
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiHub: 10
        })
        const update = sg.proposePendingDeposit(state, deposit)
        update.sigUser = await getSig(update, viewer)

        // sending 20 wei
        await hubAuthorizedUpdate(update, hub, 20).should.be.rejectedWith('Returned error: VM Exception while processing transaction: revert')
      })

      it('fails when msg.sender is not hub', async () => {
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiHub: 10
        })
        const update = sg.proposePendingDeposit(state, deposit)
        update.sigUser = await getSig(update, viewer)

        // sending as viewer
        await hubAuthorizedUpdate(update, viewer, 0).should.be.rejectedWith('Returned error: VM Exception while processing transaction: revert')
      })

      //TODO it('hubAuthorizedUpdate - fails when channel status is not "Open"')

      it('fails when timeout expired', async () => {
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiHub: 10,
          timeout: (new Date().getTime()) / 1000 // timeout is now
        })
        const update = sg.proposePendingDeposit(state, deposit)
        update.sigUser = await getSig(update, viewer)

        await hubAuthorizedUpdate(update, hub, 0).should.be.rejectedWith('the timeout must be zero or not have passed')
      })

      it('fails when txCount[0] <= channel.txCount[0]', async () => {
        // Part 1 - txCount[0] = channel.txCount[0]

        // First submit a deposit at default txCountGlobal = 0
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiHub: 10
        })
        const update = sg.proposePendingDeposit(state, deposit)
        update.sigUser = await getSig(update, viewer)
        await hubAuthorizedUpdate(update, hub, 0)

        // Then submit another deposit at the same txCountGlobal = 0
        // (will be the same because we're using the same initital state to gen)
        const newUpdate = sg.proposePendingDeposit(state, deposit)
        newUpdate.sigUser = await getSig(newUpdate, viewer)

        await hubAuthorizedUpdate(newUpdate, hub, 0).should.be.rejectedWith('global txCount must be higher than the current global txCount')
      })

      it('fails when txCount[0] <= channel.txCount[0]', async () => {
        // Part 2 - txCount[0] < channel.txCount[0]

        // First submit a deposit with txCountGlobal = 1
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiHub: 10
        })
        const update = sg.proposePendingDeposit(state, deposit)
        update.txCountGlobal = 1
        update.sigUser = await getSig(update, viewer)
        await hubAuthorizedUpdate(update, hub, 0)

        // Then submit another deposit with txCountGlobal = 0
        const newUpdate = sg.proposePendingDeposit(state, deposit)
        newUpdate.txCountGlobal = 0
        newUpdate.sigUser = await getSig(newUpdate, viewer)

        await hubAuthorizedUpdate(newUpdate, hub, 0).should.be.rejectedWith('global txCount must be higher than the current global txCount')
      })

      it('fails when txCount[1] < channel.txCount[1]', async () => {
        //First submit a deposit at default txCountChain
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiHub: 10
        })
        const update = sg.proposePendingDeposit(state, deposit)
        //txCountGlobal = 1
        update.txCountChain = 1
        update.sigUser = await getSig(update, viewer)
        await hubAuthorizedUpdate(update, hub, 0)

        // Then submit another deposit at the same txCountChain
        const newUpdate = sg.proposePendingDeposit(state, deposit)
        newUpdate.txCountGlobal = 2 // have to increment global count here to pass above test
        newUpdate.txCountChain = 0
        newUpdate.sigUser = await getSig(newUpdate, viewer)

        await hubAuthorizedUpdate(newUpdate, hub, 0).should.be.rejectedWith('onchain txCount must be higher or equal to the current onchain txCount')
      })

      it('fails when wei is not conserved', async () => {
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiHub: 10
        })
        const update = sg.proposePendingDeposit(state, deposit)
        update.balanceWeiHub = 20
        update.sigUser = await getSig(update, viewer)

        await hubAuthorizedUpdate(update, hub, 0).should.be.rejectedWith('wei must be conserved')
      })

      it('fails when token are not conserved', async () => {
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiHub: 10
        })
        const update = sg.proposePendingDeposit(state, deposit)
        update.balanceTokenHub = 20
        update.sigUser = await getSig(update, viewer)

        await hubAuthorizedUpdate(update, hub, 0).should.be.rejectedWith('tokens must be conserved')
      })

      it('fails when insufficient reserve wei', async () => {
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiHub: 1001
        })
        const update = sg.proposePendingDeposit(state, deposit)
        update.sigUser = await getSig(update, viewer)

        await hubAuthorizedUpdate(update, hub, 0).should.be.rejectedWith('insufficient reserve wei for deposits')
      })

      it('fails when insufficient reserve token', async () => {
        const deposit = getDepositArgs("empty", {
          ...state,
          depositTokenHub: 1001
        })
        const update = sg.proposePendingDeposit(state, deposit)
        update.sigUser = await getSig(update, viewer)

        await hubAuthorizedUpdate(update, hub, 0).should.be.rejectedWith('insufficient reserve tokens for deposits')
      })

      it('fails when current total channel wei + both deposits is less than final balances + withdrawals', async () => {
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiHub: 10,
        })
        const update = sg.proposePendingDeposit(state, deposit)
        update.pendingWithdrawalWeiUser = 20 //also tested here with hub withdrawal
        update.sigUser = await getSig(update, viewer)

        await hubAuthorizedUpdate(update, hub, 0).should.be.rejectedWith('insufficient wei')
      })

      it('fails when current total channel token + both deposits is less than final balances + withdrawals', async () => {
        const deposit = getDepositArgs("empty", {
          ...state,
          depositTokenHub: 10,
        })
        const update = sg.proposePendingDeposit(state, deposit)
        update.pendingWithdrawalTokenUser = 20 //also tested here with hub withdrawal
        update.sigUser = await getSig(update, viewer)

        await hubAuthorizedUpdate(update, hub, 0).should.be.rejectedWith('insufficient token')
      })

      it('fails when user is hub', async () => {
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiHub: 10
        })
        const update = sg.proposePendingDeposit(state, deposit)
        update.user = hub.address
        update.sigUser = await getSig(update, viewer)

        await hubAuthorizedUpdate(update, hub, 0).should.be.rejectedWith('user can not be hub')
      })

      it('fails when user is contract', async () => {
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiHub: 10
        })
        const update = sg.proposePendingDeposit(state, deposit)
        update.user = cm.address
        update.sigUser = await getSig(update, viewer)

        await hubAuthorizedUpdate(update, hub, 0).should.be.rejectedWith('user can not be channel manager')
      })

      it('fails when user signature is incorrect (long test)', async () => {
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiHub: 10
        })
        const update = sg.proposePendingDeposit(state, deposit)
        const sigArrayUser = await generateIncorrectSigs(update, viewer)
        //iterate over incorrect sigs and try each one to make sure it fails
        for(i=0; i<sigArrayUser.length; i++){
          update.sigUser = sigArrayUser[i]
          console.log("Now testing signature: " + update.sigUser)
          await hubAuthorizedUpdate(update, hub, 0).should.be.rejectedWith('user signature invalid')
        }
      })
    })

    describe('edge cases', () => {
      it('wei/token user/hub deposit > withdrawal > 0', async () => {
        // TODO use proposePendingUpdate
        const update = {
          ...state,
          pendingDepositWeiHub: 2,
          pendingWithdrawalWeiHub: 1,
          pendingDepositWeiUser: 5,
          pendingWithdrawalWeiUser: 3,
          pendingDepositTokenHub: 6,
          pendingWithdrawalTokenHub: 4,
          pendingDepositTokenUser: 13,
          pendingWithdrawalTokenUser: 7,
          txCountGlobal: state.txCountGlobal + 1,
          txCountChain: state.txCountChain + 1
        }

        update.sigUser = await getSig(update, viewer)
        const tx = await hubAuthorizedUpdate(update, hub, 0)
        await verifyHubAuthorizedUpdate(viewer, update, tx, true)

        // deposits - withdrawals
        // 2 + 5 - 1 - 3 = 3
        const totalChannelWei = await cm.totalChannelWei.call()
        assert.equal(+totalChannelWei, 3)

        // initial - deposits + hub withdrawals
        // initial - (2 + 5) + 1
        const hubReserveWei = await cm.getHubReserveWei()
        hubReserveWei.should.be.bignumber.equal(initHubReserveWei - 6)

        // deposits - withdrawals
        // 6 + 13 - 4 - 7 = 8
        const totalChannelToken = await cm.totalChannelToken.call()
        assert.equal(+totalChannelToken, 8)

        // initial - deposits + hub withdrawals
        // initial - (6 + 13) + 4
        const hubReserveToken = await cm.getHubReserveTokens()
        hubReserveToken.should.be.bignumber.equal(initHubReserveToken - 15)
      })

      it.skip('wei/token user/hub withdrawal > deposit > 0', async () => {
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiHub: 10,
          depositWeiUser: 11,
          depositTokenHub: 12,
          depositTokenUser: 13,
          timeout: minutesFromNow(5) // TODO remove this, not needed for hubAuth
        })
        const update = validator.generateProposePendingDeposit(state, deposit)
        update.sigUser = await getSig(update, viewer)
        const tx = await hubAuthorizedUpdate(update, hub, 0)

        confirmed = await validator.generateConfirmPending(update, {
          transactionHash: tx.tx
        })

        const update2 = {
          ...confirmed,
          pendingDepositWeiHub: 1,
          pendingWithdrawalWeiHub: 2,
          pendingDepositWeiUser: 3,
          pendingWithdrawalWeiUser: 5,
          pendingDepositTokenHub: 4,
          pendingWithdrawalTokenHub: 6,
          pendingDepositTokenUser: 7,
          pendingWithdrawalTokenUser: 13,
          txCountGlobal: confirmed.txCountGlobal + 1,
          txCountChain: confirmed.txCountChain + 1
        }

        // TODO use proposePendingUpdate
        // Duh, it's not taking into account the balance pre-processing

        update2.sigUser = await getSig(update2, viewer)
        const tx2 = await hubAuthorizedUpdate(update2, hub, 0)
        await verifyHubAuthorizedUpdate(viewer, update2, tx2, true)

        // initial balance + deposits - withdrawals
        // 10 + 11 + 1 + 3 - 2 - 5 = 18
        const totalChannelWei = await cm.totalChannelWei.call()
        assert.equal(+totalChannelWei, 18)

        // initial reserve - deposit1 - deposit2 + hub withdrawals
        // initial - (10 + 11) - (1 + 3) + 2 = initial - 23
        const hubReserveWei = await cm.getHubReserveWei()
        hubReserveWei.should.be.bignumber.equal(initHubReserveWei - 23)

        // initial balance + deposits - withdrawals
        // 12 + 13 + 4 + 7 - 6 - 13 = 17
        const totalChannelToken = await cm.totalChannelToken.call()
        assert.equal(+totalChannelToken, 17)

        // initial reserve - deposit1 - deposit2 + hub withdrawals
        // initial - (12 + 13) - (4 + 7) + 6 = initial - 30
        const hubReserveToken = await cm.getHubReserveTokens()
        hubReserveToken.should.be.bignumber.equal(initHubReserveToken - 30)
      })

      // 3. Exchange
      // 4. Recipient

    })
  })

  // TODO use proposePendingUpdate to do edge cases
  describe.skip("userAuthorizedUpdate - withdrawal", () => {
    let confirmed

    beforeEach(async () => {
      const userTokenBalance = 1000
      await token.transfer(viewer.address, userTokenBalance, { from: hub.address })
      await token.approve(cm.address, userTokenBalance, { from: viewer.address })

      const deposit = getDepositArgs("empty", {
        ...state,
        depositWeiUser: 10,
        timeout: minutesFromNow(5)
      })
      const update = validator.generateProposePendingDeposit(state, deposit)

      update.sigHub = await getSig(update, hub)
      const tx = await userAuthorizedUpdate(update, viewer, 10)

      confirmed = await validator.generateConfirmPending(update, {
        transactionHash: tx.tx
      })
    })
  })

  describe('startExit', () => {
    beforeEach(async () => {
      const deposit = getDepositArgs("empty", {
        ...state,
        depositWeiUser: 10,
        timeout: minutesFromNow(5)
      })
      const update = validator.generateProposePendingDeposit(state, deposit)

      update.sigHub = await getSig(update, hub)
      const tx = await userAuthorizedUpdate(update, viewer, 10)

      confirmed = await validator.generateConfirmPending(update, {
        transactionHash: tx.tx
      })

      initHubReserveWei = await cm.getHubReserveWei()

      // initial state is the confirmed values with txCountGlobal rolled back
      state = {
        ...confirmed,
        txCountGlobal: confirmed.txCountGlobal - 1
      }
    })

    describe('happy case', () => {
      it('start exit as user', async () => {
        const tx = await startExit(state, viewer, 0)

        await verifyStartExit(viewer, state, tx, false)

        const totalChannelWei = await cm.totalChannelWei.call()
        assert.equal(+totalChannelWei, 10)

        const hubReserveWei = await cm.getHubReserveWei()
        hubReserveWei.should.be.bignumber.equal(initHubReserveWei)
      })

      it('start exit as hub', async () => {
        const tx = await startExit(state, hub, 0)

        await verifyStartExit(viewer, state, tx, true)

        const totalChannelWei = await cm.totalChannelWei.call()
        assert.equal(+totalChannelWei, 10)

        const hubReserveWei = await cm.getHubReserveWei()
        hubReserveWei.should.be.bignumber.equal(initHubReserveWei)
      })
    })

    describe('failing requires', () => {
      it('fails when user is hub', async () => {

      })

      it('fails when user is contract', async () => {

      })

      it('fails when channel is open', async () => {

      })

      it('fails when exit initiator is not user or hub', async () => {

      })
    })

    describe('edge cases', () => {
      it('startExit a zero state', async () => {

      })

      it('successfully startExit twice in a row', async () => {

      })
    })
  })

  describe('startExitWithUpdate', () => {
    beforeEach(async () => {
      await token.transfer(cm.address, 1000, { from: hub.address })
      await web3.eth.sendTransaction({ from: hub.address, to: cm.address, value: 700 })

      initHubReserveWei = await cm.getHubReserveWei()
      initHubReserveToken = await cm.getHubReserveTokens()

      const deposit = getDepositArgs("empty", {
        ...state,
        depositWeiUser: 10,
        depositTokenUser: 11,
        depositWeiHub: 12,
        depositTokenHub: 13,
        timeout: minutesFromNow(5)
      })
      const update = validator.generateProposePendingDeposit(state, deposit)

      update.sigUser = await getSig(update, viewer)
      const tx = await hubAuthorizedUpdate(update, hub, 0)

      confirmed = await validator.generateConfirmPending(update, {
        transactionHash: tx.tx
      })

      // initial state is the confirmed values with txCountGlobal rolled back
      state = {
        ...confirmed,
        txCountGlobal: confirmed.txCountGlobal - 1
      }
    })

    describe('happy case', () => {
      it('startExitWithUpdate as user', async () => {
        const payment = getDepositArgs("empty", {
          ...state,
          amountWei: 3,
          amountToken: 0,
          recipient: 'hub'
        })
        const update = validator.generateChannelPayment(state, payment)
        update.sigUser = await getSig(update, viewer)
        update.sigHub = await getSig(update, hub)

        const tx = await startExitWithUpdate(update, viewer, 0)

        await verifyStartExit(viewer, update, tx, false)

        const totalChannelWei = await cm.totalChannelWei.call()
        assert.equal(+totalChannelWei, 22)

        const hubReserveWei = await cm.getHubReserveWei()
        hubReserveWei.should.be.bignumber.equal(initHubReserveWei - 22)

        const totalChannelToken = await cm.totalChannelToken.call()
        assert.equal(+totalChannelToken, 24)

        const hubReserveToken = await cm.getHubReserveTokens()
        hubReserveToken.should.be.bignumber.equal(initHubReserveToken - 24)
      })

      it('startExitWithUpdate as hub', async () => {
        const payment = getDepositArgs("empty", {
          ...state,
          amountWei: 3,
          amountToken: 0,
          recipient: 'hub'
        })
        const update = validator.generateChannelPayment(state, payment)
        update.sigUser = await getSig(update, viewer)
        update.sigHub = await getSig(update, hub)

        // send as hub
        const tx = await startExitWithUpdate(update, hub, 0)

        await verifyStartExit(viewer, update, tx, true)
      })
    })

    describe('failing requires', () => {

    })

    describe('edge cases', () => {

    })
  })

  describe('emptyChannelWithChallenge', () => {
    describe('happy case', () => {

    })

    describe('failing requires', () => {

    })

    describe('edge cases', () => {

    })
  })

  describe('emptyChannel', () => {
    describe('happy case', () => {

    })

    describe('failing requires', () => {

    })

    describe('edge cases', () => {

    })
  })
})

// https://github.com/ConnextProject/contracts/blob/master/docs/aggregateUpdates.md
// 1. user deposit
// 2. hub deposit
// 3. user withdrawal
// 4. hub withdrawal
// 5. user deposit + hub deposit
// 6. user deposit + hub withdrawal
// 7. user withdrawal + hub deposit
// 8. user w + hub w
// 9. actual exchange scenarios
//    - performer withdrawal booty -> eth
//      - also hub withdraws collateral
//    - user withdrawal booty -> eth
//      - also hub withdraws collateral
// 10. recipient is different than user
//
// State Transitions:
// 1. channelBalances (wei / token)
// 2. totalChannelWei
// 3. totalChannelToken
// 4. channel.weiBalances[2]
// 5. channel.tokenBalances[2]
// 6. recipient ether balance
// 7. recipient token balance
// 8. contract eth/token balance (reserve)
// 9. txCount
// 10. threadRoot
// 11. threadCount
// 12. event
