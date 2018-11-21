const html = require('choo/html')
const Component = require('choo/component')
const { input } = require('../form')
const { __ } = require('../../lib/locale')

module.exports = class Search extends Component {
  constructor (id, state) {
    super(id)
    this.state = state
    this.text = ''
  }

  update (cooperative) {
    return cooperative._id !== this.cooperative
  }

  load (element) {
    element.querySelector('#coop-search-input').focus()
  }

  unload () {
    this.text = ''
  }

  createElement (cooperative, onselect) {
    this.cooperative = cooperative._id

    const { cooperatives, consumptions: { type } } = this.state
    const pattern = new RegExp(this.text.replace(/\\/, '//'), 'i')
    const results = this.text ? cooperatives.filter(item => {
      if (item._id === cooperative._id) return false
      if (!item.meters.find(meter => meter.type === type && meter.valid)) return false
      return pattern.test(item.name)
    }) : []

    const oninput = event => {
      this.text = event.target.value
      this.rerender()
    }

    return html`
      <form class="Form">
        <h1 class="Display Display--2 u-marginVm u-textCenter">${__('Find cooperative')}</h1>
        ${input({ label: __('Type here'), id: 'coop-search-input', type: 'search', name: 'search', oninput: oninput, value: this.text, autocomplete: 'off', autofocus: true, autocorrect: 'off' })}
        ${this.text ? html`
          <ul class="List">
            ${results.length ? results.slice(0, 6).map(item => html`
              <li class="List-item">
                <button class="Button Button--link u-block u-sizeFull u-paddingAb" type="submit" name="compare" value="cooperative:${item._id}" onclick=${onselect}>
                  ${item.name}
                </button>
              </li>
            `) : html`
              <li class="ListItem u-paddingHb u-paddingVm u-textCenter">
                <em class="u-colorDark">${__('Sorry, we couldn\'t find any cooperative by that name')}</em>
              </li>
            `}
          </ul>
        ` : null}
      </form>
    `
  }
}
