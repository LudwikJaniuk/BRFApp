const html = require('choo/html')
const friendlyUrl = require('friendly-url')
const asElement = require('prismic-element')
const { asText, Elements } = require('prismic-richtext')
const view = require('../components/view')
const { loader } = require('../components/icons')
const { __ } = require('../lib/locale')
const resolve = require('../lib/resolve')

module.exports = view(about, title)

function about (state, emit) {
  let doc = state.content.about

  if (!doc) {
    emit('content:fetch', 'about')
  } else if (state.params.anchor) {
    emit('scrollto', state.params.anchor)
  }

  return html`
    <div class="View-container View-container--md u-flexExpand">
      ${doc
        ? html`
          <div class="u-marginVl">
            <h1 class="Display Display--2">
              ${asText(doc.data.title)}
            </h1>
            <div class="Type">
              ${asElement(doc.data.body, resolve, serialize)}
            </div>
          </div>`
        : html`
          <div class="u-marginVl u-textCenter">
            ${loader()}
          </div>
      `}
    </div>
  `
}

function serialize (type, element, content, children) {
  var attrs = {}
  if (element.label) attrs.class = element.label

  switch (type) {
    case Elements.heading1: return html`<h1 id="${friendlyUrl(children[0])}" ${attrs}>${children}</h1>`
    case Elements.heading2: return html`<h2 id="${friendlyUrl(children[0])}" ${attrs}>${children}</h2>`
    case Elements.heading3: return html`<h3 id="${friendlyUrl(children[0])}" ${attrs}>${children}</h3>`
    case Elements.heading4: return html`<h4 id="${friendlyUrl(children[0])}" ${attrs}>${children}</h4>`
    case Elements.heading5: return html`<h5 id="${friendlyUrl(children[0])}" ${attrs}>${children}</h5>`
    case Elements.heading6: return html`<h6 id="${friendlyUrl(children[0])}" ${attrs}>${children}</h6>`
    default: return null
  }
}

function title () {
  return __('About Brf Energi')
}
