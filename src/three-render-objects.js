import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  Raycaster,
  SRGBColorSpace,
  TextureLoader,
  Vector2,
  Vector3,
  Box3,
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
  SRGBColorSpace,
  TextureLoader,
  Vector2,
  Vector3,
  Box3,
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

import { WebGPURenderer } from 'three/webgpu';

import { TrackballControls as ThreeTrackballControls } from 'three/examples/jsm/controls/TrackballControls.js';
import { OrbitControls as ThreeOrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FlyControls as ThreeFlyControls } from 'three/examples/jsm/controls/FlyControls.js';

import { EffectComposer as ThreeEffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass as ThreeRenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';

import { parseToRgb, opacify } from 'polished';
import { Tween, Group as TweenGroup, Easing } from '@tweenjs/tween.js';

import accessorFn from 'accessor-fn';
import Kapsule from 'kapsule';
import Tooltip from 'float-tooltip';

export default Kapsule({
  props: {
    width: { default: window.innerWidth, onChange(width, state, prevWidth) { isNaN(width) && (state.width = prevWidth) } },
    height: { default: window.innerHeight, onChange(height, state, prevHeight) { isNaN(height) && (state.height = prevHeight) } },
    viewOffset: { default: [0, 0] },
    backgroundColor: { default: '#000011' },
    backgroundImageUrl: {},
    onBackgroundImageLoaded: {},
    showNavInfo: { default: true },
    skyRadius: { default: 50000 },
    objects: { default: [] },
    lights: { default: [] },
    enablePointerInteraction: {
      default: true,
      onChange(_, state) {
        // Reset hover state
        state.hoverObj = null;
        state.tooltip && state.tooltip.content(null);
      },
      triggerUpdate: false
    },
    pointerRaycasterThrottleMs: { default: 50, triggerUpdate: false },
    lineHoverPrecision: { default: 1, triggerUpdate: false },
    pointsHoverPrecision: { default: 1, triggerUpdate: false },
    hoverOrderComparator: { triggerUpdate: false }, // keep existing order by default
    hoverFilter: { default: () => true, triggerUpdate: false }, // exclude objects from interaction
    tooltipContent: { triggerUpdate: false },
    hoverDuringDrag: { default: false, triggerUpdate: false },
    clickAfterDrag: { default: false, triggerUpdate: false },
    onHover: { default: () => {}, triggerUpdate: false },
    onClick: { default: () => {}, triggerUpdate: false },
    onRightClick: { triggerUpdate: false }
  },

  methods: {
    tick: function(state) {
      if (state.initialised) {
        state.controls.update && state.controls.update(Math.min(1, state.clock.getDelta())); // timedelta is required for fly controls

        state.postProcessingComposer
          ? state.postProcessingComposer.render() // if using postprocessing, switch the output to it
          : state.renderer.render(state.scene, state.camera);

        state.extraRenderers.forEach(r => r.render(state.scene, state.camera));

        const now = +new Date();
        if (state.enablePointerInteraction && (now - state.lastRaycasterCheck) >= state.pointerRaycasterThrottleMs) {
          state.lastRaycasterCheck = now;
          // Update tooltip and trigger onHover events
          let topObject = null;
          if (state.hoverDuringDrag || !state.isPointerDragging) {
            const intersects = this.intersectingObjects(state.pointerPos.x, state.pointerPos.y);

            state.hoverOrderComparator && intersects.sort((a, b) => state.hoverOrderComparator(a.object, b.object));

            const topIntersect = intersects.find(d => state.hoverFilter(d.object)) || null;

            topObject = topIntersect ? topIntersect.object : null;
            state.intersection = topIntersect || null;
          }

          if (topObject !== state.hoverObj) {
            state.onHover(topObject, state.hoverObj, state.intersection);
            state.tooltip.content(topObject ? accessorFn(state.tooltipContent)(topObject, state.intersection) || null : null);
            state.hoverObj = topObject;
          }
        }

        state.tweenGroup.update(); // update camera animation tweens
      }

      return this;
    },
    getPointerPos: function(state) {
      const { x, y } = state.pointerPos;
      return { x, y };
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

          state.tweenGroup.add(
            new Tween(camPos)
              .to(finalPos, transitionDuration)
              .easing(Easing.Quadratic.Out)
              .onUpdate(setCameraPos)
              .start()
          );

          // Face direction in 1/3rd of time
          state.tweenGroup.add(
            new Tween(camLookAt)
              .to(finalLookAt, transitionDuration / 3)
              .easing(Easing.Quadratic.Out)
              .onUpdate(setLookAt)
              .start()
          );
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
        const lookAtVect = new three.Vector3(lookAt.x, lookAt.y, lookAt.z);
        if (state.controls.target) {
          state.controls.target = lookAtVect;
        } else { // Fly controls doesn't have target attribute
          camera.lookAt(lookAtVect); // note: lookAt may be overridden by other controls in some cases
        }
      }

      function getLookAt() {
        return Object.assign(
          (new three.Vector3(0, 0, -1000))
            .applyQuaternion(camera.quaternion)
            .add(camera.position)
        );
      }
    },
    zoomToFit: function (state, transitionDuration = 0, padding = 10, ...bboxArgs) {
      return this.fitToBbox(this.getBbox(...bboxArgs), transitionDuration, padding);
    },
    fitToBbox: function (state, bbox, transitionDuration = 0, padding = 10) {
      // based on https://discourse.threejs.org/t/camera-zoom-to-fit-object/936/24
      const camera = state.camera;

      if (bbox) {
        const center = new three.Vector3(0, 0, 0); // reset camera aim to center
        const maxBoxSide = Math.max(...Object.entries(bbox)
          .map(([coordType, coords]) => Math.max(...coords.map(c => Math.abs(center[coordType] - c))))
        ) * 2;

        // find distance that fits whole bbox within padded fov
        const paddedFov = (1 - (padding * 2 / state.height)) * camera.fov;
        const fitHeightDistance = maxBoxSide / Math.atan(paddedFov * Math.PI / 180);
        const fitWidthDistance = fitHeightDistance / camera.aspect;
        const distance = Math.max(fitHeightDistance, fitWidthDistance);

        if (distance > 0) {
          const newCameraPosition = center.clone()
            .sub(camera.position)
            .normalize()
            .multiplyScalar(-distance);

          this.cameraPosition(newCameraPosition, center, transitionDuration);
        }
      }

      return this;
    },
    getBbox: function (state, objFilter = () => true) {
      const box = new three.Box3(new three.Vector3(0, 0, 0), new three.Vector3(0, 0, 0));
      const objs = state.objects.filter(objFilter);

      if (!objs.length) return null;

      objs.forEach(obj => box.expandByObject(obj));

      // extract global x,y,z min/max
      return  Object.assign(...['x', 'y', 'z'].map(c => ({
        [c]: [box.min[c], box.max[c]]
      })));
    },
    getScreenCoords: function(state, x, y, z) {
      const vec = new three.Vector3(x, y, z);
      vec.project(this.camera()); // project to the camera plane
      return { // align relative pos to canvas dimensions
        x: (vec.x + 1) * state.width / 2,
        y: -(vec.y - 1) * state.height / 2,
      };
    },
    getSceneCoords: function(state, screenX, screenY, distance = 0) {
      const relCoords = new three.Vector2(
        (screenX / state.width) * 2 - 1,
        -(screenY / state.height) * 2 + 1
      );

      const raycaster = new three.Raycaster();
      raycaster.setFromCamera(relCoords, state.camera);
      return Object.assign({}, raycaster.ray.at(distance, new three.Vector3()));
    },
    intersectingObjects: function(state, x, y) {
      const relCoords = new three.Vector2(
        (x / state.width) * 2 - 1,
        -(y / state.height) * 2 + 1
      );

      const raycaster = new three.Raycaster();
      raycaster.params.Line.threshold = state.lineHoverPrecision; // set linePrecision
      raycaster.params.Points.threshold = state.pointsHoverPrecision; // set pointsPrecision
      raycaster.setFromCamera(relCoords, state.camera);
      return raycaster.intersectObjects(state.objects, true);
    },
    renderer: state => state.renderer,
    scene: state => state.scene,
    camera: state => state.camera,
    postProcessingComposer: state => state.postProcessingComposer,
    controls: state => state.controls,
    tbControls: state => state.controls // to be deprecated
  },

  stateInit: () => ({
    scene: new three.Scene(),
    camera: new three.PerspectiveCamera(),
    clock: new three.Clock(),
    tweenGroup: new TweenGroup(),
    lastRaycasterCheck: 0
  }),

  init(domNode, state, {
    controlType = 'trackball',
    useWebGPU = false,
    rendererConfig = {},
    extraRenderers = [],
    waitForLoadComplete = true
  } = {}) {
    // Wipe DOM
    domNode.innerHTML = '';

    // Add relative container
    domNode.appendChild(state.container = document.createElement('div'));
    state.container.className = 'scene-container';
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
    state.tooltip = new Tooltip(state.container);

    // Capture pointer coords on move or touchstart
    state.pointerPos = new three.Vector2();
    state.pointerPos.x = -2; // Initialize off canvas
    state.pointerPos.y = -2;
    ['pointermove', 'pointerdown'].forEach(evType =>
      state.container.addEventListener(evType, ev => {
        // track click state
        evType === 'pointerdown' && (state.isPointerPressed = true);

        // detect point drag
        !state.isPointerDragging && ev.type === 'pointermove'
          && (ev.pressure > 0 || state.isPointerPressed) // ev.pressure always 0 on Safari, so we used the isPointerPressed tracker
          && (ev.pointerType !== 'touch' || ev.movementX === undefined || [ev.movementX, ev.movementY].some(m => Math.abs(m) > 1)) // relax drag trigger sensitivity on touch events
          && (state.isPointerDragging = true);

        if (state.enablePointerInteraction) {
          // update the pointer pos
          const offset = getOffset(state.container);
          state.pointerPos.x = ev.pageX - offset.left;
          state.pointerPos.y = ev.pageY - offset.top;
        }

        function getOffset(el) {
          const rect = el.getBoundingClientRect(),
            scrollLeft = window.pageXOffset || document.documentElement.scrollLeft,
            scrollTop = window.pageYOffset || document.documentElement.scrollTop;
          return { top: rect.top + scrollTop, left: rect.left + scrollLeft };
        }
      }, { passive: true })
    );

    // Handle click events on objs
    state.container.addEventListener('pointerup', ev => {
      state.isPointerPressed = false;
      if (state.isPointerDragging) {
        state.isPointerDragging = false;
        if (!state.clickAfterDrag) return; // don't trigger onClick after pointer drag (camera motion via controls)
      }

      requestAnimationFrame(() => { // trigger click events asynchronously, to allow hoverObj to be set (on frame)
        if (ev.button === 0) { // left-click
          state.onClick(state.hoverObj || null, ev, state.intersection) // trigger background clicks with null
        }

        if (ev.button === 2 && state.onRightClick) { // right-click
          state.onRightClick(state.hoverObj || null, ev, state.intersection)
        }
      });
    }, { passive: true, capture: true }); // use capture phase to prevent propagation blocking from controls (specifically for fly)

    state.container.addEventListener('contextmenu', ev => {
      if (state.onRightClick) ev.preventDefault(); // prevent default contextmenu behavior and allow pointerup to fire instead
    });

    // Setup renderer, camera and controls
    state.renderer = new (useWebGPU ? WebGPURenderer : three.WebGLRenderer)(Object.assign({ antialias: true, alpha: true }, rendererConfig));
    state.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio)); // clamp device pixel ratio
    state.container.appendChild(state.renderer.domElement);

    // Setup extra renderers
    state.extraRenderers = extraRenderers;
    state.extraRenderers.forEach(r => {
      // overlay them on top of main renderer
      r.domElement.style.position = 'absolute';
      r.domElement.style.top = '0px';
      r.domElement.style.pointerEvents = 'none';
      state.container.appendChild(r.domElement);
    });

    // configure post-processing composer
    state.postProcessingComposer = new ThreeEffectComposer(state.renderer);
    state.postProcessingComposer.addPass(new ThreeRenderPass(state.scene, state.camera)); // render scene as first pass

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
      state.controls.addEventListener('start', () => {
        state.controlsEngaged = true;
      });
      state.controls.addEventListener('change', () => {
        if (state.controlsEngaged) {
          state.controlsDragging = true;
        }
      });
      state.controls.addEventListener('end', () => {
        state.controlsEngaged = false;
        state.controlsDragging = false;
      });
    }

    [state.renderer, state.postProcessingComposer, ...state.extraRenderers]
      .forEach(r => r.setSize(state.width, state.height));
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
      const w = state.width;
      const h = state.height;
      state.container.style.width = `${w}px`;
      state.container.style.height = `${h}px`;
      [state.renderer, state.postProcessingComposer, ...state.extraRenderers]
        .forEach(r => r.setSize(w, h));
      state.camera.aspect = w/h;

      const o = state.viewOffset.slice(0, 2);
      o.some(n => n) && state.camera.setViewOffset(w, h, ...o, w, h);

      state.camera.updateProjectionMatrix();
    }

    if (changedProps.hasOwnProperty('viewOffset')) {
      const w = state.width;
      const h = state.height;
      const o = state.viewOffset.slice(0, 2);
      o.some(n => n)
        ? state.camera.setViewOffset(w, h, ...o, w, h)
        : state.camera.clearViewOffset()
    }

    if (changedProps.hasOwnProperty('skyRadius') && state.skyRadius) {
      state.controls.hasOwnProperty('maxDistance') && changedProps.skyRadius
        && (state.controls.maxDistance = Math.min(state.controls.maxDistance, state.skyRadius));
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
          texture.colorSpace = three.SRGBColorSpace;
          state.skysphere.material = new three.MeshBasicMaterial({ map: texture, side: three.BackSide });
          state.skysphere.visible = true;

          // triggered when background image finishes loading (asynchronously to allow 1 frame to load texture)
          state.onBackgroundImageLoaded && setTimeout(state.onBackgroundImageLoaded);

          !state.loadComplete && finishLoad();
        });
      }
    }

    changedProps.hasOwnProperty('showNavInfo') && (state.navInfo.style.display = state.showNavInfo ? null : 'none');

    if (changedProps.hasOwnProperty('lights')) {
      (changedProps.lights || []).forEach(light => state.scene.remove(light)); // Clear the place
      state.lights.forEach(light => state.scene.add(light)); // Add to scene
    }

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
