const html = require('choo/html')
const Component = require('choo/component')
const createPopup = require('./popup')
const { loader } = require('../icons')
const { __ } = require('../../lib/locale')
const { getEnergyClass, getPerformance, load, distance } = require('../base')

const CLUSTER_THRESHOLD = 12
const POPUP_OFFSET = {
  'top': [0, -15],
  'top-left': [0, -15],
  'top-right': [0, -15],
  'bottom': [0, -36],
  'bottom-left': [0, -36],
  'bottom-right': [0, -36],
  'left': [6, -26],
  'right': [-6, -26]
}

module.exports = class Mapbox extends Component {
  constructor (id, state, emit) {
    super(id)
    this.state = state
    this.emit = emit
    this.isInitialized = false
    this.hasLoaded = false
    this.cached = null
  }

  update (cooperatives, center) {
    if (!this.map && this.mapboxgl && center) {
      this.init(cooperatives, center)
    } else if (this.map) {
      const moved = hasMoved(center, this.center)
      let changed = this.cooperatives.length !== cooperatives.length
      changed = changed || cooperatives.reduce((result, cooperative, index) => {
        return result || cooperative._id !== this.cooperatives[index]
      }, false)

      if (!moved && !changed) return false

      if (!this.map.getSource('cooperatives')) {
        this.addSource(cooperatives, center)
      } else {
        // Update map source
        this.map.getSource('cooperatives').setData({
          type: 'FeatureCollection',
          features: cooperatives.map(asFeature)
        })

        if (changed && cooperatives.length) {
          // Recalculate bounds
          const bounds = new this.mapboxgl.LngLatBounds()
          cooperatives.forEach(cooperative => {
            bounds.extend(getLngLat(cooperative))
          })

          // Include an updated position in bounds
          if (moved) bounds.extend(getLngLat(center))

          if (center.precision === 'exact') {
            if (!this.position) {
              // Create position marker for exact position
              this.position = new this.mapboxgl.Marker(myLocation())
            }

            // Update position coordinates
            this.position.setLngLat(getLngLat(center)).addTo(this.map)
          }

          if (cooperatives.length === 1) {
            // Open popup for any single cooperative hit after map has settled
            const feature = asFeature(cooperatives[0])
            this.map.once('moveend', () => {
              this.popup
                .setLngLat(feature.geometry.coordinates)
                .setDOMContent(createPopup(feature))
                .addTo(this.map)
            })
          }

          // Close any open popup before applying new bounds
          if (this.popup.isOpen()) this.popup.remove()

          // Fit new bounds in map
          this.map.fitBounds(bounds, {
            maxZoom: 15,
            padding: this.element.offsetWidth * 0.1
          })
        }
      }
    }

    this.center = center
    this.cooperatives = cooperatives.map(cooperative => cooperative._id)

    return false
  }

  unload (element) {
    element.removeEventListener('touchmove', this)
    if (this.popup.isOpen()) {
      this.popup.remove()
    }
  }

  handleEvent (event) {
    if (this['on' + event.type]) this['on' + event.type](event)
  }

  ontouchmove (event) {
    event.preventDefault()
  }

  load (element) {
    this.cached = element

    if (this.hasLoaded) {
      this.map.resize()
      return
    }

    this.hasLoaded = true
    this.element.addEventListener('touchmove', this)
    const version = process.env.npm_package_dependencies_mapbox_gl

    Promise.all([
      import('mapbox-gl'),
      load(`https://api.mapbox.com/mapbox-gl-js/v${version.replace(/^[^\d]/, '')}/mapbox-gl.css`)
    ]).then(([mapboxgl]) => {
      // Stash mapbox api in scoped variable
      this.mapboxgl = mapboxgl

      // Init if there a center location
      if (this.center && !this.isInitialized) {
        const cooperatives = this.state.cooperatives.filter((item) => {
          return this.cooperatives.includes(item._id)
        })
        window.requestAnimationFrame(() => {
          this.init(cooperatives, this.center)
        })
      }
    })
  }

  select (id) {
    if (!this.map) return

    let source = this.map.getSource('cooperatives')

    if (!source) return
    else source = source.serialize()

    const feature = source.data.features.find((item) => {
      return item.properties.id === id
    })

    if (!feature) return

    this.popup
      .setLngLat(feature.geometry.coordinates)
      .setDOMContent(createPopup(feature))

    if (!this.popup.isOpen()) this.popup.addTo(this.map)

    const bounds = new this.mapboxgl.LngLatBounds()
    bounds.extend(feature.geometry.coordinates)

    // Fit new bounds in map
    this.map.fitBounds(bounds, {
      maxZoom: 15,
      padding: this.element.offsetWidth * 0.1
    })
  }

  init (cooperatives, center) {
    this.isInitialized = true

    /**
     * Unset loading state and empty out container
     */

    this.element.classList.remove('is-loading')
    this.element.innerHTML = ''

    this.popup = new this.mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: POPUP_OFFSET
    })

    this.mapboxgl.accessToken = process.env.MAPBOX_ACCESS_TOKEN
    const map = this.map = new this.mapboxgl.Map({
      container: this.element,
      style: process.env.MAPBOX_STYLE,
      maxZoom: 17
    })

    /**
     * Try and fit center and a couple cooperatives in map
     */

    if (cooperatives.length) {
      map.fitBounds(this.getBounds(cooperatives, getLngLat(center)), {
        padding: this.element.offsetWidth * 0.1,
        animate: false
      })
    } else {
      map.fitBounds(this.getBounds(getLngLat(center)), {
        padding: this.element.offsetWidth * 0.1,
        animate: false
      })
    }

    if (center.precision === 'exact') {
      // Create a marker for exact position
      this.position = new this.mapboxgl.Marker(myLocation())
        .setLngLat(getLngLat(center))
        .addTo(map)
    } else {
      this.map.setZoom(11)
    }

    map.on('load', () => {
      if (!this.map.getSource('cooperatives') && cooperatives.length) {
        this.addSource(cooperatives, center)
      }

      /**
       * Handle clicking on the map
       */

      map.on('click', event => {
        // Figure out which (if any) layers has been clicked
        const features = map.queryRenderedFeatures(event.point, {
          layers: ['cooperative-markers', 'cooperative-clusters']
        })

        if (!features.length) {
          if (this.popup.isOpen()) this.popup.remove()
          return
        }

        const feature = features[0]

        if (feature.properties.cluster) {
          if (this.popup.isOpen()) this.popup.remove()

          // Reveal all cooperatives in cluster
          map.flyTo({
            center: feature.geometry.coordinates,
            zoom: CLUSTER_THRESHOLD + 1
          })
        } else {
          // Show cooperative popup
          this.popup
            .setLngLat(feature.geometry.coordinates)
            .setDOMContent(createPopup(feature))

          if (!this.popup.isOpen()) this.popup.addTo(map)

          this.emit('track', {
            event_name: 'inspect',
            event_category: 'map',
            event_label: feature.properties.name,
            id: feature.properties._id
          })
        }
      })

      /**
       * Handle pointer
       */

      map.on('mouseenter', 'cooperative-clusters', onmouseenter)
      map.on('mouseleave', 'cooperative-clusters', onmouseleave)
      map.on('mouseenter', 'cooperative-markers', onmouseenter)
      map.on('mouseleave', 'cooperative-markers', onmouseleave)
    })

    function onmouseenter () {
      map.getCanvas().style.cursor = 'pointer'
    }

    function onmouseleave () {
      map.getCanvas().style.cursor = ''
    }
  }

  addSource (cooperatives) {
    /**
     * Add cooperatives as source
     */

    this.map.addSource('cooperatives', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: cooperatives.map(asFeature)
      },
      cluster: true,
      clusterMaxZoom: CLUSTER_THRESHOLD
    })

    /**
     * Add all individual (unclustered cooperatives)
     */

    this.map.addLayer({
      id: 'cooperative-markers',
      type: 'symbol',
      source: 'cooperatives',
      filter: ['!has', 'point_count'],
      layout: {
        'icon-allow-overlap': true,
        'icon-image': 'marker-{energyClass}',
        'icon-offset': [0, -21]
      }
    })

    /**
     * Add clusters
     */

    this.map.addLayer({
      id: 'cooperative-clusters',
      type: 'symbol',
      source: 'cooperatives',
      filter: ['has', 'point_count'],
      layout: {
        'icon-allow-overlap': true,
        'icon-image': 'marker-cluster',
        'text-field': '{point_count}',
        'text-font': [ 'Lato Bold' ],
        'text-size': 14,
        'text-offset': [ 0, 0.85 ]
      },
      paint: {
        'text-color': '#fff'
      }
    })
  }

  createElement (cooperatives, center) {
    this.center = center
    this.cooperatives = cooperatives.map(cooperative => cooperative._id)

    if (this.cached) return this.cached

    return html`
      <div class="Map-container" id="map-canvas">
        <div class="Map-loader u-colorSky" id="map-loader">${loader()}</div>
      </div>
    `
  }

  /**
   * Calculate bounds for given coopeartives and center coordinates
   * @param  {Array}      cooperatives List of cooperatives
   * @param  {LatLngLike} center       Coordinates to base positioning on
   * @return {mapbox.LngLatBounds}
   */

  getBounds (cooperatives, center) {
    let include
    const bounds = new this.mapboxgl.LngLatBounds()
    const closest = cooperatives.map(cooperative => {
      return distance(center, getLngLat(cooperative))
    }).sort()[0]

    if (closest < 200) {
      // Include center
      bounds.extend(center)

      // Include the closest five cooperatives if within reasonable distance
      include = cooperatives.slice()
        .sort((a, b) => {
          const aDistance = distance(center, getLngLat(a))
          const bDistance = distance(center, getLngLat(b))
          return aDistance > bDistance ? 1 : -1
        })
        .filter((item, index) => index < 5)
    } else {
      // Include all cooperatives if center is too far off
      include = cooperatives
    }

    include.forEach(cooperative => bounds.extend(getLngLat(cooperative)))

    return bounds
  }
}

/**
 * Generic "You are here"-location marker
 */

function myLocation () {
  return html`
    <div>
      <div class="Map-position">${__('You are here')}</div>
    </div>
  `
}

/**
 * Extract coordinates as LngLatLike object from object
 * @param  {Object} props Object with some kind of lat/lng properties
 * @return {Array}        LatLngLike (Mapbox compatible)
 */

function getLngLat (props) {
  return [
    props.longitude || props.lng,
    props.latitude || props.lat
  ]
}

function asFeature (cooperative) {
  const { value: performance } = getPerformance(cooperative) || {}

  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [ cooperative.lng, cooperative.lat ]
    },
    properties: Object.assign({
      id: cooperative._id,
      performance: performance,
      energyClass: (getEnergyClass(cooperative) || 'unknown').toLowerCase()
    }, cooperative)
  }
}

function hasMoved (coordsA, coordsB) {
  return ['latitude', 'longitude'].reduce((changed, key) => {
    return changed || coordsA[key] !== coordsB[key]
  }, false)
}
