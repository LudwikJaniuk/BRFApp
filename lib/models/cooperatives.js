const url = require('url');
const mongoose = require('mongoose');
const moment = require('moment');
const got = require('got');
const assert = require('../assert');

const HOUSEHOLD_DEFAULT_DEDUCTION = 30;
const DYNAMIC_KEYS = [
  'name',
  'email',
  'lng',
  'lat',
  'yearOfConst',
  'area',
  'numOfApartments',
  'meters',
  'needUpdate',
  'hasRegistered',
  'ventilationType',
  'incHouseholdElectricity',
  'hasLaundryRoom',
  'hasGarage',
  'hasCharger',
  'hasEnergyProduction',
  'hasRepresentative',
  'hasConsumptionMapping',
  'hasGoalManagement',
  'hasBelysningsutmaningen',
];

const CooperativeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  metryId: {
    type: String,
    requried: true
  },
  email: String,
  lat: Number,
  lng: Number,
  yearOfConst: Number,
  area: Number,
  numOfApartments: Number,
  ventilationType: [String],
  incHouseholdElectricity: Boolean,
  hasLaundryRoom: Boolean,
  hasGarage: Boolean,
  hasCharger: Boolean,
  hasEnergyProduction: Boolean,
  hasRepresentative: Boolean,
  hasConsumptionMapping: Boolean,
  hasGoalManagement: Boolean,
  hasBelysningsutmaningen: Boolean,
  needUpdate: Boolean,
  hasRegistered: Boolean,
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
});

/**
 * Add a hook that removes action from it's parent cooperative
 */

CooperativeSchema.pre('remove', function (next) {
  this.model('Action').remove({ cooperative: this._id }, next);
});

/**
 * Prevent JSON responses from including populated fields
 */

CooperativeSchema.methods.toJSON = function toJSON() {
  const props = this.toObject();

  props._id = this._id.toString();
  props.actions = props.actions.map(action => (action._id || action).toString());
  props.editors = props.editors.map(editor => (editor._id || editor).toString());

  return props;
};

const Cooperatives = mongoose.model('Cooperative', CooperativeSchema);

exports.create = function create(props, user) {
  return Cooperatives.create({
    name: props.name,
    metryId: props.metryId,
    email: props.email,
    lng: props.lng,
    lat: props.lat,
    yearOfConst: props.yearOfConst,
    area: props.area,
    numOfApartments: props.numOfApartments,
    meters: props.meters,
    ventilationType: props.ventilationType,
    needUpdate: props.needUpdate,
    hasRegistered: props.hasRegistered,
    editors: user ? [ typeof user === 'object' ? user._id : user ] : []
  });
};

exports.all = async function all() {
  const cooperatives = await Cooperatives.find({
    $and: [{
      hasRegistered: true
    }, {
      meters: { $not: { $size: 0 }}
    }, {
      'meters.valid': { $ne: false }
    }]
  });

  await Promise.all(cooperatives.map(calculatePerformance));

  return cooperatives;
};

exports.get = async function get(id) {
  const cooperative = await Cooperatives
    .findOne({ _id: id })
    .populate('actions')
    .populate('editors')
    .exec();

  assert(cooperative, 404, 'Cooperative not found');

  await calculatePerformance(cooperative);

  return cooperative;
};

exports.update = async function update(id, data, user) {
  const cooperative = await Cooperatives.findOne({ _id: id });

  assert(cooperative, 404, 'Cooperative not found');

  /**
   * Pick properties to update
   */

  const selection = {};
  const areaChanged = data.area && (cooperative.area !== data.area);
  Object.keys(data).filter(key => DYNAMIC_KEYS.includes(key)).forEach(key => {
    selection[key] = data[key];
  });

  /**
   * Check if meters have been updated remotely
   */

  const endpoint = url.resolve(process.env.METRY_ENDPOINT, 'meters?box=active');
  const options = {
    json: true,
    headers: { 'Authorization': `Bearer ${ user.accessToken }` }
  };

  const meters = await got(endpoint, options).then(({ body }) => {
    assert(body.code === 200, body.code, body.message);
    return body.data;
  });

  selection.needUpdate = true;
  cooperative.meters = cooperative.meters.map(meter => {
    const source = meters.find(source => source._id === meter.meterId);
    if (source.location) {
      selection.needUpdate = false;
      meter.valid = true;
    }
    return meter;
  });

  /**
   * Assign all data to cooperative
   */

  Object.assign(cooperative, selection);

  if (areaChanged || data.meters) {
    // Remove last perfomance calculation if performance critical data has changed
    cooperative.performances.$pop();

    // Recalculate latest performance
    await calculatePerformance(cooperative);
  }

  return cooperative.save();
};

exports.getConsumption = async function getConsumption(id, options) {
  const cooperative = await Cooperatives.findOne({ _id: id });

  assert(cooperative, 404, 'Cooperative not found');

  const types = options.types.filter(type => type !== 'none');
  const hasType = cooperative.meters.find(meter => {
    return types.includes(meter.type);
  });

  if (hasType) {
    return queryConsumption(cooperative, options);
  } else {
    return [];
  }
};

exports.getAll = function getAll(){
  return Cooperatives.find({});
};

async function queryConsumption(cooperative, options) {
  const { types, granularity, from, to, normalized } = options;
  const { area } = cooperative;
  const meters = cooperative.meters.filter(meter => {
    return meter.valid && types.includes(meter.type);
  });
  const metrics = normalized ? 'energy_norm' : 'energy';

  if (!meters.length) {
    return [];
  }

  let endpoint = [
    url.resolve(process.env.METRY_ENDPOINT, 'consumptions'),
    'sum',
    granularity,
    from + (to ? `-${ to }` : '')
  ].join('/');

  endpoint += `?metrics=${ metrics }`;
  endpoint += `&meters=${ meters.map(meter => meter.meterId).join(',') }`;

  const response = await got(endpoint, { json: true }).catch(err => {
    assert.reject(err.statusCode, err.statusMessage);
  });

  if (response.body.code !== 200) {
    assert.reject(response.body.code, response.body.message);
  }

  const data = response.body.data[0].periods[0][metrics];

  return data.map(value => value / (area ? area : 1));
}

async function calculatePerformance(cooperative) {
  const props = cooperative.toObject();
  const now = new Date();

  let performance = cooperative.performances.find(match(now));
  if (!performance) {
    performance = cooperative.performances.find(
      match(moment(now).subtract(1, 'months').toDate())
    );
  }

  if (performance) {
    return;
  }

  // Get the last 13 months to ensure 12 actual values
  // since the current month may not have any value yet
  const from = moment(now).subtract(12, 'months').format('YYYYMM');
  const to = moment(now).format('YYYYMM');
  const options = { granularity: 'month', from, to, normalized: true };

  if (cooperative.incHouseholdElectricity === false) {

    /**
     * If the coopereative has expressively specified that households are not
     * included, fetch heat and electricity combined
     */

    return queryConsumption(
      props,
      Object.assign({ types: [ 'heat', 'electricity' ] }, options)
    ).then(setPerfomance);
  } else {

    /**
     * Fetch heat and electricity seperately so that we can deduct houshold
     * consumption from electricity usage before calculating the sum
     */

    const [
      heat,
      electricity
    ] = await Promise.all([ 'heat', 'electricity' ].map(type => {
      if (!cooperative.meters.find(meter => meter.type === type)) {
        // Resolve to an empty array for missing meters
        return [];
      }

      return queryConsumption(
        props,
        Object.assign({ types: [ type ]}, options)
      ).then(result => result.filter(Boolean));
    }));

    if (!heat.length || !electricity.length) {
      // Only calculate performance when we have a complete dataset
      return;
    }

    let isGuesstimate = false;
    let deductHouseholdConsumption = cooperative.incHouseholdElectricity;
    const total = electricity.reduce((mem, value) => mem + value, 0);

    if (typeof cooperative.incHouseholdElectricity === 'undefined') {
      if (total > 50) {
        deductHouseholdConsumption = true;
      } else if (total > 20) {
        isGuesstimate = true;
      }
    }

    let values = electricity.map((value, index) => {
      return (value || 0) + (heat[index] || 0);
    });

    return setPerfomance(values, isGuesstimate, deductHouseholdConsumption);
  }

  /**
   * Set cooperative performance with given values
   * @param {array} values List of values from which to calculate performance
   * @param {boolean} isGuesstimate Whether the values were guestimated
   */

  function setPerfomance(values, isGuesstimate = false, deduct = false) {
    let value = values
      // Remove any empty values (i.e. current month)
      .filter(Boolean)
      // Take the last 12 (last year)
      .slice(-12)
      // Summarize consumtion
      .reduce((memo, num) => memo + num, 0);

    if (!value) {
      return;
    }

    if (deduct) {
      // Deduct houshold consumption
      value -= HOUSEHOLD_DEFAULT_DEDUCTION;
    }

    // Figure out whether the last month is missing
    const missing = values[values.length - 1] ? 0 : 1;

    cooperative.performances.push({
      year: now.getFullYear(),
      month: moment(now).subtract(missing, 'months').month(),
      area: cooperative.area,
      value: value,
      isGuesstimate: isGuesstimate,
      incHouseholdElectricity: deduct
    });

    return cooperative.save();
  }

  /**
   * Create an iterator function that matches given date with
   * year and month of iteratiee properties
   * @param  {Date} date Date to match against
   * @return {function}      Iterator function
   */

  function match(date) {
    const year = date.getFullYear();
    const month = date.getMonth();

    return props => props.year === year && props.month === month;
  }
}

exports.model = Cooperatives;
