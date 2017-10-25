const url = require('url');
const moment = require('moment');
const hash = require('object-hash');
const assert = require('../../assert');
const { __ } = require('../../locale');

const FORMAT = 'YYYYMM';
const INIT = { credentials: 'include', headers: { accept: 'application/json' }};

module.exports = function consumtions() {
  return (state, emitter) => {
    state.consumptions = Object.assign({
      items: {},
      isLoading: false,
      type: 'electricity',
      compare: 'prev_year',
      granularity: 'month',
      normalized: false
    }, state.consumptions);

    let touched = false;
    emitter.on('consumptions:type', type => {
      state.error = null;
      state.consumptions.type = type;

      if (type === 'electricity') {
        state.consumptions.normalized = false;
      } else if (!touched) {
        state.consumptions.normalized = true;
        touched = true;
      }

      emitter.emit('render');
    });

    emitter.on('consumptions:compare', compare => {
      state.error = null;
      state.consumptions.compare = compare;
      emitter.emit('render');
    });

    emitter.on('consumptions:normalized', normalized => {
      state.error = null;
      state.consumptions.normalized = normalized;
      emitter.emit('render');
    });

    emitter.on('consumptions:granularity', granularity => {
      const { consumptions: { compare }} = state;

      if (granularity === 'year' && compare === 'prev_year') {
        state.consumptions.compare = null;
      } else if (granularity === 'month' && compare === null) {
        state.consumptions.compare = 'prev_year';
      }

      state.error = null;
      state.consumptions.granularity = granularity;

      emitter.emit('render');
    });

    emitter.on('consumptions:fetch', options => {
      const { consumptions } = state;
      const done = (data) => {
        consumptions.isLoading = false;

        if (Array.isArray(data)) {
          data.forEach(({ values, options }) => {
            state.consumptions.items[hash(options)] = values;
          });
        } else {
          state.consumptions.items[hash(data.options)] = data.values;
        }

        emitter.emit('render');
      };

      consumptions.isLoading = true;

      if (Array.isArray(options)) {
        Promise.all(options.map(options => {
          return fetchConsumtion(defaults(options)).then(values => ({ values, options }));
        })).then(done, err => emitter.emit('error', err));
      } else {
        fetchConsumtion(defaults(options)).then(
          values => done({ values, options }),
          err => emitter.emit('error', err)
        );
      }
    });

    function defaults(options) {
      return Object.assign({
        types: [ state.consumptions.type ],
        granularity: 'month',
        normalized: state.consumptions.normalized
      }, options);
    }
  };

  /**
   * Fetch consumtion for given cooperative with query parameterss granularity,
   * from and to
   * @param  {Object} options Hash with cooperative and query parameters
   * @return {Promise}        Resolves to parsed response
   */

  function fetchConsumtion(options) {
    const { from, to, types, granularity, normalized, cooperative: id } = options;
    const endpoint = url.format({
      pathname: `/cooperatives/${ id }/consumption`,
      query: {
        types: types.join(','),
        normalized: normalized,
        granularity: granularity,
        from: moment(from).format(FORMAT),
        to: moment(to).format(FORMAT)
      }
    });

    return fetch(endpoint, INIT).then(body => body.json().then(response => {
      if (!body.ok) {
        assert.reject(body.status, __(response.error.message));
      }

      const values = response
        // Index values by date
        .map((value, index) => {
          const date = moment(from, FORMAT).add(index, granularity + 's').toDate();
          return { value, date };
        })
        // Remove any empty values (i.e. current month)
        .filter(item => !!item.value);

      return values;
    }));
  }
};
