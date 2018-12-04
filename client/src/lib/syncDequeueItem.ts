import { ConnextStore } from '../state/store'
import * as actions from '../state/actions'
import { SyncResult } from '../types'

export function syncDequeueItem(store: ConnextStore): SyncResult | null {
  const item = store.getState().runtime.syncQueue[0]

  if (!item) {
    return null
  }

  store.dispatch(
    actions.dequeueSyncItem(1)
  )
  return item
}

export function syncDequeueAllItems(store: ConnextStore): SyncResult[] {
  const out: SyncResult[] = []

  while (true) {
    const nextItem = syncDequeueItem(store)

    if (!nextItem) {
      return out
    }

    out.push(nextItem)
  }
}
