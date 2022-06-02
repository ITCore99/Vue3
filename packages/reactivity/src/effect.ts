import { isArray, isIntegerKey } from "@vue/shared"
import { TriggerOpTypes } from "./operators"

/**
 * effect 副作用函数
 * 注意effect不仅仅只有一个参数 它还有第二个参数 
 * effect是响应式的可以做到数据变化 effect 重新执行
 */
function effect(fn, options:any = {}) {
  const effect = createReactiveEffect(fn, options)
  if (!options.lazy) { // lazy 属性为true 说明这个effect 是懒执行的
    effect() // 默认先执行一次 
  }
  return effect
}

let uid = 0
let activeEffect = null // 存储当前正在执行的effect
const effectStack = [] // 解决嵌套effect 出现依赖收集错误的问题
// 创建一个响应式的effect 作用是对effect进行二次的处理 添加一些标识
function createReactiveEffect(fn, options) {
  const reactiveEffect = function () {
    if (!effectStack.includes(reactiveEffect)) {
      try {
        effectStack.push(reactiveEffect)
        activeEffect = reactiveEffect
        return  fn() // 进行依赖的收集
      } finally {
        effectStack.pop()
        activeEffect = effectStack[effectStack.length - 1]
      }
    }
  }
  reactiveEffect.id = uid++ // effect标识 执行更新的时候用此标识对effect进行排序
  reactiveEffect._isEffect = true // 用于标识这是一个effect
  reactiveEffect.raw = fn // 保存原始的fn函数
  reactiveEffect.options = options // 保存options配置项 注意这里会保存computed的scheduler
  return reactiveEffect
}

const targetMap = new WeakMap()
// 进行依赖收集 operator 是一个标识
function track(target, type, key) {
  if (!activeEffect) return 
  let depsMap = targetMap.get(target)
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()))
  }
  let deps = depsMap.get(key)
  if(!deps) {
    depsMap.set(key, (deps = new Set()))
  }
  if (!deps.has(activeEffect)) {
    deps.add(activeEffect)
  }
}
/**
 * effect(() => { // effect1
 *  state.name ==> effect1
 *  effect(() => { // effect2
 *    state.age ==> effect2
 *  })
 *  state.address ==> effect2 这依赖收集出现了错误
 * })
 */

// 触发更新
function trigger(target, type, key, value?, oldvalue?) {
  // 如果这个属性没有收集过effect 则不需要任何的更新
  const depsMap = targetMap.get(target)
  if (!depsMap) return 
  // 将所有收集的effect 全部存在一个新的集合中(主要是对数组的lenth和下标effect整合) 最后在一起执行(使用set对effect进行去重)
  const effects = new Set()
  // 需要判断是不是修改的数组的长度 因为数组的长度影响比较大(就是当我们把数组的长度由100变为1 之前也收集了下标为3的依赖 
  // 那我们不仅要执行length的依赖也要执行下标为3的依赖)
  if (isArray(target) && key === 'length') { // 如果更改的长度小于收集的索引那么这个索引也许需要触发更新
    // 如果对应的长度有依赖收集则需要更新
    depsMap.forEach((deps, key) => {
      if(key === 'length' || key >= value) {
        add(deps)
      }
    })
  } else {
    // 对象数组 修改
    if(key !== undefined) { // (数组修改对象的新增修改) 这里对象的新增获取到deps是undefined不会添加到effects中 同时你也没使用到所以不需要触发
      const depsMap = targetMap.get(target)
      const deps = depsMap.get(key)
      add(deps)
    }
    switch(type) {
      case TriggerOpTypes.ADD: // 新增  
        if(isArray(target) && isIntegerKey(key)) { // 是数组并且修改是索引 这里需要触发length的更新
          // 情况是这样的 app.innerHTML = state.arr  这样修改  state.arr[100] = 1
          add(depsMap.get('length'))
        }
    }
   
  }
  // 将所有收集到的effect进行执行 更新页面
  effects.forEach((effect: any) => {
    if(effect.options.scheduler) {
      effect.options.scheduler(effect)
    } else {
      effect()
    }
  })

  // 将deps 添加到effects中
  function add(deps) {
    if(deps) {
      deps.forEach(dep => {
        effects.add(dep)
      })
    }
  }
}


export {
  effect,
  activeEffect,
  track,
  trigger
}