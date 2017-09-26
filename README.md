# aframe-sharedspace-component
> A-Frame VR component to create multi-user experiences with WebRTC

Try the [VR Chat](https://vr-chat.glitch.me/) on-line!

The `sharedspace` component provides a simple participation model in which participants join or leave a named room, send messages to other peers and publish audio streams. It runs on the top of WebRTC, with minimal signaling infrastructure relaying on peer-to-peer session management.

The `sharedspace` component covers an specific usecase. If you are looking for a more general solution to network-synchronized A-Frame scenes, take a look at [`networked-aframe`](https://github.com/haydenjameslee/networked-aframe) by [Hayden Lee](http://haydenlee.io/).

## HTTPS
WebRTC works with secure origins only, so your site must be served from `localhost` or HTTPS for the component to work. If you need to access your application from the Internet, use [ngrok](https://ngrok.com/) or build it completely on [glitch](https://glitch.com/). Both options work great.

## Install
You will need `node` and `npm` installed in your system. Once installed, simply run the following command from the root of your project to install as a dependency:

```bash
$ npm install --save aframe-sharedspace-component
```

Or add the script tag to the component after including A-Frame:

```html
<script src="https://cdn.rawgit.com/delapuente/aframe-sharedspace-component/master/dist/aframe-sharedspace-component.min.js"></script>
```

## Minimal setup

Once A-Frame and the `sharedspace` component are [installed](#install), this is all the HTML you need to create a chatroom (really!):

```html
<a-scene>
  <a-entity sharedspace="audio: true" avatars>
  </a-entity>
</a-scene>
<template>
  <a-sphere radius="0.1"></a-sphere>
</template>
```

Unfortunately, the chatroom lacks from decoration and avatars will be spheres, which is not the best way of representing a human head. Instead, take a look at the [VR Chat application on Glitch](https://glitch.com/edit/#!/vr-chat) for a **functional** minimal setup.

## Documentation

When installing `sharedspace`, four components are registered with A-Frame:

| Component         | Description                                          |
|-------------------|------------------------------------------------------|
| `sharedspace`     | Provides the participation model.                    |
| `avatars`         | Manage participants' avatars.                        |
| `share`           | Controls the state of the participant to share.      |
| `position-around` | Helper to position an entity around a central point. |

Take a look at the [Component Overview](https://github.com/delapuente/aframe-sharedspace-component/tree/master/dist#component-overview) document while preparing a more _webby_ version of the docs.

## Contributing
If you want to contribute to the project, clone the repository and install the dependencies:

```bash
$ npm install
```

Issue the following command to run a local server with live-reload listening at port `8080` and a local WebRTC signaling server at port `9000`:

```bash
$ npm start
```

To make the `sharedspace` component to use the local signaling server, use the `provider` property:

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
To deploy the demo coming with the library on GitHub Pages, use the following command. Remeber to change the `origin` remote to point to your own repository.

```bash
$ npm run deploy
```

## Credits

[Anime Face Model Stocking](https://sketchfab.com/models/d049b6a85d204057b170ef9dbc851200) by [stocking](https://sketchfab.com/stocking) is licensed under [CC Attribution](http://creativecommons.org/licenses/by/4.0/)
