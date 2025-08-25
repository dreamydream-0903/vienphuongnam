// shaka-player.d.ts
declare module 'shaka-player' {
  const shaka: any;
  export = shaka;
}

declare module 'shaka-player/dist/shaka-player.ui.js' {
  import shaka = require('shaka-player');
  const shakaWithUI: typeof shaka
  export default shakaWithUI
}
