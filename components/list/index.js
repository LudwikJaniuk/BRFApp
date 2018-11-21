const html = require('choo/html')
const Component = require('choo/component')
var { __ } = require('../../lib/locale')

class List extends Component {
  constructor (id, state, emit) {
    super(id)
    this.local = state.components[id] = {
      id: id,
      expanded: typeof window === 'undefined'
    }
  }

  update () {
    return false
  }

  unload () {
    this.local.expanded = false
  }

  expand () {
    this.local.expanded = true
    this.rerender()
  }
}

exports.Definition = class Definition extends List {
  createElement (props, limit = Infinity) {
    const self = this
    const keys = Object.keys(props)

    return html`
      <div>
        <dl class="List List--definition">
          ${keys.slice(0, this.local.expanded ? keys.length : limit).reduce((list, key) => list.concat([
            html`<dt class="List-term ${!props[key] ? 'List-term--noDefinition' : ''}">${key}</dt>`,
            html`<dd class="List-definition">${props[key]}</dd>`
          ]), [])}
        </dl>
        ${!this.local.expanded && keys.length > limit ? html`
          <button class="Link" onclick=${onclick}>${__('Show more')}</button>
        ` : null}
      </div>
    `

    function onclick (event) {
      self.expand()
      event.preventDefault()
    }
  }
}

exports.Numbered = class Numbered extends List {
  createElement (list, limit = Infinity) {
    const self = this

    return html`
      <div>
        <ol class="List List--numbered">
          ${list.slice(0, this.local.expanded ? list.length : limit).map((item, index) => html`
            <li class="List-item">
              <div class="List-number">${index + 1}</div>
              <div class="List-content">${item}</div>
            </li>
          `)}
        </ol>
        ${!this.local.expanded && list.length > limit ? html`
          <button class="Link" onclick=${onclick}>${__('Show more')}</button>
        ` : null}
      </div>
    `

    function onclick (event) {
      self.expand()
      event.preventDefault()
    }
  }
}
