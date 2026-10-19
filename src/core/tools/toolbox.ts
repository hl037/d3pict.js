import type { D3PBus } from '../bus'
import type { D3PChart } from '../chart'
import { D3PObject } from '../object'

/** Contract of anything that can live in a toolbox. */
export interface D3PToolLike {
  /** The name of the tool, unique in a toolbox (`pan`, `wheel-zoom`, `reset`...). */
  readonly name: string
  /** Attaches the tool to a chart. */
  addToChart(chart: D3PChart): void
  /** Detaches the tool from a chart. */
  removeFromChart(chart: D3PChart): void
  /** Destroys the tool. */
  destroy(): void
}

/** Options of a toolbox: the bus, and the groups of tools of which only one is active at a time. */
export interface D3PToolboxOptions {
  /** The bus the toolbox uses (the global bus by default). */
  bus?: D3PBus
  /** Groups of tool names that cannot be active together. */
  mutuallyExclusiveGroups?: string[][]
}

/**
 * Registry of named tools over N charts, a subset of which is active. Activating a tool
 * attaches it to every chart of the toolbox; deactivating detaches it.
 */
export class D3PToolbox extends D3PObject<{ toolStateChanged: { tool: D3PToolLike; state: boolean } }> {
  private tools = new Map<string, D3PToolLike>()
  private active = new Set<string>()
  private charts = new Set<D3PChart>()
  private chartOffs = new Map<D3PChart, () => void>()
  private _groups: string[][]

  constructor(opts: D3PToolboxOptions = {}) {
    super('toolbox', ['toolStateChanged'], opts.bus)
    this._groups = opts.mutuallyExclusiveGroups ?? []
  }

  /** The groups of tool names of which only one is active at a time (`[['pan', 'zoom-selection']]`). */
  get mutuallyExclusiveGroups(): string[][] {
    return this._groups
  }

  /** Sets the groups of mutually exclusive tools. Active tools that conflict are deactivated. */
  setMutuallyExclusiveGroups(groups: string[][]): void {
    this._groups = groups
    for (const name of [...this.active]) this.setToolActive(name, true)
  }

  /** Adds a tool. Throws an error if a tool has its name. It is not active until `setToolActive`. */
  addTool(tool: D3PToolLike): void {
    if (this.tools.has(tool.name)) throw new Error(`[d3pict] tool "${tool.name}" already exists`)
    this.tools.set(tool.name, tool)
  }

  /** Removes a tool (and deactivates it). */
  removeTool(name: string): void {
    const tool = this.getTool(name)
    if (!tool) return
    this.setToolActive(name, false)
    this.tools.delete(name)
  }

  /** Attaches the toolbox to a chart: the active tools work there. */
  addToChart(chart: D3PChart): void {
    if (this.charts.has(chart)) return
    this.charts.add(chart)
    this.chartOffs.set(chart, this.bus.on(chart.e.destroyed, () => this.removeFromChart(chart)))
    for (const name of this.active) this.tools.get(name)!.addToChart(chart)
  }

  /** Detaches the toolbox from a chart. */
  removeFromChart(chart: D3PChart): void {
    if (!this.charts.delete(chart)) return
    this.chartOffs.get(chart)?.()
    this.chartOffs.delete(chart)
    for (const name of this.active) this.tools.get(name)!.removeFromChart(chart)
  }

  /**
   * Activates or deactivates a tool. Activating a tool deactivates the others of its groups. Throws an error for an unknown name.
   */
  setToolActive(name: string, active = true): void {
    const tool = this.tools.get(name)
    if (!tool) throw new Error(`[d3pict] unknown tool "${name}"`)
    if (!active) {
      if (!this.active.delete(name)) return
      for (const c of this.charts) tool.removeFromChart(c)
      this.fire(this.e.toolStateChanged, { tool, state: false })
      return
    }
    for (const group of this._groups) {
      if (!group.includes(name)) continue
      for (const other of group) if (other !== name && this.active.has(other)) this.setToolActive(other, false)
    }
    if (this.active.has(name)) return
    this.active.add(name)
    for (const c of this.charts) tool.addToChart(c)
    this.fire(this.e.toolStateChanged, { tool, state: true })
  }

  /** Deactivates every tool. */
  deactivateAll(): void {
    for (const name of [...this.active]) this.setToolActive(name, false)
  }

  /** Whether at least one tool is active. */
  hasToolActive(): boolean {
    return this.active.size > 0
  }
  /** The first active tool, or `null`. */
  getActiveTool(): D3PToolLike | null {
    const first = this.active.values().next()
    return first.done ? null : this.tools.get(first.value)!
  }
  /** The tools that are active. */
  getActiveTools(): D3PToolLike[] {
    return [...this.active].map((n) => this.tools.get(n)!)
  }
  /** Whether the tool of that name is active. */
  isToolActive(name: string): boolean {
    return this.active.has(name)
  }
  /** The tool of that name, if any. */
  getTool<T extends D3PToolLike = D3PToolLike>(name: string): T | undefined {
    return this.tools.get(name) as T | undefined
  }
  /** All the tools, active or not. */
  getTools(): D3PToolLike[] {
    return [...this.tools.values()]
  }

  protected override onDestroy(): void {
    for (const c of [...this.charts]) this.removeFromChart(c)
    for (const off of this.chartOffs.values()) off()
    for (const t of this.tools.values()) t.destroy()
    this.tools.clear()
    this.active.clear()
  }
}
