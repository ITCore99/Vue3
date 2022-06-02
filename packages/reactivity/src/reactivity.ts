import { isObject} from '@vue/shared'
import { mutableHandlers, shallowReadonlyHandlers,shallowReactiveHandlers, readonlyHandlers } from './baseHandlers'

function reactive(target) {
  return createReactiveObject(target, false, mutableHandlers)
}

function shallowReactive(target){
  return createReactiveObject(target, false, shallowReactiveHandlers)
}

function readonly(target) {
  return createReactiveObject(target, true, readonlyHandlers)
}

function shallowReadonly(target) {
  return createReactiveObject(target, true, shallowReadonlyHandlers)
}

// 用于存储代理过的对象 已经被代理过的对象将不在被代理
const reactiveMap = new WeakMap()
const readonlyMap = new WeakMap()

// 创建一个响应式对象
function createReactiveObject(target, isReadonly, handlers) {
  if (!isObject(target)) {
    return target
  }
  const proxyMap = isReadonly ? readonlyMap : reactiveMap
  const existProxy = proxyMap.get(target)
  if (existProxy) {
    return existProxy
  }
  const proxy = new Proxy(target, handlers)
  proxyMap.set(target, proxy)
  return proxy
}

export {
  reactive,
  shallowReactive,
  readonly,
  shallowReadonly
}