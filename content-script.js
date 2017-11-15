let links = new Set();
new MutationObserver(() => {
  let newLinks = timeLinks();
  if(newLinks !== links) {
    links = newLinks;
    buildPlaylist(links);
  }
}).observe(document, {
  subtree: true,
  childList: true,
  characterData: true,
  attributes: true,
});

let port = chrome.runtime.connect({name: CONTENT_SCRIPT});
let oldPlaylistJson = '[]';
let timeUpdateListener;
let video;
let playingTrack;
function buildPlaylist(links) {
  let containers = new Map();
  for(let link of links) {
    match = link.href.match(/&t=([\d.]+)s/);
    if(match) {
      let startTime = parseFloat(match[1]);
      let container = link.closest('#content');
      if(!containers.has(container)) {
        containers.set(container, []);
      }
      let tracks = containers.get(container);
      let previousTrack = tracks[tracks.length - 1];
      if(previousTrack) {
        previousTrack.endTime = startTime;
      }
      tracks.push({
        href: link.href,
        text:
        getLine(link.previousSibling, -1) +
        link.textContent +
        getLine(link.nextSibling, 0),
        startTime
      });
    }
  }
  let playlist = Array.from(containers.values());
  let newPlaylistJson = JSON.stringify(playlist);
  if(newPlaylistJson !== oldPlaylistJson) {
    port.postMessage({
      [TYPE]: INITIALIZE,
      [PLAYLISTS]: playlist,
    });
    oldPlaylistJson = newPlaylistJson;
  }

  if(timeUpdateListener) {
    video.removeEventListener('timeupdate', timeUpdateListener);
  }
  video = document.querySelector('video');

  timeUpdateListener = () => {
    let bestTracks = [];
    for(let [container, tracks] of containers) {
      if(tracks.length > bestTracks.length) {
        bestTracks = tracks;
      }
    }

    for(let [index, track] of bestTracks.entries()) {
      if(track.startTime <= video.currentTime && video.currentTime < track.endTime) {
        port.postMessage({
          [TYPE]: UPDATE,
          [PLAYING]: index,
          [PROGRESS]: (video.currentTime - track.startTime) / (track.endTime - track.startTime),
        });
        if(playingTrack !== track) {
          playingTrack = track;
          port.postMessage({
            [TYPE]: NOTIFY,
            [PLAYING]: track.text,
            [VIDEO]: document.querySelector('.title').textContent,
          });
        }
        break;
      }
    }
  };
  video.addEventListener('timeupdate', timeUpdateListener);

  port.onMessage.addListener((message) => {
    if(message[TYPE] === SEEK) {
      video.currentTime = message[TIME];
    }
  });
}

function timeLinks() {
  let match = location.search.match(/(?:^\?|&)v=([^&]+)(?=&|$)/);
  if(match) {
    let id = match[1];
    return new Set(document.querySelectorAll(`a[href^="/watch?v=${id}"][href*="&t="]`));
  }
  return new Set();
}

function getLine(node, index) {
  if(!node) {
    return '';
  }
  let string = node.textContent;
  let lines = string.split(/[\n\r]/g);
  if(index < 0) {
    index += lines.length;
  }
  return lines[index];
}
