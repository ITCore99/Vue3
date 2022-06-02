import { isArray, isObject, isString, ShapeFlags } from "@vue/shared"
import { createVNode, isVNode } from "./vnode"

// h 函数创建虚拟节点
export const h = function(type, propsOrChildren , children = null) { // type 可能是个字符串也可能是个组件对象
  const l = arguments.length
  if(l === 2) { // 类型 + 属性 或者是 类型 + 孩子
    if(isObject(propsOrChildren) && !isArray(propsOrChildren)) {
      if(isVNode(propsOrChildren)) { // 是虚拟节点 则是孩子
        return createVNode(type, null, [propsOrChildren])
      } else { // 是属性
        return createVNode(type, propsOrChildren)
      }
    } else {  // 第二个参数不是对象一定是孩子
      return createVNode(type, null, propsOrChildren)
    }
  } else {
    if(l > 3) {
      children = Array.prototype.slice.call(null, 2)
    } else if (l === 3 && isVNode(children)) {
      children = [children]
    }
    return createVNode(type, propsOrChildren, children)
  }
}
