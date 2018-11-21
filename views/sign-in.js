const html = require('choo/html')
const asElement = require('prismic-element')
const { asText } = require('prismic-richtext')
const view = require('../components/view')
const { loader } = require('../components/icons')
const { follow } = require('../components/base')
const resolve = require('../lib/resolve')
const { __ } = require('../lib/locale')

module.exports = view(signIn, title)

function signIn (state, emit) {
  const doc = state.content['sign-in']

  if (!doc) {
    emit('content:fetch', 'sign-in')
  }

  return html`
    <div class="View-container View-container--md u-block">
      ${doc ? html`
        <div class="u-marginVl">
          <h1 class="Display Display--2">
            ${asText(doc.data.title)}
          </h1>
          <div class="Type">
            ${asElement(doc.data.body)}
          </div>
        </div>
      ` : html`
        <div class="u-marginVl u-textCenter">
          ${loader()}
        </div>
      `}
        <div class="u-flex">
          <a href="${resolve('/auth/sign-up')}" class="Button Button--secondary u-flexGrow1">
            ${__('Create an account')}
          </a>
          <a href="${resolve('/auth/metry')}" onclick=${follow} class="Button u-flexGrow1">
            ${__('Sign in with Metry')}
          </a>
        </div>
    </div>
  `
}

function title () {
  return __('Sign in')
}
