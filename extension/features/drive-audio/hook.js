// Runs in Drive's own JS world (manifest "world": "MAIN").
// Drive plays audio previews through a detached `new Audio()`, which content
// scripts cannot see. Parking those elements in a hidden node makes them
// reachable from player.js. Nothing is read, sent, or changed besides that.
(() => {
  let holder;

  const park = (el) => {
    if (!(el instanceof HTMLAudioElement) || el.isConnected) return;
    if (!holder?.isConnected) {
      holder = document.createElement('supersnacks-media');
      holder.hidden = true;
      document.documentElement.append(holder);
    }
    holder.append(el);
  };

  const proto = HTMLMediaElement.prototype;

  const play = proto.play;
  proto.play = function () {
    park(this);
    // Drop paused leftovers from earlier previews so they can be collected.
    for (const old of [...(holder?.children ?? [])]) {
      if (old !== this && old.paused) old.remove();
    }
    return play.apply(this, arguments);
  };

  const src = Object.getOwnPropertyDescriptor(proto, 'src');
  Object.defineProperty(proto, 'src', {
    ...src,
    set(value) {
      src.set.call(this, value);
      park(this);
    },
  });
})();
