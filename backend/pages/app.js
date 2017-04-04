const dedent = require('dedent');
const head = require('./partials/head');
const scripts = require('./partials/scripts');
const symbols = require('../components/icons/symbols');

module.exports = function app(view, state, prev, send) {
  return dedent`
    <!doctype html>
    <html lang="${ state.lang }">
      ${ head(state) }
      <body>
        <div class="js-static">
          ${ view(state, prev, send) }
        </div>
        <details>
          <summary>State</summary>
          <pre style="width: 100%; overflow: auto;">${ JSON.stringify(state, null, 2) }</pre>
        </details>
        ${ symbols() }
        ${ scripts(state).join('\n') }
      </body>
    </html>
  `;
};
