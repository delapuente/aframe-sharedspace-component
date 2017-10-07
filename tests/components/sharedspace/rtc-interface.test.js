const ee = require('event-emitter')

suite.only('RTCInterface', () => {
  let inject;
  let RTCInterface;
  let network;

  let fakeSignalHubCons, fakeSignalHub;
  let fakeWebRTCSwarmCons, fakeWebRTCSwarm;
  let fakePeerCons, fakePeer;

  const stream = new MediaStream();

  setup(() => {
    inject = require(
      'inject-loader!../../../src/components/sharedspace/rtc-interface'
    );

    fakeSignalHubCons = sinon.spy(function () {
      return (fakeSignalHub = {
      });
    });

    fakeWebRTCSwarmCons = sinon.spy(function (hub, { uuid }) {
      return (fakeWebRTCSwarm = ee({
        me: uuid || 'randomId'
      }));
    });


    fakePeerCons = function () { };
    ee(fakePeerCons.prototype = {
      send: sinon.spy()
    });

    RTCInterface = inject({
      'signalhub': fakeSignalHubCons,
      'webrtc-swarm': fakeWebRTCSwarmCons,
      '../../utils': { panic: sinon.spy() }
    }).RTCInterface;

    network = new RTCInterface('test', {
      stream,
      signaling: 'test.com'
    });
  });

  suite('constructor', () => {

    test('connects to the specified server with the specified room', () => {
      assert.isTrue(fakeSignalHubCons.calledOnce);
      assert.isTrue(fakeSignalHubCons.calledWith('test', ['test.com']));
    });

  });

  suite('me property', () => {

    test('is undefined before connect', () => {
      assert.isUndefined(network.me);
    });

    test('it is the id specified during construction', () => {
      network = new RTCInterface('test', { id: 'myId' });
      return network.connect()
      .then(() => {
        assert.equal(network.me, 'myId');
      });
    });

    test('it is automatically assigned if not provided', () => {
      return network.connect()
      .then(() => {
        assert.equal(network.me, 'randomId');
      });
    });

  });

  suite('connect method', () => {

    test('initializes WebRTC Swarm', () => {
      return network.connect()
      .then(() => {
        //assert.isTrue(fakeWebRTCSwarmCons.calledOnce);
        assert.isTrue(fakeWebRTCSwarmCons.calledWith(fakeSignalHub, {
          uuid: undefined,
          stream,
          offerConstraints: {
            mandatory: {
              OfferToReceiveAudio: true,
              OfferToReceiveVideo: true
            }
          }
        }));
      });
    });

  });

  suite('after connect', () => {

    setup(() => {
      return network.connect();
    });

    suite('broadcast method', () => {
      const message = {};

      test('calls send for each peer (no peers)', () => {
        sinon.spy(network, 'send');
        network.broadcast(message);
        assert.isTrue(network.send.notCalled);
      });

      test('calls send for each peer (two peers)', () => {
        sinon.spy(network, 'send');
        fakeWebRTCSwarm.emit('peer', new fakePeerCons(), 'id1');
        fakeWebRTCSwarm.emit('peer', new fakePeerCons(), 'id2');
        network.broadcast(message);
        assert.isTrue(network.send.calledTwice);
        assert.isTrue(network.send.calledWith('id1', message));
        assert.isTrue(network.send.calledWith('id2', message));
      });

    });

    suite('send method', () => {
      let message;

      setup(() => {
        message = {};
      });

      test('does nothing if the destination is not connected', () => {
        network.send('id1', message);
        assert.isTrue(fakePeerCons.prototype.send.notCalled);
      });

      test('sends a JSON stringified representation which includes the sender', () => {
        fakeWebRTCSwarm.emit('peer', new fakePeerCons(), 'id1');
        network.send('id1', message);
        const messageSent =
          JSON.stringify(Object.assign({ from: 'randomId' }, message));
        assert.isTrue(fakePeerCons.prototype.send.calledWith(messageSent));
      });
    });

    suite('isConnected method', () => {

      test('returns true whether the peer is connected', () => {
        fakeWebRTCSwarm.emit('peer', new fakePeerCons(), 'id1');
        assert.isTrue(network.isConnected('id1'));
      });

      test('returns false whether the peer is connected', () => {
        assert.isFalse(network.isConnected('id1'));
      });

    });

    suite('on peer', () => {

      test('emits a connect event with the id of the peer', done => {
        network.addEventListener('connect', ({ detail }) => {
          assert.deepEqual(detail, { id: 'id1' });
          done();
        });
        fakeWebRTCSwarm.emit('peer', new fakePeerCons(), 'id1');
      });

    });

    suite('on peer stream', () => {

    });

    suite('on peer data', () => {

    });

    suite('on peer close', () => {

    });

  });

});
