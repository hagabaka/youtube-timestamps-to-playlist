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
let notifiedTrack;
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
        text: getLine(link.previousSibling, -1) + link.textContent + getLine(link.nextSibling, 0),
        startTime
      });
    }
  }
  let playlists = Array.from(containers.values());
  let newPlaylistJson = JSON.stringify(playlists);
  if(newPlaylistJson !== oldPlaylistJson) {
    port.postMessage({
      [TYPE]: INITIALIZE,
      [PLAYLISTS]: playlists,
    });
    oldPlaylistJson = newPlaylistJson;
  }

  if(timeUpdateListener) {
    video.removeEventListener('timeupdate', timeUpdateListener);
  }
  video = document.querySelector('video');

  timeUpdateListener = () => {
    let currentTracks = [];
    for(let [playlistIndex, playlist] of playlists.entries()) {
      for(let [trackIndex, track] of playlist.entries()) {
        if(track.startTime <= video.currentTime && video.currentTime < track.endTime) {
          currentTracks.push({
            [PLAYLIST_INDEX]: playlistIndex,
            [TRACK_INDEX]: trackIndex,
            [TRACK]: track,
            [PROGRESS]: (video.currentTime - track.startTime) / (track.endTime - track.startTime),
          });
        }
      }
    }
    port.postMessage({
      [TYPE]: UPDATE,
      [PLAYING]: currentTracks,
    });
    if(currentTracks.length > 0) {
      let notifyTrack = currentTracks[0][TRACK];
      if(notifiedTrack !== notifyTrack) {
        notifiedTrack = notifyTrack;
        port.postMessage({
          [TYPE]: NOTIFY,
          [PLAYING]: notifyTrack.text,
          [VIDEO]: document.querySelector('.title').textContent,
        });
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
