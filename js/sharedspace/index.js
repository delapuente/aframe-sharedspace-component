import { registerComponent, utils } from 'aframe';
import { Participant } from './participant';
import { panic } from './utils';

const bind = utils.bind;
const log = utils.debug('sharedspace:log');
const warn = utils.debug('sharedspace:warn');

export default registerComponent('sharedspace', {
  schema: {
    provider: { default: 'localhost:9000' },
    room: { default: 'room-101' },
    audio: { default: false },
    onguest: { type: 'selector', default: '[avatar]' },
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
    this._participation.addEventListener(
      'enterparticipant', bind(this._onEnterParticipant, this)
    );
    return this._participation.connect();
  },

  _configureParticipation() {
    if (!this._participation) { panic('Participation not initialized'); }
    this.data.me = this._participation.me;
    log('Me:', this.data.me);
  },

  _onEnterParticipant({ detail: { id, position, role } }) {
    log(`on enter: ${id} (${role}) at position ${position}`);
    const participant = this._getParticipantElement(id);
    if (participant.components['position-around']) {
      participant.setAttribute('position-around', { position });
    }
  },

  _getParticipantElement(id) {
    let participant = this.el.querySelector(`[data-sharedspace-id="${id}"]`);
    if (!participant) {
      const template = document.querySelector('#participant');
      participant = document.importNode(template.content, true).children[0];
      participant.dataset.sharedspaceId = id;
      this.el.appendChild(participant);
    }
    return participant;
  }
});
