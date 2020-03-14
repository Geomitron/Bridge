/* eslint @typescript-eslint/no-explicit-any: 0 */ // Semantic adds functions to JQuery in a way that can't be type checked
/* SystemJS module definition */
declare let nodeModule: NodeModule
interface NodeModule {
  id: string
}

// @ts-ignore
declare let window: Window
declare let $: any
interface Window {
  process: any
  require: any
  jQuery: any
}