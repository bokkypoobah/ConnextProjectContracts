require('dotenv').config()
const Web3 = require('web3')
const HttpProvider = require(`ethjs-provider-http`)
import mocha = require('mocha')
import BN = require('bn.js')
import { expect } from 'chai'
import { ChannelStateFingerprint, ThreadStateFingerprint } from './types'
import { Utils } from './Utils'
import { MerkleUtils } from './helpers/merkleUtils'
// import { MerkleTree } from './helpers/merkleTree'
import MerkleTree from './helpers/merkleTree'
import * as t from './testing'
import { assert } from './testing'

describe('Utils', () => {
  let web3: any
  let accounts: string[]
  let partyA: string
  before('instantiate web3', async () => {
    // instantiate web3
    web3 = new Web3(new HttpProvider('http://localhost:8545'))
    accounts = await web3.eth.getAccounts()
    partyA = accounts[1]
  })

  it('should recover the signer from the channel update when there are no threads', async () => {
    // create and sign channel state update
    const channelStateFingerprint = t.getChannelState('full', {
      balanceWei: [100, 200],
    }) as ChannelStateFingerprint
    // generate hash
    const hash = Utils.createChannelStateUpdateHash(channelStateFingerprint)
    // sign
    const sig = await web3.eth.sign(hash, partyA)
    console.log(hash) // log harcode hash for other hash test
    // recover signer
    const signer = Utils.recoverSignerFromChannelStateUpdate(
      channelStateFingerprint,
      sig,
    )
    expect(signer).to.equal(partyA.toLowerCase())
  })

  it('should recover the signer from the thread state update', async () => {
    // create and sign channel state update
    const threadStateFingerprint = t.getThreadState('full', {
      balanceWei: [100, 200],
    })
    // generate hash
    const hash = Utils.createThreadStateUpdateHash(threadStateFingerprint)
    // sign
    const sig = await web3.eth.sign(hash, partyA)
    console.log(hash) // log harcode hash for other hash test
    // recover signer
    const signer = Utils.recoverSignerFromThreadStateUpdate(
      threadStateFingerprint,
      sig,
    )
    expect(signer).to.equal(partyA.toLowerCase())
  })

  it('should return the correct root hash', async () => {
    const threadStateFingerprint = t.getThreadState('empty', {
      balanceWei: [100, 0],
    })
    // TO DO: merkle tree class imports not working...?
    // generate hash
    const hash = Utils.createThreadStateUpdateHash(threadStateFingerprint)
    // construct elements
    const elements = [
      MerkleUtils.hexToBuffer(hash),
      MerkleUtils.hexToBuffer(Utils.emptyRootHash),
    ]
    const merkle = new MerkleTree(elements)
    const expectedRoot = MerkleUtils.bufferToHex(merkle.getRoot())
    const generatedRootHash = Utils.generateThreadRootHash([
      threadStateFingerprint,
    ])
    expect(generatedRootHash).to.equal(expectedRoot)
  })
})
