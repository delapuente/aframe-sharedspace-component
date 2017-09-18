import { registerComponent, utils } from 'aframe';
import { Participation } from './participation';
import { SceneTree } from './scene-tree';
import { EntityObserver } from './entity-observer';
import { panic } from '../utils';

const bind = utils.bind;
const log = utils.debug('sharedspace:log');
const warn = utils.debug('sharedspace:warn');

export default registerComponent('sharedspace', {
  schema: {
    provider: { default: 'localhost:9000' },
    room: { default: 'room-101' },
    audio: { default: false },
    participant: { type: 'selector', default: '#participant' },
    me: { default: '' }
  },

  init() {
    this._connected = false;
    // TODO: Isolate all the monitoring, collecting and applying updates.
    this._tree = new SceneTree(this.el);
    this._ongoingUpdates = [];
    this._incomingUpdates = [];
    this._collectToSend = bind(this._collectToSend, this);
    this._observer = new EntityObserver(this._collectToSend);

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

  tick(...args) {
    this._observer.check(...args);
    if (this._connected) {
      this._sendUpdates();
      this._applyUpdates();
    }
  },

  send(target, message) {
    this._participation.send(target, message);
  },

  _share(el, componentFilter) {
    this._observer.observe(el, { components: true, componentFilter })
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
    this._participation.addEventListener(
      'enterparticipant', bind(this._onEnterParticipant, this)
    );
    this._participation.addEventListener(
      'exitparticipant', bind(this._onExitParticipant, this)
    );
    this._participation.addEventListener(
      'participantmessage', bind(this._onParticipantMessage, this)
    );
    return this._participation.connect()
    .then(result => {
      this._connected = true;
      return result;
    });
  },

  _configureParticipation() {
    if (!this._participation) { panic('Participation not initialized'); }
    this.data.me = this._participation.me;
    log('Me:', this.data.me);
  },

  _onEnterParticipant({ detail: { id, position, role } }) {
    log(`on enter: ${id} (${role}) at position ${position}`);
    const participant = this._getParticipantElement(id);
    participant.addEventListener('loaded', function onLoaded() {
      participant.removeEventListener('loaded', onLoaded);
      if (participant.hasAttribute('position-around')) {
        participant.setAttribute('position-around', { position });
      }
    });
  },

  _getParticipantElement(id) {
    let participant = this.el.querySelector(`[data-sharedspace-id="${id}"]`);
    if (!participant) {
      const isMe = id === this._participation.me;
      const template = this.data.participant;
      participant = document.importNode(template.content, true).children[0];
      participant.dataset.sharedspaceId = id;
      if (!isMe) {
        const stream = this._participation.getStreams(id)[0];
        if (stream) {
          log(`streaming: ${id}`, stream);
          const source = this._addStream(id, stream);
          participant.setAttribute('sound', `src: #${source.id}`);
        }
      }
      if (isMe) {
        this._setupAvatar(participant);
      }
      this.el.appendChild(participant);
    }
    return participant;
  },

  _addStream(id, stream) {
    const assets = this._getAssets();
    const source = new Audio();
    source.id = `participant-stream-${id}`;
    source.srcObject = stream;
    assets.appendChild(source);
    return source;
  },

  _getAssets() {
    let assets = this.el.sceneEl.querySelector('a-assets');
    if (!assets) {
      assets = document.createElement('A-ASSETS');
      this.el.sceneEl.appendChild(assets);
    }
    return assets;
  },

  _onExitParticipant({ detail: { id, position, role } }) {
    log(`on enter: ${id} (${role}) at position ${position}`);
    const participant = this._getParticipantElement(id);
    participant.parentNode.removeChild(participant);
  },

  _onParticipantMessage({ detail: { id, message } }) {
    log(`on message: ${id}`, message);
    if (message.type === 'participantsupdates') {
      this._collectToApply(message.updates);
      return;
    }
    this.el.emit('participantmessage', { id, message });
  },

  _collectToApply(updates) {
    this._incomingUpdates.push(...updates);
  },

  _collectToSend(updates) {
    updates = updates.map(update => {
      const serializable = Object.assign({}, update);
      const { sharedspaceId } = update.target.dataset;
      serializable.target = `[data-sharedspace-id="${sharedspaceId}"]`;
      return serializable;
    });
    this._ongoingUpdates.push(...updates);
  },

  _sendUpdates() {
    if (this._ongoingUpdates.length > 0) {
      const content = participantsUpdatesMessage(this._ongoingUpdates);
      this._participation.send('*', content);
      this._ongoingUpdates = [];
    }
  },

  _applyUpdates() {
    this._tree.applyUpdates(this._incomingUpdates);
    this._incomingUpdates = [];
  },

  _setupAvatar(participant) {
    participant.setAttribute('camera', '');
    participant.setAttribute('look-controls', '');
    if (!participant.hasAttribute('onmyself')) {
      participant.setAttribute('onmyself', 'share: rotation');
    }
    participant.addEventListener('componentinitialized', ({ detail }) => {
      const { name, data } = detail;
      if (name === 'onmyself') {
        this._share(participant, data.share);
      }
    });
  }
});

function participantsUpdatesMessage(updates) {
  return { type: 'participantsupdates', updates };
}
