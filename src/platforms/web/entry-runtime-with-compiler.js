/* @flow */

import config from "core/config";
import { warn, cached } from "core/util/index";
import { mark, measure } from "core/util/perf";

// 导入运行时的Vue
import Vue from "./runtime/index";
import { query } from "./util/index";
// 从./complier/index.js文件导入compileToFunctions
import { compileToFunctions } from "./compiler/index";
import {
  shouldDecodeNewlines,
  shouldDecodeNewlinesForHref,
} from "./util/compat";

// 根据id获取元素的innerHTML
// * cache函数：为一个纯函数创建一个缓存版本的函数，利用缓存避免重复求值，提升性能
const idToTemplate = cached((id) => {
  const el = query(id);
  return el && el.innerHTML;
});

// 使用mount变量缓存Vue.prototype.$mount方法
const mount = Vue.prototype.$mount;
// ! 重写Vue.prototype.$mount方法，保留了运行时$mount的功能，在此基础上为$mount函数添加了编译模板的能力
Vue.prototype.$mount = function (
  el?: string | Element,
  hydrating?: boolean
): Component {
  el = el && query(el);

  /* istanbul ignore if */
  // * 如果是body标签或html标签会警告，因为body和html标签不能被替换
  if (el === document.body || el === document.documentElement) {
    process.env.NODE_ENV !== "production" &&
      warn(
        `Do not mount Vue to <html> or <body> - mount to normal elements instead.`
      );
    return this;
  }

  const options = this.$options;
  // resolve template/el and convert to render function
  if (!options.render) {
    // ! 不包含渲染函数，使用template或el选项构建渲染函数
    let template = options.template;
    if (template) {
      // ? template存在的话
      if (typeof template === "string") {
        if (template.charAt(0) === "#") {
          // ? 将template作为css选择符去选中对应的元素
          // * 根据id获取innerHTML
          template = idToTemplate(template);
          /* istanbul ignore if */
          if (process.env.NODE_ENV !== "production" && !template) {
            warn(
              `Template element not found or is empty: ${options.template}`,
              this
            );
          }
        }
      } else if (template.nodeType) {
        // todo template是元素节点，使用该元素的innerHTML作为模板
        template = template.innerHTML;
      } else {
        // todo 既不是字符串也不是元素节点则非生产环境提示开发者传递的template无效
        if (process.env.NODE_ENV !== "production") {
          warn("invalid template option:" + template, this);
        }
        return this;
      }
    } else if (el) {
      // * 如果template不存在的话，直接使用el元素的outerHTML作为模板内容
      template = getOuterHTML(el);
    }
    if (template) {
      /* istanbul ignore if */
      if (process.env.NODE_ENV !== "production" && config.performance && mark) {
        mark("compile");
      }

      // ? 使用compileToFunctions函数将模板（template）字符串编译为渲染函数（render），并将渲染函数添加到vm.$options选项中
      const { render, staticRenderFns } = compileToFunctions(
        template,
        {
          outputSourceRange: process.env.NODE_ENV !== "production",
          shouldDecodeNewlines,
          shouldDecodeNewlinesForHref,
          delimiters: options.delimiters,
          comments: options.comments,
        },
        this
      );
      options.render = render;
      options.staticRenderFns = staticRenderFns;

      /* istanbul ignore if */
      if (process.env.NODE_ENV !== "production" && config.performance && mark) {
        mark("compile end");
        // ? 计算性能
        measure(`vue ${this._name} compile`, "compile", "compile end");
      }
    }
  }
  // * 如果存在render函数直接调用运行版的mount函数
  return mount.call(this, el, hydrating);
};

/**
 * Get outerHTML of elements, taking care
 * of SVG elements in IE as well.
 * 获取元素的outerHTML
 */
function getOuterHTML(el: Element): string {
  if (el.outerHTML) {
    return el.outerHTML;
  } else {
    const container = document.createElement("div");
    container.appendChild(el.cloneNode(true));
    return container.innerHTML;
  }
}

// 在Vue上添加一个全局API `Vue.compile` 其值为上面导入的compileToFunctions
Vue.compile = compileToFunctions;

// 导出Vue
export default Vue;
