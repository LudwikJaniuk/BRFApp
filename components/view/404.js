const html = require('choo/html')
const { __ } = require('../../lib/locale')

view.title = () => __('Page not found')

module.exports = view

function view (error) {
  return html`
    <div class="View-container View-container--md u-flexAlignContentStart">
      <h1 class="Display Display--1 u-marginTl">${__('Oops!')}</h1>
      <div class="Text u-textCenter u-marginBl">
        <p>${__('This page could not be found. Try using the menu or go back to') + ' '} <a href="/">${__('the homepage')}</a>.</p>
      </div>
      ${process.env.NODE_ENV === 'development' ? html`
        <pre class="u-sizeFull u-scroll">${unescape(error.stack)}</pre>
      ` : null}
    </div>
  `
}
