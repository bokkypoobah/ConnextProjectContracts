"use strict";
const should = require("chai")
// const Connext = require("../client/dist/Utils.js");
const HttpProvider = require("ethjs-provider-http")
const EthRPC = require("ethjs-rpc")
const config = require("./config.json")
const Utils = require("./helpers/utils");
const privKeys = require("./privKeys.json")
const EC = artifacts.require("./ECTools.sol")
// const Ledger = artifacts.require("./ChannelManager.sol")
// const Token = artifacts.require("./lib/HumanStandardToken.sol")

const Connext = require('./../client/dist/Connext');

console.log(Connext)


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
  // TODO why do we do these empty loops?
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

let connext



contract("ChannelManager", accounts => {
  let snapshotId

  connext = createConnext(web3, accounts[0])

  before('deploy contracts', async () => {
  })

  beforeEach(async () => {
    snapshotId = await snapshot()
  })

  afterEach(async () => {
    await restore(snapshotId)
  })

  describe('contract deployment', () => {
    it("verify init parameters", async () => {
    })
  })
})
