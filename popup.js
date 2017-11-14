class PlaylistTrack extends HTMLElement {
  constructor(track) {
    super();
    let template = document.querySelector('#playlist-track');
    let text = template.content.querySelector('#text');
    text.textContent = track.text;
    this.attachShadow({mode: 'open'}).appendChild(document.importNode(template.content, true));
    this.track = track;
    this.shadowRoot.querySelector('#text').addEventListener('click', () => {
      requestSeek(this.track.startTime);
    });
    this.shadowRoot.querySelector('#progress').addEventListener('change', (event) => {
      requestSeek((this.track.endTime - this.track.startTime) * parseFloat(event.target.value) + this.track.startTime);
    });
  }

  static get observedAttributes() {
    return ['progress'];
  }
  attributeChangedCallback(attr, oldValue, newValue) {
    if(attr === 'progress') {
      this.shadowRoot.querySelector('#progress').value = newValue;
    }
  }
}
customElements.define('playlist-track', PlaylistTrack);

let port = chrome.runtime.connect();
port.onMessage.addListener((message) => {
  let tracks = document.querySelector('#playlist-tracks');
  if(message[TYPE] === INITIALIZE) {
    while (tracks.hasChildNodes()) {
      tracks.removeChild(tracks.lastChild);
    }
    for(let playlist of message[PLAYLISTS]) {
      for(let track of playlist) {
        tracks.appendChild(new PlaylistTrack(track));
      }
    }
  } else if(message[TYPE] === UPDATE) {
    for(let [index, track] of tracks.childNodes.entries()) {
      if(index === message[PLAYING]) {
        track.setAttribute('playing', 'playing');
        track.setAttribute('progress', message[PROGRESS]);
      } else {
        track.removeAttribute('playing');
      }
    }
  }
});

function requestSeek(time) {
  chrome.tabs.query({
    active: true,
    currentWindow: true,
  }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, {
      [TYPE]: SEEK,
      [TIME]: time,
    });
  });
}
