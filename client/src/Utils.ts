/*********************************
 *********** UTIL FNS ************
 *********************************/
import util = require('ethereumjs-util')
import { MerkleUtils } from './helpers/merkleUtils'
import MerkleTree from './helpers/merkleTree'
import Web3 = require('web3')

import {
  ChannelStateFingerprint,
  channelStateToBN,
  channelStateToString,
  ThreadStateFingerprint,
  threadStateToBN,
  threadStateToString,
  balancesToBN,
  balancesToString,
} from './types'

// import types from connext

// define the utils functions
export class Utils {
  static emptyRootHash =
    '0x0000000000000000000000000000000000000000000000000000000000000000'
  static emptyAddress = '0x0000000000000000000000000000000000000000'
  static channelStateToBN = channelStateToBN

  static channelStateToString = channelStateToString

  static threadStateToBN = threadStateToBN

  static threadStateToString = threadStateToString

  static balancesToBN = balancesToBN

  static balancesToString = balancesToString

  static createChannelStateUpdateHash = (
    channelState: ChannelStateFingerprint,
  ): string => {
    const {
      contractAddress,
      user,
      recipient,
      balanceWeiHub,
      balanceWeiUser,
      balanceTokenHub,
      balanceTokenUser,
      pendingDepositWeiHub,
      pendingDepositWeiUser,
      pendingDepositTokenHub,
      pendingDepositTokenUser,
      pendingWithdrawalWeiHub,
      pendingWithdrawalWeiUser,
      pendingWithdrawalTokenHub,
      pendingWithdrawalTokenUser,
      txCountGlobal,
      txCountChain,
      threadRoot,
      threadCount,
      timeout,
    } = channelState

    // hash data
    const hash = Web3.utils.soliditySha3(
      { type: 'address', value: contractAddress },
      // @ts-ignore TODO wtf??!
      { type: 'address[2]', value: [user, recipient] },
      {
        type: 'uint256[2]',
        value: [balanceWeiHub, balanceWeiUser],
      },
      {
        type: 'uint256[2]',
        value: [balanceTokenHub, balanceTokenUser],
      },
      {
        type: 'uint256[4]',
        value: [
          pendingDepositWeiHub,
          pendingWithdrawalWeiHub,
          pendingDepositWeiUser,
          pendingWithdrawalWeiUser,
        ],
      },
      {
        type: 'uint256[4]',
        value: [
          pendingDepositTokenHub,
          pendingWithdrawalTokenHub,
          pendingDepositTokenUser,
          pendingWithdrawalTokenUser,
        ],
      },
      {
        type: 'uint256[2]',
        value: [txCountGlobal, txCountChain],
      },
      { type: 'bytes32', value: threadRoot },
      { type: 'uint256', value: threadCount },
      { type: 'uint256', value: timeout },
    )
    return hash
  }

  static recoverSignerFromChannelStateUpdate = (
    channelState: ChannelStateFingerprint,
    // could be hub or user
    sig: string,
  ): string => {
    let fingerprint: any = Utils.createChannelStateUpdateHash(channelState)
    fingerprint = util.toBuffer(String(fingerprint))
    const prefix = util.toBuffer('\x19Ethereum Signed Message:\n')
    const prefixedMsg = util.keccak256(
      Buffer.concat([
        prefix,
        util.toBuffer(String(fingerprint.length)),
        fingerprint,
      ]),
    )
    const res = util.fromRpcSig(sig)
    const pubKey = util.ecrecover(
      util.toBuffer(prefixedMsg),
      res.v,
      res.r,
      res.s,
    )
    const addrBuf = util.pubToAddress(pubKey)
    const addr = util.bufferToHex(addrBuf)
    console.log('recovered:', addr)

    return addr
  }

  static createThreadStateUpdateHash = (
    threadState: ThreadStateFingerprint,
  ): string => {
    const {
      contractAddress,
      user,
      sender,
      receiver,
      balanceWeiSender,
      balanceWeiReceiver,
      balanceTokenSender,
      balanceTokenReceiver,
      txCount,
    } = threadState
    // convert ChannelState to ChannelStateFingerprint
    const hash = Web3.utils.soliditySha3(
      { type: 'address', value: contractAddress },
      { type: 'address', value: user },
      { type: 'address', value: sender },
      { type: 'address', value: receiver },
      // @ts-ignore TODO wtf??!
      {
        type: 'uint256',
        value: [balanceWeiSender, balanceWeiReceiver],
      },
      {
        type: 'uint256',
        value: [balanceTokenSender, balanceTokenReceiver],
      },
      { type: 'uint256', value: txCount },
    )
    return hash
  }

  static recoverSignerFromThreadStateUpdate = (
    threadState: ThreadStateFingerprint,
    sig: string,
  ): string => {
    let fingerprint: any = Utils.createThreadStateUpdateHash(threadState)
    fingerprint = util.toBuffer(String(fingerprint))
    const prefix = util.toBuffer('\x19Ethereum Signed Message:\n')
    const prefixedMsg = util.keccak256(
      Buffer.concat([
        prefix,
        util.toBuffer(String(fingerprint.length)),
        fingerprint,
      ]),
    )
    const res = util.fromRpcSig(sig)
    const pubKey = util.ecrecover(prefixedMsg, res.v, res.r, res.s)
    const addrBuf = util.pubToAddress(pubKey)
    const addr = util.bufferToHex(addrBuf)
    console.log('recovered:', addr)

    return addr
  }

  static generateThreadMerkleTree = (
    threadInitialStates: ThreadStateFingerprint[],
  ): any => {
    // TO DO: should this just return emptyRootHash?
    if (threadInitialStates.length === 0) {
      throw new Error('Cannot create a Merkle tree with 0 leaves.')
    }
    let merkle
    let elems = threadInitialStates.map(threadInitialState => {
      // hash each initial state and convert hash to buffer
      const hash = Utils.createThreadStateUpdateHash(threadInitialState)
      const buf = MerkleUtils.hexToBuffer(hash)
      return buf
    })
    if (elems.length % 2 !== 0) {
      // cant have odd number of leaves
      elems.push(MerkleUtils.hexToBuffer(Utils.emptyRootHash))
    }
    merkle = new MerkleTree(elems)

    return merkle
  }

  static generateThreadRootHash = (
    threadInitialStates: ThreadStateFingerprint[],
  ): string => {
    let threadRootHash
    if (threadInitialStates.length === 0) {
      // reset to initial value -- no open VCs
      threadRootHash = Utils.emptyRootHash
    } else {
      const merkle = Utils.generateThreadMerkleTree(threadInitialStates)
      threadRootHash = MerkleUtils.bufferToHex(merkle.getRoot())
    }

    return threadRootHash
  }

  static generateThreadProof = (
    thread: ThreadStateFingerprint,
    threads: ThreadStateFingerprint[],
  ) => {
    // generate hash
    const hash = Utils.createThreadStateUpdateHash(thread)
    // generate merkle tree
    let merkle = Utils.generateThreadMerkleTree(threads)
    let mproof = merkle.proof(MerkleUtils.hexToBuffer(hash))

    let proof = []
    for (var i = 0; i < mproof.length; i++) {
      proof.push(MerkleUtils.bufferToHex(mproof[i]))
    }

    proof.unshift(hash)

    proof = MerkleUtils.marshallState(proof)
    return proof
  }
}

// remove utils
// import * as utils from './utils'
// import {generateThreadRootHash} from './utils'

// class Connext {
//     utils = utils
// }
