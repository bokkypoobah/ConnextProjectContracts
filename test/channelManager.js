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
  initHubReserveTokens

// TODO - because we're testing the JS, we should also be testing
// that we properly handle BigNumbers, and use them in our tests
// Specifically, test the high possible value of uint256

contract("ChannelManager", accounts => {
  let snapshotId

  // TODO add verification of reserves by including initital reserve values

  const verifyAuthorizedUpdate = async (account, update, tx, isHub) => {
    const confirmed = await validator.generateConfirmPending(update, {
      transactionHash: tx.tx
    })

    const channelBalances = await cm.getChannelBalances(account.address)
    const channelDetails = await cm.getChannelDetails(account.address)

    const updateBN = convertChannelState("bn", update)
    const confirmedBN = convertChannelState("bn", confirmed)

    // Wei balances are equal
    channelBalances.weiHub.should.be.bignumber.equal(confirmedBN.balanceWeiHub);
    channelBalances.weiUser.should.be.bignumber.equal(confirmedBN.balanceWeiUser);
    channelBalances.weiTotal.should.be.bignumber.equal(
      confirmedBN.balanceWeiHub.add(confirmedBN.balanceWeiUser)
    );

    // Token balances are equal
    channelBalances.tokenHub.should.be.bignumber.equal(confirmedBN.balanceTokenHub);
    channelBalances.tokenUser.should.be.bignumber.equal(confirmedBN.balanceTokenUser);
    channelBalances.tokenTotal.should.be.bignumber.equal(
      confirmedBN.balanceTokenHub.add(confirmedBN.balanceTokenUser)
    );

    // Tx counts are equal to the original update (confirmed increments)
    assert.equal(+channelDetails.txCountGlobal, update.txCountGlobal)
    assert.equal(+channelDetails.txCountChain, update.txCountChain)

    // Thread states are equal
    assert.equal(channelDetails.threadRoot, update.threadRoot)
    assert.equal(channelDetails.threadCount, update.threadCount)

    // exitInitiator should not be set, and status should not change
    assert.equal(channelDetails.exitInitiator, emptyAddress)
    assert.equal(channelDetails.status, 0)

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
      const challengePeriod = await cm.challengePeriod.call()
      assert.equal(data.channelManager.challengePeriod, challengePeriod)
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

    it("accept tokens - getHubReserveTokens", async () => {
      const tokenAmount = 1
      await token.transfer(cm.address, tokenAmount, { from: hub.address })
      const reserveTokens = await cm.getHubReserveTokens()
      assert.equal(reserveTokens, tokenAmount)
    })

    describe("hubContractWithdraw", () => {
      it("happy case", async () => {
        const weiAmount = 1
        const tokenAmount = 1
        const hubInitialTokens = await token.balanceOf(hub.address)
        await web3.eth.sendTransaction({ from: hub.address, to: cm.address, value: weiAmount })
        await token.transfer(cm.address, tokenAmount, { from: hub.address })
        await cm.hubContractWithdraw(weiAmount, tokenAmount)
        const reserveTokens = await cm.getHubReserveTokens()
        const reserveWei = await cm.getHubReserveWei()
        assert.equal(reserveWei, 0)
        assert.equal(reserveTokens, 0)

        const hubFinalTokens = await web3.eth.getBalance(hub.address)
        assert.equal(hubInitialTokens, hubInitialTokens)
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

      it("fails with insufficient tokens", async () => {
        const weiAmount = 1
        const tokenAmount = 1
        const tokensToWithdraw = tokenAmount + 1
        await web3.eth.sendTransaction({ from: hub.address, to: cm.address, value: weiAmount })
        await token.transfer(cm.address, tokenAmount, { from: hub.address })
        await cm.hubContractWithdraw(weiAmount, tokensToWithdraw).should.be.rejectedWith(
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
      const tx = await userAuthorizedUpdate(update, viewer, 10)

      await verifyUserAuthorizedUpdate(viewer, update, tx)

      const totalChannelWei = await cm.totalChannelWei.call()
      assert.equal(+totalChannelWei, 0)

      const hubReserveWei = await cm.getHubReserveWei()
      assert.equal(hubReserveWei, 0)
    })

  })

  describe("hubAuthorizedUpdate", () => {
    beforeEach(async () => {
      await token.transfer(cm.address, 1000, { from: hub.address })
      await web3.eth.sendTransaction({ from: hub.address, to: cm.address, value: 700 })
      initHubReserveWei = await cm.getHubReserveWei()
      initHubReserveTokens = await cm.getHubReserveTokens()
    })

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

    it('hub deposit tokens', async () => {
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

      const hubReserveTokens = await cm.getHubReserveTokens()
      assert.equal(hubReserveTokens, initHubReserveTokens - 10)
    })

    it('hubAuthorizedUpdate - fails when sent wei (no payable)', async () => {
      const deposit = getDepositArgs("empty", {
        ...state,
        depositWeiHub: 10
      })
      const update = sg.proposePendingDeposit(state, deposit)
      update.sigUser = await getSig(update, viewer)

      // sending 20 wei
      await hubAuthorizedUpdate(update, hub, 20).should.be.rejectedWith('Returned error: VM Exception while processing transaction: revert')
    })

    it('hubAuthorizedUpdate - fails when msg.sender is not hub', async () => {
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

    it('hubAuthorizedUpdate - fails when timeout expired', async () => {
      const deposit = getDepositArgs("empty", {
        ...state,
        depositWeiHub: 10,
        timeout: (new Date().getTime()) / 1000 // timeout is now
      })
      const update = sg.proposePendingDeposit(state, deposit)
      update.sigUser = await getSig(update, viewer)

      await hubAuthorizedUpdate(update, hub, 0).should.be.rejectedWith('the timeout must be zero or not have passed')
    })

    it('hubAuthorizedUpdate - fails when txCount[0] <= channel.txCount[0]', async () => {
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

    it('hubAuthorizedUpdate - fails when txCount[0] <= channel.txCount[0]', async () => {
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

    it('hubAuthorizedUpdate - fails when txCount[1] < channel.txCount[1]', async () => {
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

    it('hubAuthorizedUpdate - fails when wei is not conserved', async () => {
      const deposit = getDepositArgs("empty", {
        ...state,
        depositWeiHub: 10
      })
      const update = sg.proposePendingDeposit(state, deposit)
      update.balanceWeiHub = 20
      update.sigUser = await getSig(update, viewer)

      await hubAuthorizedUpdate(update, hub, 0).should.be.rejectedWith('wei must be conserved')
    })

    it('hubAuthorizedUpdate - fails when tokens are not conserved', async () => {
      const deposit = getDepositArgs("empty", {
        ...state,
        depositWeiHub: 10
      })
      const update = sg.proposePendingDeposit(state, deposit)
      update.balanceTokenHub = 20
      update.sigUser = await getSig(update, viewer)

      await hubAuthorizedUpdate(update, hub, 0).should.be.rejectedWith('tokens must be conserved')
    })

    it('hubAuthorizedUpdate - fails when insufficient reserve wei', async () => {
      const deposit = getDepositArgs("empty", {
        ...state,
        depositWeiHub: 1001
      })
      const update = sg.proposePendingDeposit(state, deposit)
      update.sigUser = await getSig(update, viewer)

      await hubAuthorizedUpdate(update, hub, 0).should.be.rejectedWith('insufficient reserve wei for deposits')
    })

    it('hubAuthorizedUpdate - fails when insufficient reserve tokens', async () => {
      const deposit = getDepositArgs("empty", {
        ...state,
        depositTokenHub: 1001
      })
      const update = sg.proposePendingDeposit(state, deposit)
      update.sigUser = await getSig(update, viewer)

      await hubAuthorizedUpdate(update, hub, 0).should.be.rejectedWith('insufficient reserve tokens for deposits')
    })

    it('hubAuthorizedUpdate - fails when current total channel wei + both deposits is less than final balances + withdrawals', async () => {
      const deposit = getDepositArgs("empty", {
        ...state,
        depositWeiHub: 10,
      })
      const update = sg.proposePendingDeposit(state, deposit)
      update.pendingWithdrawalWeiUser = 20 //also tested here with hub withdrawal
      update.sigUser = await getSig(update, viewer)

      await hubAuthorizedUpdate(update, hub, 0).should.be.rejectedWith('insufficient wei')
    })

    it('hubAuthorizedUpdate - fails when current total channel tokens + both deposits is less than final balances + withdrawals', async () => {
      const deposit = getDepositArgs("empty", {
        ...state,
        depositTokenHub: 10,
      })
      const update = sg.proposePendingDeposit(state, deposit)
      update.pendingWithdrawalTokenUser = 20 //also tested here with hub withdrawal
      update.sigUser = await getSig(update, viewer)

      await hubAuthorizedUpdate(update, hub, 0).should.be.rejectedWith('insufficient token')
    })

    it('hubAuthorizedUpdate - fails when user is hub', async () => {
      const deposit = getDepositArgs("empty", {
        ...state,
        depositWeiHub: 10
      })
      const update = sg.proposePendingDeposit(state, deposit)
      update.user = hub.address
      update.sigUser = await getSig(update, viewer)

      await hubAuthorizedUpdate(update, hub, 0).should.be.rejectedWith('user can not be hub')
    })

    it('hubAuthorizedUpdate - fails when user is contract', async () => {
      const deposit = getDepositArgs("empty", {
        ...state,
        depositWeiHub: 10
      })
      const update = sg.proposePendingDeposit(state, deposit)
      update.user = cm.address
      update.sigUser = await getSig(update, viewer)

      await hubAuthorizedUpdate(update, hub, 0).should.be.rejectedWith('user can not be channel manager')
    })

    it('hubAuthorizedUpdate - fails when address in sig is not address of channel manager', async () => {
      const deposit = getDepositArgs("empty", {
        ...state,
        depositWeiHub: 10
      })
      const update = sg.proposePendingDeposit(state, deposit)
      update.contractAddress = emptyAddress
      update.sigUser = await getSig(update, viewer)
      update.contractAddress = cm.address

      await hubAuthorizedUpdate(update, hub, 0).should.be.rejectedWith('user signature invalid')
    })

    it('hubAuthorizedUpdate - fails when user in sig is incorrect', async () => {
      const deposit = getDepositArgs("empty", {
        ...state,
        depositWeiHub: 10
      })
      const update = sg.proposePendingDeposit(state, deposit)
      update.user = emptyAddress
      update.sigUser = await getSig(update, viewer)
      update.user = viewer.address

      await hubAuthorizedUpdate(update, hub, 0).should.be.rejectedWith('user signature invalid')
    })

    it('hubAuthorizedUpdate - fails when weiBalances in sig are incorrect', async () => {
      const deposit = getDepositArgs("empty", {
        ...state,
        depositWeiHub: 10
      })
      const update = sg.proposePendingDeposit(state, deposit)
      update.balanceWeiHub = 5
      update.sigUser = await getSig(update, viewer)
      update.balanceWeiHub = 0

      await hubAuthorizedUpdate(update, hub, 0).should.be.rejectedWith('user signature invalid')
    })

    it('hubAuthorizedUpdate - fails when tokenBalances in sig are incorrect', async () => {
      const deposit = getDepositArgs("empty", {
        ...state,
        depositWeiHub: 10
      })
      const update = sg.proposePendingDeposit(state, deposit)
      update.balanceTokenHub = 5
      update.sigUser = await getSig(update, viewer)
      update.balanceTokenHub = 0

      await hubAuthorizedUpdate(update, hub, 0).should.be.rejectedWith('user signature invalid')
    })

    it('hubAuthorizedUpdate - fails when pendingWeiBalances in sig are incorrect', async () => {
      const deposit = getDepositArgs("empty", {
        ...state,
        depositWeiHub: 10
      })
      const update = sg.proposePendingDeposit(state, deposit)
      update.pendingDepositWeiHub = 0
      update.sigUser = await getSig(update, viewer)
      update.pendingDepositWeiHub = 10

      await hubAuthorizedUpdate(update, hub, 0).should.be.rejectedWith('user signature invalid')
    })

    it('hubAuthorizedUpdate - fails when pendingTokenBalances in sig are incorrect', async () => {
      const deposit = getDepositArgs("empty", {
        ...state,
        depositWeiHub: 10
      })
      const update = sg.proposePendingDeposit(state, deposit)
      update.pendingDepositTokenHub = 10
      update.sigUser = await getSig(update, viewer)
      update.pendingDepositTokenHub = 0

      await hubAuthorizedUpdate(update, hub, 0).should.be.rejectedWith('user signature invalid')
    })

    it('hubAuthorizedUpdate - fails when txCount in sig is incorrect', async () => {
      const deposit = getDepositArgs("empty", {
        ...state,
        depositWeiHub: 10
      })
      const update = sg.proposePendingDeposit(state, deposit)
      update.txCountGlobal = 2
      update.sigUser = await getSig(update, viewer)
      update.txCountGlobal = 1

      await hubAuthorizedUpdate(update, hub, 0).should.be.rejectedWith('user signature invalid')
    })

    it('hubAuthorizedUpdate - fails when threadRoot in sig is incorrect', async () => {
      const deposit = getDepositArgs("empty", {
        ...state,
        depositWeiHub: 10
      })
      const update = sg.proposePendingDeposit(state, deposit)
      update.threadRoot = emptyAddress + 1
      update.sigUser = await getSig(update, viewer)
      update.threadRoot = emptyAddress

      await hubAuthorizedUpdate(update, hub, 0).should.be.rejectedWith('user signature invalid')
    })

    it('hubAuthorizedUpdate - fails when threadCount in sig is incorrect', async () => {
      const deposit = getDepositArgs("empty", {
        ...state,
        depositWeiHub: 10
      })
      const update = sg.proposePendingDeposit(state, deposit)
      update.threadCount = 1
      update.sigUser = await getSig(update, viewer)
      update.threadCount = 0

      await hubAuthorizedUpdate(update, hub, 0).should.be.rejectedWith('user signature invalid')
    })

    it('hubAuthorizedUpdate - fails when timeout in sig is incorrect', async () => {
      const deposit = getDepositArgs("empty", {
        ...state,
        depositWeiHub: 10
      })
      const update = sg.proposePendingDeposit(state, deposit)
      update.timeout = 1
      update.sigUser = await getSig(update, viewer)
      update.timeout = 0

      await hubAuthorizedUpdate(update, hub, 0).should.be.rejectedWith('user signature invalid')
    })

    it('hubAuthorizedUpdate - fails when user is not signer', async () => {
      const deposit = getDepositArgs("empty", {
        ...state,
        depositWeiHub: 10
      })
      const update = sg.proposePendingDeposit(state, deposit)
      update.sigUser = await getSig(update, hub)

      await hubAuthorizedUpdate(update, hub, 0).should.be.rejectedWith('user signature invalid')
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

    it('hub deposit tokens for user', async () => {
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

      const hubReserveTokens = await cm.getHubReserveTokens()
      assert.equal(hubReserveTokens, initHubReserveTokens - 10)
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

      const hubReserveTokens = await cm.getHubReserveTokens()
      assert.equal(hubReserveTokens, initHubReserveTokens - 17)

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

      const hubReserveTokens = await cm.getHubReserveTokens()
      hubReserveTokens.should.be.bignumber.equal(initHubReserveTokens);

      const totalChannelWei = await cm.totalChannelWei.call()
      assert.equal(+totalChannelWei, 0)

      const hubReserveWei = await cm.getHubReserveWei()
      hubReserveWei.should.be.bignumber.equal(initHubReserveWei - 5);
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

      const hubReserveTokens = await cm.getHubReserveTokens()
      hubReserveTokens.should.be.bignumber.equal(initHubReserveTokens);

      const totalChannelWei = await cm.totalChannelWei.call()
      assert.equal(+totalChannelWei, 0)

      const hubReserveWei = await cm.getHubReserveWei()
      hubReserveWei.should.be.bignumber.equal(initHubReserveWei - 5);
    })


    // TODO update client to use proper withdrawal args
    it.skip('user deposits wei then withdraws wei', async () => {
      const deposit = getDepositArgs("empty", {
        ...state,
        depositWeiUser: 10
      })
      const update1 = sg.proposePendingDeposit(state, deposit)
      update1.sigUser = await getSig(update1, viewer)
      const tx1 = await hubAuthorizedUpdate(update1, hub, 0)
      await verifyHubAuthorizedUpdate(viewer, update1, tx1, true)

      const withdrawal = getWithdrawalArgs("empty", {
        ...update1,
        withdrawWeiUser: 9
      })
      const update2 = sg.proposePendingWithdrawal(
        convertChannelState("bn", update1),
        convertWithdrawal("bn", withdrawal)
      )

      update2.sigUser = await getSig(update2, viewer)
      const tx = await hubAuthorizedUpdate(update2, hub, 0)
      await verifyHubAuthorizedUpdate(viewer, update2, tx, true)

      const totalChannelToken = await cm.totalChannelToken.call()
      assert.equal(+totalChannelToken, 0)

      const hubReserveTokens = await cm.getHubReserveTokens()
      assert.equal(hubReserveTokens, initHubReserveTokens)

      const totalChannelWei = await cm.totalChannelWei.call()
      assert.equal(+totalChannelWei, 1)

      const hubReserveWei = await cm.getHubReserveWei()
      assert.equal(hubReserveWei, initHubReserveWei)
    })

    // TODO update client to use proper withdrawal args
    it.skip('user deposits tokens with exchange, withdraws wei', async () => {
      const deposit = getDepositArgs("empty", {
        ...state,
        depositTokenUser: 10
      })
      const update1 = sg.proposePendingDeposit(state, deposit)
      update1.sigUser = await getSig(update1, viewer)
      const tx1 = await hubAuthorizedUpdate(update1, hub, 0)

      await verifyHubAuthorizedUpdate(viewer, update1, tx1, true)

      const confirmed = await validator.generateConfirmPending(update1, {
        transactionHash: tx1.tx
      })

      const withdrawal = getWithdrawalArgs("empty", {
        ...confirmed,
        withdrawalWeiUser: 10,
        depositTokenUser: 5,
      })

      const update2 = sg.proposePendingWithdrawal(
        convertChannelState("bn", confirmed),
        convertWithdrawal("bn", withdrawal)
      )

      update2.sigUser = await getSig(update2, viewer)
      const tx2 = await hubAuthorizedUpdate(update2, hub, 0)
      await verifyHubAuthorizedUpdate(viewer, update2, tx2, true)

      const totalChannelToken = await cm.totalChannelToken.call()
      assert.equal(+totalChannelToken, 5)

      const hubReserveTokens = await cm.getHubReserveTokens()
      assert.equal(hubReserveTokens, initHubReserveTokens - 5)

      const totalChannelWei = await cm.totalChannelWei.call()
      assert.equal(+totalChannelWei, 0)

      const hubReserveWei = await cm.getHubReserveWei()
      assert.equal(hubReserveWei, initHubReserveWei)
    })
  })

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

    // TODO once more connext client functions are added to support
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
