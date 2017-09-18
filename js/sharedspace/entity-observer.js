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
      this._componentFilter = init.componentFilter || null;
      if (!this._observables.has(entity)) {
        this._recordEntity(entity, init.componentFilter);
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
    Array.from(this._observables.keys()).forEach(entity => this._collectChanges(entity));
  }

  _recordEntity(entity) {
    const filter = this._componentFilter;
    this._observables.set(entity, {});
    Object.values(entity.components).forEach(component => {
      if (!filter || filter.indexOf(component.name) >= 0) {
        this._updateComponent(entity, component);
      }
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

  _collectChanges(entity) {
    const filter = this._componentFilter;
    const changes = [];
    Object.values(entity.components).forEach(component => {
      if (!filter || filter.indexOf(component.name) >= 0) {
        const change = this._getChanges(entity, component)
        if (change) {
          const [oldValue, newValue] = change;
          changes.push({
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

export { EntityObserver };
