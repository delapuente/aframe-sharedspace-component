import { schema as schemaUtils, utils } from 'aframe';

/**
 * Works equal to `MutationObserver` but adds support for component observation.
 * When using `observe`, pass `components: true` to make the components of the
 * entity to be observed. Due to limitations on the A-Frame library, checking
 * for a change in a component is only performed when calling the `check`
 * method.
 *
 * To keep it synchronized with the render loop, call it inside the `tick`
 * method of a component or system.
 */
class AFrameEntityObserver {

  constructor(callback) {
    this._observer = new MutationObserver(callback);
    this._callback = callback;
    this._observables = new Map();
  }

  observe(entity, init) {
    try {
      this._observer.observe(entity, init);
    }
    catch (e) { /* no-op */ }
    if (init.components) {
      if (!this._observables.has(entity)) {
        this._recordEntity(entity);
      }
    }
  }

  disconnect() {
    this._observer.disconnect();
    this._observables.clear();
  }

  takeRecords() {
    return this._observer.takeRecords();
  }

  check() {
    Array.from(this._observables.keys()).forEach(entity => this._checkChanges(entity));
  }

  _recordEntity(entity) {
    this._observables.set(entity, {});
    Object.values(entity.components).forEach(component => {
      this._updateComponent(entity, component);
    });
  }

  _updateComponent(entity, component) {
    const schema = component.schema;
    const data = component.data;
    const lastValue = this._stringify(data, schema);
    this._observables.get(entity)[component.name] = lastValue;
  }

  _stringify(data, schema) {
    if (schemaUtils.isSingleProperty(schema)) {
      return schemaUtils.stringifyProperty(data, schema);
    }
    const stringifiedData = schemaUtils.stringifyProperties(data, schema);
    return utils.styleParser.stringify(stringifiedData);
  }

  _checkChanges(entity) {
    const changes = [];
    Object.values(entity.components).forEach(component => {
      const change = this._getChanges(entity, component)
      if (change) {
        const [oldValue, newValue] = change;
        changes.push({ name: component.name, oldValue, newValue });
      }
    });
    if (changes.length) {
      changes.forEach(change => {
        this._callback({
          type: 'components',
          target: entity,
          componentName: change.name,
          oldValue: change.oldValue,
          newValue: change.newValue
        });
      });
    }
  }

  _getChanges(entity, component) {
    const oldValue = this._observables.get(entity)[component.name];
    const newValue = this._stringify(component.data, component.schema);
    if (oldValue !== newValue) {
      this._updateComponent(entity, component);
      return [oldValue, newValue];
    }
    return null;
  }

}

export { AFrameEntityObserver };
