/* @flow */

import { mergeOptions } from '../util/index'

// initMixin方法的作用：在Vue上添加mixin这个全局API
export function initMixin (Vue: GlobalAPI) {
  Vue.mixin = function (mixin: Object) {
    this.options = mergeOptions(this.options, mixin)
    return this
  }
}
