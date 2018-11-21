const html = require('choo/html')
const moment = require('moment')
const { __ } = require('../../lib/locale')

const SHORT_LENGTH = 50

module.exports = function comment (comment, action, state) {
  const { user } = state
  const classList = [ 'Comment' ]
  let content = comment.comment
  const isAuthor = user && user._id === comment.user

  if (comment.short) {
    classList.push('Comment--slim')

    if (content.length > SHORT_LENGTH) {
      content = `${content.substr(0, SHORT_LENGTH)}…`
    }
  }

  return html`
    <div class="${classList.join(' ')}" id="comment-${comment._id}">
      ${comment.short ? null : html`
        <time class="Comment-date" datetime="${JSON.stringify(comment.date)}">
          ${moment(comment.date).fromNow()}
        </time>
      `}
      <strong class="Comment-author">${comment.author}</strong>
      ${comment.short ? content : html`<div class="Comment-body">${content}</div>`}
      ${!comment.short && isAuthor ? form() : null}
    </div>
  `

  function form () {
    return html`
      <form action="${action._id}/comments/${comment._id}?_method=DELETE" method="POST" class="Form" enctype="application/x-www-form-urlencoded">
        <button type="submit" class="Link Link--noSmoothing">${__('Delete')}</button>
      </form>
    `
  }
}
