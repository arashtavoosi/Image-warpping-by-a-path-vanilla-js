import { create } from 'zustand';

export class Vector3 {
  x: number;
  y: number;
  z: number;

  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  set(x: number, y: number, z: number) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  copy(v: Vector3) {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    return this;
  }

  clone() {
    return new Vector3(this.x, this.y, this.z);
  }

  add(v: Vector3) {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    return this;
  }

  sub(v: Vector3) {
    this.x -= v.x;
    this.y -= v.y;
    this.z -= v.z;
    return this;
  }

  multiplyScalar(s: number) {
    this.x *= s;
    this.y *= s;
    this.z *= s;
    return this;
  }
  
  dot(v: Vector3) {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }

  lengthSq() {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }

  length() {
    return Math.sqrt(this.lengthSq());
  }

  normalize() {
    const len = this.length();
    if (len > 0) {
        this.multiplyScalar(1 / len);
    }
    return this;
  }
}


interface WarpState {
  imageUrl: string | null;
  resolution: number;
  warpIntensity: number;
  heightScale: number;
  pathOffset: number;
  imageLengthRatio: number;
  controlPoints: Vector3[];
  setImageUrl: (url: string | null) => void;
  setResolution: (res: number) => void;
  setWarpIntensity: (intensity: number) => void;
  setHeightScale: (scale: number) => void;
  setPathOffset: (offset: number) => void;
  setImageLengthRatio: (ratio: number) => void;
  updateControlPoint: (index: number, position: Vector3) => void;
  saveTrigger: number;
  triggerSave: () => void;
}

const initialPoints = [
  new Vector3(-1.5, 0.5, 0),
  new Vector3(-0.75, -0.5, 0),
  new Vector3(0.75, 0.5, 0),
  new Vector3(1.5, -0.5, 0)
];

export const useWarpStore = create<WarpState>((set) => ({
  imageUrl: 'https://picsum.photos/1024/1024',
  resolution: 50,
  warpIntensity: 1,
  heightScale: 1,
  pathOffset: 0,
  imageLengthRatio: 0.5,
  controlPoints: initialPoints,
  saveTrigger: 0,

  setImageUrl: (url) => set({ imageUrl: url, saveTrigger: 0 }), // Reset save trigger on new image
  setResolution: (res) => set({ resolution: res }),
  setWarpIntensity: (intensity) => set({ warpIntensity: intensity }),
  setHeightScale: (scale) => set({ heightScale: scale }),
  setPathOffset: (offset) =>
    set((state) => ({
      pathOffset: Math.max(0, Math.min(offset, 1 - state.imageLengthRatio)),
    })),
  setImageLengthRatio: (ratio) =>
    set((state) => ({
      imageLengthRatio: ratio,
      pathOffset: Math.min(state.pathOffset, 1 - ratio),
    })),
  updateControlPoint: (index, position) =>
    set((state) => {
      const newPoints = state.controlPoints.map(p => p.clone());
      if (newPoints[index]) {
        newPoints[index].copy(position);
      }
      return { controlPoints: newPoints };
    }),
  triggerSave: () => set((state) => ({ saveTrigger: state.saveTrigger + 1 })),
}));