import  { AbstractController } from './AbstractController'
import * as actions from '../state/actions'
import getAddress from '../lib/getAddress'
import { ChannelState, SyncResult } from '../types'
import { getChannel } from '../lib/getChannel'
import { getLastThreadId } from '../lib/getLastThreadId'
import { syncDequeueAllItems } from '../lib/syncDequeueItem'
import { isFairExchange } from '../lib/isFairExchange'
import getExchangeRates from '../lib/getExchangeRates'
import Currency, { ICurrency } from '../lib/currency/Currency'
import { diffUpdates } from '../lib/diffUpdates'
import { gt, lt, mul } from '../lib/math'
import { Unsubscribe } from 'redux'
import isZeroState from '../lib/isZeroState'

export default class StateUpdateController extends AbstractController {
  private isUpdating = false
  private unsubscribe: Unsubscribe | null = null

  public start = async () => {
    this.unsubscribe = this.store.subscribe(this.checkQueue)
  }

  public stop = async () => {
    if (!this.unsubscribe) {
      return
    }
    this.unsubscribe()
    this.unsubscribe = null
  }

  private checkQueue = async () => {
    if (this.isUpdating) {
      return
    }

    if (!this.store.getState().runtime.syncQueue.length) {
      return
    }

    this.isUpdating = true
    try {
      await this.handleStateUpdates()
    } finally {
      this.isUpdating = false
    }
  }

  private handleStateUpdates = async (): Promise<void> => {
    const actionItems = syncDequeueAllItems(this.store)
    const startState: ChannelState = getChannel(this.store)
    let txCountSubtotal = startState.txCountGlobal
    let prevChannelState = startState
    const toSign: SyncResult[] = []

    for (const actionItem of actionItems) {
      if (actionItem.type === 'thread') {
        const err = null // TODO validation this.connext.validation.validateThreadSigs(actionItem.state.state)
        if (err) {
          console.error('Invalid thread signatures detected!', actionItem)
          throw new Error('Invalid thread signatures.')
        }

        this.store.dispatch(actions.setLastThreadId(actionItem.state.state.threadId))
        continue
      }

      const currChannelState = actionItem.state.state

      if (currChannelState.txCountGlobal <= startState.txCountGlobal) {
        console.warn('StateUpdateController received update with old nonces.  Skipping.')
        continue
      }

      const valErr = null // TODO validation this.connext.validation.validateChannelSigs(currChannelState, process.env.HUB_ADDRESS!)
      if (valErr) {
        console.error('Invalid state updates signatures detected!', actionItem)
        throw new Error('Invalid channel signatures.')
      }

      if (currChannelState.sigHub && currChannelState.sigUser) {
        this.setChannel(currChannelState)
        txCountSubtotal++
        continue
      }

      if (currChannelState.txCountGlobal !== txCountSubtotal + 1) {
        throw new Error('nonce on previous update is not valid')
      }

      const err = null // TODO validation await this.connext.validation.validateChannelStateUpdate({
      //   reason: actionItem.state.reason,
      //   previous: isZeroState(prevChannelState) ? undefined : prevChannelState,
      //   current: currChannelState,
      //   hubAddress: process.env.HUB_ADDRESS!
      // })
      if (err) {
        console.error('Connext validation failed: ' + err, actionItem)
        throw new Error('Connext validation failed: ' + err)
      }

      if (actionItem.state.reason === 'Exchange') {
        const rates = getExchangeRates(this.store)
        const diffs = diffUpdates(currChannelState, prevChannelState)

        let buyAmount: ICurrency
        let sellAmount: ICurrency

        const isSellingWei = lt(diffs.balanceWeiUser, '0')

        if (isSellingWei) {
          sellAmount = Currency.WEI(mul(diffs.balanceWeiUser, '-1'))
          buyAmount = Currency.BEI(diffs.balanceTokenUser)
        } else {
          sellAmount = Currency.BEI(mul(diffs.balanceTokenUser, '-1'))
          buyAmount = Currency.WEI(diffs.balanceWeiUser)
        }

        const delta = .02

        if (!isFairExchange(rates, buyAmount, sellAmount, delta)) {
          throw new Error(`Exchange is not within delta of ${delta}`)
        }
      }

      // TODO sign state updates
      // const signedState: ChannelState = await this.connext.signChannelState({
      //   reason: actionItem.state.reason,
      //   previous: isZeroState(prevChannelState) ? undefined : prevChannelState,
      //   current: currChannelState,
      //   hubAddress: process.env.HUB_ADDRESS!
      // })

      if (prevChannelState &&
        !gt(currChannelState.pendingWithdrawalWeiUser, '0') &&
        gt(currChannelState.pendingDepositWeiUser, prevChannelState.pendingDepositWeiUser)) {
        await new Promise(async (resolve, reject) => {
          const timeout = setTimeout(() => reject('User Authorized Update timed out'), 1000 * 30)
          // TODO Timeout
          // await this.connext.userAuthorizedUpdateHandler(signedState)
          clearTimeout(timeout)
          resolve()
        })
      }
      toSign.push({ state: actionItem.state, type: actionItem.type })
      txCountSubtotal++
      prevChannelState = currChannelState
    }

    if (!toSign.length) {
      return
    }

    let res: SyncResult[]
    try {
      console.log('updating hub...')
      res = await this.hub.updateHub(
        toSign,
        getLastThreadId(this.store)
      )
      console.log('setting new channel state...')
      this.setChannel(prevChannelState)

      if (!res) {
        throw new Error('No sync response array or empty array returned')
      }

      if (res.length) {
        // TODO Verify that hub signed what we are waiting on a sig for

        // TODO we pipe this back in
        // console.info('got sync response back updating hub', {res})
        // await syncEnqueueItems(this.store, updates)
        // return this.handleStateUpdates()
      }

    } catch (e) {
      // TODO log to API or start dispute case
      throw e
    }

    const hasActiveDeposit = this.store.getState().runtime.hasActiveDeposit

    const didReceiveConfirmPending = !!toSign.find(
      update => update.type === 'channel' && update.state.reason === 'ConfirmPending'
    )

    if (hasActiveDeposit && didReceiveConfirmPending) {
      this.store.dispatch(
        actions.setHasActiveDeposit(false)
      )
    }

    const hasActiveExchange = this.store.getState().runtime.hasActiveExchange
    const didConfirmExchange = !!toSign.find(
      update => update.type === 'channel' && update.state.reason === 'Exchange'
    )

    if (hasActiveExchange && didConfirmExchange) {
      this.store.dispatch(
        actions.setHasActiveExchange(false)
      )
    }

    const hasActiveWithdrawal = this.store.getState().runtime.hasActiveWithdrawal
    if (hasActiveWithdrawal && didReceiveConfirmPending) {
      this.store.dispatch(actions.setHasActiveWithdrawal(false))
    }
  }

  private setChannel = (state: ChannelState) => {
    this.store.dispatch(
      actions.setChannel(state)
    )
  }
}
