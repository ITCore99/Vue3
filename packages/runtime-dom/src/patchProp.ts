// 这里是针对属性操作 是一系列的属性操作
import { patchAttr } from './modules/attr'
import { patchClass } from './modules/class'
import { patchEvent } from './modules/event'
import { patchStyle } from './modules/style'

export const patchProp = (el, key, prevValue, nextValue) => {
  switch(key) {
    case 'class':
      patchClass(el, nextValue) // 使用最新的将之前的覆盖掉
      break
    case 'style':
      patchStyle(el, prevValue, nextValue)
      break
    default:
      // 如果不是事件才是属性
      if (/^on[^a-z]/.test(key)) { // 判断是不是事件 事件写法onClick
        patchEvent(el, key,  nextValue)
      } else {
        patchAttr(el, key, nextValue) // 这里调用的方式不是和2.0那样是需要attr包裹而是直接写所以直接赋值即可
      }
      break
  }
}