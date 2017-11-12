let connectedPorts = new Set();
let initialMessage;

chrome.runtime.onConnect.addListener((port) => {
  port.postMessage(initialMessage);
  connectedPorts.add(port);
  port.onDisconnect.addListener(() => {
    connectedPorts.delete(port);
  });
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if(message[TYPE] === INITIALIZE) {
    chrome.pageAction.show(sender.tab.id);
    initialMessage = message;
  } else {
    for(let port of connectedPorts) {
      port.postMessage(message);
    }
  }
});
