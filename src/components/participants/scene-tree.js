import { utils } from 'aframe';

const warn = utils.debug('sharedspace:scene-tree:warn');

/**
 * Manages the mutations on the scene tree.
 */
class SceneTree {

  constructor(root) {
    this._root = root;
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
    const element = this._root.querySelector(target);

    if (!element) {
      warn(`element '${target}' is out of sync`);
      return;
    }

    element.setAttribute(componentName, newValue);
  }

}

function capitalize(str) {
  return `${str[0].toUpperCase()}${str.substr(1)}`;
}

export { SceneTree };
