import { Object3D, WebGLRendererParameters, Scene, Camera, WebGLRenderer } from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';

export interface ConfigOptions {
  controlType?: 'trackball' | 'orbit' | 'fly';
  rendererConfig?: WebGLRendererParameters;
  waitForLoadComplete?: boolean;
}

type Accessor<In, Out> = Out | string | ((obj: In) => Out);
type Obj3DAccessor<T> = Accessor<Object3D, T>;

type Coords = { x: number; y: number; z: number; };

type Obj3DCompFn = (a: Object3D, b: Object3D) => number;

export interface ThreeRenderObjectsGenericInstance<ChainableInstance> {
  (element: HTMLElement): ChainableInstance;
  resetProps(): ChainableInstance;

  // Data input
  objects(): Object3D[];
  objects(objs: Object3D[]): ChainableInstance;

  // Container layout
  width(): number;
  width(width: number): ChainableInstance;
  height(): number;
  height(height: number): ChainableInstance;
  skyRadius(): number;
  skyRadius(glUnits: number): ChainableInstance;
  backgroundColor(): string;
  backgroundColor(color: string): ChainableInstance;
  backgroundImageUrl(): string | null;
  backgroundImageUrl(url: string | null): ChainableInstance;
  onBackgroundImageLoaded(callback: () => void): ChainableInstance;
  showNavInfo(): boolean;
  showNavInfo(enabled: boolean): ChainableInstance;

  // Render control
  tick(): ChainableInstance;
  cameraPosition(): Coords;
  cameraPosition(position: Partial<Coords>, lookAt?: Coords, transitionMs?: number): ChainableInstance;
  zoomToFit(durationMs?: number, padding?: number, objFilter?: (obj: Object3D) => boolean): ChainableInstance;
  postProcessingComposer(): EffectComposer;
  renderer(): WebGLRenderer;
  scene(): Scene;
  camera(): Camera;
  controls(): object;

  // Interaction
  onClick(callback: (obj: object | null, event: MouseEvent) => void): ChainableInstance;
  onRightClick(callback: (obj: object | null, event: MouseEvent) => void): ChainableInstance;
  onHover(callback: (obj: object | null, previousObj: object | null) => void): ChainableInstance;
  hoverOrderComparator(): Obj3DCompFn;
  hoverOrderComparator(compFn: Obj3DCompFn): ChainableInstance;
  lineHoverPrecision(): number;
  lineHoverPrecision(precision: number): ChainableInstance;
  tooltipContent(): Obj3DAccessor<string>;
  tooltipContent(contentAccessor: Obj3DAccessor<string>): ChainableInstance;
  enablePointerInteraction(): boolean;
  enablePointerInteraction(enable: boolean): ChainableInstance;
  hoverDuringDrag(): boolean;
  hoverDuringDrag(enabled: boolean): ChainableInstance;

  // Utility
  getBbox(objFilter?: (obj: Object3D) => boolean): { x: [number, number], y: [number, number], z: [number, number] };
}

export type ThreeRenderObjectsInstance = ThreeRenderObjectsGenericInstance<ThreeRenderObjectsInstance>;

declare function ThreeRenderObjects(configOptions?: ConfigOptions): ThreeRenderObjectsInstance;

export default ThreeRenderObjects;