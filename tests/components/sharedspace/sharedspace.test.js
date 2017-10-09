const EventTarget = require('event-target-shim');
const helpers = require('../../helpers');

suite('sharedspace component', () => {
  /* eslint-disable import/no-webpack-loader-syntax */
  const inject = require('inject-loader!../../../src/components/sharedspace');
  /* eslint-enable import/no-webpack-loader-syntax */

  let room;
  let fakeParticipationCons, fakeParticipation;

  const stream = new window.MediaStream();
  const panic = sinon.spy();

  suiteSetup(() => {
    fakeParticipationCons = class extends EventTarget {
      constructor () {
        super();
        fakeParticipation = this;
      }

      connect () {
        return Promise.resolve();
      }

      emit (type, detail) {
        const event = new window.CustomEvent(type, { detail });
        this.dispatchEvent(event);
      }
    };
    sinon.spy(fakeParticipationCons.prototype, 'connect');
    fakeParticipationCons = sinon.spy(fakeParticipationCons);

    inject({
      './participation': { Participation: fakeParticipationCons },
      '../../utils': { panic }
    });
  });

  setup(() => {
    fakeParticipationCons.reset();
    sinon.stub(navigator.mediaDevices, 'getUserMedia').resolves(stream);
    const scene = document.querySelector('a-scene');
    if (scene) { scene.parentNode.removeChild(scene); }
    return helpers.entityFactory()
    .then(entity => {
      room = entity;
    });
  });

  teardown(() => {
    navigator.mediaDevices.getUserMedia.restore();
  });

  suite('if hold is false', () => {
    setup(done => {
      room.setAttribute('sharedspace', '');
      setTimeout(done);
    });

    test('autoconnects', () => {
      assert.isTrue(room.components.sharedspace.isConnected());
    });
  });

  suite('if hold is true', () => {
    setup(done => {
      room.setAttribute('sharedspace', 'hold: true');
      setTimeout(done);
    });

    test('does not autoconnect', () => {
      assert.isFalse(room.components.sharedspace.isConnected());
    });

    test('autoconnects after setting hold to false', done => {
      room.setAttribute('sharedspace', { hold: false });
      setTimeout(() => {
        assert.isTrue(room.components.sharedspace.isConnected());
        done();
      });
    });
  });

  suite('hold is false, non default properties', () => {
    setup(done => {
      room.setAttribute(
        'sharedspace',
        'room: test; provider: test.com; me: testId'
      );
      setTimeout(done);
    });

    test('calls participation properly', () => {
      assert.isTrue(fakeParticipationCons.calledOnce);
      assert.isTrue(fakeParticipationCons.calledWith('test', {
        id: 'testId',
        stream: null,
        provider: 'test.com'
      }));
    });
  });

  suite('hold is true, non default properties', () => {
    setup(done => {
      room.setAttribute(
        'sharedspace',
        'hold: true; room: test; provider: test.com; me: testId'
      );
      setTimeout(done);
    });

    test('calls participation properly', done => {
      assert.isTrue(fakeParticipationCons.notCalled);
      room.setAttribute('sharedspace', { hold: false });
      setTimeout(() => {
        assert.isTrue(fakeParticipationCons.calledOnce);
        assert.isTrue(fakeParticipationCons.calledWith('test', {
          id: 'testId',
          stream: null,
          provider: 'test.com'
        }));
        done();
      });
    });
  });

  suite('if audio is false', () => {
    setup(done => {
      room.setAttribute('sharedspace', 'audio: false');
      setTimeout(done);
    });

    test('does not ask for user media', () => {
      assert.isTrue(navigator.mediaDevices.getUserMedia.notCalled);
    });
  });

  suite('if audio is true', () => {
    setup(done => {
      room.setAttribute('sharedspace', 'audio: true');
      setTimeout(done);
    });

    test('ask for user media', () => {
      assert.isTrue(navigator.mediaDevices.getUserMedia.calledOnce);
    });
  });

  suite('if audio is true, but fails', () => {
    const error = {};

    test('reports the error', done => {
      navigator.mediaDevices.getUserMedia.restore();
      sinon.stub(navigator.mediaDevices, 'getUserMedia').rejects(error);
      room.addEventListener('getusermediafailed', ({ detail }) => {
        assert.isTrue(navigator.mediaDevices.getUserMedia.calledOnce);
        assert.equal(detail, error);
        done();
      });
      room.setAttribute('sharedspace', 'audio: true');
    });
  });

  suite('on participation events', () => {
    const evtDetail = {};

    setup(done => {
      room.setAttribute('sharedspace', '');
      setTimeout(done);
    });

    [
      'enterparticipant',
      'exitparticipant',
      'participantstream',
      'participantmessage'
    ].forEach(type => {
      test(`bypasses participation ${type} event`, done => {
        room.addEventListener(type, ({ detail }) => {
          assert.equal(detail, evtDetail);
          done();
        });
        fakeParticipation.emit(type, evtDetail);
      });
    });
  });
});
