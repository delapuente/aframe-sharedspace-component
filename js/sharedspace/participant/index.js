import { utils } from 'aframe';
import EventTarget from 'event-target-shim';
import { GuestList } from './guest-list';
import { RTCInterface } from '../rtc-interface';

const bind = utils.bind;
const log = utils.debug('sharedspace:participant:log');
const warn = utils.debug('sharedspace:participant:warn');

class Participant extends EventTarget {
  constructor(room, { id, stream, provider }) {
    super();

    this._rtc = new RTCInterface(room, { id, stream, signaling: provider });
    this._rtc.addEventListener('enter', bind(this._onEnter, this));
    this._rtc.addEventListener('exit', bind(this._onExit, this));
    this._rtc.addEventListener('message', bind(this._onMessage, this));

    this._role = 'unknown';
  }

  connect() {
    return this._rtc.connect()
    .then(() => {
      this._enterTime = Date.now();
      this._list = new GuestList(this._enterTime, [this.me]);
    });
  }

  /*
   * XXX: There is coupling between the notion of Participant and the
   * RTCInterface Peer (Participant are Peer ids right now).
   */
  get me() {
   return this._rtc.me;
  }

  _onEnter({ detail: { id } }) {
    log('enter participant:', id);
    if (this._role !== 'guest') {
      this._list.add(id);
      const isHost = id === this._list.host();
      this._broadcastList();
      // TODO: Emit enter participant event
    }
  }

  _onExit({ detail: { id } }) {
    log('on exit:', id);
    this._takeover(id);
    if (this._role !== 'guest') {
      this._list.remove(id);
      this._broadcastList();
      // TODO: Emit exit participant event
      // TODO: Emit new host event if needed
    }
  }

  /*
   * Becomes the host if the current host is leaving and it is the next.
   */
  _takeover(leavingGuest) {
    const hostLeft = leavingGuest === this._list.host();
    const meIsNext = this.me === this._list.nextHost();
    if (hostLeft && meIsNext) {
      log('taking over');
      this._role = 'host';
      // TODO: Emit upgrade event
    }
  }

  /*
   * Notice that, by the time the list is received. It is possibly that not all
   * the guests have been detected yet.
   */
  _onlist(message) {
    log('on list:', message);

    const notFromHost = this._list.host() !== message.from;
    if (this._role !== 'unknown' && notFromHost) {
      log('ignoring list because it\'s not coming from host');
      return;
    }

    const remoteList = GuestList.deserialize(message);
    if (this._list.equals(remoteList)) { return; }

    let nextList = remoteList;
    if (this._role === 'unknown') {
      nextList = this._selectList(this._list, remoteList);
      this._role = (nextList === this._list) ? 'host' : 'guest';
      // TODO: Emit upgrade events
      // TODO: Emit new host events

      log('best list:', nextList);
      log('role:', this._role);
    }

    this._updateList(nextList);
  }

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
  }

  _calculateCosts(listA, listB) {
    return [transformationCost(listA, listB), transformationCost(listB, listA)];
  }

  _updateList(newList) {
    this._list = newList;
    // TODO: Emit list changes events
  }

  _broadcastList() {
    log('broadcasting list:', this._list);
    const message = listMessage(this._list);
    this._rtc.broadcast(message);
  }

  _onMessage(event) {
    const handlerName = `_on${event.detail.type}`;
    if (!this[handlerName]) {
      warn(`Missing handler for event type ${event.detail.type}`);
    }
    return this[handlerName](event.detail);
  }

  _emit(type, detail) {
    const event = new CustomEvent(type, { detail });
    this.dispatchEvent(event);
  }
}

function listMessage(guestList) {
  const message = { type: 'list' };
  Object.assign(message, GuestList.serialize(guestList));
  return message;
}

function transformationCost(origin, destination) {
  return (destination.timestamp - origin.timestamp);
}

export { Participant };
