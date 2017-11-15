class PlaylistTrack extends HTMLElement {
  constructor(track) {
    super();
    this.data = track;
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
let scrolled = false;
port.onMessage.addListener((message) => {
  let container = document.querySelector('#playlist-tracks');
  if(message[TYPE] === INITIALIZE) {
    while (container.hasChildNodes()) {
      container.removeChild(container.lastChild);
    }
    for(let playlist of message[PLAYLISTS]) {
      let playlistNode = document.createElement('div');
      playlistNode.classList.add('playlist');
      container.appendChild(playlistNode);
      for(let track of playlist) {
        playlistNode.appendChild(new PlaylistTrack(track));
      }
    }
  } else if(message[TYPE] === UPDATE) {
    let playingNodes = new Set();
    message[PLAYING].forEach((playing) => {
      let playlistNode = container.childNodes[playing[PLAYLIST_INDEX]];
      if(playlistNode) {
        let trackNode = playlistNode.childNodes[playing[TRACK_INDEX]];
        playingNodes.add(trackNode);
        trackNode.setAttribute('playing', 'playing');
        trackNode.setAttribute('progress', playing[PROGRESS]);
      }
    });
    container.childNodes.forEach((playlistNode) => {
      playlistNode.childNodes.forEach((trackNode) => {
        if(!playingNodes.has(trackNode)) {
          trackNode.removeAttribute('playing');
        }
      });
    });
    if(!scrolled && playingNodes.size > 0) {
      scrolled = true;
      playingNodes.values().next().value.scrollIntoView({behavior: 'smooth'});
    }
  }
});

function requestSeek(time) {
  port.postMessage({
    [TYPE]: SEEK,
    [TIME]: time,
  });
}
