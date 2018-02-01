const html = require('choo/html')
const component = require('fun-component')
const { input } = require('../form')
const { loader } = require('../icons')
const { __ } = require('../../locale')
const { load } = require('../utils')

module.exports = component({
  name: 'address',
  location: null,
  isLoading: true,

  update (element, [location]) {
    if (location && !this.location) {
      this.location = location
      if (this.mapboxgl) this.init(element)
    }

    return false
  },

  load (element, location) {
    this.location = location

    load([
      'mapbox-gl',
      'https://api.mapbox.com/mapbox-gl-js/v0.34.0/mapbox-gl.css'
    ]).then(([ mapboxgl ]) => {
      this.mapboxgl = mapboxgl
      if (this.location) this.init(element)
    })
  },

  init (element) {
    this.isLoading = false
    this.render()

    this.mapboxgl.accessToken = process.env.MAPBOX_ACCESS_TOKEN
    this.map = new this.mapboxgl.Map({
      container: element.querySelector('.js-map'),
      style: process.env.MAPBOX_STYLE,
      center: [this.location.longitude, this.location.latitude],
      maxZoom: 17,
      zoom: 12
    })

    this.marker = new this.mapboxgl.Marker()
  },

  render (location) {
    let timeout
    const oninput = event => {
      if (event.key === 'Enter') return event.preventDefault()
      if (event.target.value.length < 3) return
      window.clearTimeout(timeout)
      timeout = window.setTimeout(() => {
        window.fetch(getGeocodeURL(event.target.value))
          .then(response => response.json())
          .then(data => {
            const result = data.results.find(result => {

              return result.types.includes('street_address') || result.types.includes('route')
            })

            if (result) {
              const coordinates = [result.geometry.location.lng, result.geometry.location.lat]
              this.marker.setLngLat(coordinates).addTo(this.map)
              this.map.flyTo({
                center: coordinates,
                zoom: 14
              })
            }
          })
      }, 250)
    }

    return html`
      <div class="Address ${this.isLoading ? 'is-loading' : ''}">
        ${input({ label: __('Address'), name: 'address', oninput: oninput })}
        <div class="Address-map js-map">
          ${this.isLoading ? html`
            <div class="Address-loader">
              ${loader()}
            </div>
          ` : null}
        </div>
      </div>
    `
  }
})

function getGeocodeURL (value) {
  const query = value.replace(/\s+/g, ',')
  return [
    `https://maps.googleapis.com/maps/api/geocode/json?address=${query}`,
    'language=sv',
    'region=sv',
    'components=country:SE',
    `key=${process.env.GOOGLE_GEOCODE_KEY}`
  ].join('&')
}
