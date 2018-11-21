const html = require('choo/html')
const moment = require('moment')
const capitalize = require('lodash.capitalize')
const comment = require('../comment')
const { __ } = require('../../lib/locale')
const resolve = require('../../lib/resolve')
const { captureAnchor } = require('../base')

module.exports = function summary (action, state) {
  const numComments = action.comments.length
  const href = resolve(`/actions/${action._id}`)

  return html`
    <article class="Action" id="action-${action._id}">
      ${action.date || (state.user && state.user.cooperative === action.cooperative) ? html`
        <a href="${href}" class="u-linkComplex u-block">
          ${action.date ? html`
            <time class="Action-date" datetime="${JSON.stringify(action.date)}">
              ${capitalize(moment(action.date).format('MMM YYYY'))}
            </time>
          ` : null}
          <h3 class="u-linkComplexTarget Action-title">${__(`ACTION_TYPE_${action.type}`)}</h3>
        </a>
      ` : html`
        <h3 class="Action-title u-colorDark">${__(`ACTION_TYPE_${action.type}`)}</h3>
      `}
      ${numComments ? comment(Object.assign({ short: true }, action.comments[numComments - 1]), action, state) : null}
      ${numComments || state.user ? html`
        <a class="u-block u-textS" onclick=${captureAnchor} href="${href}#comments-${action._id}">
          ${numComments ? __('View all %d comments', numComments) : __('Leave a comment')}
        </a>
      ` : null}
    </article>
  `
}
