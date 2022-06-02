/**
 * 只针对生产环境打包配置 (就是packages下的所有的包进行打包)
 */
const fs = require('fs')
const execa = require("execa")// 开启子进程进行打包 最终调用rollup进行打包
const path = require('path')
const resolve = path.resolve



// 读取所有packages目录下面的所有包
const targets = fs.readdirSync('packages')
  .filter(fileName => {
    if(fileName === '.DS_Store') return false
    // 判断文件状态是不是文件
    const isDir = fs.statSync(resolve(__dirname, `../packages/${fileName}`)).isDirectory()
    if (!isDir) {
      return false
    } 
    return true
  })
// 对目标进行依次的打包 并行的打包

// 打包函数
const build = async (target) => {
  // rollup -c --environment TARGET:xxx (TARGET是环境变量名 可以随意起)
  await execa('rollup', ['-c', '--environment', `TARGET:${target}`], {
    stdio: 'inherit' // 子进程打包的信息共享给父进程
  }) // 执行rollup 命令 后面的数组时命令的配置
}
// 处理并行打包
const runParallel = (targets, iteratorFn) => {
  const results = []
  for(let item of targets) {
    const p = iteratorFn(item)
    results.push(p)
  }
  return Promise.all(results)
}

runParallel(targets, build).then(() => {
  console.log('所有包都打包完毕了')
})