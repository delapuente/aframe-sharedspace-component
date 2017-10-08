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
 *
 * TODO: Optimize by not comparing with the stringifyed version.
 */
class EntityObserver {
  constructor (callback, { keyEach = 60 } = {}) {
    this._observer = new window.MutationObserver(callback);
    this._callback = callback;
    this._observables = new Map();
    this._checkCount = 0;
    this._keyThreshold = keyEach;
  }

  observe (entity, init) {
    try {
      this._observer.observe(entity, init);
    } catch (e) { /* no-op */ }
    if (init.components) {
      const filter = init.componentFilter;
      this._observables.delete(entity);
      this._recordEntity(entity, filter);
    }
  }

  disconnect () {
    this._observer.disconnect();
    this._observables.clear();
  }

  takeRecords () {
    return this._observer.takeRecords();
  }

  check () {
    Array.from(this._observables.keys())
    .forEach(entity => this._collectChanges(entity, this._isKey()));
  }

  _isKey () {
    const count = ++this._checkCount;
    if (count === this._keyThreshold) {
      this._checkCount = 0;
      return true;
    }
    return false;
  }

  _recordEntity (entity, filter) {
    this._observables.set(entity, [{}, filter]);
    Object.values(entity.components).forEach(component => {
      if (!filter || filter.indexOf(component.name) >= 0) {
        this._updateComponent(entity, component);
      }
    });
  }

  _updateComponent (entity, component) {
    const schema = component.schema;
    const data = component.data;
    const lastValue = this._stringify(data, schema);
    this._observables.get(entity)[0][component.name] = lastValue;
  }

  _stringify (data, schema) {
    if (schemaUtils.isSingleProperty(schema)) {
      return schemaUtils.stringifyProperty(data, schema);
    }
    const stringifiedData = schemaUtils.stringifyProperties(data, schema);
    return utils.styleParser.stringify(stringifiedData);
  }

  _collectChanges (entity, isKey) {
    const changes = [];
    const filter = this._observables.get(entity)[1];
    Object.values(entity.components).forEach(component => {
      if (!filter || filter.indexOf(component.name) >= 0) {
        // TODO: Refactor this mess
        const change = isKey
                       ? this._getCurrentValue(entity, component)
                       : this._getChanges(entity, component);
        if (change) {
          const [oldValue, newValue] = !isKey ? change : [change, change];
          changes.push({
            isKey,
            type: 'components',
            target: entity,
            componentName: component.name,
            oldValue,
            newValue
          });
        }
      }
    });
    if (changes.length) {
      this._callback(changes, this);
    }
  }

  _getChanges (entity, component) {
    const oldValue = this._getCurrentValue(entity, component);
    const newValue = this._stringify(component.data, component.schema);
    if (oldValue !== newValue) {
      this._updateComponent(entity, component);
      return [oldValue, newValue];
    }
    return null;
  }

  _getCurrentValue (entity, component) {
    return this._observables.get(entity)[0][component.name];
  }
}

export { EntityObserver };
