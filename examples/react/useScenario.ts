import { useEffect, useState } from 'react'
import type { D3PBus } from '../../src'
import { useD3PContext } from '../../src/react'

/**
 * Create a scenario once the component is mounted; the context destroys it when the component goes away.
 * Creating it in an effect (rather than during render) keeps it safe under StrictMode's double mount.
 */
export function useScenario<S extends { destroy(): void }>(create: (bus: D3PBus) => S): { scenario: S | undefined; bus: D3PBus } {
  const ctx = useD3PContext()
  const [scenario, setScenario] = useState<S>()
  useEffect(() => {
    setScenario(ctx.destroyLater(create(ctx.bus)))
    // the factory is a module-level function
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx])
  return { scenario, bus: ctx.bus }
}
