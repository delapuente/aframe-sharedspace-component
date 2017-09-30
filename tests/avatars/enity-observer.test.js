require('aframe');
const helpers = require('../helpers');

suite('EnitityObserver', () => {
  let inject;
  let EntityObserver;
  let entity;
  let dontChange = false;

  suiteSetup(() => {
    inject =
      require('inject-loader!../../src/components/avatars/entity-observer');
    dontChange = false;

    const map = new Map();
    EntityObserver = inject({
      'aframe': {
        schema: {
          isSingleProperty() { return true; },
          stringifyProperty(data, schema) {
            if (!map.has(schema)) {
              map.set(schema, 0);
            }
            const count = map.get(schema);
            map.set(schema, count + 1);
            return count && !dontChange ? `delta-${count}` : 'init';
          }
        },
        utils: {}
      }
    }).EntityObserver;

    return helpers.entityFactory().then(newEntity => entity = newEntity);
  });

  function testObserverCheck(options, init, callCount=1) {
    let fulfill;
    const allUpdates = [];
    const observer = new EntityObserver(updates => {
      allUpdates.push(updates);
    }, options);
    init(observer);
    for (let i = 0; i < callCount; i++) {
      observer.check();
    }
    return Promise.resolve(allUpdates);
  }

  test('Poll for all component changes', () => {
    return testObserverCheck({}, observer => {
      observer.observe(entity, { components: true });
    })
    .then(allUpdates => {
      console.log('all', allUpdates);
      const components = Object.keys(entity.components);
      assert.equal(allUpdates[0].length, components.length);
    });
  });

  test('Poll for a subset of component changes', () => {
    return testObserverCheck({}, observer => {
      observer.observe(entity, {
        components: true, componentFilter: ['position']
      });
    })
    .then(allUpdates => {
      assert.shallowDeepEqual(allUpdates[0], [{ componentName: 'position' }]);
    });
  });

  test('Send a key state every N checks', () => {
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

});
