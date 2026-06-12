import { contextBridge, ipcRenderer } from 'electron';

/**
 * Electron 预加载脚本
 * 通过 contextBridge 向渲染进程暴露安全的 IPC API
 * 避免直接暴露完整的 ipcRenderer，防止渲染进程滥用 Node/Electron 能力
 */

/**
 * 暴露给渲染进程的全局 API 对象
 * 挂载在 window.electronAPI 上
 */
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * 调用主进程暴露的 IPC 通道（invoke/handle 模式）
   * @param {string} channel - IPC 通道名称
   * @param {...any[]} args - 传递给主进程的参数列表
   * @returns {Promise<any>} 返回主进程 handle 的响应结果
   * @throws {Error} 当主进程处理异常或通道未注册时抛出
   */
  invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),

  /**
   * 监听主进程日志，在 DevTools Console 中显示
   */
  onMainLog: (callback: (level: string, ...args: any[]) => void) => {
    ipcRenderer.on('main:log', (_event, level, ...args) => {
      callback(level, ...args);
    });
  },
});
