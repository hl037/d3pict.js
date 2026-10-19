import { describe, expect, it, vi } from 'vitest'
import { D3PBus, d3pEvent } from '../src'

describe('D3PBus', () => {
  it('delivers asynchronously, in subscription order', async () => {
    const bus = new D3PBus()
    const ev = d3pEvent<number>('n')
    const seen: string[] = []
    bus.on(ev, (n) => void seen.push(`a${n}`))
    bus.on(ev, (n) => void seen.push(`b${n}`))
    const p = bus.emit(ev, 1)
    expect(seen).toEqual([]) // never synchronous
    await p
    expect(seen).toEqual(['a1', 'b1'])
  })

  it('keeps FIFO order between emits and runs wildcards after specific handlers', async () => {
    const bus = new D3PBus()
    const a = d3pEvent<string>('a')
    const b = d3pEvent<string>('b')
    const seen: string[] = []
    bus.onAny((_e, p) => void seen.push(`*${p}`))
    bus.on(a, (p) => void seen.push(`a:${p}`))
    bus.on(b, (p) => void seen.push(`b:${p}`))
    void bus.emit(a, '1')
    void bus.emit(b, '2')
    await bus.idle()
    expect(seen).toEqual(['a:1', '*1', 'b:2', '*2'])
  })

  it('isolates events by symbol and survives failing handlers', async () => {
    const bus = new D3PBus()
    const e1 = d3pEvent('same')
    const e2 = d3pEvent('same')
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const h1 = vi.fn()
    const h2 = vi.fn()
    bus.on(e1, () => {
      throw new Error('boom')
    })
    bus.on(e1, h1)
    bus.on(e2, h2)
    await bus.emit(e1)
    expect(h1).toHaveBeenCalledTimes(1)
    expect(h2).not.toHaveBeenCalled()
    expect(err).toHaveBeenCalled()
    err.mockRestore()
  })

  it('allows (un)subscribing while delivering and awaits async handlers', async () => {
    const bus = new D3PBus()
    const ev = d3pEvent()
    const seen: string[] = []
    const late = () => void seen.push('late')
    bus.on(ev, async () => {
      bus.on(ev, late)
      await new Promise((r) => setTimeout(r, 5))
      seen.push('slow')
    })
    await bus.emit(ev)
    expect(seen).toEqual(['slow']) // `late` was added after the snapshot
    await bus.emit(ev)
    expect(seen).toContain('late')
  })

  it('idle() covers deliveries triggered by handlers', async () => {
    const bus = new D3PBus()
    const a = d3pEvent()
    const b = d3pEvent()
    const done = vi.fn()
    bus.on(a, () => void bus.emit(b))
    bus.on(b, done)
    void bus.emit(a)
    await bus.idle()
    expect(done).toHaveBeenCalled()
  })
})
