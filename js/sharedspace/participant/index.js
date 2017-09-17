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
 * The Participant class represents the participation model.
 *
 * This model tries to guarantee the entering order for all participants to be
 * the same and so, the problems translates to keeping a list of participants
 * the same for all the participants.
 *
 * To that end, the source of trust is centralized into the "host" participant.
 *
 * For choosing the host, a participants starts with "unknown" role. As soon as
 * it discovers another participant, it creates a two item participant list
 * with itself and the other participant and broadcast this list along with its
 * enter time.
 *
 * Eventually, it will receive another list from the other participant. Then,
 * the list with an older enter time becomes the trusted one. If this list was
 * that coming from the other participant, the role of this participant will be
 * "guest", otherwise it will be "host".
 *
 * If a participant becomes the "host", it will start broadcasting the list
 * periodically.
 *
 * Here is a risk of creating split networks (i.e. severals hosts) when a lot
 * of peers join simulataneously. To mitigate this effect, connecting is delayed
 * randomly from 1 to 3 seconds.
 *
 * The "host" will send the participant list periodically and will ignore
 * any other list. The "guests" will only accept lists coming from the "host"
 * and the "unknown" participants joining later will choose the "host" list
 * as reference as described before.
 *
 * Notice that entering and leaving events also happen along with list updates
 * and it is not guranteed that they happen in any specific order.
 *
 * When some participant leaves, it is not removed from the list but marked
 * as absent (nullified right now). It could be the participant leaving is
 * the current host. Then a takeover happens.
 *
 * If the host is leaving, all the "guests" will remove the host from their
 * lists. Since their lists are the same, the next host (the next non-null
 * participant) must be the same. This participant will also upgrade its role
 * to "host" and will start broadcasting its list periodically.
 *
 * Peer to peer communications are not guaranteed to reach the destination.
 * The same happens with the order of reception of sent messages. This is
 * enough right now but it introduces a high risk of split networks if there is
 * a lot of participants joining simultaneously. **It is recommended to join one
 * by one to avoid the risk of a network split.**
 */
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
    return wait(1000 + Math.random(2000)) // XXX: see explanation above.
    .then(() => this._rtc.connect())
    .then(() => {
      this._enterTime = Date.now();
      this._list = window.list = new GuestList(this._enterTime, [this.me]);
      this._waitingList = [];
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

  _onEnter({ detail: { id } }) {
    log('enter participant:', id);
    if (this._role !== 'guest') {
      this._list.add(id);
      this._broadcastList();
      this._confirmEnter(id);
    }
  }

  _onExit({ detail: { id } }) {
    log('on exit:', id);
    this._takeover(id);
    if (this._role !== 'guest') {
      this._broadcastList();
    }
  }

  /*
   * Becomes the host if the current host is leaving and it is the next.
   * It only removes the participant if it is the host, to properly calculate
   * the next host.
   */
  _takeover(participant) {
    const isHost = participant === this._list.host();
    const meIsNext = this.me === this._list.nextHost();
    if (isHost) {
      log('host is leaving, be prepared for the takeover');
      this._list.remove(participant);
      if (meIsNext) {
        log('taking over');
        this._setRole('host');
      }
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
      if (nextList === this._list) {
        this._setRole('host');
      }
      else {
        this._setRole('guest');
        this._list.clear();
      }

      log('best list:', nextList);
      log('role:', this._role);
    }

    this._updateList(nextList);
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
   * Cost of a transformation is given by the function transformationCost().
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
    this._informChanges(newList);
    this._list = window.list = newList;
  }

  /*
   * XXX: Due to the client-server (guest-host) architecture, when a participant
   * freshly appears in the list, we need to wait for it to be able of
   * communicate with it but if it's removed, then waiting is not needed.
   */
  _informChanges(newList) {
    const changes = this._list.computeChanges(newList);
    changes.forEach(({ operation, id, index }) => {
      const action = operation === 'add' ? 'enter' : 'exit';
      const role = (newList.host() === id) ? 'host' : 'guest';
      const position = index + 1;
      if (action === 'enter') {
        this._waitFor(id)
        .then(() => this._emit('enterparticipant', { id, position, role }));
      }
      else {
        this._emit('exitparticipant', { id, position, role });
      }
    });
  }

  _waitFor(id) {
    if (id === this.me || this._rtc.isConnected(id)) {
      return Promise.resolve();
    }
    log('waiting for:', id);
    return new Promise(fulfill => {
      this._waitingList.push([id, fulfill]);
    });
  }

  _confirmEnter(targetId) {
    for (let i = 0, l = this._waitingList.length; i < l; i++) {
      const [id, fulfill] = this._waitingList.shift();
      if (id !== targetId) {
        this._waitingList.push([id, fulfill]);
      }
      else {
        log('no longer waiting for:', id);
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

export { Participant };
