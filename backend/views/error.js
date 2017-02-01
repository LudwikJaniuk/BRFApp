const html = require('choo/html');
const head = require('./partials/head');
const scripts = require('./partials/scripts');

module.exports = function (state, prev, send) {
  return html`
    <html lang="${ state.lang }">
      ${ head(state) }
      <body>
        Oops!
        <pre>${ JSON.stringify(state, null, 2) }</pre>
        ${ scripts(state) }
      </body>
    </html>
  `;
};
