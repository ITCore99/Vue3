/**
 * 只针对开发环境中的某个包进行打包 配置
 */
 const execa = require("execa")// 开启子进程进行打包 最终调用rollup进行打包
 // 打包函数
 const build = async (target) => {
   // rollup -c --environment TARGET:xxx (TARGET是环境变量名 可以随意起)
   await execa('rollup', ['-cw', '--environment', `TARGET:${target}`], {
     stdio: 'inherit' // 子进程打包的信息共享给父进程
   }) // 执行rollup 命令 后面的数组时命令的配置
 }

// 需要打包的包名称
const target = 'runtime-dom'
build(target)