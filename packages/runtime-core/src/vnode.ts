// 创建虚拟节点的核心

import { isArray, isObject, isString, ShapeFlags } from "@vue/shared";

// h函数就是创建虚拟节点 h方法与此方法类似 h('div', { style: {color: '#f00'}, hello world})
export const createVNode = function(type, props, children = null) { // type 可能是个字符串也可能是个组件对象 chidren要么是字符串要么是数组
  // 可以根据type来进行判断是组件还是元素
  const shapeFlag = isString(type) ?
    ShapeFlags.ELEMENT : isObject(type) ? 
      ShapeFlags.STATEFUL_COMPONENT : 0 
  const vnode = { // 虚拟节点就是一个对象 用来描述对应的内容 虚拟节点具有跨平台的能力
    __v_isVnode: true, // 标识是不是一个虚拟节点
    type,
    props,
    children,
    key: props && props.key, // 后期做diff算法用到 
    el: null, // 虚拟节点和真实节点对应
    shapeFlag,
    componet: null, // 用来存放组件的实例
  } 
  // 对孩子类型进行处理
  normalizeChild(vnode, children)
  return vnode
}

function normalizeChild(vnode, children) {
  let  type = vnode.type
  if (children === null) { // 不进行处理
  } else if(isArray(children)){ // 孩子是数组
    type = ShapeFlags.ARRAY_CHILDREN  
  } else { // 不考虑插槽 这里就是文本孩子
    type = ShapeFlags.TEXT_CHILDREN
  }
  vnode.shapeFlag = vnode.shapeFlag | type
}

export const isVNode = val => val.__v_isVnode

export const TEXT = Symbol('text')
// 对于孩子是文本的进行处理成虚拟节点
export  function normalizeVNode(child) {
  if(isObject(child)) { // 说明是h方法创建的vnode的节点不用处理
    return child
  } else if (isString(child)) {
    return createVNode(TEXT, null, String(child))
  }
} 