/* @flow */

// 该文件的作用是对Vue进行平台化地包装
/**
 * 设置平台化的Vue.config
 * 在Vue.options上混合了两个指令（directives）分别是：model和show
 * 在Vue.options上混合了两个组件（components）分别是Transition、TransitionGroup
 * 在Vue.options上添加了两个方法：__patch__，$mount
 */

import Vue from "core/index";
import config from "core/config";
import { extend, noop } from "shared/util";
import { mountComponent } from "core/instance/lifecycle";
import { devtools, inBrowser } from "core/util/index";

import {
  query,
  mustUseProp,
  isReservedTag,
  isReservedAttr,
  getTagNamespace,
  isUnknownElement,
} from "web/util/index";

import { patch } from "./patch";
import platformDirectives from "./directives/index";
import platformComponents from "./components/index";

// install platform specific utils
// 覆盖默认导出的 config 对象的属性，安装平台特定的工具方法
Vue.config.mustUseProp = mustUseProp;
Vue.config.isReservedTag = isReservedTag;
Vue.config.isReservedAttr = isReservedAttr;
Vue.config.getTagNamespace = getTagNamespace;
Vue.config.isUnknownElement = isUnknownElement;

// install platform runtime directives & components
// 安装特定平台运行时的指令和组件
// 作用：在Vue.options上添加web平台运行时的特定组件和指令
extend(Vue.options.directives, platformDirectives);
extend(Vue.options.components, platformComponents);

// install platform patch function
// 如果是浏览器运行环境，则值为patch函数，否则是一个空函数noop
Vue.prototype.__patch__ = inBrowser ? patch : noop;

// public mount method
// 添加$mount方法
/**
 * 
 * @param {* 可以是一个字符串也可以是一个DOM元素} el 
 * @param {* 用于Virtual DOM的补丁算法} hydrating 
 * @returns 
 */
Vue.prototype.$mount = function (
  el?: string | Element,
  hydrating?: boolean
): Component {
  // ? 判断是否为浏览器环境；query函数：用于根据给定的参数在DOM中查找对应的元素并返回  document.querySelector(el)实现
  el = el && inBrowser ? query(el) : undefined;
  // * 完成真正的挂载工作
  return mountComponent(this, el, hydrating);
};

// devtools global hook
/* istanbul ignore next */
// vue-devtools的全局钩子
if (inBrowser) {
  setTimeout(() => {
    if (config.devtools) {
      if (devtools) {
        devtools.emit("init", Vue);
      } else if (
        process.env.NODE_ENV !== "production" &&
        process.env.NODE_ENV !== "test"
      ) {
        console[console.info ? "info" : "log"](
          "Download the Vue Devtools extension for a better development experience:\n" +
            "https://github.com/vuejs/vue-devtools"
        );
      }
    }
    if (
      process.env.NODE_ENV !== "production" &&
      process.env.NODE_ENV !== "test" &&
      config.productionTip !== false &&
      typeof console !== "undefined"
    ) {
      console[console.info ? "info" : "log"](
        `You are running Vue in development mode.\n` +
          `Make sure to turn on production mode when deploying for production.\n` +
          `See more tips at https://vuejs.org/guide/deployment.html`
      );
    }
  }, 0);
}

// 导出Vue
export default Vue;
