const url = require('url')
const got = require('got')
const moment = require('moment')
const mongoose = require('mongoose')
const MapboxClient = require('mapbox')
const auth = require('../middleware/auth')
const assert = require('../assert')
const Users = require('./users')

const mapbox = new MapboxClient(process.env.MAPBOX_ACCESS_TOKEN)

const HOUSEHOLD_DEFAULT_DEDUCTION = 30
const CLIMATEZONE_EXCEPTIONS = [
  [11.79628, 57.666494, 12.088997, 57.787798], // Göteborg
  [12.261314, 57.630268, 12.414577, 57.734324], // Härryda
  [11.949245, 57.606115, 12.082203, 57.679487], // Mölndal
  [12.078297, 57.709873, 12.15362, 57.77442], // Partille
  [11.588586, 57.627249, 11.709036, 57.800938] // Öckerö (estimate)
]
const CLIMATEZONES = [
  ['Norrbottens län', 'Västerbottens län', 'Jämtlands län'],
  ['Västernorrlands län', 'Gävleborgs län', 'Dalarnas län', 'Värmlands län'],
  ['Jönköpings län', 'Kronobergs län', 'Östergötlands län', 'Södermanlands län',
    'Örebro län', 'Västmanlands län', 'Stockholms län', 'Uppsala län',
    'Gotlands län', 'Västra Götalands län'],
  ['Kalmar län', 'Blekinge län', 'Skåne län', 'Hallands län']
]

const CooperativeSchema = new mongoose.Schema({
  name: String,
  metryId: {
    type: String,
    requried: true
  },
  email: String,
  lat: Number,
  lng: Number,
  address: {
    address: String,
    postalCode: String,
    postalTown: String
  },
  climateZone: {
    type: Number,
    min: 1,
    max: 4
  },
  yearOfConst: Number,
  area: Number,
  numOfApartments: Number,
  ventilationType: [String],
  incHouseholdElectricity: Boolean,
  hasLaundryRoom: Boolean,
  hasGarage: Boolean,
  hasCharger: Boolean,
  hasEnergyProduction: Boolean,
  hasSolarPanels: Boolean,
  hasGeothermalHeating: Boolean,
  hasRepresentative: Boolean,
  hasConsumptionMapping: Boolean,
  hasGoalManagement: Boolean,
  hasBelysningsutmaningen: Boolean,
  needUpdate: Boolean,
  hasRegistered: Boolean,
  syncedAt: Date,
  meters: [
    new mongoose.Schema({
      type: String,
      meterId: String,
      valid: Boolean
    })
  ],
  performances: [
    new mongoose.Schema({
      year: Number,
      month: Number,
      value: Number,
      area: Number,
      isGuesstimate: Boolean,
      incHouseholdElectricity: Boolean
    })
  ],
  actions: {
    type: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Action'
    }],
    default: []
  },
  editors: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
})

/**
 * Clean up orphaned actions on cooperative remove
 */

CooperativeSchema.pre('remove', function (next) {
  this.model('Action').remove({ cooperative: this._id }, next)
})

/**
 * Complement cooperative attributes on save
 */

CooperativeSchema.pre('save', async function (next) {
  if ((this.lat && this.isModified('lat')) || (this.lng && this.isModified('lng'))) {
    // Update climate zone when location change
    this.climateZone = await getClimateZone(this.lat, this.lng)

    // Lookup address when location change
    if (!this.address.address) {
      // Reverse geocode coordinates
      const getComponent = await got(
        'https://maps.googleapis.com/maps/api/geocode/json',
        {
          json: true,
          query: {
            latlng: [this.lat, this.lng].join(','),
            location_type: 'ROOFTOP',
            result_type: 'street_address',
            key: process.env.GOOGLE_GEOCODE_KEY
          }
        }
      ).then(function (data) {
        const result = data.body.results.find(result => {
          return result.types.includes('street_address')
        })

        if (!result) throw new Error('Not a valid address')

        return function (key) {
          const component = result.address_components.find(item => {
            return item.types.includes(key)
          })
          return component ? component.long_name : ''
        }
      }).catch(function () {
        return null
      })

      if (getComponent) {
        const street = getComponent('route')
        const num = getComponent('street_number')
        this.address = {}
        this.address.address = `${street} ${num}`
        this.address.postalCode = getComponent('postal_code')
        this.address.postalTown = getComponent('postal_town')
      }
    }
  }

  next()
})

/**
 * Prevent JSON responses from including populated fields
 */

CooperativeSchema.methods.toJSON = function toJSON () {
  const props = this.toObject()

  props._id = this._id.toString()
  props.actions = props.actions.map(action => (action._id || action).toString())
  props.editors = props.editors.map(editor => (editor._id || editor).toString())

  return props
}

const Cooperatives = mongoose.model('Cooperative', CooperativeSchema)

exports.create = function create (props, user) {
  return Cooperatives.create(Object.assign({}, props, {
    editors: user ? [ typeof user === 'object' ? user._id : user ] : []
  }))
}

exports.all = async function all () {
  const cooperatives = await Cooperatives.find({
    hasRegistered: true,
    lat: { $exists: true },
    lng: { $exists: true }
  })

  await Promise.all(cooperatives.map(async (cooperative) => {
    const syncedAt = cooperative.syncedAt
    const threshold = moment().subtract(1, 'month')

    if (syncedAt || moment(syncedAt).isBefore(threshold)) {
      await sync(cooperative)
    }

    return calculatePerformance(cooperative)
  }))

  return cooperatives
}

exports.get = async function get (id) {
  const cooperative = await Cooperatives
    .findOne({ _id: id })
    .populate('actions')
    .populate('editors')
    .exec()

  assert(cooperative, 404, 'Cooperative not found')

  const syncedAt = cooperative.syncedAt
  const threshold = moment().subtract(1, 'month')

  if (syncedAt || moment(syncedAt).isBefore(threshold)) {
    await sync(cooperative)
  }

  await calculatePerformance(cooperative)

  return cooperative
}

exports.update = async function update (id, props, user) {
  assert(user, 400, 'User credentials required to update')
  const cooperative = await Cooperatives.findOne({ _id: id })
  assert(cooperative, 404, 'Cooperative not found')

  /**
   * Update meter location if coordinates have changed
   */

  if (props.lat || props.lng) {
    if (props.lat !== cooperative.lat || props.lng !== cooperative.lng) {
      const responses = await Promise.all(cooperative.meters.map(meter => got(url.resolve(
        process.env.METRY_ENDPOINT,
        `meters/${meter.meterId}`
      ), {
        json: true,
        method: 'PUT',
        body: { location: [props.lng, props.lat] },
        headers: { 'Authorization': `Bearer ${user.accessToken}` }
      })))

      for (let i = 0, len = responses.length, body; i < len; i++) {
        body = responses[i].body
        assert(body.code === 200, body.code, body.message)
        const meter = cooperative.meters.find(meter => {
          return meter.meterId === body.data._id
        })
        meter.valid = true
      }
    }
  }

  /**
   * Assign all props to cooperative
   */

  Object.assign(cooperative, props)

  const areaChanged = props.area && (cooperative.area !== props.area)
  if (areaChanged || props.meters) {
    // Remove last perfomance calculation if performance critical props has changed
    cooperative.performances.$pop()

    // Recalculate latest performance
    await calculatePerformance(cooperative)
  }

  return cooperative.save()
}

exports.getConsumption = async function getConsumption (id, options) {
  const cooperative = await Cooperatives.findOne({ _id: id })

  assert(cooperative, 404, 'Cooperative not found')

  const types = options.types.filter(type => type !== 'none')
  const hasType = cooperative.meters.find(meter => {
    return types.includes(meter.type)
  })

  if (hasType) {
    return queryConsumption(cooperative, options)
  } else {
    return []
  }
}

exports.getAll = function getAll () {
  return Cooperatives.find({})
}

/**
 * Sync cooperative (meter, location etc.) with Metry
 * @param {String|Object} id  Cooperative or cooperative id
 * @param {String} accessToken User access token
 * @return {Promise}
 */

exports.sync = sync
async function sync (id, accessToken) {
  const cooperative = id._id ? id : await Cooperatives.findOne({_id: id})

  if (!accessToken) {
    let refreshToken

    // Lookup refresh tokens of cooperative editors
    for (const id of cooperative.editors) {
      let editor = await Users.model.findOne({ _id: id })
      if (editor.refreshToken) {
        refreshToken = editor.refreshToken
        break
      }
    }

    assert(refreshToken, 400, 'Could not find a refresh token')

    // Generate access token for single use
    accessToken = await auth.refresh(refreshToken)
  }

  // Shared http settings
  const options = {
    json: true,
    headers: { 'Authorization': `Bearer ${accessToken}` }
  }

  // Fetch cooperative meters
  const meters = await got(url.resolve(
    process.env.METRY_ENDPOINT,
    'meters?box=active'
  ), options).then(({ body }) => {
    assert(body.code === 200, body.code, body.message)
    return body.data
  })

  // Check for new meters
  const missing = meters.filter((meter) => {
    return !cooperative.meters.find(({ meterId }) => meterId === meter._id)
  })

  // Identify legacy meters
  const excess = cooperative.meters.filter(meter => {
    // Allow for an empty meter of type `none`
    if (meter.type === 'none') return true
    return !meters.find(({ _id }) => _id === meter.meterId)
  })

  // Publish new meters to open channel
  if (missing.length) {
    await Promise.all(missing.map(async function (meter) {
      const { body } = await got(url.resolve(
        process.env.METRY_ENDPOINT,
        `open_channels/${process.env.METRY_OPEN_CHANNEL}/meters`
      ), Object.assign({}, options, {body: { meter_id: meter._id }}))
      assert(body.code === 200, body.code, body.message)
    }))
  }

  // Add and remove meters on cooperative
  cooperative.meters = cooperative.meters.filter(meter => {
    return !excess.find(({ meterId }) => meter.meterId === meterId)
  }).concat(missing.map(meter => ({
    type: meter.type,
    meterId: meter._id,
    valid: !!meter.location
  })))

  // Reflect meter coordinates to incomplete cooperative
  if (!cooperative.lat || !cooperative.lng) {
    cooperative.needUpdate = true
    const meter = meters.find(meter => meter.location)
    if (meter) {
      cooperative.lng = meter.location[0]
      cooperative.lat = meter.location[1]
    }
  }

  // Reflect cooperative coordinates on meters missing location
  if (cooperative.lat && cooperative.lng) {
    const invalid = cooperative.meters.filter(meter => {
      const source = meters.find((src) => src._id === meter.meterId)
      return !meter.valid && !source.location
    })

    await Promise.all(invalid.map(function (meter) {
      return got(url.resolve(
        process.env.METRY_ENDPOINT,
        `meters/${meter.meterId}`
      ), Object.assign({}, options, {
        method: 'PUT',
        body: {
          location: [cooperative.lng, cooperative.lat]
        }
      })).then(function (response) {
        const body = response.body
        assert(body.code === 200, body.code, body.message)
        meter.valid = true
      })
    }))
  }

  cooperative.syncedAt = Date.now()

  // Save all changes made to cooperative
  await cooperative.save()
}

async function getClimateZone (lat, lng) {
  const isZone4 = CLIMATEZONE_EXCEPTIONS.find(bbox => {
    const sw = bbox.slice(0, 2)
    const ne = bbox.slice(2, 4)
    return lng > sw[0] && lng < ne[0] && lat < sw[1] && lat > ne[1]
  })

  if (isZone4) {
    return 4
  }

  const response = await mapbox.geocodeReverse(
    { latitude: lat, longitude: lng },
    { types: 'region', limit: 1 }
  )

  const region = response.entity.features[0].place_name.split(',')[0]
  const zone = CLIMATEZONES.find(regions => {
    return regions.includes(region)
  })

  return zone ? CLIMATEZONES.indexOf(zone) + 1 : null
}

async function queryConsumption (cooperative, options) {
  const { types, granularity, from, to, normalized } = options
  const { area } = cooperative
  const meters = cooperative.meters.filter(meter => {
    return meter.valid && types.includes(meter.type)
  })
  const metrics = normalized ? 'energy_norm' : 'energy'

  if (!meters.length) {
    return []
  }

  let endpoint = [
    url.resolve(process.env.METRY_ENDPOINT, 'consumptions'),
    'sum',
    granularity,
    from + (to ? `-${to}` : '')
  ].join('/')

  endpoint += `?metrics=${metrics}`
  endpoint += `&meters=${meters.map(meter => meter.meterId).join(',')}`

  const response = await got(endpoint, { json: true }).catch(err => {
    assert.reject(err.statusCode, err.statusMessage)
  })

  if (response.body.code !== 200) {
    assert.reject(response.body.code, response.body.message)
  }

  const data = response.body.data[0].periods[0][metrics]

  return data.map(value => value && value / (area || 1))
}

async function calculatePerformance (cooperative, offset) {
  if (!cooperative.area) return

  const props = cooperative.toObject()
  let now = new Date()

  if (offset) now = moment(now).subtract(offset, 'months').toDate()

  // Lookup performance for current month
  let performance = cooperative.performances.find(byDate(now))
  if (!offset && !performance) {
    // Fallback to previous month if not specifically offsetting calculation
    performance = cooperative.performances.find(
      byDate(moment(now).subtract(1, 'months').toDate())
    )
  }

  // Exit if there's a recent performance calculation we can use
  if (performance) return

  // Check that the cooperative has valid meters before trying to calculate
  const isValid = ['heat', 'electricity'].reduce((result, type) => {
    return result && !!cooperative.meters.find(meter => {
      return meter.type === type && meter.valid
    })
  }, true)

  if (!isValid) return

  const from = moment(now).subtract(11, 'months').format('YYYYMM')
  const to = moment(now).format('YYYYMM')
  const options = { granularity: 'month', from, to }

  const [heat, electricity] = await Promise.all([
    { types: ['heat'], normalized: true },
    { types: ['electricity'] }
  ].map(opts => queryConsumption(props, Object.assign({}, options, opts))))

  // Only calculate performance when we have a complete dataset
  if (
    heat.filter(Boolean).length !== 12 ||
    electricity.filter(Boolean).length !== 12
  ) {
    // Lookup latest performance calculation
    let latest = props.performances[props.performances.length - 1]

    // Rewind one month to get a first performance calculation
    if (!latest) {
      if (
        heat.filter(Boolean).length === 11 ||
        electricity.filter(Boolean).length === 11
      ) return calculatePerformance(cooperative, 1)
      else return
    }

    // Figure out how many months are missing
    const missing = moment(now).diff([latest.year, latest.month], 'months')
    if (offset || missing <= 1) return

    // Try and fill in missing months if there's one or more months missing
    return calculatePerformance(cooperative, 1)
  }

  const values = electricity.map((value, index) => {
    return (value || 0) + (heat[index] || 0)
  })

  if (cooperative.incHouseholdElectricity === false) {
    return setPerfomance(values)
  }

  let isGuesstimate = false
  let deductHouseholdConsumption = cooperative.incHouseholdElectricity
  const total = electricity.reduce((mem, value) => mem + value, 0)

  if (typeof cooperative.incHouseholdElectricity === 'undefined') {
    if (total > 50) {
      deductHouseholdConsumption = true
    } else if (total > 20) {
      isGuesstimate = true
    }
  }

  return setPerfomance(values, isGuesstimate, deductHouseholdConsumption)

  /**
   * Set cooperative performance with given values
   * @param {array} values List of values from which to calculate performance
   * @param {boolean} isGuesstimate Whether the values were guestimated
   */

  function setPerfomance (values, isGuesstimate = false, deduct = false) {
    let value = values.reduce((memo, num) => memo + num, 0)

    // Exit if there were no values found
    if (!value) return

    // Deduct household consumption
    if (deduct) value -= HOUSEHOLD_DEFAULT_DEDUCTION

    cooperative.performances.push({
      year: now.getFullYear(),
      month: now.getMonth(),
      area: cooperative.area,
      value: value,
      isGuesstimate: isGuesstimate,
      incHouseholdElectricity: deduct
    })

    return cooperative.save()
  }

  /**
   * Create an iterator function that matches given date with
   * year and month of iteratiee properties
   * @param  {Date} date Date to match against
   * @return {function}      Iterator function
   */

  function byDate (date) {
    const year = date.getFullYear()
    const month = date.getMonth()

    return props => props.year === year && props.month === month
  }
}

exports.model = Cooperatives
