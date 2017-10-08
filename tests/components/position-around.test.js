const helpers = require('../helpers');

suite('position-around component', () => {
  let entity;

  suiteSetup(() => {
    require('../../src/components/position-around');

    return helpers.entityFactory()
    .then(newEntity => {
      entity = newEntity;
      sinon.spy(entity, 'setAttribute');
    });
  });

  teardown(() => {
    entity.setAttribute.reset();
  });

  function forCircle ([ x, y, z ], r, h) {
    const s = Math.sin(Math.PI / 4);
    return [
      { x: r + x, y: y + h, z },
      { x: -(r + x), y: y + h, z: -z },
      { x, y: y + h, z: r + z },
      { x: -x, y: y + h, z: -(r + z) },
      { x: s * r + x, y: y + h, z: s * r + z },
      { x: -(s * r + x), y: y + h, z: -(s * r + z) },
      { x: -s * r + x, y: y + h, z: s * r + z },
      { x: -(-s * r + x), y: y + h, z: -(s * r + z) }
    ];
  }

  suite('with default configuration', () => {
    const testSet = forCircle([0, 0, 0], 1.1, 1.6);

    testSet.forEach((expectedPosition, index) => {
      test(`changes an entity's position to be arranged around a circle (position ${index + 1})`, () => {
        entity.setAttribute('position-around', { position: index + 1 });
        assertWithThreshold(
          entity.setAttribute.getCall(1).args,
          expectedPosition
        );
      });
    });
  });

  suite('with modified parameters', () => {
    const center = { x: 1, y: -2, z: 3 };
    const radius = 0.5;
    const height = -2;
    const testSet = forCircle([center.x, center.y, center.z], radius, height);

    setup(() => {
      entity.setAttribute('position-around', { center, radius, height });
      entity.setAttribute.reset();
    });

    testSet.forEach((expectedPosition, index) => {
      test(`changes an entity's position to be arranged around a circle (position ${index + 1})`, () => {
        entity.setAttribute('position-around', { position: index + 1 });
        assertWithThreshold(
          entity.setAttribute.getCall(1).args,
          expectedPosition
        );
      });
    });
  });

  function assertWithThreshold (target, expected) {
    const THRESHOLD = 0.001;
    const [ attr, { x, y, z } ] = target;
    assert.equal(attr, 'position');
    assert.isBelow(Math.abs(x - expected.x), THRESHOLD, 'x not similar enough');
    assert.isBelow(Math.abs(y - expected.y), THRESHOLD, 'y not similar enough');
    assert.isBelow(Math.abs(z - expected.z), THRESHOLD, 'z not similar enough');
  }
});
