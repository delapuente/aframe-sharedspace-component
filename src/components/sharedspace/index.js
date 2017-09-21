import { registerComponent, utils } from 'aframe';
import { Participation } from './participation';
import { panic } from '../../utils';

const bind = utils.bind;
const log = utils.debug('sharedspace:log');
const warn = utils.debug('sharedspace:warn');
const error = utils.debug('sharedspace:error');

export default registerComponent('sharedspace', {
  schema: {
    provider: { default: 'localhost:9000' },
    room: { default: 'room-101' },
    audio: { default: false },
    me: { default: '' }
  },

  init() {
    this._connected = false;

    this.el.sceneEl.addEventListener('loaded', () => {

      const { audio } = this.data;
      if (!audio) {
        this._initParticipation(null)
        .then(bind(this._getIdentity, this));
        return;
      }

      this._getUserMedia({ audio })
      .then(bind(this._initParticipation, this))
      .catch(bind(informAndInit, this))
      .then(bind(this._getIdentity, this));

    });

    function informAndInit(reason) {
      warn('getUserMedia() failed. There will be no stream.');
      this.el.emit('getusermediafailed', reason, false);
      return this._initParticipation(null);
    }
  },

  send(target, message) {
    this._participation.send(target, message);
  },

  isConnected() {
    return this._connected;
  },

  _getUserMedia(constraints) {
    return navigator.mediaDevices.getUserMedia(constraints)
    .then(stream => {
      log('My stream:', stream);
      return stream;
    });
  },

  _initParticipation(stream) {
    const { room, id, provider } = this.data;
    this._participation = new Participation(room, { id, stream, provider });
    this._configureParticipation();
    return this._participation.connect()
    .then(result => {
      this._connected = true;
      return result;
    });
  },

  _configureParticipation() {
    this._passEventsThrough([
      'enterparticipant',
      'exitparticipant',
      'participantstream',
      'participantmessage'
    ]);
  },

  _passEventsThrough(events) {
    events.forEach(eventType => {
      this._participation.addEventListener(eventType, event => {
        log(`on ${eventType}:`, event.detail);
        this.el.emit(eventType, event.detail);
      })
    });
  },

  _getIdentity() {
    if (!this._participation) { panic('Participation not initialized'); }
    this.data.me = this._participation.me;
    log('Me:', this.data.me);
  }
});
