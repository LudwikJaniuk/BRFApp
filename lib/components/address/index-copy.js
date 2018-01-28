const html = require('choo/html')
const Component = require('nanocomponent')
const { input } = require('../components/form')
const { loader } = require('../icons')
const { __ } = require('../../locale')
const { load } = require('../utils')

module.exports = class Address extends Component {
  constructor (id, onselect) {
    super(`address-${id}`)
    this.isLoading = true
    this.onselect = onselect
  }

  update (location) {
    if (location && !this.location) {
      this.location = location
      if (this.mapboxgl) {
        this.init()
      }
    }

    return false
  }

  load () {
    load([
      'mapbox-gl',
      'https://api.mapbox.com/mapbox-gl-js/v0.34.0/mapbox-gl.css'
    ]).then(([ mapboxgl ]) => {
      this.mapboxgl = mapboxgl
      if (this.location) this.init()
    })
  }

  init () {
    this.isLoading = false
    this.rerender()

    this.mapboxgl.accessToken = process.env.MAPBOX_ACCESS_TOKEN
    const map = this.map = new this.mapboxgl.Map({
      container: this.element.querySelector('.js-map'),
      style: process.env.MAPBOX_STYLE,
      maxZoom: 17
    })
  }

  render () {
    if (this.isLoading) {
      return html`
        <div class="Address is-loading">
          ${loader()}
        </div>
      `
    }

    return html`
      <div class="Address">
        ${input({ label: __('Address'), name: 'address' })}
        <div class="Address-map js-map">
        </div>
      </div>
    `
  }
}
