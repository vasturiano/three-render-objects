import { WebGLRenderer, Scene, PerspectiveCamera, Raycaster, Vector2, Vector3, Color } from 'three';
import ThreeTrackballControls from 'three-trackballcontrols';
import tinycolor from 'tinycolor2';
import TweenLite from 'gsap';
import accessorFn from 'accessor-fn';
import Kapsule from 'kapsule';

function styleInject(css, ref) {
  if (ref === void 0) ref = {};
  var insertAt = ref.insertAt;

  if (!css || typeof document === 'undefined') {
    return;
  }

  var head = document.head || document.getElementsByTagName('head')[0];
  var style = document.createElement('style');
  style.type = 'text/css';

  if (insertAt === 'top') {
    if (head.firstChild) {
      head.insertBefore(style, head.firstChild);
    } else {
      head.appendChild(style);
    }
  } else {
    head.appendChild(style);
  }

  if (style.styleSheet) {
    style.styleSheet.cssText = css;
  } else {
    style.appendChild(document.createTextNode(css));
  }
}

var css = ".scene-nav-info {\n  bottom: 5px;\n  width: 100%;\n  text-align: center;\n  color: slategrey;\n  opacity: 0.7;\n  font-size: 10px;\n}\n\n.scene-tooltip {\n  color: lavender;\n  font-size: 18px;\n  transform: translate(-50%, 25px);\n}\n\n.scene-nav-info, .scene-tooltip {\n  position: absolute;\n  font-family: Sans-serif;\n}";
styleInject(css);

var three = window.THREE ? window.THREE // Prefer consumption from global THREE, if exists
: {
  WebGLRenderer: WebGLRenderer,
  Scene: Scene,
  PerspectiveCamera: PerspectiveCamera,
  Raycaster: Raycaster,
  Vector2: Vector2,
  Vector3: Vector3,
  Color: Color
};

var threeRenderObjects = Kapsule({
  props: {
    width: { default: window.innerWidth },
    height: { default: window.innerHeight },
    backgroundColor: {
      default: '#000011',
      onChange: function onChange(bckgColor, state) {
        if (state.renderer) {
          var alpha = tinycolor(bckgColor).getAlpha();
          state.renderer.setClearColor(new three.Color(bckgColor), alpha);
        }
      },

      triggerUpdate: false
    },
    showNavInfo: { default: true },
    objects: { default: [], onChange: function onChange(objs, state) {
        (state.prevObjs || []).forEach(function (obj) {
          return state.scene.remove(obj);
        }); // Clear the place
        state.prevObjs = objs;
        objs.forEach(function (obj) {
          return state.scene.add(obj);
        }); // Add to scene
      },
      triggerUpdate: false },
    enablePointerInteraction: { default: true, onChange: function onChange(_, state) {
        state.hoverObj = null;
      },
      triggerUpdate: false },
    lineHoverPrecision: { default: 1, triggerUpdate: false },
    hoverOrderComparator: { default: function _default() {
        return -1;
      }, triggerUpdate: false }, // keep existing order by default
    tooltipContent: { triggerUpdate: false },
    onHover: { default: function _default() {}, triggerUpdate: false },
    onClick: { default: function _default() {}, triggerUpdate: false }
  },

  methods: {
    tick: function tick(state) {
      if (state.initialised) {
        state.tbControls.update();
        state.renderer.render(state.scene, state.camera);

        if (!state.mousedown && state.enablePointerInteraction) {
          // Update tooltip and trigger onHover events
          var raycaster = new three.Raycaster();
          raycaster.linePrecision = state.lineHoverPrecision;

          raycaster.setFromCamera(state.mousePos, state.camera);
          var intersects = raycaster.intersectObjects(state.objects, true).map(function (_ref) {
            var object = _ref.object;
            return object;
          }).sort(state.hoverOrderComparator);

          var topObject = intersects.length ? intersects[0] : null;

          if (topObject !== state.hoverObj) {
            state.onHover(topObject, state.hoverObj);
            state.toolTipElem.innerHTML = topObject ? accessorFn(state.tooltipContent)(topObject) || '' : '';
            state.hoverObj = topObject;
          }
        }
      }

      return this;
    },
    cameraPosition: function cameraPosition(state, position, lookAt, transitionDuration) {
      var camera = state.camera;

      // Setter
      if (position && state.initialised) {
        var finalPos = position;
        var finalLookAt = lookAt || { x: 0, y: 0, z: 0 };

        if (!transitionDuration) {
          // no animation
          setCameraPos(finalPos);
          setLookAt(finalLookAt);
        } else {
          var camPos = Object.assign({}, camera.position);
          var camLookAt = getLookAt();
          var tweenDuration = transitionDuration / 1000; // ms > s

          TweenLite.to(camPos, tweenDuration, Object.assign({
            onUpdate: function onUpdate() {
              return setCameraPos(camPos);
            }
          }, finalPos));

          // Face direction in 1/3rd of time
          TweenLite.to(camLookAt, tweenDuration / 3, Object.assign({
            onUpdate: function onUpdate() {
              return setLookAt(camLookAt);
            }
          }, finalLookAt));
        }

        return this;
      }

      // Getter
      return Object.assign({}, camera.position, { lookAt: getLookAt() });

      //

      function setCameraPos(pos) {
        var x = pos.x,
            y = pos.y,
            z = pos.z;

        if (x !== undefined) camera.position.x = x;
        if (y !== undefined) camera.position.y = y;
        if (z !== undefined) camera.position.z = z;
      }

      function setLookAt(lookAt) {
        state.tbControls.target = new three.Vector3(lookAt.x, lookAt.y, lookAt.z);
      }

      function getLookAt() {
        return Object.assign(new three.Vector3(0, 0, -1000).applyQuaternion(camera.quaternion).add(camera.position));
      }
    },
    renderer: function renderer(state) {
      return state.renderer;
    },
    scene: function scene(state) {
      return state.scene;
    },
    camera: function camera(state) {
      return state.camera;
    },
    tbControls: function tbControls(state) {
      return state.tbControls;
    }
  },

  stateInit: function stateInit() {
    return {
      scene: new three.Scene(),
      camera: new three.PerspectiveCamera()
    };
  },

  init: function init(domNode, state) {
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
    state.container.addEventListener("mousemove", function (ev) {
      if (state.enablePointerInteraction) {

        // update the mouse pos
        var offset = getOffset(state.container),
            relPos = {
          x: ev.pageX - offset.left,
          y: ev.pageY - offset.top
        };
        state.mousePos.x = relPos.x / state.width * 2 - 1;
        state.mousePos.y = -(relPos.y / state.height) * 2 + 1;

        // Move tooltip
        state.toolTipElem.style.top = relPos.y + 'px';
        state.toolTipElem.style.left = relPos.x + 'px';
      }

      function getOffset(el) {
        var rect = el.getBoundingClientRect(),
            scrollLeft = window.pageXOffset || document.documentElement.scrollLeft,
            scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        return { top: rect.top + scrollTop, left: rect.left + scrollLeft };
      }
    }, false);

    // Handle click events on objs
    state.container.addEventListener("mousedown", function (ev) {
      state.mousedown = true;
      state.clickObj = state.hoverObj;
      if (state.clickObj) {
        ev.preventDefault();
        ev.stopPropagation();
        return false;
      }
    }, false);

    state.container.addEventListener("mouseup", function (ev) {
      if (state.clickObj) {
        state.onClick(state.clickObj);
        delete state.clickObj;
      }
      state.mousedown = false;
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
      state.camera.aspect = state.width / state.height;
      state.camera.updateProjectionMatrix();
    }

    state.navInfo.style.display = state.showNavInfo ? null : 'none';
  }
});

export default threeRenderObjects;
