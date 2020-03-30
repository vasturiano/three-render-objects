import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  Raycaster,
  TextureLoader,
  Vector2,
  Vector3,
  Color,
  Mesh,
  SphereGeometry,
  MeshBasicMaterial,
  BackSide,

  // required for various controls
  EventDispatcher,
  MOUSE,
  Quaternion,
  Spherical,
  Clock
} from 'three';

const three = window.THREE
  ? window.THREE // Prefer consumption from global THREE, if exists
  : {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  Raycaster,
  TextureLoader,
  Vector2,
  Vector3,
  Color,
  Mesh,
  SphereGeometry,
  MeshBasicMaterial,
  BackSide,

  EventDispatcher,
  MOUSE,
  Quaternion,
  Spherical,
  Clock
};

import ThreeTrackballControls from 'three-trackballcontrols';
import OrbitControlsWrapper from 'three-orbit-controls';
const ThreeOrbitControls = OrbitControlsWrapper(three);
import FlyControlsWrapper from 'three-fly-controls';
const ThreeFlyControls = (FlyControlsWrapper(three), three.FlyControls);

import { parseToRgb, opacify } from 'polished';
import TWEEN from '@tweenjs/tween.js';

import accessorFn from 'accessor-fn';
import Kapsule from 'kapsule';

export default Kapsule({
  props: {
    width: { default: window.innerWidth, onChange(width, state, prevWidth) { isNaN(width) && (state.width = prevWidth) } },
    height: { default: window.innerHeight, onChange(height, state, prevHeight) { isNaN(height) && (state.height = prevHeight) } },
    backgroundColor: { default: '#000011' },
    backgroundImageUrl: {},
    onBackgroundImageLoaded: {},
    showNavInfo: { default: true },
    skyRadius: { default: 50000 },
    objects: { default: [] },
    postProcessingComposer: { triggerUpdate: false },
    enablePointerInteraction: {
      default: true,
      onChange(_, state) {
        // Reset hover state
        state.hoverObj = null;
        if (state.toolTipElem) state.toolTipElem.innerHTML = '';
      },
      triggerUpdate: false
    },
    lineHoverPrecision: { default: 1, triggerUpdate: false },
    hoverOrderComparator: { default: () => -1, triggerUpdate: false }, // keep existing order by default
    tooltipContent: { triggerUpdate: false },
    hoverDuringDrag: { default: false, triggerUpdate: false },
    onHover: { default: () => {}, triggerUpdate: false },
    onClick: { default: () => {}, triggerUpdate: false },
    onRightClick: { triggerUpdate: false }
  },

  methods: {
    tick: function(state) {
      if (state.initialised) {
        state.controls.update && state.controls.update(state.clock.getDelta()); // timedelta is required for fly controls

        state.postProcessingComposer
          ? state.postProcessingComposer.render() // if using postprocessing, render only the output of the
          : state.renderer.render(state.scene, state.camera);

        if (state.enablePointerInteraction) {
          // Update tooltip and trigger onHover events
          let topObject = null;
          if (state.hoverDuringDrag || !state.controlsDragging) {
            const raycaster = new three.Raycaster();
            raycaster.params.Line.threshold = state.lineHoverPrecision; // set linePrecision

            raycaster.setFromCamera(state.mousePos, state.camera);
            const intersects = raycaster.intersectObjects(state.objects, true)
              .map(({ object }) => object)
              .sort(state.hoverOrderComparator);

            topObject = intersects.length ? intersects[0] : null;
          }

          if (topObject !== state.hoverObj) {
            state.onHover(topObject, state.hoverObj);
            state.toolTipElem.innerHTML = topObject ? accessorFn(state.tooltipContent)(topObject) || '' : '';
            state.hoverObj = topObject;
          }
        }

        TWEEN.update(); // update camera animation tweens
      }

      return this;
    },
    cameraPosition: function(state, position, lookAt, transitionDuration) {
      const camera = state.camera;

      // Setter
      if (position && state.initialised) {
        const finalPos = position;
        const finalLookAt = lookAt || {x: 0, y: 0, z: 0};

        if (!transitionDuration) { // no animation
          setCameraPos(finalPos);
          setLookAt(finalLookAt);
        } else {
          const camPos = Object.assign({}, camera.position);
          const camLookAt = getLookAt();

          new TWEEN.Tween(camPos)
            .to(finalPos, transitionDuration)
            .easing(TWEEN.Easing.Quadratic.Out)
            .onUpdate(setCameraPos)
            .start();

          // Face direction in 1/3rd of time
          new TWEEN.Tween(camLookAt)
            .to(finalLookAt, transitionDuration / 3)
            .easing(TWEEN.Easing.Quadratic.Out)
            .onUpdate(setLookAt)
            .start();
        }

        return this;
      }

      // Getter
      return Object.assign({}, camera.position, { lookAt: getLookAt() });

      //

      function setCameraPos(pos) {
        const { x, y, z } = pos;
        if (x !== undefined) camera.position.x = x;
        if (y !== undefined) camera.position.y = y;
        if (z !== undefined) camera.position.z = z;
      }

      function setLookAt(lookAt) {
        state.controls.target = new three.Vector3(lookAt.x, lookAt.y, lookAt.z);
      }

      function getLookAt() {
        return Object.assign(
          (new three.Vector3(0, 0, -1000))
            .applyQuaternion(camera.quaternion)
            .add(camera.position)
        );
      }
    },
    renderer: state => state.renderer,
    scene: state => state.scene,
    camera: state => state.camera,
    controls: state => state.controls,
    tbControls: state => state.controls // to be deprecated
  },

  stateInit: () => ({
    scene: new three.Scene(),
    camera: new three.PerspectiveCamera(),
    clock: new three.Clock()
  }),

  init(domNode, state, { controlType = 'trackball', rendererConfig = {}, waitForLoadComplete = true }) {
    // Wipe DOM
    domNode.innerHTML = '';

    // Add relative container
    domNode.appendChild(state.container = document.createElement('div'));
    state.container.style.position = 'relative';

    // Add nav info section
    state.container.appendChild(state.navInfo = document.createElement('div'));
    state.navInfo.className = 'scene-nav-info';
    state.navInfo.textContent = {
        orbit: 'Left-click: rotate, Mouse-wheel/middle-click: zoom, Right-click: pan',
        trackball: 'Left-click: rotate, Mouse-wheel/middle-click: zoom, Right-click: pan',
        fly: 'WASD: move, R|F: up | down, Q|E: roll, up|down: pitch, left|right: yaw'
      }[controlType] || '';
    state.navInfo.style.display = state.showNavInfo ? null : 'none';

    // Setup tooltip
    state.toolTipElem = document.createElement('div');
    state.toolTipElem.classList.add('scene-tooltip');
    state.container.appendChild(state.toolTipElem);

    // Capture mouse coords on move
    state.mousePos = new three.Vector2();
    state.mousePos.x = -2; // Initialize off canvas
    state.mousePos.y = -2;
    state.container.addEventListener("mousemove", ev => {
      if (state.enablePointerInteraction) {

        // update the mouse pos
        const offset = getOffset(state.container),
          relPos = {
            x: ev.pageX - offset.left,
            y: ev.pageY - offset.top
          };
        state.mousePos.x = (relPos.x / state.width) * 2 - 1;
        state.mousePos.y = -(relPos.y / state.height) * 2 + 1;

        // Move tooltip
        state.toolTipElem.style.top = `${relPos.y}px`;
        state.toolTipElem.style.left = `${relPos.x}px`;
        state.toolTipElem.style.transform = `translate(-${relPos.x / state.width * 100}%, 21px)`; // adjust horizontal position to not exceed canvas boundaries
      }

      function getOffset(el) {
        const rect = el.getBoundingClientRect(),
          scrollLeft = window.pageXOffset || document.documentElement.scrollLeft,
          scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        return { top: rect.top + scrollTop, left: rect.left + scrollLeft };
      }
    }, false);

    // Handle click events on objs
    state.container.addEventListener('click', ev => {
      if (state.ignoreOneClick) {
        state.ignoreOneClick = false; // because of controls end event
        return;
      }

      state.onClick(state.hoverObj || null, ev); // trigger background clicks with null
    }, false);

    // Handle right-click events
    state.container.addEventListener('mouseup', ev => {
      if (ev.button === 2 && state.onRightClick) {
        if (state.ignoreOneClick) {
          state.ignoreOneClick = false; // because of controls end event
          return;
        }
        state.onRightClick(state.hoverObj || null, ev);
      }
    }, false);

    state.container.addEventListener('contextmenu', ev => {
      if (state.onRightClick) ev.preventDefault(); // prevent default contextmenu behavior and allow mouseup to fire instead
    }, false);

    // Setup renderer, camera and controls
    state.renderer = new three.WebGLRenderer(Object.assign({ antialias: true, alpha: true }, rendererConfig));
    state.renderer.setPixelRatio(window.devicePixelRatio);

    state.container.appendChild(state.renderer.domElement);

    // configure controls
    state.controls = new ({
      trackball: ThreeTrackballControls,
      orbit: ThreeOrbitControls,
      fly: ThreeFlyControls
    }[controlType])(state.camera, state.renderer.domElement);

    if (controlType === 'fly') {
      state.controls.movementSpeed = 300;
      state.controls.rollSpeed = Math.PI / 6;
      state.controls.dragToLook = true;
    }

    if (controlType === 'trackball' || controlType === 'orbit') {
      state.controls.minDistance = 0.1;
      state.controls.maxDistance = state.skyRadius;
      state.controls.addEventListener('start', () => state.controlsEngaged = true);
      state.controls.addEventListener('change', () => {
        if (state.controlsEngaged) {
          state.controlsDragging = true;
          state.ignoreOneClick = true;
        }
      });
      state.controls.addEventListener('end', () => {
        state.controlsEngaged = false;
        state.controlsDragging = false;
      });
    }

    state.renderer.setSize(state.width, state.height);
    state.camera.aspect = state.width/state.height;
    state.camera.updateProjectionMatrix();

    state.camera.position.z = 1000;

    // add sky
    state.scene.add(state.skysphere = new three.Mesh());
    state.skysphere.visible = false;
    state.loadComplete = state.scene.visible = !waitForLoadComplete;

    window.scene = state.scene;
  },

  update(state, changedProps) {
    // resize canvas
    if (state.width && state.height && (changedProps.hasOwnProperty('width') || changedProps.hasOwnProperty('height'))) {
      state.container.style.width = state.width;
      state.container.style.height = state.height;
      state.renderer.setSize(state.width, state.height);
      state.camera.aspect = state.width/state.height;
      state.camera.updateProjectionMatrix();
    }

    if (changedProps.hasOwnProperty('skyRadius') && state.skyRadius) {
      state.controls.hasOwnProperty('maxDistance') && changedProps.skyRadius
        && (state.controls.maxDistance = state.skyRadius);
      state.camera.far = state.skyRadius * 2.5;
      state.camera.updateProjectionMatrix();
      state.skysphere.geometry = new three.SphereGeometry(state.skyRadius);
    }

    if (changedProps.hasOwnProperty('backgroundColor')) {
      let alpha = parseToRgb(state.backgroundColor).alpha;
      if (alpha === undefined) alpha = 1;
      state.renderer.setClearColor(new three.Color(opacify(1, state.backgroundColor)), alpha);
    }

    if (changedProps.hasOwnProperty('backgroundImageUrl')) {
      if (!state.backgroundImageUrl) {
        state.skysphere.visible = false;
        state.skysphere.material.map = null;

        !state.loadComplete && finishLoad();
      } else {
        new three.TextureLoader().load(state.backgroundImageUrl, texture => {
          state.skysphere.material = new three.MeshBasicMaterial({ map: texture, side: three.BackSide });
          state.skysphere.visible = true;

          // triggered when background image finishes loading (asynchronously to allow 1 frame to load texture)
          state.onBackgroundImageLoaded && setTimeout(state.onBackgroundImageLoaded);

          !state.loadComplete && finishLoad();
        });
      }
    }

    changedProps.hasOwnProperty('showNavInfo') && (state.navInfo.style.display = state.showNavInfo ? null : 'none');

    if (changedProps.hasOwnProperty('objects')) {
      (changedProps.objects || []).forEach(obj => state.scene.remove(obj)); // Clear the place
      state.objects.forEach(obj => state.scene.add(obj)); // Add to scene
    }

    //

    function finishLoad() {
      state.loadComplete = state.scene.visible = true;
    }
  }
});