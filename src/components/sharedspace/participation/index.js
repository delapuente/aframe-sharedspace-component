import { utils } from 'aframe';
import EventTarget from 'event-target-shim';
import { GuestList } from './guest-list';
import { RTCInterface } from '../rtc-interface';

const bind = utils.bind;
const log = utils.debug('sharedspace:participant:log');
const warn = utils.debug('sharedspace:participant:warn');

function wait(time) {
  return new Promise(fulfill => setTimeout(fulfill, time));
}

/**
 * The Participation class represents the participation model.
 *
 * This model tries to guarantee the entering order for all participants to be
 * the same and so, the problems translates to keeping a list of participants
 * the same for all the participants.
 *
 * To that end, the source of trust is centralized into the "host" participant.
 *
 * For choosing the "host", a participant starts with "unknown" role. As soon as
 * it discovers another participant, it creates a two item participant list
 * with itself and the other participant, and broadcast this list along with its
 * enter-time.
 *
 * Eventually, it will receive another list from the other participant. The
 * list with the oldest enter-time is choosen. If this list is the local one,
 * the participant becomes "host". If the list is the remote one, the
 * participant becomes "guest".
 *
 * If a participant becomes the "host", it will start broadcasting the list
 * periodically.
 *
 * Here is a risk of creating split networks (i.e. severals hosts) when a lot
 * of peers join simulataneously. To mitigate this effect, connecting is delayed
 * randomly up to a couple of seconds.
 *
 * The "host" will send the participant list periodically and will ignore
 * any other list. The "guests" will only accept lists coming from the "host",
 * and the "unknown" participants joining later will choose the "host" list
 * as described before.
 *
 * Notice that entering and leaving events also happen along with list updates
 * and it is not guranteed that they happen in any specific order.
 *
 * When some participant leaves, it is not removed from the list but marked
 * as absent (nullified right now). It could be the participant leaving is
 * the current "host". Then a takeover happens.
 *
 * If the host is leaving, all the "guests" will remove the "host" from their
 * lists. Since their lists are the same, the next "host" (the next non-null
 * participant) must be the same. This participant will also upgrade its role
 * to "host" and will start broadcasting its list periodically.
 */
class Participation extends EventTarget {
  constructor(room, { id, stream, provider }) {
    super();

    this._rtc = new RTCInterface(room, { id, stream, signaling: provider });
    this._rtc.addEventListener('connect', bind(this._onConnect, this));
    this._rtc.addEventListener('stream', bind(this._onStream, this));
    this._rtc.addEventListener('close', bind(this._onClose, this));
    this._rtc.addEventListener('message', bind(this._onMessage, this));

    this._role = 'unknown';
  }

  connect() {
    return wait(Math.random() * 2000) // XXX: see explanation above.
    .then(() => this._rtc.connect())
    .then(() => {
      this._streams = new Map();
      this._enterTime = Date.now();
      this._list = window.list = new GuestList(this._enterTime, [this.me]);
      this._connectionWaitingList = [];
      this._presenceWaitingList = [];
      this._emit('connected', { me: this.me });
    });
  }

  /*
   * XXX: There is coupling between the notion of Participant and the
   * RTCInterface Peer (Participant are Peer ids right now).
   */
  get me() {
   return this._rtc.me;
  }

  getStreams(id) {
    return this._streams.get(id).slice(0);
  }

  send(target, content) {
    const message = contentMessage(content);
    if (target === '*') {
      this._rtc.broadcast(message);
    }
    else {
      this._rtc.send(target, message);
    }
  }

  get _negotiating() {
    return this._role === 'unknown';
  }

  _onConnect({ detail: { id } }) {
    log('on connect:', id);
    if (this._role !== 'guest') {
      const nextList = GuestList.copy(this._list);
      nextList.add(id);
      this._updateList(nextList);
      this._broadcastList();
    }
    this._confirmConnection(id);
  }

  _onStream({ detail: { stream, id } }) {
    this._addStream(id, stream);
    this._waitForPresence(id)
    .then(() => this._emit('participantstream', { stream, id }));
  }

  _addStream(id, stream) {
    if (!this._streams.has(id)) {
      this._streams.set(id, []);
    }
    this._streams.get(id).push(stream);
  }

  _onClose({ detail: { id } }) {
    log('on close:', id);
    this._takeover(id);
    if (this._role !== 'guest') {
      this._broadcastList();
    }
  }

  /*
   * Becomes the "host" if the current "host" is leaving and it is the next.
   * It only removes the participant if it is the "host", to properly calculate
   * the next "host".
   */
  _takeover(participant) {
    const isHost = this._list.isHost(participant);
    const meIsNext = this.me === this._list.nextHost();
    if (this._role === 'host') {
      const nextList = GuestList.copy(this._list);
      nextList.remove(participant);
      this._updateList(nextList);
    }
    else if (this._role === 'guest' && isHost) {
      log('host is leaving, be prepared for the takeover');
      const nextList = GuestList.copy(this._list);
      nextList.remove(participant);
      this._updateList(nextList);
      if (meIsNext) {
        log('taking over');
        this._setRole('host');
      }
    }
  }

  /*
   * Notice that, by the time the list is received. It is possibly that the
   * local "guest" has not connect with all the other guests yet.
   */
  _onlist(message) {
    log('on list:', message);

    const notFromHost = !this._list.isHost(message.from);
    if (!this._negotiating && notFromHost) {
      log('ignoring list because it\'s not coming from host');
      return;
    }

    const remoteList = GuestList.deserialize(message);
    if (this._list.equals(remoteList)) { return; }

    let nextList = remoteList;
    if (this._negotiating) {
      nextList = this._selectList(GuestList.copy(this._list), remoteList);
      if (nextList.equals(this._list)) {
        this._setRole('host');
      }
      else {
        this._setRole('guest');
      }
      this._list.clear(); //TODO: Perhaps split into _list and _candidateList

      log('best list:', nextList);
      log('role:', this._role);
    }

    this._updateList(nextList);
  }

  _oncontent(message) {
    log('on content:', message);
    const { from: id, content } = message;
    this._emit('participantmessage', { id, message: content });
  }

  _setRole(newRole) {
    if (newRole !== this._role) {
      this._role = newRole;
      this._emit('upgrade', { role: newRole });
      if (newRole === 'host') {
        this._heartBeatList();
      }
    }
  }

  _heartBeatList() {
    setTimeout(() => {
      this._broadcastList();
      this._heartBeatList();
    }, 3000);
  }

  /**
   * Select the list of guests that, transforming the other into it, is cheaper.
   * Cost of a transformation is given by the method
   * GuestList.transformationCost().
   */
  _selectList(listA, listB) {
    const [ costAB, costBA ] = this._calculateCosts(listA, listB);
    if (costAB === costBA) {
      error('equal costs for different lists:', listA, listB);
      panic('Costs for transforming into different lists must be different.');
    }
    return costAB < costBA ? listB : listA;
  }

  _calculateCosts(listA, listB) {
    const transformationCost = bind(GuestList.transformationCost, GuestList);
    return [transformationCost(listA, listB), transformationCost(listB, listA)];
  }

  _updateList(newList) {
    const changes = this._list.computeChanges(newList);
    this._list = window.list = newList;
    if (!this._negotiating) {
      this._informChanges(changes);
    }
  }

  /*
   * XXX: A new list can come with peers not already connected to this
   * participant so we need to wait for it to connect before informing the
   * participant enter. When a participant is no longer in the list, the best
   * option to keep synchronization with the "host" is to inform it's leaving
   * immediately.
   */
  _informChanges(changes) {
    changes.forEach(({ id, role, position, action }) => {
      if (action === 'enter') {
        this._waitForConnection(id)
        .then(() => {
          this._emit('enterparticipant', { id, role, position });
          this._confirmPresence(id);
        });
      }
      else {
        this._emit('exitparticipant', { id, role, position });
      }
    });
  }

  _waitForConnection(id) {
    if (id === this.me || this._rtc.isConnected(id)) {
      return Promise.resolve();
    }
    log('waiting for connection:', id);
    return new Promise(fulfill => {
      this._connectionWaitingList.push([id, fulfill]);
    });
  }

  _confirmConnection(targetId) {
    for (let i = 0, l = this._connectionWaitingList.length; i < l; i++) {
      const [id, fulfill] = this._connectionWaitingList.shift();
      if (id !== targetId) {
        this._connectionWaitingList.push([id, fulfill]);
      }
      else {
        log('no longer waiting for connection:', id);
        fulfill();
      }
    }
  }

  _waitForPresence(id) {
    if (id === this.me || (!this._negotiating && this._list.isPresent(id))) {
      return Promise.resolve();
    }
    log('waiting for presence:', id);
    return new Promise(fulfill => {
      this._presenceWaitingList.push([id, fulfill]);
    });
  }

  _confirmPresence(targetId) {
    for (let i = 0, l = this._presenceWaitingList.length; i < l; i++) {
      const [id, fulfill] = this._presenceWaitingList.shift();
      if (id !== targetId) {
        this._presenceWaitingList.push([id, fulfill]);
      }
      else {
        log('no longer waiting for presence:', id);
        fulfill();
      }
    }
  }

  _broadcastList() {
    log('broadcasting list:', this._list);
    const message = listMessage(this._list);
    this._rtc.broadcast(message);
  }

  _onMessage(event) {
    const handlerName = `_on${event.detail.type}`;
    if (!this[handlerName]) {
      warn(`missing handler for event type ${event.detail.type}`);
      return;
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

function contentMessage(content) {
  return { type: 'content', content };
}

export { Participation };
