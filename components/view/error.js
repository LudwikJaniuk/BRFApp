const html = require('choo/html')
const Component = require('choo/component')
const { __ } = require('../../lib/locale')

module.exports = class ApplicationError extends Component {
  constructor (id, state, emit) {
    super(id)
    this.state = state
    this.emit = emit
    this.hasError = !!state.error
    this.load = this.afterupdate
  }

  update () {
    return this.hasError !== !!this.state.error
  }

  afterupdate (element) {
    if (this.hasError) element.scrollIntoView({ behavior: 'smooth' })
  }

  createElement () {
    this.hasError = !!this.state.error

    return html`
      <div role="${this.hasError ? 'alert' : 'none'}" class="View-error" id="app-error">
        ${this.hasError ? html`
          <div class="View-container View-container--lg u-flexNoWrap u-flexAlignItemsStart u-flexJustifyBetween u-paddingVs">
            ${this.state.error.message}
            <button class="Button Button--link u-paddingLs u-colorCurrent" onclick=${() => this.emit('error:dismiss')}>
              ${__('Close')}
            </button>
          </div>
        ` : null}
      </div>
    `
  }
}
