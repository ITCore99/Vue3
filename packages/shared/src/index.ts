/**
 * 共享的方法
 */
const isObject = (value) => typeof value === 'object' && value !== null
const extend = Object.assign
const isArray = (value) => Array.isArray(value)
const isFunction = value => typeof value  === 'function'
const isNumber = value => typeof value === 'number'
const isString = value => typeof value === 'string'
// 是不是一个整形的key 
const isIntegerKey = value => parseInt(value) + '' === value
const hasOwnProperty = Object.prototype.hasOwnProperty
const hasOwn = (target, key) => hasOwnProperty.call(target, key)
const hasChange = (oldValue, newValue) => oldValue !== newValue

export {
  isObject,
  extend,
  isArray,
  isFunction,
  isNumber,
  isString,
  isIntegerKey,
  hasOwn,
  hasChange
}
export * from './shapeFlag'