const should = require("chai")
const HttpProvider = require("ethjs-provider-http")
const ethjsUtil = require('ethereumjs-util')
const EthRPC = require("ethjs-rpc")
const privKeys = require("./privKeys.json")
const CM = artifacts.require("./ChannelManager.sol")
const HST = artifacts.require("./HumanStandardToken.sol")

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

async function hashState (state) {
  return await web3.utils.soliditySha3(
    {type: 'address', value: cm.address},
    {type: 'address[2]', value: [state.user, state.recipient]},
    {type: 'uint256[2]', value: state.weiBalances},
    {type: 'uint256[2]', value: state.tokenBalances},
    {type: 'uint256[4]', value: state.pendingWeiUpdates},
    {type: 'uint256[4]', value: state.pendingTokenUpdates},
    {type: 'uint256[2]', value: state.txCount},
    {type: 'bytes32', value: state.threadRoot},
    {type: 'uint256', value: state.threadCount},
    {type: 'uint256', value: state.timeout}
  )
}

async function getSig(state, account) {
  const { signature } = await web3.eth.accounts.sign(await hashState(state), account.pk)
  return signature
}

async function userAuthorizedUpdate(state, account, wei=0) {
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

let cm, token, hub, performer, viewer, state

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
  })

  beforeEach(async () => {
    snapshotId = await snapshot()

    state = {
      "user": viewer.address,
      "recipient": viewer.address,
      "weiBalances": [0, 0],
      "tokenBalances": [0, 0],
      "pendingWeiUpdates": [0, 0, 0, 0],
      "pendingTokenUpdates": [0, 0, 0, 0],
      "txCount": [1, 1],
      "threadRoot": emptyRootHash,
      "threadCount": 0,
      "timeout": 0
    }
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
      await web3.eth.sendTransaction({ from: hubAddress, to: cm.address, value: weiAmount })
      const reserveWei = await cm.getHubReserveWei()
      assert.equal(reserveWei, weiAmount)
    })

    it("accept tokens - getHubReserveTokens", async () => {
      const tokenAmount = 1
      await token.transfer(cm.address, tokenAmount, { from: hubAddress })
      const reserveTokens = await cm.getHubReserveTokens()
      assert.equal(reserveTokens, tokenAmount)
    })

    describe("hubContractWithdraw", () => {
      it("happy case", async () => {
        const weiAmount = 1
        const tokenAmount = 1
        const hubInitialTokens = await token.balanceOf(hubAddress)
        await web3.eth.sendTransaction({ from: hubAddress, to: cm.address, value: weiAmount })
        await token.transfer(cm.address, tokenAmount, { from: hubAddress })
        await cm.hubContractWithdraw(weiAmount, tokenAmount)
        const reserveTokens = await cm.getHubReserveTokens()
        const reserveWei = await cm.getHubReserveWei()
        assert.equal(reserveWei, 0)
        assert.equal(reserveTokens, 0)

        const hubFinalTokens = await web3.eth.getBalance(hubAddress)
        assert.equal(hubInitialTokens, hubInitialTokens)
      })

      it("fails with insufficient ETH", async () => {
        const weiAmount = 1
        const tokenAmount = 1
        const weiToWithdraw = weiAmount + 1
        await web3.eth.sendTransaction({ from: hubAddress, to: cm.address, value: weiAmount })
        await token.transfer(cm.address, tokenAmount, { from: hubAddress })
        await cm.hubContractWithdraw(weiToWithdraw, tokenAmount).should.be.rejectedWith(
          `${SolRevert} hubContractWithdraw: Contract wei funds not sufficient to withdraw`
        )
      })

      it("fails with insufficient tokens", async () => {
        const weiAmount = 1
        const tokenAmount = 1
        const tokensToWithdraw = tokenAmount + 1
        await web3.eth.sendTransaction({ from: hubAddress, to: cm.address, value: weiAmount })
        await token.transfer(cm.address, tokenAmount, { from: hubAddress })
        await cm.hubContractWithdraw(weiAmount, tokensToWithdraw).should.be.rejectedWith(
          `${SolRevert} hubContractWithdraw: Contract token funds not sufficient to withdraw`
        )
      })
    })
  })

  describe("userAuthorizedUpdate", () => {
    it.only('deposit wei', async () => {
      const update = {
        ...state,
        pendingWeiUpdates: [0, 0, 1, 0],
        txCount: [1, 1],
        timeout: minutesFromNow(5)
      }

      update.sigHub = await getSig(update, hub)
      const tx = await userAuthorizedUpdate(update, viewer, 1)

      // const channel = await cm.channels.call(viewer.address)
      const channelBalances = await cm.getChannelBalances(viewer.address)
      const channelDetails = await cm.getChannelDetails(viewer.address)
      assert.equal(+channelBalances.weiHub, 0)
      assert.equal(+channelBalances.weiUser, 1)
      assert.equal(+channelBalances.weiTotal, 1)
      assert.equal(+channelBalances.tokenHub, 0)
      assert.equal(+channelBalances.tokenUser, 0)
      assert.equal(+channelBalances.tokenTotal, 0)
      assert.equal(+channelDetails.txCountGlobal, 1)
      assert.equal(+channelDetails.txCountChain, 1)
      assert.equal(channelDetails.threadRoot, emptyRootHash)
      assert.equal(channelDetails.threadCount, 0)
      assert.equal(channelDetails.exitInitiator, emptyAddress)
      assert.equal(+channelDetails.status, 0)

      const parseBNArr = (BNArray) => {
        return BNArray.map(a => +a)
      }

      const event = getEventParams(tx, 'DidUpdateChannel')
      assert.equal(event.user, viewer.address)
      assert.equal(event.senderIdx, 1)
      assert.deepEqual(parseBNArr(event.weiBalances), [0, 0])
      assert.deepEqual(parseBNArr(event.tokenBalances), [0, 0])
      assert.deepEqual(parseBNArr(event.pendingWeiUpdates), [0, 0, 1, 0])
      assert.deepEqual(parseBNArr(event.pendingTokenUpdates), [0, 0, 0, 0])
      assert.deepEqual(parseBNArr(event.txCount), [1, 1])
      assert.equal(event.threadRoot, emptyRootHash)
      assert.equal(event.threadCount, 0)

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
