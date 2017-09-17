import { utils } from 'aframe';
import signalhub from 'signalhub';
import WebRtcSwarm from 'webrtc-swarm';
import EventTarget from 'event-target-shim';
import { panic } from './utils';

const bind = utils.bind;
const log = utils.debug('sharedspace:rtc-interface:log');
const error = utils.debug('sharedspace:rtc-interface:error');

class RTCInterface extends EventTarget {

  constructor(room, { id, stream, signaling }) {
    super();
    this._id = id;
    this._stream = stream;
    this._hub = signalhub(room, [signaling]);
  }

  get me() {
    return this._swarm.me;
  }

  connect() {
    this._peers = new Map();
    this._swarm = new WebRtcSwarm(this._hub, {
      uuid: this._id,
      stream: this._stream,
      offerConstraints: {
        mandatory: {
          OfferToReceiveAudio: true,
          OfferToReceiveVideo: true
        }
      }
    });
    this._swarm.on('peer', (...args) => this._onPeer(...args));
    return Promise.resolve();
  }

  broadcast(msg) {
    Array.from(this._peers.keys()).forEach(id => this.send(id, msg));
  }

  send(destination, msg={}) {
    msg.from = this.me;
    const data = JSON.stringify(msg);
    log('sending data:', data);
    this._peers.get(destination).send(data);
  }

  isConnected(id) {
    return this._peers.has(id);
  }

  _onPeer(peer, id) {
    this._peers.set(id, peer);
    this._setupPeer(peer, id);
    this._emit('enter', { id });
  }

  _setupPeer(peer, id) {
    peer.on('data', bind(this._onData, this));
    peer.on('close', bind(this._onClose, this, id));
  }

  _onData(data) {
    const message = JSON.parse(data);
    if (typeof message !== 'object' || !message.type) {
      error('Malformed message:', message);
      panic('Malformed message');
    }
    this._emit('message', message);
  }

  _onClose(id) {
    this._peers.delete(id);
    this._emit('exit', { id });
  }

  _isOutOfDate(msg) {
    return false; // TODO: Implement sync counters by origin and type.
  }

  _consume(msg) {
    // TODO: Update sync counters by origin and type.
  }

  _emit(type, detail) {
    const event = new CustomEvent(type, { detail });
    this.dispatchEvent(event);
  }
}

export { RTCInterface };
