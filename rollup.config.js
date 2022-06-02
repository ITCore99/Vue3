/**
 * rollup 配置
 * 根据环境变量中文件名
 */
import path from 'path'
import json from '@rollup/plugin-json'
import nodeResolve  from '@rollup/plugin-node-resolve' // 解析第三方node模块插件
import ts from 'rollup-plugin-typescript2'

// 获取packages 文件路径
const packagesDir = path.resolve(__dirname, 'packages')
// 获取具体某个包的路）
const packageDir = path.resolve(packagesDir, process.env.TARGET)
const resolve = (p) => path.resolve(packageDir, p)

// 获取package.json文件 (json文件可以直接通过require导入)
const pkj = require(resolve('package.json'))
// 取文件名
const name = path.basename(packageDir)

// 先对打包的类型做一个映射表 再根据formats中的打包类型 来进行处理打包
const outputConfig = {
  'esm-bundler': {
    file: resolve(`dist/${name}.esm-bundler.js`),
    format: 'es'
  },
  'cjs': {
    file: resolve(`dist/${name}.cjs.js`),
    format: 'cjs'
  },
  'global': {
    file: resolve(`dist/${name}.global.js`),
    format: 'iife' // 这里也可以使用umd vue3中使用的iife 立即执行函数
  }
}
const options = pkj.buildOptions
// 生成打包的配置
function createConfig(output) {
  output.name = options.name // global格式中的全局配置的名称
  output.sourcemap = true // 生层sourcemap文件

  // 生成rollup配置
  return {
    // 入口文件
    input:  resolve('src/index.ts'),
    // 出口文件
    output,
    // 创建有顺序 从上到下依次执行
    plugins: [
      json(),
      ts({
        tsconfig: path.resolve(__dirname, 'tsconfig.json')
      }),
      nodeResolve()
    ]
  }
}


// rollup 最终要导出一个配置变量
export default options.formats.map(format => createConfig(outputConfig[format]))

