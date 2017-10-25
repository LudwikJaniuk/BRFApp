/* globals gtag */

const CONSUMPTIONS = /consumptions:(type|compare|granularity|normalized)/;
const COOPERATIVE_COMPARE = /cooperative:(.+)/;

module.exports = function () {
  return function (state, emitter) {
    emitter.on('track', data => {
      const name = data.event_name;
      const props = Object.assign({ is_editor: false }, data);

      delete props.event_name;

      const user = state.user;
      if (user.isAuthenticated) {
        if (props.id && state.cooperatives.find(item => item._id === props.id)) {
          props.is_editor = user.cooperative === props.id;
        } else if (state.params.cooperative) {
          props.is_editor === user.cooperative === state.params.cooperative;
        } else if (state.params.action) {
          var action = state.actions.find(item => item._id === state.params.action);
          if (action) {
            props.is_editor === action.cooperative === user.cooperative;
          }
        }
      }

      if (COOPERATIVE_COMPARE.test(props.cooperative_compare)) {
        props.cooperative_compare = state.cooperatives.find(item => {
          const id = state.consumptions.compare.match(COOPERATIVE_COMPARE)[1];
          return item._id === id;
        }).name;
      }

      // Cast boolean custom dimension to string
      props.is_editor = props.is_editor ? 'Yes' : 'No';

      gtag('event', name, props);
    });

    emitter.on(state.events.DOMCONTENTLOADED, onpageview);

    emitter.on(state.events.NAVIGATE, () => {
      requestAnimationFrame(onpageview);
    });

    emitter.on('track:exception', err => {
      gtag('event', 'exception', {
        description: err.message,
        fatal: err.status > 499
      });
    });

    emitter.on('error', err => {
      gtag('event', 'exception', {
        description: err.message,
        fatal: err.status > 499
      });
    });

    emitter.on('chart:paginate', () => {
      emitter.emit('track', {
        event_name: 'paginate',
        event_category: 'chart',
        event_label: 'paginate',
        value: state.chart.page,
        energy_type: state.consumptions.type,
        cooperative_compare: state.consumptions.compare,
        energy_granularity: state.consumptions.granularity,
        energy_normalized: state.consumptions.normalized
      });
    });

    emitter.on('*', type => {
      if (typeof window !== 'undefined' && CONSUMPTIONS.test(type)) {
        emitter.emit('track', {
          event_name: 'filter',
          event_category: 'consumption',
          event_label: type.match(CONSUMPTIONS)[1],
          energy_type: state.consumptions.type,
          cooperative_compare: state.consumptions.compare,
          energy_granularity: state.consumptions.granularity,
          energy_normalized: state.consumptions.normalized
        });
      }
    });

    function onpageview() {
      const props = {
        page_title: state.title.split(' | ')[0],
        page_location: window.location.href,
        page_path: state.href,
        user_id: state.user.isAuthenticated ? state.user._id : null,
        is_editor: false,
        custom_map: {
          dimension1: 'is_editor',
          dimension2: 'energy_type',
          dimension3: 'cooperative_compare',
          dimension4: 'energy_granularity',
          dimension5: 'energy_normalized'
        }
      };

      const user = state.user;
      if (user.isAuthenticated) {
        if (state.params.cooperative) {
          props.is_editor = user.cooperative === state.params.cooperative;
        } else if (state.params.action) {
          var action = state.actions.find(item => item._id === state.params.action);
          if (action) {
            props.is_editor = action.cooperative === user.cooperative;
          }
        }
      }

      // Cast boolean custom dimension to string
      props.is_editor = props.is_editor ? 'Yes' : 'No';

      gtag('config', process.env.GOOGLE_ANALYTICS_ID, props);
    }
  };
};
