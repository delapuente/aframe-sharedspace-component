require('aframe');
const helpers = require('../../helpers');

suite('EnitityObserver', () => {
  const noCall = [];
  function * defaultSequence () {
    let count = 0;
    while (true) {
      yield (count++ === 0) ? 'init' : `delta-${count}`;
    }
  }

  let inject;
  let EntityObserver;
  let entity;
  let _sequence;
  let _isSingleProperty;

  setup(() => {
    /* eslint-disable import/no-webpack-loader-syntax */
    inject = require(
      'inject-loader!../../../src/components/avatars/entity-observer'
    );
    /* eslint-enable import/no-webpack-loader-syntax */

    _sequence = defaultSequence();
    _isSingleProperty = true;

    const map = new Map();
    EntityObserver = inject({
      'aframe': {
        schema: {
          isSingleProperty () { return _isSingleProperty; },
          stringifyProperty (data, schema) {
            if (!map.has(schema)) {
              map.set(schema, 0);
            }
            const count = map.get(schema);
            map.set(schema, count + 1);
            return _sequence.next().value;
          },
          stringifyProperties (...args) {
            return this.stringifyProperty(...args);
          }
        },
        utils: {
          styleParser: { stringify (props) { return props; } }
        }
      }
    }).EntityObserver;

    return helpers.entityFactory().then(newEntity => { entity = newEntity; });
  });

  function testObserverCheck (options, init, callCount = 1) {
    const allUpdates = [];
    const observer = new EntityObserver(updates => {
      allUpdates.push(updates);
    }, options);
    init(observer);
    for (let i = 0; i < callCount; i++) {
      observer.check();
      // If the check did not cause a callback call, add the centinel.
      if (allUpdates.length === i) {
        allUpdates.push(noCall);
      }
    }
    // Works because callback calls happen synchronously after check() calls.
    return Promise.resolve(allUpdates);
  }

  [true, false].forEach(isSingleProperty => {
    test(`polls for all component changes (${isSingleProperty ? 'single' : 'multi'})`, () => {
      _isSingleProperty = isSingleProperty;
      return testObserverCheck({}, observer => {
        observer.observe(entity, { components: true });
      })
      .then(allUpdates => {
        const components = Object.keys(entity.components);
        assert.equal(allUpdates[0].length, components.length);
      });
    });

    test(`polls for a subset of component changes (${isSingleProperty ? 'single' : 'multi'})`, () => {
      _isSingleProperty = isSingleProperty;
      return testObserverCheck({}, observer => {
        observer.observe(entity, {
          components: true, componentFilter: ['position']
        });
      })
      .then(allUpdates => {
        assert.shallowDeepEqual(allUpdates[0], [{ componentName: 'position' }]);
      });
    });

    test(`sends a key state every N checks (${isSingleProperty ? 'single' : 'multi'})`, () => {
      _isSingleProperty = isSingleProperty;
      const keyEach = 2;
      const repetitions = 3;
      const max = keyEach * repetitions;

      return testObserverCheck({ keyEach }, observer => {
        observer.observe(entity, {
          components: true, componentFilter: ['position']
        });
      }, max)
      .then(allUpdates => {
        allUpdates.forEach((updates, index) => {
          const isKey = ((index + 1) % keyEach) === 0;
          updates.forEach(update => {
            assert.shallowDeepEqual(update, { isKey });
          });
        });
      });
    });

    test(`sends a key state every N checks even if there is no changes (${isSingleProperty ? 'single' : 'multi'})`, () => {
      _isSingleProperty = isSingleProperty;
      const keyEach = 2;
      const repetitions = 3;
      const max = keyEach * repetitions;
      _sequence = (function * () {
        while (true) { yield 'const'; }
      }());

      return testObserverCheck({ keyEach }, observer => {
        observer.observe(entity, {
          components: true, componentFilter: ['position']
        });
      }, max)
      .then(allUpdates => {
        allUpdates.forEach((updates, index) => {
          const isKey = ((index + 1) % keyEach) === 0;
          if (!isKey) { assert.equal(updates, noCall); }
          updates.forEach(update => {
            assert.shallowDeepEqual(update, { isKey });
          });
        });
      });
    });
  });
});
