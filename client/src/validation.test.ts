require('dotenv').config()
const Web3 = require('web3')
const HttpProvider = require(`ethjs-provider-http`)
import mocha = require('mocha')
import BN = require('bn.js')
import { expect } from 'chai'
import { ChannelStateFingerprint } from './types'
import { Utils } from './Utils'
import { Validation } from './Validation'

describe('Validation', () => {
  let web3
  let accounts
  const utils = new Utils()
  const validation = new Validation()
  let user, hubAddress, receiver
  before('instantiate web3', async () => {
    // instantiate web3
    web3 = new Web3(new HttpProvider('http://localhost:8545'))
    // set default account values
    accounts = await web3.eth.getAccounts()
    hubAddress = accounts[0]
    user = accounts[1]
    receiver = accounts[2]
  })

  it('should correctly validate a payment update', async () => {})

  it('should correctly validate an exchange update', async () => {})

  it('should correctly validate a proposed pending deposit update', async () => {})

  it('should correctly validate a confirm pending deposit update', async () => {})

  it('should correctly validate a proposed pending withdrawal update', async () => {})

  it('should correctly validate a confirm pending withdrawal update', async () => {})

  it('should correctly validate an open thread update', async () => {})

  it('should correctly validate a close thread update', async () => {})
})
