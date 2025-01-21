import {registerSW} from 'virtual:pwa-register';

export const ngv = {};

const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('New content available. Reload?')) {
      updateSW(true).catch(console.error);
    }
  },
});
