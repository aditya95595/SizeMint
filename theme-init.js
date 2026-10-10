/* SizeMint pre-paint theme initialiser.
   Loaded synchronously in <head> (render-blocking is intentional):
   sets data-theme before first paint so there is no theme flash.
   Zero dependencies; safe under `script-src 'self'`. */
(function(){try{var t=localStorage.getItem('sizemint-theme');document.documentElement.dataset.theme=(t==='light'||t==='dark')?t:'dark'}catch(e){document.documentElement.dataset.theme='dark'}})();
