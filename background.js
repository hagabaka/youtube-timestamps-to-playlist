let contentScriptPorts = new Map();
chrome.runtime.onConnect.addListener((port) => {
  if(port.name === CONTENT_SCRIPT) {
    let tabId = port.sender.tab.id;
    contentScriptPorts.set(tabId, new TabManager(port, tabId));
    port.onDisconnect.addListener(() => {
      contentScriptPorts.delete(tabId);
    });
  } else {
    chrome.tabs.query({
      active: true,
      currentWindow: true,
    }, (tabs) => {
      let tabId = tabs[0].id;
      let contentScriptPort = contentScriptPorts.get(tabId);
      if(contentScriptPort) {
        contentScriptPort.addPopupPort(port);
      }
    });
  }
});

class TabManager {
  constructor(port, tabId) {
    this.contentScriptPort = port;
    this.tabId = tabId;
    this.popupPorts = new Set();

    this.contentScriptPort.onDisconnect.addListener(() => {
      this.hidePageAction();
    });
    this.contentScriptPort.onMessage.addListener((message) => {
      if(message[TYPE] === INITIALIZE) {
        this.initialMessage = message;
        if(message[PLAYLISTS].length > 0) {
          this.showPageAction();
        } else {
          this.hidePageAction();
        }
      } else if(message[TYPE] === NOTIFY) {
        if(this.notificationText !== message[PLAYING]) {
          this.notificationText = message[PLAYING];
          chrome.notifications.create({
            type: 'basic',
            title: 'Now playing',
            message: message[PLAYING] + '\n' + message[VIDEO],
            iconUrl: 'icon48.png'
          });
        }
      } else {
        for(let port of this.popupPorts) {
          port.postMessage(message);
        }
      }
    });
  }

  addPopupPort(port) {
    this.popupPorts.add(port);
    port.postMessage(this.initialMessage);
    port.onDisconnect.addListener(() => {
      this.popupPorts.delete(port);
    });
    port.onMessage.addListener((message) => {
      if(message[TYPE] === SEEK) {
        this.contentScriptPort.postMessage(message);
      }
    });
  }

  showPageAction() {
    chrome.pageAction.show(this.tabId);
  }
  hidePageAction() {
    chrome.pageAction.hide(this.tabId);
  }
}
