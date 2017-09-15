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
    Object.keys(this._swarm.remotes).forEach(id => this.send(id, msg));
  }

  send(destination, msg={}) {
    msg.from = this._swarm.me;
    this._swarm.remotes[destination].send(JSON.stringify(msg))
  }

  _onPeer(peer, id) {
    this._setupPeer(peer);
    this.onpeer && this.onpeer(id);
  }

  _setupPeer(peer) {
    peer.on('data', this._ofType('list', bind(this._onList, this)));
  }

  _onList(msg) {
    const { timestamp, list } = msg;
    this.onlist && this.onlist({ timestamp, list });
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
