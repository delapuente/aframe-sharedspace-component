
const entityFactory = module.exports.entityFactory = function () {
  const scene = ensureScene();
  const entity = document.createElement('a-entity');
  const loaded = new Promise(fulfill => {
    entity.addEventListener('loaded', () => fulfill(entity));
    scene.appendChild(entity);
  });
  return loaded;
};

const ensureScene = module.exports.ensureScene = function () {
  let scene = document.querySelector('a-scene');
  if (!scene) {
    scene = document.createElement('a-scene');
    document.body.appendChild(scene);
  }
  return scene;
};
