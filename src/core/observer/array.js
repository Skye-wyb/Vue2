/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 */

import { def } from '../util/index'

const arrayProto = Array.prototype
export const arrayMethods = Object.create(arrayProto)

const methodsToPatch = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]

/**
 * Intercept mutating methods and emit events
 */
methodsToPatch.forEach(function (method) {
  // cache original method
  // 缓存原本的变异方法
  const original = arrayProto[method];
  // ? 使用def函数在arrayMethods对象上定义与数组变异方法同名的函数，从而做到拦截的目的
  def(arrayMethods, method, function mutator(...args) {
    // 调用缓存下来的数组变异方法
    const result = original.apply(this, args);
    // ! 取出所有的依赖
    const ob = this.__ob__;
    let inserted;
    switch (method) {
      /**
       * * 新增加的元素是非响应式的，需要获取这些新元素，并将其变为响应式数据
       */
      case "push":
      case "unshift":
        inserted = args;
        break;
      case "splice":
        // ? splice函数从第三个参数开始就是新增的元素
        inserted = args.slice(2);
        break;
    }
    // ? 调用ob.observeArray()函数对新加入的元素进行观测
    if (inserted) ob.observeArray(inserted);
    // notify change
    // ! 当调用了数组变异方法时，必然修改了数组，需要将该数组的所有依赖（观察者）全部拿出来执行
    ob.dep.notify();
    return result;
  });
})
