# three-render-objects

[![NPM](https://nodei.co/npm/three-render-objects.png?compact=true)](https://nodei.co/npm/three-render-objects/)

This module offers a convenient way to render [ThreeJS](https://threejs.org/) objects onto a WebGL canvas, with built-in interaction capabilities:
* hover/click events
* tooltips
* camera movement with animated transitions
* trackball, orbit or fly controls

All the renderer/scene/camera scaffolding is already included and any instance of [Object3D](https://threejs.org/docs/#api/core/Object3D) can be rendered with minimal setup. 

## Quick start

```
import ThreeRenderObjects from 'three-render-objects';
```
or
```
var ThreeRenderObjects = require('three-render-objects');
```
or even
```
<script src="//unpkg.com/three-render-objects"></script>
```
then
```
const myCanvas = ThreeRenderObjects();
myCanvas(<myDOMElement>)
    .objects(<myData>);
```

## API reference

### Initialisation
```
ThreeRenderObjects({ configOptions })(<domElement>)
```

| Config options | Description | Default |
| --- | --- | :--: |
| <b>controlType</b>: <i>str</i> | Which type of control to use to control the camera. Choice between [trackball](https://threejs.org/examples/misc_controls_trackball.html), [orbit](https://threejs.org/examples/#misc_controls_orbit) or [fly](https://threejs.org/examples/misc_controls_fly.html). | `trackball` |
| <b>rendererConfig</b>: <i>object</i> | Configuration parameters to pass to the [ThreeJS WebGLRenderer](https://threejs.org/docs/#api/en/renderers/WebGLRenderer) constructor. | `{ antialias: true, alpha: true }` |

### Data input
| Method | Description | Default |
| --- | --- | :--: |
| <b>objects</b>([<i>array</i>]) | Getter/setter for the list of objects to render. Each object should be an instance of [Object3D](https://threejs.org/docs/#api/core/Object3D). | `[]` |

### Container layout
| Method | Description | Default |
| --- | --- | :--: |
| <b>width</b>([<i>px</i>]) | Getter/setter for the canvas width. | *&lt;window width&gt;* |
| <b>height</b>([<i>px</i>]) | Getter/setter for the canvas height. | *&lt;window height&gt;* |
| <b>backgroundColor</b>([<i>str</i>]) | Getter/setter for the canvas background color. | `#000011` |
| <b>showNavInfo</b>([<i>boolean</i>]) | Getter/setter for whether to show the navigation controls footer info. | `true` |

### Render control
| Method | Description | Default |
| --- | --- | :--: |
| <b>tick() | Re-render all the objects on the canvas. Essentially this method should be called at every frame, and can be used to control the animation ticks. ||
| <b>cameraPosition</b>([<i>{x,y,z}</i>], [<i>lookAt</i>], [<i>ms</i>]) | Getter/setter for the camera position, in terms of `x`, `y`, `z` coordinates. Each of the coordinates is optional, allowing for motion in just some dimensions. The optional second argument can be used to define the direction that the camera should aim at, in terms of an `{x,y,z}` point in the 3D space at the distance of `1000` away from the camera. The 3rd optional argument defines the duration of the transition (in <i>ms</i>) to animate the camera motion. A value of `0` (default) moves the camera immediately to the final position. | By default the camera will face the center of the graph at a `z` distance of `1000`. |
| <b>renderer</b>() | Access the [WebGL renderer](https://threejs.org/docs/#api/renderers/WebGLRenderer) object. || 
| <b>camera</b>() | Access the [perspective camera](https://threejs.org/docs/#api/cameras/PerspectiveCamera) object. || 
| <b>scene</b>() | Access the [Scene](https://threejs.org/docs/#api/scenes/Scene) object. ||
| <b>controls</b>() | Access the camera controls object. ||

### Interaction
| Method | Description | Default |
| --- | --- | :--: |
| <b>onClick</b>(<i>fn</i>) | Callback function for object clicks with left mouse button. The object is included as single argument `onClick(object)`. | - |
| <b>onRightClick</b>(<i>fn</i>) | Callback function for object right-clicks. The object is included as single argument `onRightClick(object)`. | - |
| <b>onHover</b>(<i>fn</i>) | Callback function for object mouse over events. The object (or `null` if there's no node under the mouse line of sight) is included as the first argument, and the previous hovered object (or null) as second argument: `onHover(obj, prevObj)`. | - |
| <b>hoverOrderComparator</b>([<i>fn</i>]) | Getter/setter for the comparator function to use when hovering over multiple objects under the same line of sight. This function can be used to prioritize hovering some objects over others. | By default, hovering priority is based solely on camera proximity (closes object wins). |
| <b>lineHoverPrecision</b>([<i>int</i>]) | Getter/setter for the precision to use when detecting hover events over [Line](https://threejs.org/docs/#api/objects/Line) objects. | 1 |
| <b>tooltipContent</b>([<i>str</i> or <i>fn</i>]) | Object accessor function or attribute for label (shown in tooltip). Supports plain text or HTML content. ||
| <b>enablePointerInteraction([<i>boolean</i>]) | Getter/setter for whether to enable the mouse tracking events. This activates an internal tracker of the canvas mouse position and enables the functionality of object hover/click and tooltip labels, at the cost of performance. If you're looking for maximum gain in your render performance it's recommended to switch off this property. | `true` |

