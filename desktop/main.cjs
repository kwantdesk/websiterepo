const { app, BrowserWindow, Menu, session, shell, screen } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const APP_URL = "https://www.kwantdesk.com/charts";
const APP_ORIGIN = "https://www.kwantdesk.com";
const ICON_PATH = path.join(__dirname, "..", "public", "icons", "kwantdesk-app.ico");
const TITLE_BAR_HEIGHT = 30;
const TITLE_BAR_COLOR = "#303238";
const TITLE_BAR_SYMBOL_COLOR = "#d5d7da";

const desktopWindowChrome = {
  titleBarStyle: "hidden",
  titleBarOverlay: {
    color: TITLE_BAR_COLOR,
    symbolColor: TITLE_BAR_SYMBOL_COLOR,
    height: TITLE_BAR_HEIGHT,
  },
};

function reserveDesktopTitleBar(webContents) {
  webContents.on("dom-ready", () => {
    void webContents.insertCSS(`
      html { --kwantdesk-desktop-titlebar-height: ${TITLE_BAR_HEIGHT}px; }
      body {
        box-sizing: border-box !important;
        padding-top: var(--kwantdesk-desktop-titlebar-height) !important;
      }
    `);
  });
}

app.setName("KwantDesk");
app.setAppUserModelId("com.kwantdesk.desktop");

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) app.quit();

let mainWindow = null;

function statePath() {
  return path.join(app.getPath("userData"), "window-state.json");
}

function readWindowState() {
  try {
    const stored = JSON.parse(fs.readFileSync(statePath(), "utf8"));
    if ([stored.x, stored.y, stored.width, stored.height].every(Number.isFinite)) return stored;
  } catch {}
  const area = screen.getPrimaryDisplay().workArea;
  return {
    x: area.x + Math.round(area.width * 0.04),
    y: area.y + Math.round(area.height * 0.04),
    width: Math.round(area.width * 0.92),
    height: Math.round(area.height * 0.92),
    maximized: true,
  };
}

function saveWindowState(window) {
  if (window.isDestroyed()) return;
  const bounds = window.isMaximized() ? window.getNormalBounds() : window.getBounds();
  fs.writeFileSync(
    statePath(),
    JSON.stringify({ ...bounds, maximized: window.isMaximized() }),
  );
}

function isTrustedPermissionOrigin(url) {
  try {
    return new URL(url).origin === APP_ORIGIN;
  } catch {
    return false;
  }
}

async function createMainWindow() {
  const saved = readWindowState();
  const window = new BrowserWindow({
    ...saved,
    ...desktopWindowChrome,
    minWidth: 980,
    minHeight: 640,
    title: "KwantDesk",
    icon: ICON_PATH,
    backgroundColor: "#030406",
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
      backgroundThrottling: false,
    },
  });

  mainWindow = window;
  reserveDesktopTitleBar(window.webContents);
  Menu.setApplicationMenu(null);

  if (saved.maximized) window.maximize();
  window.once("ready-to-show", () => window.show());
  window.on("close", () => saveWindowState(window));
  window.on("closed", () => {
    if (mainWindow === window) mainWindow = null;
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(APP_ORIGIN) || url.startsWith("https://accounts.google.com")) {
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          ...desktopWindowChrome,
          icon: ICON_PATH,
          autoHideMenuBar: true,
          webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
        },
      };
    }
    void shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("did-create-window", (childWindow) => {
    reserveDesktopTitleBar(childWindow.webContents);
  });

  // Remove cached application assets, but retain cookies and site storage so
  // the signed-in QuantDesk account survives app restarts.
  await session.defaultSession.clearCache();
  await window.loadURL(APP_URL, {
    extraHeaders: "Cache-Control: no-cache\nPragma: no-cache",
  });

  return window;
}

app.on("second-instance", () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

app.whenReady().then(async () => {
  session.defaultSession.setPermissionCheckHandler((_contents, permission, requestingOrigin) => {
    return isTrustedPermissionOrigin(requestingOrigin)
      && ["media", "microphone", "notifications", "clipboard-sanitized-write"].includes(permission);
  });
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(
      isTrustedPermissionOrigin(webContents.getURL())
      && ["media", "microphone", "notifications", "clipboard-sanitized-write"].includes(permission),
    );
  });

  await createMainWindow();
  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) await createMainWindow();
  });
});

app.on("window-all-closed", () => app.quit());
