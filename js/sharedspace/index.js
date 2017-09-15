import { registerComponent, utils } from 'aframe';
import { GuestList } from './guest-list';
import { RTCInterface } from './rtc-interface';

const bind = utils.bind;

const log = utils.debug('sharedspace:log');
const warn = utils.debug('sharedspace:warn');

function panic(error) {
  error = (typeof error !== 'string') ? error : new Error(error);
  throw error;
}

export default registerComponent('sharedspace', {
  schema: {
    provider: { default: 'localhost:9000' },
    room: { default: 'room-101' },
    audio: { default: false },
    me: { default: '' }
  },

  init() {
    this._enterTime = Date.now();

    const { audio } = this.data;
    if (!audio) {
      this._initRTC(null)
      .then(bind(this._configureRTC, this));
      return;
    }

    this._getUserMedia({ audio })
    .then(bind(this._initRTC, this))
    .catch(bind(informAndInit, this))
    .then(bind(this._configureRTC, this));

    function informAndInit(reason) {
      warn('getUserMedia() failed. There will be no stream.');
      this.el.emit('getusermediafailed', reason, false);
      return this._initRTC(null);
    }
  },

  _getUserMedia(constraints) {
    return navigator.mediaDevices.getUserMedia(constraints)
    .then(stream => {
      log('my stream:', stream);
      return stream;
    });
  },

  _initRTC(stream) {
    const { room, id, provider } = this.data;
    this._rtc = new RTCInterface({ room, id, stream, signaling: provider });
    return this._rtc.connect();
  },

  /*
   * XXX: There is coupling between the notion of Guest and the RTCInterface
   * peer ids (now are the same thing).
   */
  _configureRTC() {
    if (!this._rtc) { panic('RTC interface not initialized'); }
    this.data.me = this._rtc.me;
    log('me:', this.data.me);
    this._list = new GuestList(this._enterTime, [this.data.me]);
    this._rtc.onpeer = bind(this._onPeer, this);
    this._rtc.onlist = bind(this._onList, this);
  },

  _onPeer(id) {
    log('on peer:', id);
    this._list.add(id);
    this._broadcastList();
    this.el.emit('enterguest', { id });
    // TODO: Add avatar automatically
  },

  _onList(msg) {
    const remoteList = new GuestList(msg.timestamp, msg.list);
    log('on list:', remoteList);
    if (this._list.equals(remoteList)) { return; }
    const bestList = this._selectList(this._list, remoteList);
    log('best list:', bestList);
    this._updateList(bestList);
  },

  /**
   * Select the list of guests that, transforming the other into it, is cheaper.
   * Cost of a transformation is given by the function transformationCost().
   */
  _selectList(listA, listB) {
    const [ costAB, costBA ] = this._calculateCosts(listA, listB);
    if (costAB === costBA) {
      error('Equal costs for different lists:', listA, listB);
      panic('Costs for transforming into different lists must be different.');
    }
    return costAB < costBA ? listB : listA;
  },

  _calculateCosts(listA, listB) {
    return [transformationCost(listA, listB), transformationCost(listB, listA)];
  },

  _updateList(newList) {
    this._list = newList;
    // TODO: Add scene management code according to the new list.
  },

  _broadcastList() {
    const msg = listMessage(this._list);
    this._rtc.broadcast(msg);
  }
});

function listMessage(guestList) {
  const { timestamp, _list } = guestList;
  return { type: 'list', timestamp, list: _list };
}

function transformationCost(origin, destination) {
  return (destination.timestamp - origin.timestamp);
}
