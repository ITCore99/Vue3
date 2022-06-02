import { isFunction } from "@vue/shared"
import { effect } from './'
import { track, trigger } from "./effect"
import { TrackOpTypes, TriggerOpTypes } from "./operators"
/**
 * computed 默认不执行 只有调用才会执行
 * 存在缓存 依赖的值不发生变化不执行 使用缓存
 * 当依赖的值发生了变化 不会立即执行 而是当下一次获取的时候在执行
 * 我们发现computed的值 使用的时候是可以.value的所以 应该是ref
 */

class ComputedRefImpl {
  public _dirty = true // 缓存标识 默认为true即取值时不要使用缓存
  public _value 
  public effect
  constructor(getter, public setter) {
    // 计算属性默认产生一个effect使用effect来进行收集依赖
    this.effect = effect(getter, { 
      lazy: true, // 计算属性默认不执行
      scheduler: (effect) => { // 属性用于当computed所依赖的变量发生变化的时候将dirty设置为true
        if (!this._dirty) {
          this._dirty = true
          trigger(this, TriggerOpTypes.SET, 'value') // 当有computed 有依赖的话去更新
        }
      } 
    })
  }
  // 取值
  get value() { // 需要注意计算属性也要收集依赖(这里收集是getter中的属性的依赖)
    if (this._dirty) { // 只有脏的的时候才执行否则将缓存下来的老值进行返回
      this._value = this.effect()
      this._dirty = false
    }
    track(this, TrackOpTypes.GET, 'value') // 有可能在effect中使用computed所以也要收集自己的依赖
    return this._value
  }
  // 设置值
  set value(newValue) {
    this.setter(newValue) // 如果用户传递了set方法 会调用用户set方法
  }
 }

function computed(getterOrOptions) { // 注意这里的参数可能出现两种情况 一种是getter 一种是对象: { set() {}, get() {} }
  let getter
  let setter
  if(isFunction(getterOrOptions)) {
    getter = getterOrOptions
    setter = () => {
      console.warn('computed value must be is readOnly')
    }
  } else {
    getter = getterOrOptions.get
    setter = getterOrOptions.set
  }
  return new ComputedRefImpl(getter, setter)
}



export {
  computed
}
