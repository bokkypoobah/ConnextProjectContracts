"use strict";
const should = require("chai")
const Connext = require("connext")
const HttpProvider = require("ethjs-provider-http")
const EthRPC = require("ethjs-rpc")
const config = require("./config.json")
const Utils = require("./helpers/utils");
const privKeys = require("./privKeys.json")
const EC = artifacts.require("./ECTools.sol")
const Ledger = artifacts.require("./ChannelManager.sol")
const Token = artifacts.require("./lib/HumanStandardToken.sol")

should
  .use(require("chai-as-promised"))
  .should()

const ethRPC = new EthRPC(new HttpProvider('http://localhost:8545'))
const SolRevert = "VM Exception while processing transaction: revert"
const emptyRootHash =
  "0x0000000000000000000000000000000000000000000000000000000000000000"

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
  }, (err)=> {`error increasing time`});
  const start = Date.now();
  while (Date.now() < start + 300) {}
  await ethRPC.sendAsync({method: `evm_mine`}, (err)=> {});
  while (Date.now() < start + 300) {}
  return true
}

async function generateThreadProof(threadHashToProve, threadInitStates) {
  return await Connext.Utils.generateThreadProof(threadHashToProve, threadInitStates)
}

async function generateThreadRootHash(threadInitStates){
  return await Connext.Utils.generateThreadRootHash(threadInitStates)
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

async function updateHash(data, privateKey) {
  const hash = await web3.utils.soliditySha3(
    channelManager.address,
    {type: 'address[2]', value: [data.user, data.recipient]},
    {type: 'uint256[2]', value: data.weiBalances},
    {type: 'uint256[2]', value: data.tokenBalances},
    {type: 'uint256[4]', value: data.pendingWeiUpdates},
    {type: 'uint256[4]', value: data.pendingTokenUpdates},
    {type: 'uint256[2]', value: data.txCount},
    {type: 'bytes32', value: data.threadRoot},
    data.threadCount,
    data.timeout
  )
  const sig = await web3.eth.accounts.sign(hash, privateKey)
  return sig.signature
}

async function updateThreadHash(data, privateKey) {
  const hash = await web3.utils.soliditySha3(
    channelManager.address,
    {type: 'address', value: data.user},
    {type: 'address', value: data.sender},
    {type: 'address', value: data.receiver},
    {type: 'uint256[2]', value: data.weiBalances},
    {type: 'uint256[2]', value: data.tokenBalances},
    {type: 'uint256', value: data.txCount}
  )
  const sig = await web3.eth.accounts.sign(hash, privateKey)
  return sig.signature
}

async function hubAuthorizedUpdate(data) {
  await channelManager.hubAuthorizedUpdate(
    data.user,
    data.recipient,
    data.weiBalances,
    data.tokenBalances,
    data.pendingWeiUpdates,
    data.pendingTokenUpdates,
    data.txCount,
    data.threadRoot,
    data.threadCount,
    data.timeout,
    data.sigUser,
    {from: hub.address}
  )
}

async function userAuthorizedUpdate(data, user, wei=0) {
    await channelManager.userAuthorizedUpdate(
      data.recipient,
      data.weiBalances,
      data.tokenBalances,
      data.pendingWeiUpdates,
      data.pendingTokenUpdates,
      data.txCount,
      data.threadRoot,
      data.threadCount,
      data.timeout,
      data.sigHub,
      {from: user.address, value:wei}
    )
  }

async function emptyChannelWithChallenge(data, user) {
  await channelManager.emptyChannelWithChallenge(
    [data.user, data.recipient],
    data.weiBalances,
    data.tokenBalances,
    data.pendingWeiUpdates,
    data.pendingTokenUpdates,
    data.txCount,
    data.threadRoot,
    data.threadCount,
    data.timeout,
    data.sigHub,
    data.sigUser,
    {from: user}
  )
}

async function startExitWithUpdate(data, user) {
  await channelManager.startExitWithUpdate(
    [data.user, data.recipient],
    data.weiBalances,
    data.tokenBalances,
    data.pendingWeiUpdates,
    data.pendingTokenUpdates,
    data.txCount,
    data.threadRoot,
    data.threadCount,
    data.timeout,
    data.sigHub,
    data.sigUser,
    {from:user}
  )
}

async function startExitThread(data, user) {
  await channelManager.startExitThread(
    data.user,
    data.sender,
    data.receiver,
    data.threadId,
    data.weiBalances,
    data.tokenBalances,
    data.proof,
    data.sig,
    {from: user}
  )
}

async function startExitThreadWithUpdate(data, user) {
    await channelManager.startExitThreadWithUpdate(
        data.user,
        [data.sender, data.receiver],
        data.threadId,
        data.weiBalances,
        data.tokenBalances,
        data.proof,
        data.sig,
        data.updatedWeiBalances,
        data.updatedTokenBalances,
        data.updatedTxCount,
        data.updateSig,
        {from: user}
    )
}

async function challengeThread(data, user) {
    await channelManager.challengeThread(
        data.sender,
        data.receiver,
        data.threadId,
        data.weiBalances,
        data.tokenBalances,
        data.txCount,
        data.sig,
        {from: user}
    )
}

async function emptyThread(data) {
    await channelManager.emptyThread(
        data.user,
        data.sender,
        data.receiver,
        data.threadId,
        data.weiBalances,
        data.tokenBalances,
        data.proof,
        data.sig,
        {from: user}
    )
}

async function nukeThreads(data, user) {
    await channelManager.nukeThreads(
        data.user,
        {from: user}
    )
}

// Funds contract with eth and tokens
async function fundContract(eth, tokens) {
  await web3.eth.sendTransaction({
    to: channelManager.address,
    value: web3.utils.toWei(eth),
    from: hub.address
  })
  // let balance = await web3.eth.getBalance(cm.address)
  // console.log('contract ETH balance: ', balance);
  await tokenAddress.transfer(channelManager.address, web3.utils.toWei(tokens))
  // balance = await hst.balanceOf(cm.address)
  // console.log('contract HST balance: ', balance);
}

// NOTE : ganache-cli -m 'refuse result toy bunker royal small story exhaust know piano base stand'
// NOTE : hub : accounts[0], privKeys[0]
let channelManager, tokenAddress, challengePeriod
let hub, performer, viewer, initChannel, initThread

contract("ChannelManager", accounts => {
  let snapshotId

  before('deploy contracts', async () => {
    channelManager = await Ledger.deployed()
    tokenAddress = await Token.deployed()

    hub = {
      address: accounts[0],
      privateKey: privKeys[0]
    }
    performer = {
      address: accounts[1],
      privateKey: privKeys[1]
    }
    viewer = {
      address: accounts[2],
      privateKey: privKeys[2]
    }

    await fundContract("5", "1000")
  })

  beforeEach(async () => {
    snapshotId = await snapshot()
    initChannel = {
      "user": performer.address,
      "recipient": performer.address,
      "weiBalances": [0, 0],
      "tokenBalances": [0, 0],
      "pendingWeiUpdates": [0, 0, 0, 0],
      "pendingTokenUpdates": [0, 0, 0, 0],
      "txCount": [1, 1],
      "threadRoot": emptyRootHash,
      "threadCount": 0,
      "timeout": 0
    }
    initThread = {
      "hub": hub.address,
      "user": viewer.address,
      "sender": viewer.address,
      "receiver": performer.address,
      "recipient": performer.address,
      "weiBalances": [0, 0],
      "tokenBalances": [0, 0],
      "pendingWeiUpdates": [0, 0, 0, 0],
      "pendingTokenUpdates": [0, 0, 0, 0],
      "txCount": [1, 1],
      "threadRoot": emptyRootHash,
      "threadCount": 0,
      "timeout": 0,
      "proof": await generateThreadRootHash([{
        "contractAddress": channelManager.address,
        "user": viewer.address,
        "sender": hub.address,
        "receiver": performer.address,
        "balanceWeiSender": 0,
        "balanceWeiReceiver": 0,
        "balanceTokenSender": 0,
        "balanceTokenReceiver": 0,
        "txCount": 2
      }])
    }
  })

  afterEach(async () => {
    await restore(snapshotId)
  })

  describe('contract deployment', () => {
    it("verify initialized parameters", async () => {
      const approvedToken = await channelManager.approvedToken()
      challengePeriod = await channelManager.challengePeriod()

      assert.equal(hub.address, accounts[0])
      assert.equal(challengePeriod.toNumber(), config.timeout)
      assert.equal(approvedToken, tokenAddress.address)
    })
  })

  describe('hubContractWithdraw', () => {
    it("happy case", async () => {
      await channelManager.hubContractWithdraw(
        web3.utils.toWei('1'),
        web3.utils.toWei('1')
      )
    })

    it("fails with insufficient ETH", async () => {
      await channelManager.hubContractWithdraw(
        web3.utils.toWei('6'),
        web3.utils.toWei('1')
      )
        .should
        .be
        .rejectedWith(
          'hubContractWithdraw: Contract wei funds not sufficient to withdraw'
        )
    })

    it("fails with insufficient tokens", async () => {
      await channelManager.hubContractWithdraw(
        web3.utils.toWei('1'),
        web3.utils.toWei('1001')
      )
        .should
        .be
        .rejectedWith(
          'hubContractWithdraw: Contract token funds not sufficient to withdraw'
        )
    })
  })

  describe('hubAuthorizedUpdate', () => {
    it("happy case", async () => {
      initChannel.sigUser = await updateHash(initChannel, performer.privateKey)
      await hubAuthorizedUpdate(initChannel)
    })

    // TODO write tests based on:
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
    //
    // TODO
    // test modifiers
    // 1. onlyHub

    it("fails user withdrawal with empty channel and pending wei updates", async () => {
      initChannel.pendingWeiUpdates = [0, 0, 0, 1]
      initChannel.sigUser = await updateHash(initChannel, performer.privateKey)
      await hubAuthorizedUpdate(initChannel)
        .should
        .be
        .rejectedWith('Returned error: VM Exception while processing transaction: revert')
    })

    it("fails with invalid user signature", async () => {
      // increment global txCount
      initChannel.txCount[0] = 2
      // set invalid signature
      initChannel.sigUser = '0x0'
      // attempt update
      await hubAuthorizedUpdate(initChannel)
        .should.be.rejectedWith('user signature invalid')
    })

    it("fails on non-open channel", async () => {
      // set status to ChannelDispute
      await channelManager.startExit(accounts[1])
      // attempt update
      initChannel.sigUser = await updateHash(initChannel, performer.privateKey)
      await hubAuthorizedUpdate(initChannel)
        .should.be.rejectedWith('channel must be open')
    })
  })

  describe('userAuthorizedUpdate', () => {
    it("happy case", async () => {
      initChannel.sigHub = await updateHash(initChannel, hub.privateKey)
      await userAuthorizedUpdate(initChannel, performer)
    })

    it("fails when wei deposit value not equal to message value", async () => {
      // increment global txCount
      initChannel.txCount[0] = 2
      // set invalid deposit amount in wei
      initChannel.pendingWeiUpdates[2] = web3.utils.toWei('1')
      // set sig
      initChannel.sigHub = await updateHash(initChannel, hub.privateKey)
      // attempt update
      await userAuthorizedUpdate(initChannel, performer)
        .should.be.rejectedWith('msg.value is not equal to pending user deposit')
    })

    it("fails token deposit for user without tokens", async () => {
      // increment global txCount
      initChannel.txCount[0] = 2
      // set invalid deposit amount in tokens
      initChannel.pendingTokenUpdates[2] = web3.utils.toWei('1')
      // set sig
      initChannel.sigHub = await updateHash(initChannel, hub.privateKey)
      // attempt update
      await userAuthorizedUpdate(initChannel, performer)
        .should
        .be
        .rejectedWith(
          'Returned error: VM Exception while processing transaction: revert'
        )
    })

    it("fails with invalid hub signature", async () => {
      // increment global txCount
      initChannel.txCount[0] = 2
      // set invalid signature
      initChannel.sigHub = '0x0'
      // attempt update
      await userAuthorizedUpdate(initChannel, performer)
        .should.be.rejectedWith('hub signature invalid')
    })
  })

  describe('startExit', () => {
    it("fails when user == hub", async () => {
      await channelManager.startExit(hub.address)
        .should.be.rejectedWith('user can not be hub')
    })

    it("fails when user == contract", async () => {
      await channelManager.startExit(channelManager.address)
        .should.be.rejectedWith('user can not be channel manager')
    })

    it("fails when sender not hub or user", async () => {
      await channelManager.startExit(
        performer.address,
        { from: viewer.address }
      )
        .should.be.rejectedWith('exit initiator must be user or hub')
    })

    it("happy case", async () => {
      await channelManager.startExit(performer.address)
    })

    it("fails when channel.status != Open", async () => {
      await channelManager.startExit(performer.address)
      await channelManager.startExit(performer.address)
        .should.be.rejectedWith('channel must be open')
    })
  })

  describe('startExitWithUpdate', () => {
    it("fails when sender not hub or user", async () => {
      initChannel.sigHub = await updateHash(initChannel, hub.privateKey)
      initChannel.sigUser = await updateHash(initChannel, performer.privateKey)

      await startExitWithUpdate(initChannel, viewer.address)
        .should
        .be
        .rejectedWith('exit initiator must be user or hub')
    })

    it("fails when timeout != 0", async () => {
      initChannel.timeout = 1
      initChannel.sigHub = await updateHash(initChannel, hub.privateKey)
      initChannel.sigUser = await updateHash(initChannel, performer.privateKey)

      await startExitWithUpdate(initChannel, hub.address)
        .should.be.rejectedWith('can\'t start exit with time-sensitive states')
    })

    it("happy case", async () => {
      initChannel.user = performer.address
      initChannel.sigHub = await updateHash(initChannel, hub.privateKey)
      initChannel.sigUser = await updateHash(initChannel, performer.privateKey)
      await startExitWithUpdate(initChannel, hub.address)
    })

    it("fails when channel.status != Open", async () => {
      initChannel.sigHub = await updateHash(initChannel, hub.privateKey)
      initChannel.sigUser = await updateHash(initChannel, performer.privateKey)
      await channelManager.startExit(performer.address) // channel.status = Status.ChannelDispute
      await startExitWithUpdate(initChannel, hub.address)
        .should
        .be
        .rejectedWith('channel must be open')
    })
  })

  describe('emptyChannelWithChallenge', () => {
    it("happy case", async() => {
      initChannel.sigHub = await updateHash(initChannel, hub.privateKey)
      initChannel.sigUser = await updateHash(initChannel, performer.privateKey)
      await channelManager.startExit(performer.address, { from: hub.address })
      await emptyChannelWithChallenge(initChannel, performer.address)
    })
  })

  describe('emptyChannel', () => {
    it("happy case", async () => {
      await channelManager.startExit(performer.address)
      await moveForwardSecs(config.timeout + 1)
      await channelManager.emptyChannel(performer.address)
    })

    // TODO
    // Global Process:
    // 1. For each function write down every state change
    // 2. Test each successful state change
    // 3. Test all logical branches (both sides of an if)
    // 4. refactor to add helper functions for verification
    //
    // EXAMPLE: emptyChannel
    // 1. channel.weiBalances[2]
    // 2. channel.tokenBalances[2]
    // 3. totalChannelWei
    // 4. totalChannelToken
    // 5. user ETH balance
    // 6. contract ETH balance -> reserves
    // 7. user token balance
    // 8. contract token balance -> reserves
    // 9. channel.weiBalances[0, 1] = 0
    // 10. channel.tokenBalances[0, 1] = 0
    // 11. channe.threadClosingTime
    // 12. channel.status
    // 13. channel.exitInitiator
    // 14. channel.channelClosingTime
    // 15. event
    //
    // 0. happy case - emptyChannel with zero threadCount (default)
    // - check 1-15
    // 1. emptyChannel after hubAuthorizedUpdate
    // - check 1-15 (different balance)
    // 2. emptyChannel after userAuthorizedUpdate
    // - check 1-15 (different balance)
    // 3. emptyChannel with non-zero threadCount
    // - check 1-15 (thread dispute, thread closing time updated)
    // 4. emptyChannel after startExitWithUpdate


    it("fails when channel not in dispute", async () => {
      await channelManager.emptyChannel(performer.address)
        .should.be.rejectedWith('channel must be in dispute')
    })

    it("fails when channel closing time not passed", async () => {
      await channelManager.startExit(performer.address)
      await channelManager.emptyChannel(performer.address)
        .should.be.rejectedWith('channel closing time must have passed')
    })
  })
})
