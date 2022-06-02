export const nodeOps = {
  // createElement 不同的平台创建的方式不一样 这里我们先不考虑 只用管浏览器的就行
  createElement(tagName: string): HTMLElement {
    return  document.createElement(tagName)
  },
  // 删除元素
  remove(el: HTMLElement) {
    const parent = el.parentNode
    if(parent) {
      parent.removeChild(el)
    }
  },
  // 元素的插入
  insert(el: HTMLElement, parent: HTMLElement , anchor: HTMLElement | null = null) {
    parent.insertBefore(el, anchor) // 如果参照物为null的话 等同于appendChild
  },
  // 查询
  querySelector(selector:string) {
    return document.querySelector(selector)
  },
  // 设置元素内容
  setElementText(el: HTMLElement, text) {
    el.textContent = text
  },
  // 创建文本
  createText(text) {
    return document.createTextNode(text)
  },
  // 设置文本内容
  setText(node: Node, text: string) {
    node.nodeValue = text
  },
  // 获取下一个兄弟节点
  nextSibling(el: Node) {
    return el.nextSibling
  }
}