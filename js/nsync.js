import * as AFRAME from 'aframe';
import { AFrameEntityObserver } from './AFrameEntityObserver';

/**
 * The nsync system coordinates the network activity needed to keep all the
 * remote scenes synchronized. It stands for network synchronized.
 * TODO: Investigate takeRecords()
 */
AFRAME.registerSystem('nsync', {

  init() {
    this._changes = [];
    this._collectChanges = this._collectChanges.bind(this);
    this._observer = new AFrameEntityObserver(this._collectChanges);

    // Finish initialization after the scene is loaded.
    if (this.el.hasLoaded) { this._initSync(); }
    else { this.el.addEventListener('loaded', () => this._initSync()); }
  },

  tick(...args) {
    this._observer.check(...args);
    this._sendChanges();
  },

  _initSync() {
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
    this._observer.observe(element, { components: true });
  },

  _collectChanges(mutations) {
    this._changes.push(...mutations);
  },

  _sendChanges() {
    if (this._changes.length) {
      console.log('sending through network', this._changes);
      this._changes = [];
    }
  }
});