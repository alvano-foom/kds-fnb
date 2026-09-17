import { describe, expect, it } from 'vitest'
import { useErrorLogStore } from './errorLogStore'

describe('errorLogStore', () => {
  it('logs newest first, with a timestamp and optional detail', () => {
    useErrorLogStore.getState().logError({ category: 'printer', message: 'first' })
    useErrorLogStore.getState().logError({ category: 'printer', message: 'second', detail: 'because reasons' })

    const { entries } = useErrorLogStore.getState()
    expect(entries).toHaveLength(2)
    expect(entries[0].message).toBe('second')
    expect(entries[0].detail).toBe('because reasons')
    expect(entries[1].message).toBe('first')
    expect(entries[1].detail).toBeNull()
    expect(entries[0].at).toBeTruthy()
  })

  it('caps history at 200 entries so it can\'t grow without bound', () => {
    for (let i = 0; i < 205; i++) {
      useErrorLogStore.getState().logError({ category: 'printer', message: `entry ${i}` })
    }
    expect(useErrorLogStore.getState().entries).toHaveLength(200)
    expect(useErrorLogStore.getState().entries[0].message).toBe('entry 204')
  })

  it('clears the log', () => {
    useErrorLogStore.getState().logError({ category: 'printer', message: 'x' })
    useErrorLogStore.getState().clear()
    expect(useErrorLogStore.getState().entries).toEqual([])
  })

  describe('same-day pruning', () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const today = new Date().toISOString()

    it('drops entries from a previous calendar day as soon as a new one is logged', () => {
      useErrorLogStore.setState({ entries: [{ id: 'old', category: 'printer', message: 'stale', detail: null, at: yesterday }] })

      useErrorLogStore.getState().logError({ category: 'printer', message: 'fresh' })

      const messages = useErrorLogStore.getState().entries.map((e) => e.message)
      expect(messages).toEqual(['fresh'])
    })

    it('pruneOldEntries() removes stale entries without needing a new log', () => {
      useErrorLogStore.setState({
        entries: [
          { id: 'old', category: 'printer', message: 'stale', detail: null, at: yesterday },
          { id: 'new', category: 'printer', message: 'fresh', detail: null, at: today },
        ],
      })

      useErrorLogStore.getState().pruneOldEntries()

      expect(useErrorLogStore.getState().entries.map((e) => e.message)).toEqual(['fresh'])
    })
  })
})
