import { hasChange, isArray, isObject } from "@vue/shared"
import { reactive } from "."
import { track, trigger } from "./effect"
import { TrackOpTypes, TriggerOpTypes } from "./operators"

function ref(value) { // 需要对传入的值进行一层包装
  return createRef(value)
}
function shallowRef(value) {
  return createRef(value, true)
}

const convert = val => isObject(val) ? reactive(val) : val
class RefImpl  {
  public _value // 表示声明了没赋值
  public __v_isRef = true // 产生的实例会被添加这个属性 表示是一个ref
  constructor(public rawValue, public isShallow) { // 参数前面添加修饰时符 表示此属性需要添加到实例上
    this._value = isShallow ? rawValue : convert(rawValue)
  } 
  // 使用类的属性访问器 (这里通过babel转义之后就是es5的defineProperty)
  get value() { // 获取值的时候进行依赖收集
    track(this, TrackOpTypes.GET, 'value')
    return this._value
  }
  set value(newValue) { // 设置值的时候进行触发更新
    if (hasChange(newValue, this.rawValue)) {
      this.rawValue = newValue
      this._value =  this.isShallow ? newValue : convert(newValue)
      trigger(this, TriggerOpTypes.SET, 'value', newValue)
    }
  }
}

// 创建一个ref
function createRef(rawValue, isShallow = false) {
  return new RefImpl(rawValue, isShallow)
}

// 注意由官方文档结果来 并不是RefImpl类的实例 而是这个新类的实例 所以toRef和Ref基本是没有任何关系
class ObjectRefImpl { 
  public __v_isRef = true // 标识是一个ref
  constructor(public taget, public key) {}
  get value() {
    // 注意这里没有响应式 对象是响应式的 代理之后就是响应式的 对象不是响应式的代理之后就不是响应式的
    // 因为这个对象已经是响应式的了 我们通过get和set也是对对象进行修改所以对象的相关依赖和收集和触发 所以这里不需要添加. 只要一層的代理
    return this.taget[this.key]
  }
  set value(newValue) {
    this.taget[this.key] = newValue
  }
}

// 可以将一个对象的属性变为ref 返回一个ref
function toRef(target, key) {
   return new ObjectRefImpl(target, key)
}

// 将一个对象的所有属性都转化为ref
function toRefs(target) { // 需要注意这里target 需要考虑两种情况 一种是对象 一种是数组
  const res = isArray(target) ? new Array(target.length) : {}
  const keys = Object.keys(target)
  keys.forEach(key => {
    res[key] = toRef(target, key)
  })
  return res
}
export {
  ref,
  shallowRef,
  toRef,
  toRefs
}