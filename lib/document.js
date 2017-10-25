const dedent = require('dedent');

const html = process.env.NODE_ENV === 'development' ? dedent : minify;

module.exports = function app(view, state) {
  return html`
    <!doctype html>
    <html lang="${ state.lang }">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <title>${ state.title ? state.title + ' | ' : '' }Brf Energi</title>
      <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
      <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
      <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
      <link rel="manifest" href="/manifest.json">
      <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#388ee8">
      <meta name="apple-mobile-web-app-title" content="Brf Energi">
      <meta name="application-name" content="Brf Energi">
      <meta name="theme-color" content="#ffffff">
      <script>document.documentElement.classList.add('has-js');</script>
      <link rel="stylesheet" href="/index-${ state.version }.css">
      ${ process.env.NODE_ENV !== 'development' ? html`
        <script src="https://cdn.polyfill.io/v2/polyfill.min.js?features=default,fetch,Array.prototype.includes,Array.prototype.find,Object.values"></script>
      ` : '' }
      <script async src="https://www.googletagmanager.com/gtag/js?id=${ process.env.GOOGLE_ANALYTICS_ID }"></script>
      <script>
        (function () {
          window.dataLayer = window.dataLayer || [];
          window.gtag = function gtag(){dataLayer.push(arguments);};
          gtag('js', new Date());
        }());
      </script>
      <script>window.initialState = ${ JSON.stringify(state) }</script>
      <script src="/index-${ state.version }.js" async></script>
    </head>
    ${ view(state) }
    </html>
  `;
};

/**
 * Simple minification removing all new line feeds and leading spaces
 *
 * @param {array} strings Array of string parts
 * @param {array} parts Trailing arguments with expressions
 * @returns {string}
 */

function minify(strings, ...parts) {
  return strings.reduce((output, string, index) => {
    return output + string.replace(/\n\s+/g, '') + (parts[index] || '');
  }, '');
}
