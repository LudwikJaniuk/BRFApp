const Prismic = require('prismic.io');
const prismicElement = require('prismic-element');

prismicElement(Prismic);

const ARGS = [
  'id', 'uid', 'type', 'href', 'tags', 'slugs','firstPublicationDate',
  'lastPublicationDate', 'lang', 'alternateLanguages', 'data', 'rawJSON'
];

const API = Prismic.api(process.env.PRISMIC_API);

module.exports = function content() {
  return (state, emitter) => {
    state.content = state.content || {};

    /**
     * Reconstruct Prismic `Document` from JSON formated dumps
     */

    Object.keys(state.content).forEach(key => {
      let doc = state.content[key];

      if (!doc) { return; }

      if (!(doc instanceof Prismic.Document)) {
        doc = new Prismic.Document(...ARGS.map(arg => doc[arg]));
      }

      state.content[key] = doc;
    });

    emitter.on('content:fetch', name => {
      API.then(api => api.getSingle(name).then(doc => {
        state.content[name] = doc;
        emitter.emit('render');
      })).catch(err => emitter.emit('error', err));
    });
  };
};
