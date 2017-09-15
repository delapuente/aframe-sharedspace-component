import { utils } from 'aframe';
import signalhub from 'signalhub';
import WebRtcSwarm from 'webrtc-swarm';

const bind = utils.bind;
const debug = utils.debug;

const log = debug('sharedspace:rtc-interface:log');

class RTCInterface {

  constructor({ room, id, stream, signaling }) {
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
    log('sending data:', data)
    this._peers.get(destination).send(data)
  }

  _onPeer(peer, id) {
    this._peers.set(id, peer);
    this._setupPeer(peer, id);
    this.onpeer && this.onpeer(id);
  }

  _onClose(id) {
    this._peers.delete(id);
    this.onleave && this.onleave(id);
  }

  _setupPeer(peer, id) {
    peer.on('data', this._ofType('list', bind(this._onList, this)));
    peer.on('close', bind(this._onClose, this, id));
  }

  _onList(msg) {
    this.onlist && this.onlist(msg);
  }

  _ofType(type, cb) {
    const self = this;
    return function (data) {
      const msg = JSON.parse(data);
      if (self._isOutOfDate(msg)) { return; }
      if (msg.type !== type) { return; }
      self._consume(msg);
      return cb(msg);
    }
  }

  _isOutOfDate(msg) {
    return false; // TODO: Implement sync counters by origin and type.
  }

  _consume(msg) {
    // TODO: Update sync counters by origin and type.
  }
}

export { RTCInterface };
