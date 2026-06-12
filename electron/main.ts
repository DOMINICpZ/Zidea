import { app, BrowserWindow, protocol, BrowserView, ipcMain, Menu, nativeImage } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { initStorage, getPagesByCourse } from './storage';
import { registerIpcHandlers } from './ipcHandlers';

/**
 * Electron 主进程入口模块
 * 负责应用生命周期管理、浏览器窗口创建、存储初始化和 IPC 注册
 */

/**
 * 主窗口实例引用
 */
let mainWindow: BrowserWindow | null = null;

/**
 * BrowserView 实例引用，用于显示外部网页内容
 * 替代 iframe 以支持所有网站（包括设置 X-Frame-Options 的网站）
 */
let contentView: BrowserView | null = null;

/**
 * BrowserView 当前尺寸和位置缓存
 * 用于在显示 BrowserView 时恢复之前的尺寸设置
 */
let contentViewBounds: { x: number; y: number; width: number; height: number } | null = null;

/**
 * 注册应用自定义协议为特权协议
 * 必须在 app.ready 之前同步调用，否则 localStorage 等 Web Storage API 会被拒绝访问
 */
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      allowServiceWorkers: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
  {
    scheme: 'local-page',
    privileges: {
      standard: true,
      secure: true,
      allowServiceWorkers: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

/**
 * 判断当前是否处于开发环境
 * @returns {boolean} 若 NODE_ENV 为 development 或存在 DEBUG 标志则返回 true
 */
function isDev(): boolean {
  return process.env.NODE_ENV === 'development' || !!process.env.DEBUG;
}

/**
 * 创建并配置主窗口
 * 窗口大小固定为 1280x800，根据环境加载不同入口
 * @throws {Error} 当窗口创建失败时可能抛出异常
 */
/**
 * 获取应用图标路径
 * 开发模式从项目根目录 build/ 获取，生产模式从 extraResources 获取
 * @returns {string} 图标文件绝对路径
 */
function getIconPath(): string {
  const iconFile = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
  if (isDev()) {
    // 开发模式：electron/dist/main.js → ../../build/
    return path.join(__dirname, '../../build', iconFile);
  }
  // 生产模式：从 extraResources 获取
  return path.join(process.resourcesPath, 'build', iconFile);
}

function createMainWindow(): void {
  const iconPath = getIconPath();
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    autoHideMenuBar: true,
    icon: nativeImage.createFromPath(iconPath),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
      allowRunningInsecureContent: true,
    },
  });

  // 去除默认菜单栏和工具栏
  mainWindow.setMenuBarVisibility(false);
  mainWindow.setAutoHideMenuBar(true);
  Menu.setApplicationMenu(null);

  if (isDev()) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    // 使用 app:// 协议加载页面，避免 file:// 协议的 CORS 问题
    mainWindow.loadURL('app://./index.html').catch((err) => {
      console.error('Failed to load app:', err);
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 监听窗口大小变化，调整 BrowserView 尺寸
  mainWindow.on('resize', () => {
    if (contentView && mainWindow) {
      const bounds = mainWindow.getContentBounds();
      // 预留底部 80px 空间给工具栏
      const toolbarHeight = 60;
      contentView.setBounds({
        x: 0,
        y: 0,
        width: bounds.width,
        height: Math.max(bounds.height - toolbarHeight, 0),
      });
    }
  });
}

/**
 * 根据文件扩展名获取 MIME 类型
 * @param filePath - 文件路径
 * @returns {string} MIME 类型字符串
 */
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.html': 'text/html',
    '.htm': 'text/html',
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.pdf': 'application/pdf',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.ogg': 'video/ogg',
    '.ogv': 'video/ogg',
    '.mov': 'video/quicktime',
    '.mkv': 'video/x-matroska',

    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'font/otf',
    '.wasm': 'application/wasm',
    '.map': 'application/json',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * 注册应用自定义协议
 * 用于在 Electron 中安全加载本地 HTML 页面及其资源，避免 file:// 协议的 CORS 限制
 */
function registerAppProtocol(): void {
  protocol.handle('app', (request) => {
    const url = new URL(request.url);
    let pathname = url.pathname;

    // 处理默认路径
    if (!pathname || pathname === '/') {
      pathname = '/index.html';
    }

    // 移除开头的斜杠
    pathname = pathname.replace(/^\//, '');

    // 解码 URL 编码的路径（处理空格、中文等）
    pathname = decodeURIComponent(pathname);

    const filePath = path.join(__dirname, '../renderer/dist', pathname);

    // 安全检查：确保文件在渲染器目录内
    const distPath = path.join(__dirname, '../renderer/dist');
    const resolvedPath = path.resolve(filePath);
    const resolvedDistPath = path.resolve(distPath);
    if (!resolvedPath.startsWith(resolvedDistPath)) {
      return new Response('Forbidden', { status: 403 });
    }

    if (!fs.existsSync(filePath)) {
      console.error('File not found:', filePath);
      return new Response('Not Found', { status: 404 });
    }

    try {
      const data = fs.readFileSync(filePath);
      const mimeType = getMimeType(filePath);
      return new Response(data, {
        headers: {
          'Content-Type': mimeType,
        },
      });
    } catch (error) {
      console.error('Error reading file:', filePath, error);
      return new Response('Internal Server Error', { status: 500 });
    }
  });
}

/**
 * 根据文件扩展名判断文件类型
 * @param filePath - 文件路径
 * @returns {string} 文件类型: 'html' | 'image' | 'pdf' | 'video' | 'other'
 */
function getFileType(filePath: string): 'html' | 'image' | 'pdf' | 'video' | 'other' {
  const ext = path.extname(filePath).toLowerCase();
  if (['.html', '.htm'].includes(ext)) return 'html';
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'].includes(ext)) return 'image';
  if (['.pdf'].includes(ext)) return 'pdf';
  if (['.mp4', '.webm', '.ogg', '.ogv', '.mov', '.mkv'].includes(ext)) return 'video';
  return 'other';
}

/**
 * 生成图片预览的 HTML
 * @param fileUrl - 文件 URL
 * @returns {string} HTML 字符串
 */
function generateImageViewerHtml(fileUrl: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 100vw;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #1a1a1a;
      overflow: hidden;
    }
    img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
  </style>
</head>
<body>
  <img src="${fileUrl}" alt="Image">
</body>
</html>`;
}

/**
 * 生成 PDF 预览的 HTML
 * @param fileUrl - 文件 URL
 * @returns {string} HTML 字符串
 */
function generatePdfViewerHtml(fileUrl: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 100vw;
      height: 100vh;
      background: #525659;
      overflow: hidden;
    }
    embed {
      width: 100%;
      height: 100%;
      border: none;
    }
  </style>
</head>
<body>
  <embed src="${fileUrl}" type="application/pdf" width="100%" height="100%">
</body>
</html>`;
}

/**
 * 生成视频预览的 HTML
 * @param fileUrl - 文件 URL
 * @returns {string} HTML 字符串
 */
function generateVideoViewerHtml(fileUrl: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 100vw;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #000;
      overflow: hidden;
    }
    video {
      max-width: 100%;
      max-height: 100%;
    }
  </style>
</head>
<body>
  <video src="${fileUrl}" controls autoplay>
    您的浏览器不支持视频播放
  </video>
</body>
</html>`;
}

/**
 * 注册本地页面自定义协议
 * 用于在 Electron 中安全加载本地 HTML 页面及其资源
 * 文件路径格式: local-page://courseId/pageId/filename
 * 实际存储路径: assets/{courseId}/{pageId}/filename
 */
function registerLocalPageProtocol(): void {
  protocol.handle('local-page', (request) => {
    console.log('local-page request:', request.url);

    // 手动解析 URL，因为 new URL() 对非标准协议的处理可能不一致
    // URL 格式: local-page://courseId/pageId/filename
    const urlString = request.url;
    const protocolPrefix = 'local-page://';

    if (!urlString.startsWith(protocolPrefix)) {
      console.error('local-page: Invalid protocol');
      return new Response('Bad Request', { status: 400 });
    }

    // 提取路径部分（去掉协议前缀）
    const pathPart = urlString.substring(protocolPrefix.length);
    // 去掉可能的查询参数和哈希
    const pathWithoutQuery = pathPart.split('?')[0].split('#')[0];
    // 统一使用正斜杠作为分隔符（处理 Windows 路径）
    const normalizedPath = pathWithoutQuery.replace(/\\/g, '/');
    // 去掉开头的斜杠（如果有）
    const cleanPath = normalizedPath.replace(/^\//, '');

    const parts = cleanPath.split('/').filter(Boolean);

    console.log('local-page pathPart:', pathPart);
    console.log('local-page cleanPath:', cleanPath);
    console.log('local-page parts:', parts);

    if (parts.length < 2) {
      console.error('local-page: Bad Request, parts.length < 2');
      return new Response('Bad Request', { status: 400 });
    }

    const courseId = parts[0];
    const pageId = parts[1];
    // 支持子目录资源文件，如 css/style.css、js/app.js、assets/image.png
    const fileName = parts.slice(2).join('/') || 'index.html';

    console.log('local-page courseId:', courseId, 'pageId:', pageId, 'fileName:', fileName);

    const { getConfig } = require('./storage');
    const config = getConfig();

    // 构建文件路径: assets/{courseId}/{pageId}/filename
    // 直接使用 pageId，不需要再查找页面
    const filePath = path.join(config.assetsDir, courseId, pageId, fileName);

    console.log('local-page filePath:', filePath);
    console.log('local-page assetsDir:', config.assetsDir);
    console.log('local-page file exists:', fs.existsSync(filePath));

    if (!fs.existsSync(filePath)) {
      console.error('local-page: File not found:', filePath);
      // 列出目录内容以便调试
      const pageDir = path.join(config.assetsDir, courseId, pageId);
      console.log('local-page: Checking pageDir:', pageDir);
      if (fs.existsSync(pageDir)) {
        console.log('local-page: PageDir exists, contents:', fs.readdirSync(pageDir));
      } else {
        console.log('local-page: PageDir does not exist');
        // 检查 courseDir
        const courseDir = path.join(config.assetsDir, courseId);
        console.log('local-page: Checking courseDir:', courseDir);
        if (fs.existsSync(courseDir)) {
          console.log('local-page: CourseDir exists, contents:', fs.readdirSync(courseDir));
        } else {
          console.log('local-page: CourseDir does not exist');
        }
      }
      return new Response('Not Found', { status: 404 });
    }

    try {
      const fileType = getFileType(filePath);
      
      // 对于 HTML 文件，直接返回文件内容
      if (fileType === 'html') {
        const data = fs.readFileSync(filePath);
        const mimeType = getMimeType(filePath);
        console.log('local-page: Serving HTML file:', filePath, 'mimeType:', mimeType, 'size:', data.length);
        return new Response(data, {
          headers: {
            'Content-Type': mimeType,
          },
        });
      }
      
      // 对于其他类型文件，生成对应的 HTML 查看器
      // 构建原始文件的 local-page URL
      const rawFileUrl = `local-page://${courseId}/${pageId}/${fileName}`;

      let viewerHtml: string;
      switch (fileType) {
        case 'image':
          viewerHtml = generateImageViewerHtml(rawFileUrl);
          break;
        case 'pdf':
          viewerHtml = generatePdfViewerHtml(rawFileUrl);
          break;
        case 'video':
          viewerHtml = generateVideoViewerHtml(rawFileUrl);
          break;
        default:
          // 其他类型直接返回文件
          const data = fs.readFileSync(filePath);
          const mimeType = getMimeType(filePath);
          return new Response(data, {
            headers: {
              'Content-Type': mimeType,
            },
          });
      }
      
      console.log('local-page: Serving viewer HTML for:', filePath, 'type:', fileType);
      return new Response(viewerHtml, {
        headers: {
          'Content-Type': 'text/html',
        },
      });
    } catch (error) {
      console.error('Error reading file:', filePath, error);
      return new Response('Internal Server Error', { status: 500 });
    }
  });
}

/**
 * 注册 BrowserView 相关的 IPC 处理器
 * 用于在播放器中显示外部网页，替代 iframe 以绕过 X-Frame-Options 限制
 */
function registerBrowserViewHandlers(): void {
  /**
   * 创建或更新 BrowserView 并加载指定内容
   * @param event - IPC 事件对象
   * @param options - 加载选项 { url?: string, filePath?: string, type?: 'url' | 'file' }
   */
  ipcMain.handle('player:createBrowserView', (event, options: { url?: string; filePath?: string; type?: 'url' | 'file' }) => {
    if (!mainWindow) {
      console.error('Main window is not available');
      return;
    }

    // 如果已存在 BrowserView，先销毁
    if (contentView) {
      mainWindow.removeBrowserView(contentView);
      (contentView.webContents as any).destroy();
      contentView = null;
    }

    // 创建新的 BrowserView
    contentView = new BrowserView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false,
        allowRunningInsecureContent: true,
      },
    });

    // 忽略 HTTPS 证书错误，允许访问自签名证书网站
    contentView.webContents.on('certificate-error', (event, url, error, certificate, callback) => {
      event.preventDefault();
      callback(true);
    });

    const bounds = mainWindow.getContentBounds();
    // 预留底部 80px 空间给工具栏（40px 工具栏 + 20px 边距 + 一些余量）
    const toolbarHeight = 60;
    contentView.setBounds({
      x: 0,
      y: 0,
      width: bounds.width,
      height: Math.max(bounds.height - toolbarHeight, 0),
    });

    // 设置自动调整大小
    contentView.setAutoResize({
      width: true,
      height: true,
      horizontal: false,
      vertical: false,
    });

    mainWindow.addBrowserView(contentView);

    // 根据类型加载内容
    if (options.type === 'file' && options.filePath) {
      // 直接加载本地文件
      console.log('BrowserView loading file:', options.filePath);
      contentView.webContents.loadFile(options.filePath).catch((err) => {
        console.error('Failed to load file in BrowserView:', err);
      });
    } else if (options.url) {
      // 加载 URL
      console.log('BrowserView loading URL:', options.url);
      contentView.webContents.loadURL(options.url).catch((err) => {
        console.error('Failed to load URL in BrowserView:', err);
      });
    }
  });

  /**
   * 销毁 BrowserView
   */
  ipcMain.handle('player:destroyBrowserView', () => {
    if (contentView && mainWindow) {
      mainWindow.removeBrowserView(contentView);
      (contentView.webContents as any).destroy();
      contentView = null;
    }
  });

  /**
   * 显示 BrowserView（添加到窗口）
   * 使用之前缓存的尺寸和位置，保持预览区域固定
   */
  ipcMain.handle('player:showBrowserView', () => {
    if (contentView && mainWindow) {
      mainWindow.addBrowserView(contentView);
      // 如果有缓存的尺寸，使用缓存的尺寸；否则使用默认全窗口尺寸
      if (contentViewBounds) {
        contentView.setBounds(contentViewBounds);
      } else {
        const bounds = mainWindow.getContentBounds();
        // 预留底部 80px 空间给工具栏
        const toolbarHeight = 60;
        contentView.setBounds({
          x: 0,
          y: 0,
          width: bounds.width,
          height: Math.max(bounds.height - toolbarHeight, 0),
        });
      }
    }
  });

  /**
   * 隐藏 BrowserView（从窗口移除）
   */
  ipcMain.handle('player:hideBrowserView', () => {
    if (contentView && mainWindow) {
      mainWindow.removeBrowserView(contentView);
    }
  });

  /**
   * 调整 BrowserView 尺寸
   * @param event - IPC 事件对象
   * @param bounds - 新的位置和尺寸（相对于窗口内容区域的坐标）
   */
  ipcMain.handle('player:resizeBrowserView', (event, bounds: { x: number; y: number; width: number; height: number }) => {
    if (contentView && mainWindow) {
      // 获取窗口的内容区域边界（相对于屏幕）
      const windowContentBounds = mainWindow.getContentBounds();
      const windowBounds = mainWindow.getBounds();

      // 计算窗口边框和标题栏的高度差
      const frameHeight = windowBounds.height - windowContentBounds.height;
      const frameWidth = windowBounds.width - windowContentBounds.width;

      // bounds 是相对于窗口内容区域的坐标
      // 需要转换为相对于屏幕的坐标，然后再转换为 BrowserView 的相对坐标
      const actualBounds = {
        x: Math.max(0, bounds.x),
        y: Math.max(0, bounds.y),
        width: Math.max(0, Math.min(bounds.width, windowContentBounds.width - bounds.x)),
        height: Math.max(0, Math.min(bounds.height, windowContentBounds.height - bounds.y)),
      };

      // 缓存当前尺寸，用于显示时恢复
      contentViewBounds = actualBounds;

      console.log('resizeBrowserView:', { bounds, actualBounds, windowContentBounds });
      contentView.setBounds(actualBounds);
    }
  });
}

/**
 * 获取数据存储目录路径
 * 优先使用应用可执行文件所在目录下的 data 文件夹
 * 在开发模式下使用项目根目录下的 data 文件夹
 * @returns {string} 数据存储目录绝对路径
 */
function getDataDirectory(): string {
  // 判断是否为开发模式
  const isDev = !app.isPackaged;

  if (isDev) {
    // 开发模式下使用项目根目录下的 data 文件夹
    // 使用 process.cwd() 获取当前工作目录（应该是项目根目录）
    return path.join(process.cwd(), 'data');
  }

  // 生产模式下使用应用可执行文件所在目录
  const exePath = app.getPath('exe');
  const exeDir = path.dirname(exePath);
  return path.join(exeDir, 'data');
}

/**
 * 应用就绪后初始化存储、注册 IPC、注册协议并创建主窗口
 */
app.whenReady().then(() => {
  // 初始化数据存储目录（使用应用可执行文件所在目录下的 data 文件夹）
  const dataPath = getDataDirectory();
  initStorage(dataPath);

  // 注册 IPC 事件处理器
  registerIpcHandlers();

  // 注册 BrowserView 相关的 IPC 处理器
  registerBrowserViewHandlers();

  // 注册应用协议（必须在创建窗口之前）
  registerAppProtocol();

  // 注册本地页面协议
  registerLocalPageProtocol();

  createMainWindow();

  app.on('activate', () => {
    if (mainWindow === null) {
      createMainWindow();
    }
  });
});

/**
 * 所有窗口关闭后退出应用（Windows/Linux 行为）
 */
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
