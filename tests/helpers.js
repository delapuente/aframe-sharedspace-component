
module.exports.entityFactory = function () {
  return ensureScene()
  .then(scene => {
    const entity = document.createElement('a-entity');
    scene.appendChild(entity);
    return waitFor(entity);
  });
};

const ensureScene = module.exports.ensureScene = function () {
  let scene = document.querySelector('a-scene');
  if (!scene) {
    scene = document.createElement('a-scene');
    scene.innerHTML = '<a-assets></a-assets>';
    document.body.appendChild(scene);
  }
  return waitFor(scene);
};

const waitFor = module.exports.waitFor = function (el) {
  return new Promise(resolve => {
    if (el.hasLoaded) {
      return resolve(el);
    }
    el.addEventListener('loaded', () => resolve(el));
  });
};
