// Runs in Meet's own JS world (manifest "world": "MAIN").
// Meet tells Chrome not to offer sound when you present a window or your whole
// screen. This turns that back on, so the share picker shows an audio switch.
(() => {
  const getDisplayMedia = MediaDevices.prototype.getDisplayMedia;

  MediaDevices.prototype.getDisplayMedia = async function (options = {}) {
    if (!options.audio) return getDisplayMedia.call(this, options);

    const stream = await getDisplayMedia.call(this, {
      ...options,
      audio: {
        ...(options.audio === true ? {} : options.audio),
        restrictOwnAudio: true, // keep the call's own sound out where Chrome can
      },
      systemAudio: 'include',
      windowAudio: 'window', // Chrome falls back to system sound where needed
    });

    const [audio] = stream.getAudioTracks();
    const [video] = stream.getVideoTracks();
    const isTab = video?.getSettings().displaySurface === 'browser';
    if (audio && video && !isTab && !audio.getSettings().restrictOwnAudio) {
      warn(video);
    }
    return stream;
  };

  // Shown when Chrome can't leave the call's own sound out (e.g. Windows 10),
  // so whatever other people say is sent back to them. Meet's own
  // "Presentation audio" switch already mutes the shared sound.
  function warn(video) {
    const host = document.createElement('supersnacks-meet-audio');
    const root = host.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = CSS;

    const text = document.createElement('span');
    text.textContent = 'Others may hear themselves in your shared sound. ' +
      'Switch off "Presentation audio" when you\'re not playing anything.';

    const button = document.createElement('button');
    button.textContent = 'Got it';
    button.addEventListener('click', () => host.remove());

    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.append(text, button);
    root.append(style, bar);
    document.documentElement.append(host);

    // Meet stops tracks with stop(), which fires no event, so check instead.
    const timer = setInterval(() => {
      if (video.readyState === 'ended' || !host.isConnected) {
        clearInterval(timer);
        host.remove();
      }
    }, 1000);
  }

  const CSS = `
    :host { all: initial; position: fixed; top: 64px; left: 50%; z-index: 2147483647;
      transform: translateX(-50%); }
    .bar { display: flex; align-items: center; gap: 12px; padding: 6px 6px 6px 16px;
      border-radius: 24px; background: rgb(48, 49, 52); color: rgb(232, 234, 237);
      box-shadow: 0 4px 12px rgba(0, 0, 0, .4);
      font: 14px/20px "Google Sans", Roboto, Arial, sans-serif; }
    button { all: unset; padding: 8px 16px; border-radius: 18px; cursor: pointer;
      background: rgb(168, 199, 250); color: rgb(6, 46, 111); font-weight: 500;
      white-space: nowrap; }
    button:hover { background: rgb(184, 209, 251); }
    button:focus-visible { outline: 2px solid rgb(232, 234, 237); outline-offset: 2px; }
  `;
})();
