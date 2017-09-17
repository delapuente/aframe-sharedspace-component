import { registerComponent, utils } from 'aframe';
import { Participant } from './participant';
import { panic } from './utils';

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
    const { audio } = this.data;
    if (!audio) {
      this._initParticipation(null)
      .then(bind(this._configureParticipation, this));
      return;
    }

    this._getUserMedia({ audio })
    .then(bind(this._initParticipation, this))
    .catch(bind(informAndInit, this))
    .then(bind(this._configureParticipation, this));

    function informAndInit(reason) {
      warn('getUserMedia() failed. There will be no stream.');
      this.el.emit('getusermediafailed', reason, false);
      return this._initParticipation(null);
    }
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
    this._participation = new Participant(room, { id, stream, provider });
    return this._participation.connect();
  },

  _configureParticipation() {
    if (!this._participation) { panic('Participation not initialized'); }
    this.data.me = this._participation.me;
    log('Me:', this.data.me);
  }
});
