import { registerComponent, utils } from 'aframe';
import { Participation } from './participation';
import { panic } from '../../utils';

const bind = utils.bind;
const log = utils.debug('sharedspace:log');
const warn = utils.debug('sharedspace:warn');

export default registerComponent('sharedspace', {
  schema: {
    hold: { default: false },
    provider: { default: 'https://salvadelapuente.com:9000' },
    room: { default: 'room-101' },
    audio: { default: false },
    me: { default: '' }
  },

  update () {
    if (!this._initializing && !this._connected && !this.data.hold) {
      this._start();
    }
  },

  init () {
    this._connected = false;
    this._initializing = false;

    // Delay connection until all the scene is complete so other dependant
    // components can set their event handlers up. See `participants` component
    // for an example.
    if (this.el.sceneEl.hasLoaded) {
      this._start();
    } else {
      this.el.sceneEl.addEventListener('loaded', bind(this._start, this));
    }
  },

  send (target, message) {
    this._participation.send(target, message);
  },

  isConnected () {
    return this._connected;
  },

  _start () {
    if (this.data.hold || this._connected || this._initializing) {
      return;
    }

    this._initializing = true;

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

    function informAndInit (reason) {
      warn('getUserMedia() failed. There will be no stream.');
      this.el.emit('getusermediafailed', reason, false);
      return this._initParticipation(null);
    }
  },

  _getUserMedia (constraints) {
    return navigator.mediaDevices.getUserMedia(constraints)
    .then(stream => {
      log('My stream:', stream);
      return stream;
    });
  },

  _initParticipation (stream) {
    const { room, me, provider } = this.data;
    this._participation = new Participation(room, { id: me, stream, provider });
    this._configureParticipation();
    return this._participation.connect()
    .then(result => {
      this._connected = true;
      this._initializing = false;
      return result;
    });
  },

  _configureParticipation () {
    this._passEventsThrough([
      'enterparticipant',
      'exitparticipant',
      'participantstream',
      'participantmessage'
    ]);
  },

  _passEventsThrough (events) {
    events.forEach(eventType => {
      this._participation.addEventListener(eventType, event => {
        log(`on ${eventType}:`, event.detail);
        this.el.emit(eventType, event.detail);
      });
    });
  },

  _getIdentity () {
    if (!this._participation) { panic('Participation not initialized'); }
    this.data.me = this._participation.me;
    log('Me:', this.data.me);
  }
});
