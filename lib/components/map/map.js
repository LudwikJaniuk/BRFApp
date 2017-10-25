const html = require('choo/html');
const component = require('fun-component');
const createPopup = require('./popup');
const { loader } = require('../icons');
const { __ } = require('../../locale');
const { getEnergyClass, getPerformance, load } = require('../utils');

const CLUSTER_THRESHOLD = 12;
const POPUP_OFFSET = {
  'top': [0, -15],
  'top-left': [0, -15],
  'top-right': [0, -15],
  'bottom': [0, -36],
  'bottom-left': [0, -36],
  'bottom-right': [0, -36],
  'left': [6, -26],
  'right': [-6, -26]
};

module.exports = component({
  name: 'map',
  cache: true,
  isInitialized: false,
  hasLoaded: false,

  update(element, args, prev) {
    const [ cooperatives, center ] = args;

    if (!this.map && this.mapboxgl && center) {
      this.init(element, ...args);
    } else if (shouldUpdate(args, prev) && this.map) {
      // Update map source
      this.map.getSource('cooperatives').setData({
        type: 'FeatureCollection',
        features: asFeatures(cooperatives)
      });

      if (coordinatesDiff(center, prev[1])) {
        // Recalculate bounds
        const bounds = this.getBounds(cooperatives, getLngLat(center));

        if (center.precission === 'exact') {
          if (!this.position) {
            // Create position marker for exact position
            this.position = new this.mapboxgl.Marker(myLocation());
          }

          // Update position coordinates
          this.position.setLngLat(getLngLat(center)).addTo(this.map);

          // Ensure that exact position is included in bounds
          bounds.extend(getLngLat(center));
        }

        // Fit new bounds in map
        this.map.fitBounds(bounds, { padding: element.offsetWidth * 0.1 });
      }
    }

    return false;
  },

  unload() {
    if (this.popup && this.popup.isOpen()) {
      this.popup.remove();
    }
  },

  load(element, cooperatives, center, emit) {
    if (this.hasLoaded) { return; }
    this.hasLoaded = true;

    load([
      'mapbox-gl',
      'https://api.mapbox.com/mapbox-gl-js/v0.34.0/mapbox-gl.css'
    ]).then(([ mapboxgl ]) => {
      // Stash mapbox api in scoped variable
      this.mapboxgl = mapboxgl;

      // Init if there a center location
      if (center && !this.isInitialized) {
        this.init(element, cooperatives, center, emit);
      }
    });
  },

  init(element, cooperatives, center, emit) {
    this.isInitialized = true;

    /**
     * Unset loading state and empty out container
     */

    element.classList.remove('is-loading');
    element.innerHTML = '';

    this.mapboxgl.accessToken = process.env.MAPBOX_ACCESS_TOKEN;
    const map = this.map = new this.mapboxgl.Map({
      container: element,
      style: process.env.MAPBOX_STYLE,
      maxZoom: 17
    });

    /**
     * Try and fit center and a couple cooperatives in map
     */

    if (cooperatives.length) {
      map.fitBounds(this.getBounds(cooperatives, getLngLat(center)), {
        padding: element.offsetWidth * 0.1,
        animate: false
      });
    }

    if (center.precission === 'exact') {
      // Create a marker for exact position
      this.position = new this.mapboxgl.Marker(myLocation())
        .setLngLat(getLngLat(center))
        .addTo(map);
    }

    map.on('load', () => {

      /**
       * Add cooperatives as source
       */

      map.addSource('cooperatives', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: asFeatures(cooperatives)
        },
        cluster: true,
        clusterMaxZoom: CLUSTER_THRESHOLD
      });

      /**
       * Add all individual (unclustered cooperatives)
       */

      map.addLayer({
        id: 'cooperative-markers',
        type: 'symbol',
        source: 'cooperatives',
        filter: ['!has', 'point_count'],
        layout: {
          'icon-allow-overlap': true,
          'icon-image': 'marker-{energyClass}',
          'icon-offset': [0, -21]
        }
      });

      /**
       * Add clusters
       */

      map.addLayer({
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
      });

      /**
       * Zoom out if center posiiton is unprecise
       */

      if (center.precission !== 'exact') {
        map.setZoom(11);
      }

      /**
       * Handle pointer
       */

      map.on('mousemove', event => {
        const features = map.queryRenderedFeatures(event.point, {
          layers: ['cooperative-markers', 'cooperative-clusters']
        });

        map.getCanvas().style.cursor = features.length ? 'pointer' : '';
      });

      /**
       * Handle clikcing on the map
       */

      map.on('click', event => {
        // Figure out which (if any) layers has been clicked
        const features = map.queryRenderedFeatures(event.point, {
          layers: ['cooperative-markers', 'cooperative-clusters']
        });

        if (!features.length) {
          return;
        }

        const feature = features[0];

        if (feature.properties.cluster) {
          // Reveal all cooperatives in cluster
          map.flyTo({
            center: feature.geometry.coordinates,
            zoom: CLUSTER_THRESHOLD + 1
          });
        } else {
          // Show cooperative popup
          this.popup = new this.mapboxgl.Popup({ closeButton: false, offset: POPUP_OFFSET });
          this.popup
            .setLngLat(feature.geometry.coordinates)
            .setDOMContent(createPopup(feature))
            .addTo(map);

          emit('track', {
            event_name: 'inspect',
            event_category: 'map',
            event_label: feature.properties.name,
            id: feature.properties._id
          });
        }
      });
    });
  },

  render() {
    return html`
      <div class="Map-container" id="map-canvas">
        <div class="Map-loader u-colorSky" id="map-loader">${ loader() }</div>
      </div>
    `;
  },

  /**
   * Calculate bounds for given coopeartives and center coordinates
   * @param  {Array}      cooperatives List of cooperatives
   * @param  {LatLngLike} center       Coordinates to base positioning on
   * @return {mapbox.LngLatBounds}
   */

  getBounds(cooperatives, center) {
    let include;
    const bounds = new this.mapboxgl.LngLatBounds();
    const closest = cooperatives.map(cooperative => {
      return getPositionDistance(center, getLngLat(cooperative));
    }).sort()[0];

    if (closest < 200) {
      // Include center
      bounds.extend(center);

      // Include the closest five cooperatives if within reasonable distance
      include = cooperatives.slice()
        .sort((a, b) => {
          const aDistance = getPositionDistance(center, getLngLat(a));
          const bDistance = getPositionDistance(center, getLngLat(b));
          return aDistance > bDistance ? 1 : -1;
        })
        .filter((item, index) => index < 5);
    } else {
      // Include all cooperatives if center is too far off
      include = cooperatives;
    }

    include.forEach(cooperative => bounds.extend(getLngLat(cooperative)));

    return bounds;
  }
});

/**
 * Determin whether map should update
 * @param {any} [cooperatives, center]
 * @param {any} [prevCooperatives, prevCenter]
 * @returns {boolean}
 */

function shouldUpdate([cooperatives, center], [prevCooperatives, prevCenter]) {
  // Check if number of cooperatives has changed
  if (cooperatives.length !== prevCooperatives.length) {
    return true;
  }

  // Check if center has changed
  if (!center || !prevCenter || coordinatesDiff(center, prevCenter)) {
    return true;
  }

  return false;
}

/**
 * Generic "You are here"-location marker
 */

function myLocation() {
  return html`
    <div>
      <div class="Map-position">${ __('You are here') }</div>
    </div>
  `;
}

/**
 * Extract coordinates as LngLatLike object from object
 * @param  {Object} props Object with some kind of lat/lng properties
 * @return {Array}        LatLngLike (Mapbox compatible)
 */

function getLngLat(props) {
  return [
    props.longitude || props.lng,
    props.latitude || props.lat
  ];
}

/**
 * Convert degrees to radius
 */

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

/**
 * Calculate distance between two lat/lng points in km
 */

function getPositionDistance(posA, posB) {
  const [lng1, lat1] = posA;
  const [lng2, lat2] = posB;

  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1); // deg2rad above
  const dLon = deg2rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km

  return d;
}

function asFeatures(cooperatives) {
  return cooperatives.map(cooperative => {
    const { value: performance } = getPerformance(cooperative) || {};

    return {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [ cooperative.lng, cooperative.lat ]
      },
      properties: Object.assign({
        id: cooperative._id,
        performance: performance,
        energyClass: (getEnergyClass(performance) || 'unknown').toLowerCase()
      }, cooperative)
    };
  });
}

function coordinatesDiff(coordsA, coordsB) {
  return ['latitude', 'longitude'].reduce((changed, key) => {
    return changed || coordsA[key] !== coordsB[key];
  }, false);
}
