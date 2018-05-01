import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  Raycaster,
  Vector2,
  Vector3,
  Color
} from 'three';

const three = window.THREE
  ? window.THREE // Prefer consumption from global THREE, if exists
  : {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  Raycaster,
  Vector2,
  Vector3,
  Color
};

import ThreeTrackballControls from 'three-trackballcontrols';

import tinycolor from 'tinycolor2';
import TweenLite from 'gsap';

import accessorFn from 'accessor-fn';
import Kapsule from 'kapsule';

export default Kapsule({
  props: {
    width: { default: window.innerWidth },
    height: { default: window.innerHeight },
    backgroundColor: {
      default: '#000011',
      onChange(bckgColor, state) {
        if (state.renderer) {
          const alpha = tinycolor(bckgColor).getAlpha();
          state.renderer.setClearColor(new three.Color(bckgColor), alpha);
        }
      },
      triggerUpdate: false
    },
    showNavInfo: { default: true },
    objects: { default: [], onChange(objs, state) {
      (state.prevObjs || []).forEach(obj => state.scene.remove(obj)); // Clear the place
      state.prevObjs = objs;
      objs.forEach(obj => state.scene.add(obj)); // Add to scene
    }, triggerUpdate: false },
    enablePointerInteraction: { default: true, onChange(_, state) { state.hoverObj = null; }, triggerUpdate: false },
    lineHoverPrecision: { default: 1, triggerUpdate: false },
    hoverOrderComparator: { default: () => -1, triggerUpdate: false }, // keep existing order by default
    tooltipContent: { triggerUpdate: false },
    onHover: { default: () => {}, triggerUpdate: false },
    onClick: { default: () => {}, triggerUpdate: false }
  },

  methods: {
    tick: function(state) {
      if (state.initialised) {
        state.tbControls.update();
        state.renderer.render(state.scene, state.camera);

        if (state.enablePointerInteraction) {
          // Update tooltip and trigger onHover events
          const raycaster = new three.Raycaster();
          raycaster.linePrecision = state.lineHoverPrecision;

          raycaster.setFromCamera(state.mousePos, state.camera);
          const intersects = raycaster.intersectObjects(state.objects, true)
            .map(({ object }) => object)
            .sort(state.hoverOrderComparator);

          const topObject = intersects.length ? intersects[0] : null;

          if (topObject !== state.hoverObj) {
            state.onHover(topObject, state.hoverObj);
            state.toolTipElem.innerHTML = topObject ? accessorFn(state.tooltipContent)(topObject) || '' : '';
            state.hoverObj = topObject;
          }
        }
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
          const tweenDuration = transitionDuration/1000; // ms > s

          TweenLite.to(camPos, tweenDuration, Object.assign({
            onUpdate: () => setCameraPos(camPos)
          }, finalPos));

          // Face direction in 1/3rd of time
          TweenLite.to(camLookAt, tweenDuration/3, Object.assign({
            onUpdate: () => setLookAt(camLookAt)
          }, finalLookAt));
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
        state.tbControls.target = new three.Vector3(lookAt.x, lookAt.y, lookAt.z);
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
    tbControls: state => state.tbControls
  },

  stateInit: () => ({
    scene: new three.Scene(),
    camera: new three.PerspectiveCamera()
  }),

  init: (domNode, state) => {
    // Wipe DOM
    domNode.innerHTML = '';

    // Add relative container
    domNode.appendChild(state.container = document.createElement('div'));
    state.container.style.position = 'relative';

    // Add nav info section
    state.container.appendChild(state.navInfo = document.createElement('div'));
    state.navInfo.className = 'scene-nav-info';
    state.navInfo.textContent = "MOVE mouse & press LEFT/A: rotate, MIDDLE/S: zoom, RIGHT/D: pan";

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
      }

      function getOffset(el) {
        const rect = el.getBoundingClientRect(),
          scrollLeft = window.pageXOffset || document.documentElement.scrollLeft,
          scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        return { top: rect.top + scrollTop, left: rect.left + scrollLeft };
      }
    }, false);

    // Handle click events on objs
    state.container.addEventListener("click", ev => {
      if (state.hoverObj) {
        state.onClick(state.hoverObj);
      }
    }, false);

    // Setup renderer, camera and controls
    state.renderer = new three.WebGLRenderer({ alpha: true });
    state.renderer.setClearColor(new three.Color(state.backgroundColor), tinycolor(state.backgroundColor).getAlpha());
    state.container.appendChild(state.renderer.domElement);

    state.tbControls = new ThreeTrackballControls(state.camera, state.renderer.domElement);
    state.tbControls.minDistance = 0.1;
    state.tbControls.maxDistance = 50000;

    state.renderer.setSize(state.width, state.height);
    state.camera.position.z = 1000;
    state.camera.far = 50000;

    window.scene = state.scene;
  },

  update: function updateFn(state) {
    // resize canvas
    if (state.width && state.height) {
      state.container.style.width = state.width;
      state.container.style.height = state.height;
      state.renderer.setSize(state.width, state.height);
      state.camera.aspect = state.width/state.height;
      state.camera.updateProjectionMatrix();
    }

    state.navInfo.style.display = state.showNavInfo ? null : 'none';
  }
});