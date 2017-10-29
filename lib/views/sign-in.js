const html = require('choo/html');
const app = require('../components/app');
const { loader } = require('../components/icons');
const { follow } = require('../components/utils');
const resolve = require('../resolve');
const { __ } = require('../locale');

module.exports = app(view, title);

function view(state, emit) {
  const doc = state.content['sign-in'];

  if (!doc) {
    emit('content:fetch', 'sign-in');
  }

  return html`
    <div class="App-container App-container--md u-block">
      ${ doc ? html`
        <div class="u-marginVl">
          <h1 class="Display Display--2">
            ${ doc.getStructuredText('sign-in.title').asText() }
          </h1>
          <div class="Type">
            ${ doc.getStructuredText('sign-in.body').asElement() }
          </div>
        </div>
      ` : html`
        <div class="u-marginVl u-textCenter">
          ${ loader() }
        </div>
      ` }
        <div class="u-flex">
          <a href="${ resolve('/auth/signup') }" onclick=${ follow } class="Button Button--secondary u-flexGrow1">
            ${ __('Create an account') }
          </a>
          <a href="${ resolve('/auth/metry') }" onclick=${ follow } class="Button u-flexGrow1">
            ${ __('Sign in with Metry') }
          </a>
        </div>
    </div>
  `;
}

function title() {
  return __('Sign in');
}
