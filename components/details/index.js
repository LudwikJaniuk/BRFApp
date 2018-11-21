const html = require('choo/html')
const { __ } = require('../../lib/locale')

module.exports = details

function details (title, expanded, children) {
  var attrs = { class: 'Details' }
  if (expanded) {
    attrs.open = 'open'
    attrs.class += ' is-open'
  }
  return html`
    <details ${attrs}>
      <summary class="Details-summary" onclick=${onclick}>
        ${title}
        <span class="Details-trigger Details-trigger--show"><span class="Link" tabindex="0">${__('Show')}</span></span>
        <span class="Details-trigger Details-trigger--hide"><span class="Link" tabindex="0">${__('Hide')}</span></span>
      </summary>
      ${typeof children === 'function' ? children() : children}
    </details>
  `

  function onclick (event) {
    if (expanded) event.preventDefault()
  }
}
