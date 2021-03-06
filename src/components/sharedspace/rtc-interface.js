import { utils } from 'aframe';
import signalhub from 'signalhub';
import WebRtcSwarm from 'webrtc-swarm';
import EventTarget from 'event-target-shim';
import { panic } from '../../utils';

const bind = utils.bind;
const log = utils.debug('sharedspace:rtc-interface:log');
const error = utils.debug('sharedspace:rtc-interface:error');

class RTCInterface extends EventTarget {
  constructor (room, { id, stream, signaling }) {
    super();
    this._id = id;
    this._stream = stream;
    this._hub = signalhub(room, [signaling]);
  }

  get me () {
    return this._swarm && this._swarm.me;
  }

  connect () {
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

  broadcast (msg) {
    Array.from(this._peers.keys()).forEach(id => this.send(id, msg));
  }

  send (destination, msg = {}) {
    msg.from = this.me;
    const data = JSON.stringify(msg);
    log('sending data:', data);
    const peer = this._peers.get(destination);
    if (peer) { peer.send(data); }
  }

  isConnected (id) {
    return this._peers.has(id);
  }

  _onPeer (peer, id) {
    this._peers.set(id, peer);
    this._setupPeer(peer, id);
    this._emit('connect', { id });
  }

  _setupPeer (peer, id) {
    peer.on('stream', bind(this._onStream, this, id));
    peer.on('data', bind(this._onData, this));
    peer.on('close', bind(this._onClose, this, id));
  }

  _onStream (id, stream) {
    this._emit('stream', { id, stream });
  }

  // TODO: Rethink this: the emitted event does not follow the same shape of
  // other events.
  _onData (data) {
    try {
      const message = JSON.parse(data);
      if (typeof message !== 'object' || !message.type) {
        error('Malformed message:', message);
        return panic('Malformed message');
      }
      this._emit('message', message);
    } catch (e) {
      if (e instanceof SyntaxError) {
        error('Non JSON format:', data, e);
        return panic('Non JSON format');
      }
      throw e;
    }
  }

  _onClose (id) {
    this._peers.delete(id);
    this._emit('close', { id });
  }

  _emit (type, detail) {
    const event = new window.CustomEvent(type, { detail });
    this.dispatchEvent(event);
  }
}

export { RTCInterface };
