/**
 * 实现proxy的handlers
 * 需要注意的是要判断是不是仅读的 如果是仅读的话 在进行set是时候要进行报异常处理
 * 判断是是不是深度的
 */

import { isObject, extend, isArray, isIntegerKey, hasOwn, hasChange } from "@vue/shared"
import { reactive, readonly } from "."
import { track, trigger } from "./effect"
import { TrackOpTypes, TriggerOpTypes } from './operators'

// 创建一个getter
function createGetter(isReadonly = false, isShallow = false) {
  return function(target, key, receive) {
    const res = Reflect.get(target, key, receive)
    if(!isReadonly) { 
      // 如果不是仅读 要收集依赖 仅读的 不能够修改所以不需要收集依赖 提高性能
      track(target, TrackOpTypes.GET, key)
    }
    if (isShallow) {
      return res
    }
    if(isObject(res)) {
      return isReadonly ? readonly(res) : reactive(res)
    }
    return res
  }
}
const get = createGetter(false, false)
const shallowGet = createGetter(false, true)
const readonlyGet = createGetter(true, false)
const shallowReadonlyGet = createGetter(true, true)

// 创建一个setter
function createSetter(isShallow = false) {
  return function (target, key, value, receive) {
    const oldValue = target[key] // 获取老值
    // 判断是不属性更新还是属性新增（需要分成两种情况判断数组还是对象）haskey为true则是修改否则为新增
    let hasKey = (isArray(target) &&
      isIntegerKey(key)) ? Number(key) <  target.length : hasOwn(target, key)
    const res = Reflect.set(target, key, value, receive)
    // 触发依赖更新
    if (!hasKey) { //新增
      trigger(target,TriggerOpTypes.ADD, key, value)
    } else if(hasChange(oldValue, value)) { // 修改
      trigger(target,TriggerOpTypes.SET, key, value, oldValue)
    }
    return res
  }
}
const set = createSetter()
const shallowSet = createSetter(true)
// 仅读对象
const readonlyObj = {
  set(target, key, value) {
    console.log(`set on key ${key} is fail, because is readonly`)
  }
}

const mutableHandlers = {
  get,
  set
}
const shallowReactiveHandlers = {
  get: shallowGet,
  set: shallowSet
}
const readonlyHandlers = extend({
  get: readonlyGet,
}, readonlyObj) 

const shallowReadonlyHandlers = extend({
  get: shallowReadonlyGet,
}, readonlyObj)

export {
  mutableHandlers,
  shallowReactiveHandlers,
  readonlyHandlers,
  shallowReadonlyHandlers
}