let observerOptions = {
  childList: true,
  subTree: true,
  characterData: true,
};
let documentMutationObserver = new MutationObserver((_, observer) => {
  let description = document.querySelector('#description');
  let comments = document.querySelector('#comments');
  let mutationObserver;
  if(description && comments) {
    buildPlaylist();
    mutationObserver = new MutationObserver(buildPlaylist);
    mutationObserver.observe(document.querySelector('#description'), observerOptions);
    mutationObserver.observe(document.querySelector('#comments'), observerOptions);
  } else {
    if(mutationObserver) {
      mutationObserver.disconnect();
    }
  }
});
documentMutationObserver.observe(document.querySelector('body'), observerOptions);

let oldPlaylistJson = '[]';
let timeUpdateListener;
let video;
let playingTrack;
function buildPlaylist() {
  let match = location.search.match(/(?:^\?|&)v=([^&]+)(?=&|$)/);
  if(match) {
    let id = match[1];
    let containers = new Map();
    for(let link of document.querySelectorAll(`a[href^="/watch?v=${id}"][href*="&t="]`)) {
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
      chrome.runtime.sendMessage({
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
      for(let [container, tracks] of containers) {
        for(let [index, track] of tracks.entries()) {
          if(track.startTime <= video.currentTime && video.currentTime < track.endTime) {
            chrome.runtime.sendMessage({
              [TYPE]: UPDATE,
              [PLAYING]: index,
              [PROGRESS]: (video.currentTime - track.startTime) / (track.endTime - track.startTime),
            });
            if(playingTrack !== track) {
              playingTrack = track;
              chrome.runtime.sendMessage({
                [TYPE]: NOTIFY,
                [PLAYING]: track.text,
              });
            }
            break;
          }
        }
      }
    };
    video.addEventListener('timeupdate', timeUpdateListener);

    chrome.runtime.onMessage.addListener((message) => {
      if(message[TYPE] === SEEK) {
        video.currentTime = message[TIME];
      }
    });
  }
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
