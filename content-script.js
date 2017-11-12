setTimeout(function() {
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
            getLine(link.previousSibling.textContent, -1) +
            link.textContent +
            getLine(link.nextSibling.textContent, 0),
          startTime
        });
      }
    }
    chrome.runtime.sendMessage({
      [TYPE]: INITIALIZE,
      [PLAYLISTS]: Array.from(containers.values()),
    });

    let video = document.querySelector('video');
    video.addEventListener('timeupdate', () => {
      for(let [container, tracks] of containers) {
        for(let [index, track] of tracks.entries()) {
          if(track.startTime <= video.currentTime && video.currentTime < track.endTime) {
            chrome.runtime.sendMessage({
              [TYPE]: UPDATE,
              [PLAYING]: index,
              [PROGRESS]: (video.currentTime - track.startTime) / (track.endTime - track.startTime),
            });
            break;
          }
        }
      }
    });

    chrome.runtime.onMessage.addListener((message) => {
      if(message[TYPE] === SEEK) {
        video.currentTime = message[TIME];
      }
    });
  }
}, 1000);

function getLine(string, index) {
  let lines = string.split(/[\n\r]/g);
  if(index < 0) {
    index += lines.length;
  }
  return lines[index];
}
