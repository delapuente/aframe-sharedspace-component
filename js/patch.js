import * as AFRAME from 'aframe';
const THREE = AFRAME.THREE;

var warn = AFRAME.utils.debug('components:sound:warn');

const { play } = THREE.Audio.prototype;

THREE.Audio.prototype.setAudioElement = function (audioElement) {
  this.audioElement = audioElement;
  this.sourceType = 'audio-element';
  this.source = this.context.createMediaStreamSource(audioElement.srcObject);
  this.buffer = {};
  return this;
};

THREE.Audio.prototype.play = function () {
  if (this.sourceType !== 'audio-element' || this.isPlaying) {
    return play.call(this);
  }

  this.audioElement.muted = true;
  this.connect();
  this.audioElement.play();
  return this;
};

AFRAME.components.sound.schema.src.parse = function assetParse (value) {
  var el;
  var parsedUrl;

  // If an element was provided (e.g. canvas or video), just return it.
  if (typeof value !== 'string') { return value; }

  // Wrapped `url()` in case of data URI.
  parsedUrl = value.match(/\url\((.+)\)/);
  if (parsedUrl) { return parsedUrl[1]; }

  // ID.
  if (value.charAt(0) === '#') {
    el = document.getElementById(value.substring(1));
    if (el) {
      // Pass through media elements. If we have the elements, we don't have to call
      // three.js loaders which would re-request the assets.
      if (['CANVAS', 'VIDEO', 'IMG', 'AUDIO'].indexOf(el.tagName) >= 0) {
        return el;
      }
      return el.getAttribute('src');
    }
    warn('"' + value + '" asset not found.');
    return;
  }

  // Non-wrapped url().
  return value;
};

const Sound = AFRAME.components.sound.Component;
Sound.prototype.update = function (oldData) {
  var data = this.data;
  var srcChanged = data.src !== oldData.src;
  // Create new sound if not yet created or changing `src`.
  if (srcChanged) {
    if (!data.src) {
      warn('Audio source was not specified with `src`');
      return;
    }
    this.setupSound();
  }

  this.pool.children.forEach(function (sound) {
    if (data.positional) {
      sound.setDistanceModel(data.distanceModel);
      sound.setMaxDistance(data.maxDistance);
      sound.setRefDistance(data.refDistance);
      sound.setRolloffFactor(data.rolloffFactor);
    }
    sound.setLoop(data.loop);
    sound.setVolume(data.volume);
    sound.isPaused = false;
  });

  if (data.on !== oldData.on) {
    this.updateEventListener(oldData.on);
  }
  // All sound values set. Load in `src`.
  if (srcChanged) {
    var self = this;

    this.loaded = false;
    if (typeof data.src === 'string') {
      this.audioLoader.load(data.src, function (buffer) {
        self.pool.children.forEach(function (sound) {
          sound.setBuffer(buffer);
        });
        self.loaded = true;

        // Remove this key from cache, otherwise we can't play it again
        AFRAME.THREE.Cache.remove(data.src);
        if (self.data.autoplay || self.mustPlay) { self.playSound(); }
        self.el.emit('sound-loaded');
      });
    }
    else {
      var audioEl = data.src;
      audioEl.addEventListener('loadeddata', function onEnoughData() {
        if (audioEl.readyState === 4) {
          audioEl.removeEventListener('loadeddata', onEnoughData);

          self.pool.children.forEach(function (sound) {
            sound.setAudioElement(audioEl);
          });
          self.loaded = true;

          console.log('shoud play');
          if (self.data.autoplay || self.mustPlay) { self.playSound(); }
          self.el.emit('sound-loaded');
        }
      });
    }
  }
};
