/**
 * The Vue adapter: a plugin and the components that mount a chart, its tooltip, its legend and your own content.
 * @module d3pict/vue
 */
/** Installs D3Pict in a Vue app: `app.use(D3PVPlugin)`. The app gets its own bus and render manager, which the components and the objects created in `setup` use. */
export { D3PVPlugin } from './plugin'
export { D3P_BUS_KEY, useD3PBus, useD3PContext, type D3PAttachableLike } from './shared'
/** Mounts a chart in a `div` and attaches `objects` to it. Props: `objects`, `width`, `height`, `margin`, `name`, `resizeDebounceMs`, `bus`. Emits `ready` with the chart. */
export { default as D3PVChart } from './D3PVChart.vue'
/** Shows a tooltip in HTML. Prop: `tooltip`. The default slot renders the content from `data` (a `D3PTooltipData`) and `chart`; without it, the standard content is used. */
export { default as D3PVTooltip } from './D3PVTooltip.vue'
/** Shows a legend in HTML. Props: `legend` and `style`. The default slot renders it from `data` (a `D3PLegend`) and `chart`; without it, the standard legend is used. */
export { default as D3PVLegend } from './D3PVLegend.vue'
/** Puts content at a point of a chart, in its overlay. Props: `anchor`, `x`, `y`, `width`, `height` and `point`. The default slot renders the content for each `chart`. */
export { default as D3PVAnchor } from './D3PVAnchor.vue'
/** Puts content in a slot of a chart (a title, a legend, your own component). Prop: `slot`. The default slot renders the content for each `chart`. */
export { default as D3PVSlot } from './D3PVSlot.vue'
