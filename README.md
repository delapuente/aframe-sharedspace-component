# aframe-sharedspace-component
> A-Frame VR component to create multi-user experiences with WebRTC

Try the

## HTTPS
WebRTC works with secure origins only, so your site must be served from `localhost` or HTTPS for the component to work. If you need to access your application from the Internet, use [ngrok](https://ngrok.com/) or build it completely on [glitch](https://glitch.com/). Both options work great.

## Install
You will need `node` and `npm` installed in your system. Once installed, simply run the following command from the root of your project to install as a dependency:

```bash
$ npm install --save aframe-sharedspace-component
```

Or add the script tag to the component after including A-Frame:

```html
<script src="https://cdn.rawgit.com/delapuente/aframe-sharedspace-component/master/dist/aframe-sharedspace-component.js"></script>
```

## Minimal setup

Once A-Frame and the `sharedspace` component are [installed](#install), this is all the HTML you need to create a chatroom (really!):

```html
<a-scene>
  <a-entity sharedspace="audio: true" participants>
  </a-entity>
</a-scene>
<template>
  <a-sphere radius="0.1" position-around><a-sphere>
</template>
```

Unfortunately, the chatroom lacks from decoration and participants will be spheres, which is not the best way of representing a human head. Instead, take a look at the [Minimal Chatroom application on Glitch](glitch.com/edit/#!/minimal-chatroom) for a **functional** minimal setup.

## Documentation

Take a look at the [Component Overview]() document while I prepare the proper documentations.

## Develop
Issuing the following command will run a local server with live-reload listening at port `8080` and a local WebRTC signaling server at port `9000`:

```bash
$ npm start
```

You need to point the `sharedspace` component to the developer server. Use the `provider` property to that end:

```html
<a-entity sharedspace="provider: http://localhost:9000">
  <!-- Here is the content of your shared space -->
</a-entity>
```

## Build
If you want to generate the JavaScript bundle for the library, run the following command and the package will be under the `dist` folder:

```bash
$ npm run build
```

### Size analysis
You can set the `SIZE_ANALYSIS` environment variable to visualize the size of the bundle components.

```bash
$ SIZE_ANALYSIS=1 npm run build
```

## Deploy
Finally, if you want to publish "The (Un)Happy Birthday Chamber" demo on GitHub Pages, run:

```bash
$ npm run deploy
```
