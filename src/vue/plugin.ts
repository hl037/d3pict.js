import type { App } from 'vue'
import { D3PBus, d3pInit, setGlobalBusProvider } from '../index'
import { D3P_BUS_KEY, injectedBus } from './shared'

/**
 * Vue plugin: one bus (and one render manager) per application, provided to descendants.
 * Objects created in `setup` pick the app's bus; anywhere else the global bus is unchanged.
 */
export const D3PVPlugin = {
  install(app: App) {
    const bus = new D3PBus()
    d3pInit(bus)
    app.provide(D3P_BUS_KEY, bus)
    setGlobalBusProvider(injectedBus)
  },
}
