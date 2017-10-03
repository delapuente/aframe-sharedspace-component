
const entityFactory = module.exports.entityFactory = function () {
  return ensureScene()
  .then(scene => {
    const entity = document.createElement('a-entity');
    scene.appendChild(entity);
    return new Promise(fulfill => {
      entity.addEventListener('loaded', () => fulfill(entity));
    });
  });
};

const ensureScene = module.exports.ensureScene = function () {
  let scene = document.querySelector('a-scene');
  if (!scene) {
    scene = document.createElement('a-scene');
    scene.innerHTML = '<a-assets></a-assets>';
    document.body.appendChild(scene);
  }
  if (scene.hasLoaded) {
    return Promise.resolve(scene);
  }
  return new Promise(fulfil => {
    scene.addEventListener('loaded', () => fulfil(scene));
  });
};

const waitFor = module.exports.waitFor = function (el) {
  return new Promise(fulfil => {
    if (el.hasLoaded) {
      return fulfil(el);
    }
    el.addEventListener('loaded', () => fulfil(el));
  });
}
