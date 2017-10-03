const registerComponent = require('aframe').registerComponent;
const helpers = require('../helpers');

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
    room.innerHTML = '';
  });

  suite('on enterparticipant', () => {

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
      return new Promise(fulfil => {
        avatar.addEventListener('loaded', () => {
          const components = Object.keys(avatar.components);
          assert.equal(components.length, 4);
          assert.include(components, 'position');
          assert.include(components, 'rotation');
          assert.include(components, 'scale');
          assert.include(components, 'visible');
          fulfil();
        });
      });
    });

    test('customizes user avatar', () => {
      room.setAttribute('avatars', { placement: 'none' });
      dispatch('enterparticipant', { id: myId, position: 1 });
      const avatar =
        room.querySelector(`[data-sharedspace-id="${myId}"]`);
      return new Promise(fulfil => {
        avatar.addEventListener('loaded', () => {
          const components = Object.keys(avatar.components);
          assert.equal(components.length, 7);
          assert.include(components, 'position');
          assert.include(components, 'rotation');
          assert.include(components, 'scale');
          assert.include(components, 'visible');
          assert.include(components, 'camera');
          assert.include(components, 'share');
          fulfil();
        });
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
      return new Promise(fulfil => {
        avatar.addEventListener('loaded', () => {
          const components = Object.keys(avatar.components);
          assert.equal(components.length, 4);
          assert.include(components, 'position');
          assert.include(components, 'rotation');
          assert.include(components, 'scale');
          assert.include(components, 'visible');
          fulfil();
        });
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
      return new Promise(fulfil => {
        avatar.addEventListener('loaded', () => {
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
          fulfil();
        });
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

});
