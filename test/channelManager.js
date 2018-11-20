"use strict";
console.log(__dirname)
const Utils = require("./helpers/utils");
const Ledger = artifacts.require("./ChannelManager.sol");
const EC = artifacts.require("./ECTools.sol");
const Token = artifacts.require("./lib/HumanStandardToken.sol");
const Connext = require("connext");
const privKeys = require("./privKeys.json")


const should = require("chai")
  .use(require("chai-as-promised"))
  .should();

const SolRevert = "VM Exception while processing transaction: revert";

const emptyRootHash =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

function wait(ms) {
  const start = Date.now();
  console.log(`Waiting for ${ms}ms...`);
  while (Date.now() < start + ms) { }
  return true;
}

function generateProof(vcHashToProve, vcInitStates) {
  const merkle = Connext.generateMerkleTree(vcInitStates);
  const mproof = merkle.proof(Utils.hexToBuffer(vcHashToProve));

  let proof = [];
  for (var i = 0; i < mproof.length; i++) {
    proof.push(Utils.bufferToHex(mproof[i]));
  }

  proof.unshift(vcHashToProve);

  proof = Utils.marshallState(proof);
  return proof;
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

async function initHash(contract, init, accountIndex) {
  const hash = await web3.utils.soliditySha3(
    contract.address,
    { type: 'address[2]', value: [init.user, init.recipient] },
    { type: 'uint256[2]', value: init.weiBalances },
    { type: 'uint256[2]', value: init.tokenBalances },
    { type: 'uint256[4]', value: init.pendingWeiUpdates },
    { type: 'uint256[4]', value: init.pendingTokenUpdates },
    { type: 'uint256[2]', value: init.txCount },
    { type: 'bytes32', value: init.threadRoot },
    init.threadCount,
    init.timeout
  )
  const sig = await web3.eth.accounts.sign(hash, privKeys[accountIndex])
  return sig.signature
}

// Funds contract with eth and tokens
async function fundContract(cm, hst, eth, tokens) {
  const acct = await web3.eth.getAccounts()
  await web3.eth.sendTransaction({ to: cm.address, value: web3.utils.toWei(eth), from: acct[0] })
  // let balance = await web3.eth.getBalance(cm.address)
  // console.log('contract ETH balance: ', balance);
  await hst.transfer(cm.address, web3.utils.toWei(tokens))
  // balance = await hst.balanceOf(cm.address)
  // console.log('contract HST balance: ', balance);
}

// NOTE : ganache-cli -m 'refuse result toy bunker royal small story exhaust know piano base stand'

contract("ChannelManager::constructor", accounts => {
  let channelManager, tokenAddress, hubAddress, challengePeriod, approvedToken

  before('deploy contracts', async () => {
    channelManager = await Ledger.deployed()
    tokenAddress = await Token.deployed()
    hubAddress = await channelManager.hub()
    challengePeriod = await channelManager.challengePeriod()
    approvedToken = await channelManager.approvedToken()
  })

  describe('contract deployment', () => {
    it("verify initialized parameters", async () => {
      assert.equal(hubAddress, accounts[0])
      assert.equal(challengePeriod.toNumber(), 10000)
      assert.equal(approvedToken, tokenAddress.address)
    })
  })
})

contract("ChannelManager::hubContractWithdraw", accounts => {
  let channelManager
  let tokenAddress

  before('deploy contracts', async () => {
    channelManager = await Ledger.deployed()
    tokenAddress = await Token.deployed()
    await fundContract(channelManager, tokenAddress, "5", "1000")
  })

  describe('hubContractWithdraw', () => {
    it("happy case", async () => {
      await channelManager.hubContractWithdraw(
        web3.utils.toWei('1'),
        web3.utils.toWei('1')
      )
    })

    it("fails with insufficient ETH", async () => {
      try {
        await channelManager.hubContractWithdraw(
          web3.utils.toWei('5'),
          web3.utils.toWei('1')
        )
        throw new Error('hubContractWithdraw succeeded with insufficient ETH')
      } catch (err) {
        assert.equal(err.reason, 'hubContractWithdraw: Contract wei funds not sufficient to withdraw')
      }
    })

    it("fails with insufficient tokens", async () => {
      try {
        await channelManager.hubContractWithdraw(
          web3.utils.toWei('1'),
          web3.utils.toWei('1000')
        )
        throw new Error('hubContractWithdraw succeeded with insufficient tokens')
      } catch (err) {
        assert.equal(err.reason, 'hubContractWithdraw: Contract token funds not sufficient to withdraw')
      }
    })
  })
});

contract("ChannelManager::hubAuthorizedUpdate", accounts => {
  let channelManager
  let tokenAddress

  before('deploy contracts', async () => {
    channelManager = await Ledger.deployed()
    tokenAddress = await Token.deployed()
    // TODO test non-zero channel balances
    await fundContract(channelManager, tokenAddress, "15", "5000")
  })

  describe('hubAuthorizedUpdate', () => {
    let init

    beforeEach(async () => {
      init = {
        "user": accounts[1],
        "recipient": accounts[1],
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

    it("happy case", async () => {
      init.sigUser = await initHash(channelManager, init, 1)
      await channelManager.hubAuthorizedUpdate(
        init.user,
        init.recipient,
        init.weiBalances,
        init.tokenBalances,
        init.pendingWeiUpdates,
        init.pendingTokenUpdates,
        init.txCount,
        init.threadRoot,
        init.threadCount,
        init.timeout,
        init.sigUser
      )
    })

    it("fails with invalid user signature", async () => {
      // increment global txCount
      init.txCount[0] = 2
      // set invalid signature
      init.sigUser = '0x0'
      // attempt update
      try {
        await channelManager.hubAuthorizedUpdate(
          init.user,
          init.recipient,
          init.weiBalances,
          init.tokenBalances,
          init.pendingWeiUpdates,
          init.pendingTokenUpdates,
          init.txCount,
          init.threadRoot,
          init.threadCount,
          init.timeout,
          init.sigUser
        )
        throw new Error('hubAuthorizedUpdate should fail if user sig invalid')
      } catch (err) {
        assert.equal(err.reason, 'user signature invalid')
      }
    })

    it("fails on non-open channel", async () => {
      // set status to ChannelDispute
      await channelManager.startExit(accounts[1])
      // attempt update
      init.sigUser = await initHash(channelManager, init, 1)
      try {
        await channelManager.hubAuthorizedUpdate(
          init.user,
          init.recipient,
          init.weiBalances,
          init.tokenBalances,
          init.pendingWeiUpdates,
          init.pendingTokenUpdates,
          init.txCount,
          init.threadRoot,
          init.threadCount,
          init.timeout,
          init.sigUser
        )
        throw new Error('hubAuthorizedUpdate should fail if channel not open')
      } catch (err) {
        assert.equal(err.reason, 'channel must be open')
      }
    })
  })
});


contract("ChannelManager::userAuthorizedUpdate", accounts => {
  let channelManager, tokenAddress

  before('deploy contracts', async () => {
    channelManager = await Ledger.deployed()
    tokenAddress = await Token.deployed()
    // TODO test non-zero channel balances
    await fundContract(channelManager, tokenAddress, "15", "5000")
  })

  describe('userAuthorizedUpdate', () => {
    let hash, init
    beforeEach(async () => {
      init = {
        "user": accounts[1],
        "recipient": accounts[1],
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

    it("happy case", async () => {
      init.sigHub = await initHash(channelManager, init, 0)
      await channelManager.userAuthorizedUpdate(
        init.recipient,
        init.weiBalances,
        init.tokenBalances,
        init.pendingWeiUpdates,
        init.pendingTokenUpdates,
        init.txCount,
        init.threadRoot,
        init.threadCount,
        init.timeout,
        init.sigHub,
        { from: accounts[1] }
      )
    })

    it("fails when wei deposit value not equal to message value", async () => {
      // increment global txCount
      init.txCount[0] = 2
      // set invalid deposit amount in wei
      init.pendingWeiUpdates[2] = web3.utils.toWei('1')
      // set sig
      init.sigHub = await initHash(channelManager, init, 0)
      // attempt update
      try {
        await channelManager.userAuthorizedUpdate(
          init.recipient,
          init.weiBalances,
          init.tokenBalances,
          init.pendingWeiUpdates,
          init.pendingTokenUpdates,
          init.txCount,
          init.threadRoot,
          init.threadCount,
          init.timeout,
          init.sigHub,
          { from: accounts[1] }
        )
        throw new Error('userAuthorizedUpdate should fail if msg.value != pendingWeiUpdates')
      } catch (err) {
        assert.equal(err.reason, 'msg.value is not equal to pending user deposit')
      }
    })

    it("fails token deposit for user without tokens", async () => {
      // increment global txCount
      init.txCount[0] = 2
      // set invalid deposit amount in tokens
      init.pendingTokenUpdates[2] = web3.utils.toWei('1')
      // set sig
      init.sigHub = await initHash(channelManager, init, 0)
      // attempt update
      try {
        await channelManager.userAuthorizedUpdate(
          init.recipient,
          init.weiBalances,
          init.tokenBalances,
          init.pendingWeiUpdates,
          init.pendingTokenUpdates,
          init.txCount,
          init.threadRoot,
          init.threadCount,
          init.timeout,
          init.sigHub,
          { from: accounts[1] }
        )
        throw new Error('userAuthorizedUpdate should fail if user token transfer fails')
      } catch (err) {
        assert.equal(err, 'Error: Returned error: VM Exception while processing transaction: revert')
      }
    })

    it("fails with invalid hub signature", async () => {
      // increment global txCount
      init.txCount[0] = 2
      // set invalid signature
      init.sigHub = '0x0'
      // attempt update
      try {
        await channelManager.userAuthorizedUpdate(
          init.recipient,
          init.weiBalances,
          init.tokenBalances,
          init.pendingWeiUpdates,
          init.pendingTokenUpdates,
          init.txCount,
          init.threadRoot,
          init.threadCount,
          init.timeout,
          init.sigHub,
          { from: accounts[1] }
        )
        throw new Error('userAuthorizedUpdate should fail if hub sig invalid')
      } catch (err) {
        assert.equal(err.reason, 'hub signature invalid')
      }
    })
  })
});


contract("ChannelManager::startExit", accounts => {
  let channelManager
  before('deploy contracts', async () => {
    channelManager = await Ledger.deployed()
  })

  describe('startExit', () => {
    it("fails when user == hub", async () => {
      try {
        await channelManager.startExit(
          accounts[0]
        )
        throw new Error('startExit should fail if user == hub')
      } catch (err) {
        assert.equal(err.reason, 'user can not be hub')
      }
    })

    it("fails when user == contract", async () => {
      try {
        await channelManager.startExit(
          channelManager.address
        )
        throw new Error('startExit should fail if user == channel manager')
      } catch (err) {
        assert.equal(err.reason, 'user can not be channel manager')
      }
    })

    it("fails when sender not hub or user", async () => {
      try {
        await channelManager.startExit(
          accounts[1],
          { from: accounts[2] }
        )
        throw new Error('startExit should fail if sender not hub or user')
      } catch (err) {
        assert.equal(err.reason, 'exit initiator must be user or hub')
      }
    })

    it("happy case", async () => {
      await channelManager.startExit(
        accounts[1]
      )
    })

    it("fails when channel.status != Open", async () => {
      try {
        await channelManager.startExit(
          accounts[1]
        )
        throw new Error('startExit should fail if channel not open')
      } catch (err) {
        assert.equal(err.reason, 'channel must be open')
      }
    })
  })
});


contract("ChannelManager::startExitWithUpdate", accounts => {
  let channelManager, tokenAddress, init

  async function doStartExitWithUpdate(from = accounts[0], timeout = 0) {
    const hash = await web3.utils.soliditySha3(
      channelManager.address,
      { type: 'address[2]', value: init.user },
      { type: 'uint256[2]', value: init.weiBalances },
      { type: 'uint256[2]', value: init.tokenBalances },
      { type: 'uint256[4]', value: init.pendingWeiUpdates },
      { type: 'uint256[4]', value: init.pendingTokenUpdates },
      { type: 'uint256[2]', value: init.txCount },
      { type: 'bytes32', value: init.threadRoot },
      init.threadCount,
      init.timeout
    )
    const signatureHub = await web3.eth.accounts.sign(hash, privKeys[0])
    const signatureUser = await web3.eth.accounts.sign(hash, privKeys[1])

    init.sigHub = signatureHub.signature
    init.sigUser = signatureUser.signature

    await channelManager.startExitWithUpdate(
      init.user,
      init.weiBalances,
      init.tokenBalances,
      init.pendingWeiUpdates,
      init.pendingTokenUpdates,
      init.txCount,
      init.threadRoot,
      init.threadCount,
      timeout,
      init.sigHub,
      init.sigUser,
      { from }
    )
  }

  before('deploy contracts', async () => {
    channelManager = await Ledger.deployed()
    tokenAddress = await Token.deployed()
    // TODO test non-zero channel balances
    await fundContract(channelManager, tokenAddress, "15", "5000")
  })

  beforeEach(async () => {
    init = {
      "user": [accounts[1], accounts[1]],
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

  describe('startExitWithUpdate', () => {
    it("fails when sender not hub or user", async () => {
      try {
        await doStartExitWithUpdate(accounts[2])
        throw new Error('startExitWithUpdate should fail if sender not hub or user')
      } catch (err) {
        assert.equal(err.reason, 'exit initiator must be user or hub')
      }
    })

    it("fails when timeout != 0", async () => {
      try {
        await doStartExitWithUpdate(accounts[0], 10000)
        throw new Error('startExitWithUpdate should fail if timeout not 0')
      } catch (err) {
        assert.equal(err.reason, "can't start exit with time-sensitive states")
      }
    })

    it("happy case", async () => {
      await doStartExitWithUpdate()
    })

    it("fails when channel.status != Open", async () => {
      try {
        await doStartExitWithUpdate()
        throw new Error('startExitWithUpdate should fail if channel not open')
      } catch (err) {
        assert.equal(err.reason, 'channel must be open')
      }
    })
  })
});

contract("ChannelManager::emptyChannelWithChallenge", accounts => {
  let channelManager, tokenAddress, init

  async function doEmptyChannelWithChallenge(from = accounts[1], timeout = 0) {
    const hash = await web3.utils.soliditySha3(
      channelManager.address,
      { type: 'address[2]', value: init.user },
      { type: 'uint256[2]', value: init.weiBalances },
      { type: 'uint256[2]', value: init.tokenBalances },
      { type: 'uint256[4]', value: init.pendingWeiUpdates },
      { type: 'uint256[4]', value: init.pendingTokenUpdates },
      { type: 'uint256[2]', value: init.txCount },
      { type: 'bytes32', value: init.threadRoot },
      init.threadCount,
      init.timeout
    )
    const signatureHub = await web3.eth.accounts.sign(hash, privKeys[0])
    const signatureUser = await web3.eth.accounts.sign(hash, privKeys[1])

    init.sigHub = signatureHub.signature
    init.sigUser = signatureUser.signature

    await channelManager.emptyChannelWithChallenge(
      init.user,
      init.weiBalances,
      init.tokenBalances,
      init.pendingWeiUpdates,
      init.pendingTokenUpdates,
      init.txCount,
      init.threadRoot,
      init.threadCount,
      timeout,
      init.sigHub,
      init.sigUser,
      { from }
    )
  }

  before('deploy contracts', async () => {
    channelManager = await Ledger.deployed()
    tokenAddress = await Token.deployed()
    // TODO test non-zero channel balances
    await fundContract(channelManager, tokenAddress, "15", "5000")
  })

  beforeEach(async () => {
    init = {
      "user": [accounts[1], accounts[1]],
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

  describe('emptyChannelWithChallenge', () => {
    it("happy case", async() => {
      await channelManager.startExit(accounts[1], { from: accounts[0] })
      await doEmptyChannelWithChallenge()
    })
  })
});

/*
// TODO
contract("ChannelManager::emptyChannel", accounts => {
  let channelManager
  before('deploy contracts', async () => {
    channelManager = await Ledger.deployed()
  })

  describe('emptyChannel', () => {
    it("happy case", async() => {
      await channelManager.emptyChannel(
        accounts[0]
      )
    })
  })
});

// TODO
contract("ChannelManager::startExitThread", accounts => {
  let channelManager
  before('deploy contracts', async () => {
    channelManager = await Ledger.deployed()
  })

  describe('startExitThread', () => {
    it("happy case", async() => {
      await channelManager.startExitThread(
        accounts[0]
      )
    })
  })
});

// TODO
contract("ChannelManager::startExitThreadWithUpdate", accounts => {
  let channelManager
  before('deploy contracts', async () => {
    channelManager = await Ledger.deployed()
  })

  describe('startExitThreadWithUpdate', () => {
    it("happy case", async() => {
      await channelManager.startExitThreadWithUpdate(
        accounts[0]
      )
    })
  })
});

// TODO
contract("ChannelManager::fastEmptyThread", accounts => {
  let channelManager
  before('deploy contracts', async () => {
    channelManager = await Ledger.deployed()
  })

  describe('fastEmptyThread', () => {
    it("happy case", async() => {
      await channelManager.fastEmptyThread(
        accounts[0]
      )
    })
  })
});

// TODO
contract("ChannelManager::emptyThread", accounts => {
  let channelManager
  before('deploy contracts', async () => {
    channelManager = await Ledger.deployed()
  })

  describe('emptyThread', () => {
    it("happy case", async() => {
      await channelManager.emptyThread(
        accounts[0]
      )
    })
  })
});

// TODO
contract("ChannelManager::nukeThreads", accounts => {
  let channelManager
  before('deploy contracts', async () => {
    channelManager = await Ledger.deployed()
  })

  describe('nukeThreads', () => {
    it("happy case", async() => {
      await channelManager.nukeThreads(
        accounts[0]
      )
    })
  })
});

*/
