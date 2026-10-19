import { useEffect, useState } from 'react'
import type { D3PBus } from '../../src'
import { useD3PBus } from '../../src/react'

/**
 * Create a scenario once the component is mounted and destroy it on unmount. Creating it in an
 * effect (rather than during render) keeps it safe under StrictMode's double mount.
 */
export function useScenario<S extends { destroy(): void }>(create: (bus: D3PBus) => S): { scenario: S | undefined; bus: D3PBus } {
  const bus = useD3PBus()
  const [scenario, setScenario] = useState<S>()
  useEffect(() => {
    const s = create(bus)
    setScenario(s)
    return () => {
      s.destroy()
      setScenario(undefined)
    }
    // the factory is a module-level function
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bus])
  return { scenario, bus }
}
