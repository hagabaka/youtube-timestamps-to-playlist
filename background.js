let connectedPorts = new Set();
let initialMessage;

chrome.runtime.onConnect.addListener((port) => {
  port.postMessage(initialMessage);
  connectedPorts.add(port);
  port.onDisconnect.addListener(() => {
    connectedPorts.delete(port);
  });
});

let notificationText;
chrome.runtime.onMessage.addListener((message, sender) => {
  if(message[TYPE] === INITIALIZE) {
    if(message[PLAYLISTS].length > 0) {
      chrome.pageAction.show(sender.tab.id);
    } else {
      chrome.pageAction.hide(sender.tab.id);
    }
    initialMessage = message;
  } else if(message[TYPE] === NOTIFY) {
    if(notificationText !== message[PLAYING]) {
      notificationText = message[PLAYING];
      chrome.notifications.create({
        type: 'basic',
        title: 'Now playing',
        message: message[PLAYING] + '\n' + message[VIDEO],
        iconUrl: 'icon.png'
      });
    }
  }
  for(let port of connectedPorts) {
    port.postMessage(message);
  }
});
