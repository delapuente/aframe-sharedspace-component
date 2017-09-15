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
    this._role = 'unknown';
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
    this._rtc.onleave = bind(this._onLeave, this);
  },

  _onPeer(id) {
    log('on peer:', id);
    if (this._role !== 'guest') {
      this._list.add(id);
      this._broadcastList();
      this.el.emit('enterguest', { guest: id });
      // TODO: Add avatar automatically if enabled
    }
  },

  _onLeave(id) {
    log('on leave:', id);
    this._takeover(id);
    if (this._role !== 'guest') {
      this._list.remove(id);
      this._broadcastList();
      this.el.emit('leaveguest', { guest: id });
      // TODO: Remove avatar automatically (always)
    }
  },

  /*
   * Becomes the host if the current host is leaving and it is the next.
   */
  _takeover(leavingGuest) {
    const hostLeft = leavingGuest === this._list.host();
    const meIsNext = this.data.me === this._list.nextHost();
    if (hostLeft && meIsNext) {
      log('taking over');
      this._role = 'host';
    }
  },

  /*
   * TODO: The surface of the RTC API related to the list should be attacked by
   * an specific class.
   */
  _onList(msg) {
    log('on list:', msg);

    const notFromHost = this._list.host() !== msg.from;
    if (this._role !== 'unknown' && notFromHost) {
      log('ignoring list because it\'s not coming from host');
      return;
    }

    const remoteList = new GuestList(msg.timestamp, msg.list);
    if (this._list.equals(remoteList)) { return; }

    let nextList = remoteList;
    if (this._role === 'unknown') {
      nextList = this._selectList(this._list, remoteList);
      this._role = (nextList === this._list) ? 'host' : 'guest';

      log('best list:', nextList);
      log('role:', this._role);
    }

    this._updateList(nextList);
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
    log('broadcasting list:', this._list);
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
