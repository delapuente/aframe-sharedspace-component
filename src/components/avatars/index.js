import { registerComponent, utils } from 'aframe';
import { SceneTree } from './scene-tree';
import { EntityObserver } from './entity-observer';

const bind = utils.bind;
const log = utils.debug('sharedspace:avatars:log');
const warn = utils.debug('sharedspace:avatars:warn');
const error = utils.debug('sharedspace:avatars:error');

export default registerComponent('avatars', {

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
    if(this.data.template !== 'none' && !this._getAvatar(id)) {
      this._addAvatar(id, position);
    }
  },

  _onStream({ detail: { id, stream }}) {
    if (!this.data.audio) { return; }

    const avatar = this._getAvatar(id);
    if (!avatar) {
      warn(`Avatar ${id} avatar is not in the DOM`);
      return;
    }

    this._addStream(id, stream)
    .then(source => {
      log(`streaming: ${id}`, stream);
      avatar.setAttribute('sound', `src: #${source.id}`);
    });
  },

  _onExit({ detail: { id }}) {
    const isMe = id === this._sharedspace.data.me;
    const avatar = this._getAvatar(id);
    if (avatar) {
      this.el.emit('avatarelement', { avatar, isMe, action: 'exit' });
      if (this.data.autoremove) {
        avatar.parentNode.removeChild(avatar);
      }
    }
  },

  _onMessage({ detail: { id, message } }) {
    if (message.type === 'avatarsupdates') {
      this._collectToApply(message.updates);
      return;
    }
  },

  _getAvatar(id) {
    return this.el.querySelector(`[data-sharedspace-id="${id}"]`);
  },

  _addAvatar(id, position) {
    const isMe = id === this._sharedspace.data.me;
    const avatar = this._newAvatar();
    this.el.emit('avatarelement', { avatar, isMe, action: 'enter' });

    this._setupAvatar(avatar, id, position);
    if (isMe) {
      this._setupLocalAvatar(avatar);
    }
    this.el.emit('avatarsetup', { avatar, isMe });

    this.el.appendChild(avatar);
    this.el.emit('avataradded', { avatar, isMe });

    return avatar;
  },

  _newAvatar() {
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

  _setupAvatar(avatar, id, position) {
    const isMe = id === this._sharedspace.data.me;
    avatar.dataset.sharedspaceId = id;
    avatar.dataset.sharedspaceRoomPosition = position;
    avatar.dataset.isMe = isMe;

    const placement = this.data.placement;
    if (placement !== 'none') {
      avatar.addEventListener('loaded', function onLoaded() {
        avatar.removeEventListener('loaded', onLoaded);
        avatar.setAttribute(placement, { position });
      });
    }

    return avatar;
  },

  _setupLocalAvatar(avatar) {
    // HACK: Move this inside the conditional when camera can be used in mixins.
    // If you want to remove the camera right now, use avatarsetup event
    // and remove from detail.avatar element.
    avatar.setAttribute('camera', '');
    if (this.data.onmyself === 'auto') {
      avatar.setAttribute('look-controls', '');
      avatar.setAttribute('visible', 'false');
      avatar.setAttribute('share', 'rotation');
    }
    else if (this.data.myself !== 'none') {
      const mixinList = avatar.hasAttribute('mixin') ?
                        avatar.getAttribute('mixin').split(/\s+/) : [];

      mixinList.push(this.data.onmyself);
      avatar.setAttribute('mixin', mixinList.join(' '));
    }

    avatar.addEventListener('componentinitialized', ({ detail }) => {
      const { name } = detail;
      if (name === 'share') {
        const share = avatar.components.share;
        const filter = share.data.split(',').map(str => str.trim());
        log('sharing:', filter);
        this._share(avatar, filter.length > 0 ? filter : null);
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
      source.id = `avatar-stream-${id}`;
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
      const content = avatarsUpdatesMessage(this._ongoingUpdates);
      this._sharedspace.send('*', content);
      this._ongoingUpdates = [];
    }
  },

  _applyUpdates() {
    this._tree.applyUpdates(this._incomingUpdates);
    this._incomingUpdates = [];
  }
});

function avatarsUpdatesMessage(updates) {
  return { type: 'avatarsupdates', updates };
}
