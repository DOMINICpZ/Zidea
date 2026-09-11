/// <reference lib="dom" />
import { ipcRenderer } from 'electron';

/**
 * 内容区（BrowserView）预加载脚本
 * 作用：追踪内容区当前聚焦元素是否为可编辑输入框（input/textarea/select/contenteditable），
 * 并将状态实时同步给主进程。主进程据此决定是否拦截快捷键，
 * 避免与第三方网页内的文字输入（方向键、空格、E、Tab等）产生冲突。
 */

/**
 * 计算当前聚焦元素是否可编辑，并将结果发送给主进程
 * @returns {void}
 */
function updateEditableState(): void {
  const el = document.activeElement as HTMLElement | null;
  const editable = !!el && (
    el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    el.tagName === 'SELECT' ||
    el.isContentEditable
  );
  ipcRenderer.send('player:content-editable', editable);
}

/**
 * 挂载焦点监听并初始化状态
 * @returns {void}
 */
function init(): void {
  document.addEventListener('focusin', updateEditableState);
  document.addEventListener('focusout', updateEditableState);
  updateEditableState();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
