import 'aframe';

suite('test-suite', () => {
  let inject;
  let EntityObserver;
  let entity;

  setup(() => {
    inject =
      require('inject-loader!../../src/components/avatars/entity-observer');

    var scene = document.createElement('a-scene');
    var assets = document.createElement('a-assets');
    entity = document.createElement('a-entity');
    scene.appendChild(assets);
    scene.appendChild(entity);

    return new Promise(fulfill => {
      scene.addEventListener('loaded', fulfill);
      document.body.appendChild(scene);
    });
  });

  test('test', done => {
    let count = 0;
    EntityObserver = inject({
      'aframe': {
        schema: {
          isSingleProperty() { return true; },
          stringifyProperty() { return `value-${count++}`; } },
        utils: {}
      }
    }).EntityObserver;

    const observer = new EntityObserver(updates => {
      assert.shallowDeepEqual(updates, {
        length: 1,
        0: { oldValue: 'value-0', newValue: 'value-1' }
      })
      done();
    });
    observer.observe(entity, { components: true, componentFilter: ['position'] });
    observer.check();
  });

});
