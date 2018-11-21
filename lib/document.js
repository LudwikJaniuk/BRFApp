var dedent = require('dedent')
var hyperstream = require('hstream')

module.exports = document

function document () {
  return hyperstream({
    head: {
      _appendHtml: dedent`
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
        <link rel="manifest" href="/manifest.json">
        <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#388ee8">
        <meta name="apple-mobile-web-app-title" content="Brf Energi">
        <meta name="application-name" content="Brf Energi">
        <script>document.documentElement.classList.add('has-js');</script>
        <script>
          (function () {
            if (!window.initialState.tracking.enabled) return
            var script = document.createElement('script')
            script.src = 'https://www.googletagmanager.com/gtag/js?id=${process.env.GOOGLE_ANALYTICS_ID}'
            document.head.appendChild(script)
              window.dataLayer = window.dataLayer || [];
              window.gtag = function gtag(){dataLayer.push(arguments);};
              gtag('js', new Date());
          }());
        </script>
      `
    }
  })
}
