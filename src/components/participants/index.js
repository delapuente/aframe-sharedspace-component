import { registerComponent, utils } from 'aframe';
import { SceneTree } from './scene-tree';
import { EntityObserver } from './entity-observer';

const bind = utils.bind;
const log = utils.debug('sharedspace:participants:log');
const warn = utils.debug('sharedspace:participants:warn');
const error = utils.debug('sharedspace:participants:error');

export default registerComponent('participants', {

  dependendies: ['sharedspace'],

  schema: {
    template: { type: 'selector', default: 'template' },
    placement: { type: 'string', default: 'position-around' },
    onmyself: { type: 'string', default: 'auto' },
    audio: { default: true },
    autoremove: { default: true }
  },

  init() {
    this._tree = new SceneTree(this.el);
    this._ongoingUpdates = [];
    this._incomingUpdates = [];
    this._collectToSend = bind(this._collectToSend, this);
    this._observer = new EntityObserver(this._collectToSend);
    this._sharedspace = this.el.components.sharedspace;

    this.el.addEventListener('enterparticipant', bind(this._onEnter, this));
    this.el.addEventListener('participantstream', bind(this._onStream, this));
    this.el.addEventListener('participantmessage', bind(this._onMessage, this));
    this.el.addEventListener('exitparticipant', bind(this._onExit, this));
  },

  tick(...args) {
    this._observer.check(...args);
    if (this._sharedspace.isConnected()) {
      this._sendUpdates();
      this._applyUpdates();
    }
  },

  _onEnter({ detail: { id, position }}) {
    if(this.data.template !== 'none' && !this._getParticipant(id)) {
      this._addParticipant(id, position);
    }
  },

  _onStream({ detail: { id, stream }}) {
    if (!this.data.audio) { return; }

    const participant = this._getParticipant(id);
    if (!participant) {
      warn(`Participant ${id} avatar is not in the DOM`);
      return;
    }

    this._addStream(id, stream)
    .then(source => {
      log(`streaming: ${id}`, stream);
      participant.setAttribute('sound', `src: #${source.id}`);
    });
  },

  _onExit({ detail: { id }}) {
    const isMe = id === this._sharedspace.data.me;
    const participant = this._getParticipant(id);
    if (participant) {
      this.el.emit('participantelement', { participant, isMe, action: 'exit' });
      if (this.data.autoremove) {
        participant.parentNode.removeChild(participant);
      }
    }
  },

  _onMessage({ detail: { id, message } }) {
    if (message.type === 'participantsupdates') {
      this._collectToApply(message.updates);
      return;
    }
  },

  _getParticipant(id) {
    return this.el.querySelector(`[data-sharedspace-id="${id}"]`);
  },

  _addParticipant(id, position) {
    const isMe = id === this._sharedspace.data.me;
    const participant = this._newParticipant();
    this.el.emit('participantelement', { participant, isMe, action: 'enter' });

    this._setupParticipant(participant, id, position);
    if (isMe) {
      this._setupMyself(participant);
    }
    this.el.emit('participantsetup', { participant, isMe });

    this.el.appendChild(participant);
    this.el.emit('participantadded', { participant, isMe });

    return participant;
  },

  _newParticipant() {
    const empty = document.createElement('A-ENTITY');

    const template = this.data.template;
    if (!template) {
      warn('Template not found. Using an empty entity.');
      return empty;
    }

    const instance = document.importNode(template.content, true).children[0];
    if (!instance) {
      warn('Template was empty. Using an empty entity.');
      return empty;
    }

    return instance;
  },

  _setupParticipant(participant, id, position) {
    const isMe = id === this._sharedspace.data.me;
    participant.dataset.sharedspaceId = id;
    participant.dataset.sharedspaceRoomPosition = position;
    participant.dataset.isMe = isMe;

    const placement = this.data.placement;
    if (placement !== 'none') {
      participant.addEventListener('loaded', function onLoaded() {
        participant.removeEventListener('loaded', onLoaded);
        participant.setAttribute(placement, { position });
      });
    }

    return participant;
  },

  _setupMyself(participant) {
    // HACK: Move this inside the conditional when camera can be used in mixins.
    // If you want to remove the camera right now, use participantsetup event
    // and remove from detail.participant element.
    participant.setAttribute('camera', '');
    if (this.data.onmyself === 'auto') {
      participant.setAttribute('look-controls', '');
      participant.setAttribute('share', 'rotation');
    }
    else if (this.data.myself !== 'none') {
      const mixinList = participant.hasAttribute('mixin') ?
                        participant.getAttribute('mixin').split(/\s+/) : [];

      mixinList.push(this.data.onmyself);
      participant.setAttribute('mixin', mixinList.join(' '));
    }

    participant.addEventListener('componentinitialized', ({ detail }) => {
      const { name } = detail;
      if (name === 'share') {
        const share = participant.components.share;
        const filter = share.data.split(',').map(str => str.trim());
        log('sharing:', filter);
        this._share(participant, filter.length > 0 ? filter : null);
      }
    });
  },

  _share(el, componentFilter) {
    this._observer.observe(el, { components: true, componentFilter })
  },

  _addStream(id, stream) {
    return this._getAssets()
    .then(assets => {
      const source = new Audio();
      source.id = `participant-stream-${id}`;
      source.srcObject = stream;
      assets.appendChild(source);
      return source;
    });
  },

  _getAssets() {
    let assets = this.el.sceneEl.querySelector('a-assets');
    if (!assets || !assets.hasLoaded) {
      assets = document.createElement('A-ASSETS');
      this.el.sceneEl.appendChild(assets);
      return new Promise(fulfill => {
        assets.addEventListener('loaded', () => fulfill(assets));
      });
    }
    return Promise.resolve(assets);
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
      this._sharedspace.send('*', content);
      this._ongoingUpdates = [];
    }
  },

  _applyUpdates() {
    this._tree.applyUpdates(this._incomingUpdates);
    this._incomingUpdates = [];
  }
});

function participantsUpdatesMessage(updates) {
  return { type: 'participantsupdates', updates };
}
