
/**
 * Manages the mutations on the scene tree.
 */
class SceneTree {

  constructor(scene) {
    this._scene = scene;
  }

  applyUpdates(updates) {
    if (!Array.isArray(updates)) {
      updates = [updates];
    }
    updates.forEach(update => this._applyUpdate(update));
  }

  _applyUpdate(update) {
    const methodName = `_apply${capitalize(update.type)}Update`;
    const method = this[methodName];
    if (!method) {
      throw new Error(`Unknown update '${update.type}'. Looking for a
'${methodName}' implementation.`);
    }
    this[methodName](update);
  }

  _applyComponentsUpdate(update) {
    const { target, componentName, newValue } = update;
    const element = this._scene.querySelector(`[data-nsync-id="${target}"]`);
    if (!element) {
      console.error(`Element '${target}' is out of sync`);
      return;
    }
    element.setAttribute(componentName, newValue);
  }

}

function capitalize(str) {
  return `${str[0].toUpperCase()}${str.substr(1)}`;
}

export { SceneTree };
