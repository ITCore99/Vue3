import { currentInstance, setCurrentIntance } from "./component"

/**
 * 这是组件的生命周期钩子函数
 */
const enum LifeCyacleHooks {
  BEFORE_MOUNT = 'bm',
  MOUNTED  = 'm',
  BEFORE_UPDATE = 'bu',
  UPDATE = 'u',
  BEFORE_UNMOUNT = 'bum',
  UNMOUNTED = 'um',
}
export const onBeforeMount = createHook(LifeCyacleHooks.BEFORE_MOUNT)
export const onMounted = createHook(LifeCyacleHooks.MOUNTED)
export const onBeforeUpdate = createHook(LifeCyacleHooks.BEFORE_UPDATE)
export const onUpdated = createHook(LifeCyacleHooks.UPDATE)
export const onBeforeUnmount = createHook(LifeCyacleHooks.BEFORE_UNMOUNT)
export const omUnmounted = createHook(LifeCyacleHooks.UNMOUNTED)

// 创建钩子函数
function createHook(lifecycle: LifeCyacleHooks) {
  return function(hook, target = currentInstance) { // 通过target 来表示他是哪个实例的钩子函数
    // 为当前实例增加对的生命周期
    injectHook(lifecycle, hook, target)
  }
}

function injectHook(type, hook, target) { // 在这个函数中保存了实例 闭包
  if(!currentInstance) {
    console.warn('生命周期钩子'+ 'hook'+ '只能用到setup函数中')
  } else {
    const hooks = target[type] || (target[type] = []) // 数组有可能是多个相同的生命周期
    const warp = () => { 
      setCurrentIntance(target) // currentInstance 是自己的 target 被保存到当前这个wrap的作用域下面 这样就保证了当孩子挂载完之后setcurrent指向孩子组件 执行父组件mounted的时候currentInstance不正确的问题
      hook.call(target)
      setCurrentIntance(null)
    }
    hooks.push(warp) // 保存的时候就知道当前生命周期是那个实例的
  }
}

// 调用函数
export function invokeArrayFns(fns) {
  for(let i = 0; i < fns.length; i++) { // 和vue2 类似调用时让函数一次执行
    fns[i]()
  }
}
