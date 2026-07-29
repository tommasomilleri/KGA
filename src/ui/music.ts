
let player: any = null;
let apiReady = false;

function loadYTApi(): Promise<void> {
  return new Promise((resolve) => {
    if (apiReady) return resolve();
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(s);
    (window as any).onYouTubeIframeAPIReady = () => { apiReady = true; resolve(); };
  });
}

export function initMusicPlayer(): void {
  const wrap = document.createElement('div');
  wrap.id = 'music';
  wrap.innerHTML = `
    <button id="music-toggle" title="Musica">♪</button>
    <div id="music-panel">
      <div class="mp-row">
        <input id="mp-search" type="text" placeholder="cerca un brano… + INVIO" />
      </div>
      <div id="mp-frame"></div>
      <div class="mp-row mp-controls">
        <button id="mp-prev">⏮</button>
        <button id="mp-play">⏯</button>
        <button id="mp-next">⏭</button>
        <input id="mp-vol" type="range" min="0" max="100" value="60" title="Volume" />
      </div>
    </div>`;
  document.body.appendChild(wrap);

  const panel = document.getElementById('music-panel')!;
  const toggle = document.getElementById('music-toggle')!;
  toggle.onclick = () => panel.classList.toggle('open');

  const search = document.getElementById('mp-search') as HTMLInputElement;
  search.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter' || !search.value.trim()) return;
    await loadYTApi();
    const YT = (window as any).YT;
    if (!player) {
      player = new YT.Player('mp-frame', {
        height: '158', width: '280',
        playerVars: { listType: 'search', list: search.value, autoplay: 1 },
      });
    } else {
      player.loadPlaylist({ listType: 'search', list: search.value });
    }
  });

  document.getElementById('mp-play')!.onclick = () => {
    if (!player) return;
    const s = player.getPlayerState();
    s === 1 ? player.pauseVideo() : player.playVideo();
  };
  document.getElementById('mp-prev')!.onclick = () => player?.previousVideo();
  document.getElementById('mp-next')!.onclick = () => player?.nextVideo();
  (document.getElementById('mp-vol') as HTMLInputElement).oninput = (e) =>
    player?.setVolume(Number((e.target as HTMLInputElement).value));
}

