const SceneTree =
  require('../../../src/components/avatars/scene-tree').SceneTree;
const EntityObserver =
  require('../../../src/components/avatars/entity-observer').EntityObserver;
const registerComponent = require('aframe').registerComponent;
const helpers = require('../../helpers');

suite('avatars component', () => {
  let room;
  const myId = 'id0';
  const otherId = 'id1';

  const fakeSharedSpace = {
    data: {
      me: myId
    },
    isConnected() {
      return true;
    },
    send() { }
  }

  function dispatch(type, detail) {
    const event = new CustomEvent(type, { detail });
    room.dispatchEvent(event);
  }

  suiteSetup(() => {
    const template = document.createElement('TEMPLATE');
    template.innerHTML = '<a-entity class="avatar"></a-entity>';
    document.body.appendChild(template);
    return helpers.entityFactory()
    .then(entity => {
      room = entity;
    });
  });

  setup(() => {
    room.components.sharedspace = fakeSharedSpace;
    room.removeAttribute('avatars');
    room.setAttribute('avatars', '');
  });

  suite('on enterparticipant', () => {

    setup(() => {
      sinon.stub(EntityObserver.prototype, 'observe');
      room.innerHTML = '';
    });

    teardown(() => {
      EntityObserver.prototype.observe.restore();
    });

    test('if template is disabled, does nothing', () => {
      room.setAttribute('avatars', { template: 'none' });
      dispatch('enterparticipant', { id: myId, position: 1 });
      assert.equal(room.innerHTML, '');
    });

    test('instantiates the avatar template', () => {
      dispatch('enterparticipant', { id: myId, position: 1 });
      const avatar =
        room.querySelector(`[data-sharedspace-id="${myId}"]`);
      assert.equal(avatar.dataset.sharedspaceId, myId);
      assert.equal(avatar.dataset.sharedspaceRoomPosition, 1);
      assert.equal(avatar.dataset.isMe, 'true');
    });

    test('instantiates the avatar template only once', () => {
      dispatch('enterparticipant', { id: myId, position: 1 });
      dispatch('enterparticipant', { id: myId, position: 1 });
      const avatars =
        room.querySelectorAll(`[data-sharedspace-id="${myId}"]`);
      assert.equal(avatars.length, 1);
    });

    test('adds the default `position-around` placement component', () => {
      dispatch('enterparticipant', { id: myId, position: 1 });
      const avatar =
        room.querySelector(`[data-sharedspace-id="${myId}"]`);
      return new Promise(fulfil => {
        avatar.addEventListener('componentinitialized', ({ detail }) => {
          if (detail.name === 'position-around') {
            const attr = avatar.getAttribute('position-around');
            assert.equal(attr.position, 1);
            fulfil();
          }
        });
      });
    });

    test('adds a custom placement component', () => {
      registerComponent('placement-test', {
        schema: { position: { default: 1 } }
      });
      room.setAttribute('avatars', { placement: 'placement-test' });
      dispatch('enterparticipant', { id: myId, position: 1 });
      const avatar =
        room.querySelector(`[data-sharedspace-id="${myId}"]`);
      return helpers.waitFor(avatar)
      .then(() => {
        const attr = avatar.getAttribute('placement-test');
        assert.equal(attr.position, 1);
      });
    });

    test('does nothing special on peers avatars', () => {
      room.setAttribute('avatars', { placement: 'none' });
      dispatch('enterparticipant', { id: 'other-id', position: 1 });
      const avatar =
        room.querySelector(`[data-sharedspace-id="other-id"]`);
      return helpers.waitFor(avatar)
      .then(() => {
        const components = Object.keys(avatar.components);
        assert.equal(components.length, 4);
        assert.include(components, 'position');
        assert.include(components, 'rotation');
        assert.include(components, 'scale');
        assert.include(components, 'visible');
      });
    });

    test('customizes user avatar', () => {
      room.setAttribute('avatars', { placement: 'none' });
      dispatch('enterparticipant', { id: myId, position: 1 });
      const avatar =
        room.querySelector(`[data-sharedspace-id="${myId}"]`);
      return helpers.waitFor(avatar)
      .then(() => {
        const components = Object.keys(avatar.components);
        assert.equal(components.length, 7);
        assert.include(components, 'position');
        assert.include(components, 'rotation');
        assert.include(components, 'scale');
        assert.include(components, 'visible');
        assert.include(components, 'camera');
        assert.include(components, 'share');
        assert.isTrue(
          EntityObserver.prototype.observe.calledWith(avatar, {
            components: true,
            componentFilter: ['rotation']
          })
        );
      });
    });

    test('does nothing special on user avatar if customization is disabled', () => {
      room.setAttribute('avatars', {
        onmyself: 'none',
        placement: 'none'
      });
      dispatch('enterparticipant', { id: myId, position: 1 });
      const avatar =
        room.querySelector(`[data-sharedspace-id="${myId}"]`);
      return helpers.waitFor(avatar)
      .then(() => {
        const components = Object.keys(avatar.components);
        assert.equal(components.length, 4);
        assert.include(components, 'position');
        assert.include(components, 'rotation');
        assert.include(components, 'scale');
        assert.include(components, 'visible');
        assert.isTrue(
          EntityObserver.prototype.observe.neverCalledWith(avatar)
        );
      });
    });

    test('uses a mixin for user avatar customization', () => {
      const assets = document.querySelector('a-assets');
      assets.innerHTML = '<a-mixin id="user" light></a-mixin>';
      room.setAttribute('avatars', {
        onmyself: 'user',
        placement: 'none'
      });
      dispatch('enterparticipant', { id: myId, position: 1 });
      const avatar =
        room.querySelector(`[data-sharedspace-id="${myId}"]`);
      return helpers.waitFor(avatar)
      .then(() => {
        const components = Object.keys(avatar.components);
        assert.equal(components.length, 6);
        assert.include(components, 'position');
        assert.include(components, 'rotation');
        assert.include(components, 'scale');
        assert.include(components, 'visible');
        assert.include(components, 'light');
        // Remove when HACK (see src code) is solved.
        assert.include(components, 'camera');
        assert.equal(avatar.getAttribute('mixin'), 'user');
      });
    });

    test('triggers customization events in order', () => {
      const onElement = sinon.spy();
      const onSetup = sinon.spy();
      const onAdded = sinon.spy();
      room.addEventListener('avatarelement', onElement);
      room.addEventListener('avatarsetup', onSetup);
      room.addEventListener('avataradded', onAdded);
      dispatch('enterparticipant', { id: myId, position: 1 });

      const avatar =
        room.querySelector(`[data-sharedspace-id="${myId}"]`);
      return helpers.waitFor(avatar)
      .then(() => {
        let detail = onElement.getCall(0).args[0].detail;
        assert.equal(detail.avatar, avatar);
        assert.equal(detail.isMe, true);
        assert.equal(detail.action, 'enter');

        detail = onSetup.getCall(0).args[0].detail;
        assert.equal(detail.avatar, avatar);
        assert.equal(detail.isMe, true);

        detail = onAdded.getCall(0).args[0].detail;
        assert.equal(detail.avatar, avatar);
        assert.equal(detail.isMe, true);

        assert.isTrue(onAdded.calledAfter(onSetup));
        assert.isTrue(onSetup.calledAfter(onElement));
      });
    });

  });

  suite('on exitparticipant', () => {

    setup(() => {
      room.innerHTML = `<a-entity data-sharedspace-id="${myId}"></a-entity>`;
    });

    test('by default, removes the avatar of the participant', () => {
      dispatch('exitparticipant', { id: myId, position: 1 });
      assert.equal(room.innerHTML, '');
    });

    test('if autoremove is disabled, do nothing', () => {
      room.setAttribute('avatars', { autoremove: false });
      dispatch('exitparticipant', { id: myId, position: 1 });
      assert.equal(room.innerHTML, `<a-entity data-sharedspace-id="${myId}"></a-entity>`);
    });

  });

  suite('on participant message', () => {

    setup(() => {
      sinon.stub(SceneTree.prototype, 'applyUpdates');
    });

    teardown(() => {
      SceneTree.prototype.applyUpdates.restore();
    });

    test('applies updates on next tick', () => {
      const avatars = room.components.avatars;
      const updates = [];
      dispatch('participantmessage', {
        id: otherId,
        message: {
          type: 'avatarsupdates',
          updates
        }
      });
      avatars.tick();
      assert.isTrue(SceneTree.prototype.applyUpdates.calledWith(updates));
    });

  });

  suite('on participant stream', () => {
    let assets;

    setup(() => {
      assets = document.querySelector('a-assets');
      assets.innerHTML = '';
      room.innerHTML = `<a-entity data-sharedspace-id="${myId}"></a-entity>`;
    });

    let original;
    function fakeMediaStreamSource() {
      original = AudioContext.prototype.createMediaStreamSource;
      AudioContext.prototype.createMediaStreamSource = () => ({
        connect() {}
      });
    }

    function restoreMediaStreamSource() {
      AudioContext.prototype.createMediaStreamSource = original;
    }

    test('by default, sets a sound component in the avatar', done => {
      fakeMediaStreamSource();
      const stream = new MediaStream();
      const avatar = room.querySelector('a-entity');
      avatar.addEventListener('componentinitialized', function (evt) {
        if (evt.detail.name === 'sound') {
          const audio = document.querySelector('a-assets > audio');
          assert.isOk(audio);
          assert.equal(audio, avatar.components.sound.data.src);
          assert.equal(audio.srcObject, stream);
          restoreMediaStreamSource();
          done();
        }
      });
      dispatch('participantstream', { id: myId, stream });
    });

    test('if audio is set to false, does nothing', () => {
      room.setAttribute('avatars', { audio: false });
      const stream = new MediaStream();
      const assets = document.querySelector('a-assets');
      assets.innerHTML = '';
      dispatch('participantstream', { id: myId, stream });
      return helpers.waitFor(assets)
      .then(() => {
        assert.equal(assets.innerHTML, '');
      });
    });

  });

});
