# aframe-sharedspace-component
> A-Frame VR chatroom component

## Install
You will need `node` and `npm` installed in your system. Once installed, simply run the following command from the root of your project:

```bash
$ npm install --save aframe-sharedspace-component
```

## Components

## Develop
Issuing the following command will run a local server with live-reload listening at port `8080` and a WebRTC signaling server at port `9000`:

```bash
$ npm start
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
