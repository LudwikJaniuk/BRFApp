const html = require('choo/html')
const asElement = require('prismic-element')
const { asText } = require('prismic-richtext')
const view = require('../components/view')
const { loader } = require('../components/icons')
const { follow } = require('../components/base')
const resolve = require('../lib/resolve')
const { __ } = require('../lib/locale')

module.exports = view(signUp, title)

function signUp (state, emit) {
  const doc = state.content.registration

  if (!doc) {
    emit('content:fetch', 'registration')
  }

  return html`
    <div class="View-container View-container--md u-block">
      ${doc ? html`
        <div class="u-marginVl">
          <h1 class="Display Display--2">
            ${asText(doc.data.disclaimer_title)}
          </h1>
          <div class="Type">
            ${asElement(doc.data.disclaimer_body)}
          </div>
        </div>
      ` : html`
        <div class="u-marginVl u-textCenter">
          ${loader()}
        </div>
      `}
        <a href="${resolve('/auth/metry/sign-up')}" onclick=${follow} class="Button u-block">
          ${__('Create an account')}
        </a>
    </div>
  `
}

function title () {
  return __('Create an account')
}
