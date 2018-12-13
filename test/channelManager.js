const should = require("chai")
const HttpProvider = require("ethjs-provider-http")
const ethjsUtil = require('ethereumjs-util')
const EthRPC = require("ethjs-rpc")
const privKeys = require("./privKeys.json")
const CM = artifacts.require("./ChannelManager.sol")
const HST = artifacts.require("./HumanStandardToken.sol")

/* Connext Client */
const { Utils } = require("../client/dist/Utils.js");
const { StateGenerator } = require("../client/dist/StateGenerator.js")
const { Validator } = require("../client/dist/validator.js")
const { convertChannelState, convertDeposit, convertExchange, } = require("../client/dist/types")
const { mkAddress, getChannelState, getThreadState, getDepositArgs, getWithdrawalArgs, getExchangeArgs, getPaymentArgs, assertThreadStateEqual, assertChannelStateEqual } = require("../client/dist/testing")
const clientUtils = new Utils()
const sg = new StateGenerator()


const data = require('../data.json')

should.use(require("chai-as-promised")).should()

const ethRPC = new EthRPC(new HttpProvider('http://localhost:8545'))
const emptyRootHash =
  "0x0000000000000000000000000000000000000000000000000000000000000000"

const emptyAddress = "0x0000000000000000000000000000000000000000"

const SolRevert = 'VM Exception while processing transaction: revert'

const secondsFromNow = (seconds) => seconds + Math.floor(new Date().getTime() / 1000)
const minutesFromNow = (minutes) => secondsFromNow(minutes * 60)

async function snapshot() {
    return new Promise((accept, reject) => {
        ethRPC.sendAsync({method: `evm_snapshot`}, (err, result)=> {
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
      ethRPC.sendAsync({method: `evm_revert`, params: [snapshotId]}, (err, result) => {
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
    jsonrpc:'2.0', method: `evm_increaseTime`,
    params: [secs],
    id: 0
  }, (err)=> {`error increasing time`})
  const start = Date.now()
  await ethRPC.sendAsync({method: `evm_mine`}, (err)=> {})
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
  return ({
    ...state,
    user: state.user,
    recipient: state.recipient,
    weiBalances: [+state.balanceWeiHub, +state.balanceWeiUser],
    tokenBalances: [+state.balanceTokenHub, +state.balanceTokenUser],
    pendingWeiUpdates: [
      +state.pendingDepositWeiHub,
      +state.pendingWithdrawalWeiHub,
      +state.pendingDepositWeiUser,
      +state.pendingWithdrawalWeiUser,
    ],
    pendingTokenUpdates: [
      +state.pendingDepositTokenHub,
      +state.pendingWithdrawalTokenHub,
      +state.pendingDepositTokenUser,
      +state.pendingWithdrawalTokenUser,
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

async function userAuthorizedUpdate(state, account, wei=0) {
  // TODO see if I can just use BN here instead of + conversion
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
    {from: account.address, value: wei}
  )
}

let cm, token, hub, performer, viewer, state, validator

contract("ChannelManager", accounts => {
  let snapshotId

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

  describe.skip('using the client', () => {
    it('should show a decent example of how to access fns', async () => {
      const chan = getChannelState("empty", {
        contractAddress: cm.address,
        user: viewer.address,
        recipient: viewer.address,
        txCountGlobal: 1,
        txCountChain: 1,
        timeout: minutesFromNow(5)
      })

      // console.log(chan)
      // console.log(clientUtils.createChannelStateHash(chan))
      assertChannelStateEqual(chan, {
        balanceToken: [0, 0]
      })


      // Applying and generating args
      const deposit = getDepositArgs("empty", {
        ...chan, depositWeiUser: 10,
      })
      const proposed = sg.proposePendingDeposit(
        convertChannelState("bn", chan),
        convertDeposit("bn", deposit)
      )
      const valid = validator.generateProposePendingDeposit(chan, deposit)
      // console.log(valid)
      assertChannelStateEqual(proposed, valid)
    })
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

  describe.only("userAuthorizedUpdate - deposit", () => {
    // depositing with 1 wei worked
    // deposit with 1 token

    beforeEach(async () => {
      const userTokenBalance = 1000
      await token.transfer(viewer.address, userTokenBalance, {from: hub.address})
      await token.approve(cm.address, userTokenBalance, {from: viewer.address})
    })

    // Refactor
    // 3 sections
    // 1. state generation
    //  - take initial state
    //  - use update params
    // 2. contract method call
    //  - requires signed updated state
    // 3. verification
    //  - requires initial, update, and final

    // The state generation and contract call successfully use connext
    // the verification of the onchain state still needs work
    // specifically, we need to get to the final values we "expect"
    //
    // This could be figured out using a few of our more tricky test cases
    // ... but we can't run those on userAuthorizedDeposit
    // so at least for now, the verify for this can be easy
    // run the confirm pending, and see if the final values match :)

    const verifyUserAuthorizedUpdate = async (account, update, tx) => {
      const confirmed = await validator.generateConfirmPending(update, {
        transactionHash: tx.tx
      })

      const channelBalances = await cm.getChannelBalances(viewer.address)
      const channelDetails = await cm.getChannelDetails(viewer.address)

      const updateBN = convertChannelState("bn", update)
      const confirmedBN = convertChannelState("bn", confirmed)
      // TODO - because we're testing the JS, we should also be testing
      // that we properly handle BigNumbers, and use them in our tests
      // Specifically, test the high possible value of uint256

      // Wei balances are equal
      assert(channelBalances.weiHub.eq(confirmedBN.balanceWeiHub))
      assert(channelBalances.weiUser.eq(confirmedBN.balanceWeiUser))
      assert(
        channelBalances.weiTotal.eq(
        confirmedBN.balanceWeiHub.add(confirmedBN.balanceWeiUser))
      )

      // Token balances are equal
      assert(channelBalances.tokenHub.eq(confirmedBN.balanceTokenHub))
      assert(channelBalances.tokenUser.eq(confirmedBN.balanceTokenUser))
      assert(
        channelBalances.tokenTotal.eq(
        confirmedBN.balanceTokenHub.add(confirmedBN.balanceTokenUser))
      )

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
      assert.equal(event.user, viewer.address)
      assert.equal(event.senderIdx, 1)
      assert(event.weiBalances[0].eq(updateBN.balanceWeiHub))
      assert(event.weiBalances[1].eq(updateBN.balanceWeiUser))
      assert(event.tokenBalances[0].eq(updateBN.balanceTokenHub))
      assert(event.tokenBalances[1].eq(updateBN.balanceTokenUser))
      assert(event.pendingWeiUpdates[0].eq(updateBN.pendingDepositWeiHub))
      assert(event.pendingWeiUpdates[1].eq(updateBN.pendingWithdrawalWeiHub))
      assert(event.pendingWeiUpdates[2].eq(updateBN.pendingDepositWeiUser))
      assert(event.pendingWeiUpdates[3].eq(updateBN.pendingWithdrawalWeiUser))
      assert(event.pendingTokenUpdates[0].eq(updateBN.pendingDepositTokenHub))
      assert(event.pendingTokenUpdates[1].eq(updateBN.pendingWithdrawalTokenHub))
      assert(event.pendingTokenUpdates[2].eq(updateBN.pendingDepositTokenUser))
      assert(event.pendingTokenUpdates[3].eq(updateBN.pendingWithdrawalTokenUser))
      assert.equal(+event.txCount[0], update.txCountGlobal)
      assert.equal(+event.txCount[1], update.txCountChain)
      assert.equal(event.threadRoot, emptyRootHash)
      assert.equal(event.threadCount, 0)
    }

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

      const totalChannelToken = await cm.totalChannelToken.call()
      assert.equal(+totalChannelToken, 10)

      const hubReserveTokens = await cm.getHubReserveTokens()
      assert.equal(hubReserveTokens, 0)
    })
  })

  describe.skip("hubAuthorizedUpdate", () => {

  })

  describe.skip("userAuthorizedUpdate - withdrawal", () => {
    let confirmed

    beforeEach(async () => {
      const userTokenBalance = 1000
      await token.transfer(viewer.address, userTokenBalance, {from: hub.address})
      await token.approve(cm.address, userTokenBalance, {from: viewer.address})

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
