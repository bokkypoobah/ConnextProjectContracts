import { ChannelState } from '../types'

export default function isZeroState(state: ChannelState): boolean {
  return state.user === '0x0'
}