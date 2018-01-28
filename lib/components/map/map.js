const html = require('choo/html')
const component = require('fun-component')
const createPopup = require('./popup')
const { loader } = require('../icons')
const { __ } = require('../../locale')
const { getEnergyClass, getPerformance, load, distance } = require('../utils')

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

module.exports = component({
  name: 'map',
  cache: true,
  isInitialized: false,
  hasLoaded: false,

  update (element, args, prev) {
    const [ cooperatives, center, emit ] = args

    if (!this.map && this.mapboxgl && center) {
      this.init(element, ...args)
    } else if (shouldUpdate(args, prev) && cooperatives.length && this.map) {
      if (!this.map.getSource('cooperatives')) {
        this.addSource(cooperatives, center, emit)
      } else {
        // Update map source
        this.map.getSource('cooperatives').setData({
          type: 'FeatureCollection',
          features: asFeatures(cooperatives)
        })

        if (coordinatesDiff(center, prev[1])) {
          // Recalculate bounds
          const bounds = this.getBounds(cooperatives, getLngLat(center))

          if (center.precision === 'exact') {
            if (!this.position) {
              // Create position marker for exact position
              this.position = new this.mapboxgl.Marker(myLocation())
            }

            // Update position coordinates
            this.position.setLngLat(getLngLat(center)).addTo(this.map)

            // Ensure that exact position is included in bounds
            bounds.extend(getLngLat(center))
          }

          // Fit new bounds in map
          this.map.fitBounds(bounds, { padding: element.offsetWidth * 0.1 })
        }
      }
    }

    return false
  },

  unload () {
    if (this.popup && this.popup.isOpen()) {
      this.popup.remove()
    }
  },

  load (element, cooperatives, center, emit) {
    if (this.hasLoaded) { return }
    this.hasLoaded = true

    load([
      'mapbox-gl',
      'https://api.mapbox.com/mapbox-gl-js/v0.34.0/mapbox-gl.css'
    ]).then(([ mapboxgl ]) => {
      // Stash mapbox api in scoped variable
      this.mapboxgl = mapboxgl

      // Init if there a center location
      if (center && !this.isInitialized) {
        window.requestAnimationFrame(() => {
          this.init(element, cooperatives, center, emit)
        })
      }
    })
  },

  init (element, cooperatives, center, emit) {
    this.isInitialized = true

    /**
     * Unset loading state and empty out container
     */

    element.classList.remove('is-loading')
    element.innerHTML = ''

    this.mapboxgl.accessToken = process.env.MAPBOX_ACCESS_TOKEN
    const map = this.map = new this.mapboxgl.Map({
      container: element,
      style: process.env.MAPBOX_STYLE,
      maxZoom: 17
    })

    /**
     * Try and fit center and a couple cooperatives in map
     */

    if (cooperatives.length) {
      map.fitBounds(this.getBounds(cooperatives, getLngLat(center)), {
        padding: element.offsetWidth * 0.1,
        animate: false
      })
    }

    if (center.precision === 'exact') {
      // Create a marker for exact position
      this.position = new this.mapboxgl.Marker(myLocation())
        .setLngLat(getLngLat(center))
        .addTo(map)
    }

    map.on('load', () => {
      if (!this.map.getSource('cooperatives') && cooperatives.length) {
        this.addSource(cooperatives, center, emit)
      }
    })
  },

  addSource (cooperatives, center, emit) {
    /**
     * Add cooperatives as source
     */

    this.map.addSource('cooperatives', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: asFeatures(cooperatives)
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

    /**
     * Zoom out if center posiiton is unprecise
     */

    if (center.precision !== 'exact') {
      this.map.setZoom(11)
    }

    /**
     * Handle pointer
     */

    this.map.on('mousemove', event => {
      const features = this.map.queryRenderedFeatures(event.point, {
        layers: ['cooperative-markers', 'cooperative-clusters']
      })

      this.map.getCanvas().style.cursor = features.length ? 'pointer' : ''
    })

    /**
     * Handle clikcing on the map
     */

    this.map.on('click', event => {
      // Figure out which (if any) layers has been clicked
      const features = this.map.queryRenderedFeatures(event.point, {
        layers: ['cooperative-markers', 'cooperative-clusters']
      })

      if (!features.length) {
        return
      }

      const feature = features[0]

      if (feature.properties.cluster) {
        // Reveal all cooperatives in cluster
        this.map.flyTo({
          center: feature.geometry.coordinates,
          zoom: CLUSTER_THRESHOLD + 1
        })
      } else {
        // Show cooperative popup
        this.popup = new this.mapboxgl.Popup({ closeButton: false, offset: POPUP_OFFSET })
        this.popup
          .setLngLat(feature.geometry.coordinates)
          .setDOMContent(createPopup(feature))
          .addTo(this.map)

        emit('track', {
          event_name: 'inspect',
          event_category: 'map',
          event_label: feature.properties.name,
          id: feature.properties._id
        })
      }
    })
  },

  render () {
    return html`
      <div class="Map-container" id="map-canvas">
        <div class="Map-loader u-colorSky" id="map-loader">${loader()}</div>
      </div>
    `
  },

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
})

/**
 * Determin whether map should update
 * @param {any} [cooperatives, center]
 * @param {any} [prevCooperatives, prevCenter]
 * @returns {boolean}
 */

function shouldUpdate ([cooperatives, center], [prevCooperatives, prevCenter]) {
  // Check if number of cooperatives has changed
  if (cooperatives.length !== prevCooperatives.length) {
    return true
  }

  // Check if center has changed
  if (!center || !prevCenter || coordinatesDiff(center, prevCenter)) {
    return true
  }

  return false
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

function asFeatures (cooperatives) {
  return cooperatives.map(cooperative => {
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
  })
}

function coordinatesDiff (coordsA, coordsB) {
  return ['latitude', 'longitude'].reduce((changed, key) => {
    return changed || coordsA[key] !== coordsB[key]
  }, false)
}
