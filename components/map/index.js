const html = require('choo/html')
const Component = require('choo/component')
const asElement = require('prismic-element')
const { asText } = require('prismic-richtext')
const modal = require('../modal')
const Mapbox = require('./mapbox')
const Filter = require('./filter')
const { follow } = require('../base')
const { loader } = require('../icons')
const { __ } = require('../../lib/locale')
const resolve = require('../../lib/resolve')

module.exports = class MapExplorer extends Component {
  constructor (id, state, emit) {
    super(id)
    this.id = id
    this.filter = {}
    this.cache = state.cache
    this.state = state
    this.emit = emit
    this.modal = null
  }

  update () {
    if (this.modal) {
      modal.render(this.modal(), () => { this.modal = null })
    }

    return this.cooperatives.reduce((shouldUpdate, cooperative, index) => {
      return shouldUpdate || cooperative._id !== this.cooperatives[index]
    }, false)
  }

  createElement () {
    this.registration = this.state.content.registration
    this.cooperatives = this.state.cooperatives.map(item => item._id)

    const { user } = this.state
    const cooperatives = Filter.apply(this.state.cooperatives, this.filter)

    const filter = () => {
      return this.cache(Filter, this.id + '-filter').render(
        this.state.cooperatives,
        (props) => {
          if (props._id) {
            this.cache(Mapbox, this.id + '-mapbox').select(props._id)
          } else {
            this.filter = props
          }
          this.modal = null
          modal.close()
          this.rerender()
        }
      )
    }

    const openModal = (content) => (event) => {
      this.modal = content
      modal.render(this.modal(), () => { this.modal = null })
      event.preventDefault()
    }

    const signup = () => {
      if (!this.registration) {
        this.emit('content:fetch', 'registration')
        return html`
          <div class="u-marginVl u-textCenter u-colorSky">
            ${loader()}
          </div>
        `
      }

      return html`
        <div class="u-flex u-flexCol u-sizeFullV">
          <div class="u-flexGrow1 u-paddingVl u-paddingHm">
            <h1 class="Display Display--2 u-textCenter">
              ${asText(this.registration.data.disclaimer_title)}
            </h1>
            <div class="Type">
              ${asElement(this.registration.data.disclaimer_body)}
            </div>
          </div>
          <a href="${resolve('/auth/metry/sign-up')}" onclick=${follow} class="Button u-flexShrink0">
            ${__('Create an account')}
          </a>
        </div>
      `
    }

    let center
    if (user) {
      const home = this.state.cooperatives.find(item => {
        return item._id === user.cooperative
      })
      center = home && { longitude: home.lng, latitude: home.lat }
    }

    if (!center) {
      if (this.state.geoip && this.state.geoip.ll) {
        const [latitude, longitude] = this.state.geoip.ll
        center = {
          longitude: longitude,
          latitude: latitude,
          precision: 'city'
        }
      } else {
        center = {
          longitude: 18.05,
          latitude: 59.3333,
          precision: 'city'
        }
      }
    }

    if (this.modal) {
      modal.render(this.modal(), () => { this.modal = null })
    }

    return html`
      <div class="Map u-hiddenNoScript" id="map-container">
        ${this.cache(Mapbox, this.id + '-mapbox').render(cooperatives, center)}

        <div class="Map-recruit" id="map-recruit">
          ${!this.state.user ? html`
            <div class="Map-panel" id="map-recruit-panel">
              ${__('Missing your cooperative?') + ' '} <a href="${resolve('/auth/sign-up')}" onclick=${openModal(signup)}>${__('Add your cooperative')}</a>
            </div>
          ` : null}
          <button class="Button" onclick=${openModal(filter)} style="margin-left: auto;">
            ${__('Search and filter')} ${Object.keys(this.filter).length ? ` (${cooperatives.length})` : ''}
          </button>
        </div>

        <div class="Map-controls" id="map-recruit">
          ${!this.state.user ? html`
            <a href="${resolve('/auth/sign-up')}" onclick=${openModal(signup)} class="Button u-flexGrow1" id="map-recruit-button">
              ${__('Add your cooperative')}
            </a>
          ` : null}
          <button class="Button u-flexGrow1" onclick=${openModal(filter)}>
            ${__('Search and filter')} ${Object.keys(this.filter).length ? ` (${cooperatives.length})` : ''}
          </button>
        </div>
      </div>
    `
  }
}
