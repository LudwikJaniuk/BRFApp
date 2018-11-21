const html = require('choo/html')

module.exports = function menu (links) {
  return html`
    <ul class="Menu">
      ${links.map(props => html`
        <li class="Menu-item">
          <a class="Menu-link" href="${props.href}" onclick=${props.onclick || null}>
            ${props.title}
          </a>
        </li>
      `)}
    </ul>
  `
}
