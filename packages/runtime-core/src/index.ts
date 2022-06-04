// 这里负责导出 功能模块放到其他的文件中
export  {
  createRenderer
} from './renderer'

export { h } from './h' 
export * from '@vue/reactivity'
export { getCurrentInstance } from './component'
export * from './apiLifecycle'