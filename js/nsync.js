import * as AFRAME from 'aframe';
import { AFrameEntityObserver } from './AFrameEntityObserver';
import { NetworkAdapter } from './NetworkAdapter';
import { SceneTree } from './SceneTree';

/**
 * The nsync system coordinates the network activity needed to keep all the
 * remote scenes synchronized. It stands for network synchronized.
 * TODO: Investigate takeRecords()
 */
AFRAME.registerSystem('nsync', {

  schema: {
    session: { default: 'room-101' },
    server: { default: 'localhost:9000' }
  },

  init() {
    this._uniqueId = 1;

    this._sceneTree = new SceneTree(this.el);
    this._network = new NetworkAdapter(this.data.session, this.data.server);
    this._network.onupdates = this._onupdates.bind(this);
    this._changes = [];
    this._collectChanges = this._collectChanges.bind(this);
    this._observer = new AFrameEntityObserver(this._collectChanges);

    // Finish initialization after the scene is loaded.
    if (this.el.hasLoaded) { this._postLoad(); }
    else { this.el.addEventListener('loaded', () => this._postLoad()); }
  },

  tick(...args) {
    this._observer.check(...args);
    this._sendChanges();
  },

  _postLoad() {
    this._gatherSyncedElements();
    this._observeSyncedElements();
  },

  _gatherSyncedElements() {
    this._syncedElements = Array.from(this.el.querySelectorAll('[nsync]'));
  },

  _observeSyncedElements() {
    this._syncedElements.forEach(element => this._watchElement(element));
  },

  _watchElement(element) {
    if (!element.dataset.nsyncId) {
      this._observer.observe(element, { components: true });
      element.dataset.nsyncId = `nsync:${element.tagName}:${this._uniqueId}`;
      this._uniqueId++;
    }
  },

  _collectChanges(mutations) {
    mutations = mutations.map(mutation => {
      const serializableCopy = Object.assign({}, mutation);
      serializableCopy.target = mutation.target.dataset.nsyncId;
      return serializableCopy;
    });
    this._changes.push(...mutations);
  },

  _sendChanges() {
    if (this._changes.length) {
      this._network.sendUpdates(this._changes);
      this._changes = [];
    }
  },

  _onupdates(updates) {
    this._sceneTree.applyUpdates(updates);
  }
});
