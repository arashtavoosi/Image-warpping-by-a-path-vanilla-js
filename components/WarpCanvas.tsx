import React, { useRef, useEffect, useCallback } from 'react';
import { useWarpStore, Vector3 } from '../hooks/useWarpStore';

// =================================================================
// === MINI MATH & WEBGL LIBRARY START                         ===
// =================================================================

// --- Catmull-Rom Curve Implementation ---
class CatmullRomCurve3 {
    points: Vector3[];
    closed: boolean;
    curveType: string;
    tension: number;
    private arcLengths: number[];

    constructor(points: Vector3[] = [], closed = false, curveType = 'catmullrom', tension = 0.5) {
        this.points = points;
        this.closed = closed;
        this.curveType = curveType;
        this.tension = tension;
        this.arcLengths = [];
        this.updateArcLengths();
    }

    getPoint(t: number, optionalTarget = new Vector3()): Vector3 {
        const p = optionalTarget;
        const points = this.points;
        const l = points.length;
        const point = (t * (l - 1));
        const intPoint = Math.floor(point);
        const weight = point - intPoint;

        const p0 = points[intPoint === 0 ? intPoint : intPoint - 1];
        const p1 = points[intPoint];
        const p2 = points[intPoint > l - 2 ? l - 1 : intPoint + 1];
        const p3 = points[intPoint > l - 3 ? l - 1 : intPoint + 2];

        p.x = this.catmullRom(weight, p0.x, p1.x, p2.x, p3.x);
        p.y = this.catmullRom(weight, p0.y, p1.y, p2.y, p3.y);
        p.z = this.catmullRom(weight, p0.z, p1.z, p2.z, p3.z);
        return p;
    }

    getPoints(divisions = 5): Vector3[] {
        const points: Vector3[] = [];
        for (let i = 0; i <= divisions; i++) {
            points.push(this.getPoint(i / divisions));
        }
        return points;
    }

    getPointAt(u: number, optionalTarget = new Vector3()): Vector3 {
        const t = this.getUtoTmapping(u);
        return this.getPoint(t, optionalTarget);
    }

    getTangent(t: number, optionalTarget = new Vector3()): Vector3 {
        const tangent = optionalTarget;
        const points = this.points;
        const l = points.length;
        const point = t * (l - 1);
        const intPoint = Math.floor(point);
        const weight = point - intPoint;

        const p0 = points[intPoint === 0 ? intPoint : intPoint - 1];
        const p1 = points[intPoint];
        const p2 = points[intPoint > l - 2 ? l - 1 : intPoint + 1];
        const p3 = points[intPoint > l - 3 ? l - 1 : intPoint + 2];
        
        tangent.x = this.tangent(weight, p0.x, p1.x, p2.x, p3.x);
        tangent.y = this.tangent(weight, p0.y, p1.y, p2.y, p3.y);
        tangent.z = this.tangent(weight, p0.z, p1.z, p2.z, p3.z);

        return tangent.normalize();
    }

    getTangentAt(u: number, optionalTarget = new Vector3()): Vector3 {
      const t = this.getUtoTmapping(u);
      return this.getTangent(t, optionalTarget);
    }
    
    getUtoTmapping(u: number): number {
        const arcLengths = this.arcLengths;
        const totalLength = arcLengths[arcLengths.length - 1];
        const targetArcLength = u * totalLength;

        let low = 0, high = arcLengths.length - 1;
        let comparison;

        while (low <= high) {
            const mid = Math.floor(low + (high - low) / 2);
            comparison = arcLengths[mid] - targetArcLength;
            if (comparison < 0) {
                low = mid + 1;
            } else if (comparison > 0) {
                high = mid - 1;
            } else {
                high = mid;
                break;
            }
        }
        const i = high;
        if (i < 0 || i >= arcLengths.length - 1) {
            return i <= 0 ? 0 : 1;
        }
        if (arcLengths[i] === targetArcLength) {
            return i / (arcLengths.length - 1);
        }
        const p0 = arcLengths[i];
        const p1 = arcLengths[i + 1];
        const t0 = i / (arcLengths.length - 1);
        const t1 = (i + 1) / (arcLengths.length - 1);

        return t0 + (t1 - t0) * (targetArcLength - p0) / (p1 - p0);
    }

    updateArcLengths() {
        const arcLengths = [0];
        let currentPoint = this.getPoint(0);
        let lastPoint = currentPoint;
        let totalLength = 0;
        
        for (let i = 1; i <= 200; i++) { // Increased precision
            currentPoint = this.getPoint(i / 200);
            totalLength += currentPoint.clone().sub(lastPoint).length();
            arcLengths.push(totalLength);
            lastPoint = currentPoint;
        }
        this.arcLengths = arcLengths;
    }
    
    getLength(): number {
        if (!this.arcLengths || this.arcLengths.length === 0) {
          this.updateArcLengths();
        }
        return this.arcLengths[this.arcLengths.length - 1];
    }
    
    private catmullRom(t: number, p0: number, p1: number, p2: number, p3: number) {
        const v0 = (p2 - p0) * 0.5;
        const v1 = (p3 - p1) * 0.5;
        const t2 = t * t;
        const t3 = t * t2;
        return (2 * p1 - 2 * p2 + v0 + v1) * t3 + (-3 * p1 + 3 * p2 - 2 * v0 - v1) * t2 + v0 * t + p1;
    }

    private tangent(t: number, p0: number, p1: number, p2: number, p3: number) {
      const v0 = (p2 - p0) * 0.5;
      const v1 = (p3 - p1) * 0.5;
      const t2 = t * t;
      return (6 * p1 - 6 * p2 + 3 * v0 + 3 * v1) * t2 + (-6 * p1 + 6 * p2 - 4 * v0 - 2 * v1) * t + v0;
    }
}

// --- WebGL Helper Functions ---
function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('An error occurred compiling the shaders: ', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function createProgram(gl: WebGLRenderingContext, vsSource: string, fsSource: string): WebGLProgram | null {
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
    if (!vertexShader || !fragmentShader) return null;

    const program = gl.createProgram();
    if (!program) return null;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Unable to initialize the shader program: ', gl.getProgramInfoLog(program));
        return null;
    }
    return program;
}

// --- Matrix Math ---
type Mat4 = Float32Array;
function createOrthographic(left: number, right: number, bottom: number, top: number, near: number, far: number): Mat4 {
    const lr = 1 / (left - right);
    const bt = 1 / (bottom - top);
    const nf = 1 / (near - far);
    const out = new Float32Array(16);
    out[0] = -2 * lr;
    out[5] = -2 * bt;
    out[10] = 2 * nf;
    out[12] = (left + right) * lr;
    out[13] = (top + bottom) * bt;
    out[14] = (far + near) * nf;
    out[15] = 1;
    return out;
}

// --- Geometry Generation ---
function createPlaneGeometry(width: number, height: number, widthSegments: number, heightSegments: number) {
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let iy = 0; iy <= heightSegments; iy++) {
        const v = iy / heightSegments;
        for (let ix = 0; ix <= widthSegments; ix++) {
            const u = ix / widthSegments;
            positions.push((u - 0.5) * width, (v - 0.5) * height, 0);
            uvs.push(u, v);
        }
    }

    for (let iy = 0; iy < heightSegments; iy++) {
        for (let ix = 0; ix < widthSegments; ix++) {
            const a = ix + (widthSegments + 1) * iy;
            const b = ix + (widthSegments + 1) * (iy + 1);
            const c = (ix + 1) + (widthSegments + 1) * (iy + 1);
            const d = (ix + 1) + (widthSegments + 1) * iy;
            indices.push(a, b, d);
            indices.push(b, c, d);
        }
    }
    return {
        positions: new Float32Array(positions),
        uvs: new Float32Array(uvs),
        indices: new Uint16Array(indices),
    };
}

function createSphereGeometry(radius: number, widthSegments: number, heightSegments: number) {
    const positions: number[] = [];
    const indices: number[] = [];
    
    for (let y = 0; y <= heightSegments; y++) {
        const v = y / heightSegments;
        const phi = v * Math.PI;
        for (let x = 0; x <= widthSegments; x++) {
            const u = x / widthSegments;
            const theta = u * (Math.PI * 2);
            const px = -radius * Math.cos(theta) * Math.sin(phi);
            const py = radius * Math.cos(phi);
            const pz = radius * Math.sin(theta) * Math.sin(phi);
            positions.push(px, py, pz);
        }
    }

    for (let y = 0; y < heightSegments; y++) {
        for (let x = 0; x < widthSegments; x++) {
            const first = (y * (widthSegments + 1)) + x;
            const second = first + widthSegments + 1;
            indices.push(first, second, first + 1);
            indices.push(second, second + 1, first + 1);
        }
    }

    return {
        positions: new Float32Array(positions),
        indices: new Uint16Array(indices),
    };
}


// --- Shaders ---
const planeVS = `
    attribute vec4 aVertexPosition;
    attribute vec2 aTextureCoord;
    uniform mat4 uProjectionMatrix;
    varying highp vec2 vTextureCoord;
    void main() {
        gl_Position = uProjectionMatrix * aVertexPosition;
        vTextureCoord = aTextureCoord;
    }
`;
const planeFS = `
    varying highp vec2 vTextureCoord;
    uniform sampler2D uSampler;
    void main() {
        gl_FragColor = texture2D(uSampler, vTextureCoord);
    }
`;
const simpleVS = `
    attribute vec4 aVertexPosition;
    uniform mat4 uProjectionMatrix;
    uniform vec3 uModelPosition;
    void main() {
        gl_Position = uProjectionMatrix * vec4(aVertexPosition.xyz + uModelPosition, 1.0);
    }
`;
const simpleFS = `
    uniform lowp vec4 uColor;
    void main() {
        gl_FragColor = uColor;
    }
`;

// =================================================================
// === MINI MATH & WEBGL LIBRARY END                           ===
// =================================================================


const WarpCanvas: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rendererRef = useRef<any>({});
    
    const saveTrigger = useWarpStore(state => state.saveTrigger);

    const screenToWorld = useCallback((x: number, y: number, canvas: HTMLCanvasElement) => {
        const renderer = rendererRef.current;
        if (!renderer.viewWidth || !renderer.viewHeight) return new Vector3();

        const rect = canvas.getBoundingClientRect();
        const mouseX = ((x - rect.left) / canvas.clientWidth) * 2 - 1;
        const mouseY = -((y - rect.top) / canvas.clientHeight) * 2 + 1;
        
        return new Vector3(
            mouseX * renderer.viewWidth / 2,
            mouseY * renderer.viewHeight / 2,
            0
        );
    }, []);

    useEffect(() => {
        if (saveTrigger === 0) return; // Do not run on initial mount

        const renderer = rendererRef.current;
        if (renderer.gl && renderer.render && renderer.imageResolution) {
            const gl = renderer.gl;
            const state = useWarpStore.getState();
            const { controlPoints, heightScale, warpIntensity, pathOffset, imageLengthRatio } = state;

            // 1. Calculate deformed geometry and its tight bounding box
            const planeBuffers = renderer.buffers.plane;
            if (!planeBuffers || !planeBuffers.originalPositions) {
                console.error("Plane geometry not initialized. Cannot save.");
                return;
            }
            const originalPositions = planeBuffers.originalPositions;
            const vertexCount = planeBuffers.vertexCount;
            const curve = new CatmullRomCurve3(controlPoints);
            
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

            for (let i = 0; i < vertexCount; i++) {
                const x = originalPositions[i * 3];
                const y = originalPositions[i * 3 + 1];

                const u = (x + 1) / 2;
                const t = pathOffset + u * imageLengthRatio;
                const clampedT = Math.max(0, Math.min(1, t));

                const pointOnPath = curve.getPointAt(clampedT);
                const tangent = curve.getTangentAt(clampedT);
                const normal = new Vector3(-tangent.y, tangent.x, 0);
                const offsetVector = normal.clone().multiplyScalar(y * warpIntensity);
                const newPos = pointOnPath.clone().add(offsetVector);
                
                minX = Math.min(minX, newPos.x);
                maxX = Math.max(maxX, newPos.x);
                minY = Math.min(minY, newPos.y);
                maxY = Math.max(maxY, newPos.y);
            }
            
            const padding = Math.max(maxX - minX, maxY - minY) * 0.05; 
            minX -= padding; maxX += padding; minY -= padding; maxY += padding;

            const warpedWidth = maxX - minX;
            const warpedHeight = maxY - minY;
            const warpedAspectRatio = warpedWidth / warpedHeight;
            
            // 2. Determine output dimensions for high quality
            const { width: imageWidth, height: imageHeight } = renderer.imageResolution;
            const targetLongestSide = Math.max(imageWidth, imageHeight, 2048);
            
            let finalWidth, finalHeight;
            if (warpedAspectRatio >= 1) {
                finalWidth = targetLongestSide;
                finalHeight = targetLongestSide / warpedAspectRatio;
            } else {
                finalHeight = targetLongestSide;
                finalWidth = targetLongestSide * warpedAspectRatio;
            }
            const finalWidthInt = Math.round(finalWidth);
            const finalHeightInt = Math.round(finalHeight);

            // 3. Setup for offscreen rendering using a Framebuffer
            const framebuffer = gl.createFramebuffer();
            gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

            const targetTexture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, targetTexture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, finalWidthInt, finalHeightInt, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, targetTexture, 0);
            
            // 4. Render the scene to the framebuffer
            const originalViewport = gl.getParameter(gl.VIEWPORT);
            gl.viewport(0, 0, finalWidthInt, finalHeightInt);
            
            const saveProjectionMatrix = createOrthographic(minX, maxX, minY, maxY, -10, 10);
            
            renderer.render({ 
                force: true, 
                saveMode: true,
                overrideProjectionMatrix: saveProjectionMatrix,
            });

            // 5. Read pixel data from the framebuffer
            const pixels = new Uint8Array(finalWidthInt * finalHeightInt * 4);
            gl.readPixels(0, 0, finalWidthInt, finalHeightInt, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
            
            // 6. Restore original WebGL state and clean up
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.viewport(originalViewport[0], originalViewport[1], originalViewport[2], originalViewport[3]);
            gl.deleteFramebuffer(framebuffer);
            gl.deleteTexture(targetTexture);

            // 7. Convert pixels to a downloadable PNG
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = finalWidthInt;
            tempCanvas.height = finalHeightInt;
            const tempCtx = tempCanvas.getContext('2d');
            if (tempCtx) {
                const imageData = tempCtx.createImageData(finalWidthInt, finalHeightInt);
                // Flip the image vertically
                for (let y = 0; y < finalHeightInt; y++) {
                    const srcY = y;
                    const destY = finalHeightInt - 1 - y;
                    const srcOffset = srcY * finalWidthInt * 4;
                    const destOffset = destY * finalWidthInt * 4;
                    const row = pixels.subarray(srcOffset, srcOffset + finalWidthInt * 4);
                    imageData.data.set(row, destOffset);
                }
                tempCtx.putImageData(imageData, 0, 0);

                tempCanvas.toBlob(blob => {
                    if (blob) {
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.download = 'warped-image.png';
                        link.href = url;
                        link.click();
                        URL.revokeObjectURL(url);
                    }
                }, 'image/png');
            }
        } else if (!renderer.imageResolution) {
            alert("Please load an image before attempting to save.");
        }
    }, [saveTrigger]);


    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true, antialias: true });
        if (!gl) {
            console.error('WebGL not supported');
            return;
        }

        const planeProgram = createProgram(gl, planeVS, planeFS);
        const simpleProgram = createProgram(gl, simpleVS, simpleFS);
        if (!planeProgram || !simpleProgram) return;
        
        const renderer: any = {
            gl,
            planeProgram,
            simpleProgram,
            programs: {
                plane: {
                    program: planeProgram,
                    attribLocations: {
                        vertexPosition: gl.getAttribLocation(planeProgram, 'aVertexPosition'),
                        textureCoord: gl.getAttribLocation(planeProgram, 'aTextureCoord'),
                    },
                    uniformLocations: {
                        projectionMatrix: gl.getUniformLocation(planeProgram, 'uProjectionMatrix'),
                        uSampler: gl.getUniformLocation(planeProgram, 'uSampler'),
                    },
                },
                simple: {
                    program: simpleProgram,
                    attribLocations: {
                        vertexPosition: gl.getAttribLocation(simpleProgram, 'aVertexPosition'),
                    },
                    uniformLocations: {
                        projectionMatrix: gl.getUniformLocation(simpleProgram, 'uProjectionMatrix'),
                        modelPosition: gl.getUniformLocation(simpleProgram, 'uModelPosition'),
                        color: gl.getUniformLocation(simpleProgram, 'uColor'),
                    },
                },
            },
            buffers: {
                plane: {},
                sphere: {},
                curve: {},
            },
            texture: null as WebGLTexture | null,
            imageResolution: null as { width: number; height: number } | null,
            viewWidth: 0,
            viewHeight: 4,
            animationFrameId: 0,
            dragState: {
                isDragging: false,
                dragType: null as 'point' | 'plane' | null,
                pointIndex: -1,
                startPoint: new Vector3(),
                startOffset: 0,
                startT: 0,
                curve: null as CatmullRomCurve3 | null,
                curveLength: 1,
                dragOffset: new Vector3(),
            }
        };
        rendererRef.current = renderer;

        const sphereGeom = createSphereGeometry(0.05, 16, 8);
        const spherePosBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, spherePosBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, sphereGeom.positions, gl.STATIC_DRAW);
        const sphereIdxBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sphereIdxBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, sphereGeom.indices, gl.STATIC_DRAW);
        renderer.buffers.sphere = {
            position: spherePosBuffer,
            indices: sphereIdxBuffer,
            count: sphereGeom.indices.length,
        };

        const curvePosBuffer = gl.createBuffer();
        renderer.buffers.curve = { position: curvePosBuffer };
        
        let lastState = { resolution: -1, heightScale: -1 };

        const render = (options: { force?: boolean, saveMode?: boolean, overrideProjectionMatrix?: Mat4 } = {}) => {
            const { force = false, saveMode = false, overrideProjectionMatrix } = options;

            const state = useWarpStore.getState();
            const { resolution, heightScale } = state;

            if (force || lastState.resolution !== resolution || lastState.heightScale !== heightScale) {
                const planeHeight = 2 * heightScale;
                const planeGeom = createPlaneGeometry(2, planeHeight, resolution, 1);
                
                const planePosBuffer = gl.createBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, planePosBuffer);
                gl.bufferData(gl.ARRAY_BUFFER, planeGeom.positions, gl.DYNAMIC_DRAW);
                
                const planeUVBuffer = gl.createBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, planeUVBuffer);
                gl.bufferData(gl.ARRAY_BUFFER, planeGeom.uvs, gl.STATIC_DRAW);
                
                const planeIdxBuffer = gl.createBuffer();
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, planeIdxBuffer);
                gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, planeGeom.indices, gl.STATIC_DRAW);

                renderer.buffers.plane = {
                    position: planePosBuffer,
                    uv: planeUVBuffer,
                    indices: planeIdxBuffer,
                    count: planeGeom.indices.length,
                    originalPositions: planeGeom.positions,
                    vertexCount: planeGeom.positions.length / 3,
                };

                lastState = { resolution, heightScale };
            }
            
            const { controlPoints, warpIntensity, pathOffset, imageLengthRatio } = state;
            const curve = new CatmullRomCurve3(controlPoints);
            const planeBuffers = renderer.buffers.plane;
            const deformedPositions = new Float32Array(planeBuffers.originalPositions);

            for (let i = 0; i < planeBuffers.vertexCount; i++) {
                const x = planeBuffers.originalPositions[i * 3];
                const y = planeBuffers.originalPositions[i * 3 + 1];

                const u = (x + 1) / 2;
                const t = pathOffset + u * imageLengthRatio;
                const clampedT = Math.max(0, Math.min(1, t));

                const pointOnPath = curve.getPointAt(clampedT);
                const tangent = curve.getTangentAt(clampedT);
                const normal = new Vector3(-tangent.y, tangent.x, 0);
                const offsetVector = normal.clone().multiplyScalar(y * warpIntensity);
                const newPos = pointOnPath.clone().add(offsetVector);

                deformedPositions[i * 3] = newPos.x;
                deformedPositions[i * 3 + 1] = newPos.y;
                deformedPositions[i * 3 + 2] = newPos.z;
            }

            gl.bindBuffer(gl.ARRAY_BUFFER, planeBuffers.position);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, deformedPositions);

            const curveDivisions = 100;
            const curvePoints = [];
            for (let i = 0; i <= curveDivisions; i++) {
                curvePoints.push(curve.getPointAt(i / curveDivisions));
            }
            const curvePositions = new Float32Array(curvePoints.length * 3);
            curvePoints.forEach((p, i) => {
                curvePositions[i * 3] = p.x;
                curvePositions[i * 3 + 1] = p.y;
                curvePositions[i * 3 + 2] = p.z - 0.01;
            });
            gl.bindBuffer(gl.ARRAY_BUFFER, renderer.buffers.curve.position);
            gl.bufferData(gl.ARRAY_BUFFER, curvePositions, gl.DYNAMIC_DRAW);
            renderer.buffers.curve.count = curvePoints.length;

            if (saveMode) {
                gl.clearColor(0.0, 0.0, 0.0, 0.0);
            } else {
                gl.clearColor(0.11, 0.12, 0.13, 1.0);
            }
            
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            gl.enable(gl.DEPTH_TEST);
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

            const projMatrix = overrideProjectionMatrix 
                ? overrideProjectionMatrix 
                : createOrthographic(-renderer.viewWidth / 2, renderer.viewWidth / 2, -renderer.viewHeight / 2, renderer.viewHeight / 2, -10, 10);
            
            if (!saveMode) {
                const simpleProgInfo = renderer.programs.simple;
                gl.useProgram(simpleProgInfo.program);
                gl.uniformMatrix4fv(simpleProgInfo.uniformLocations.projectionMatrix, false, projMatrix);
                gl.uniform3f(simpleProgInfo.uniformLocations.modelPosition, 0, 0, 0);
                gl.uniform4f(simpleProgInfo.uniformLocations.color, 1.0, 1.0, 1.0, 0.5);
                gl.bindBuffer(gl.ARRAY_BUFFER, renderer.buffers.curve.position);
                gl.vertexAttribPointer(simpleProgInfo.attribLocations.vertexPosition, 3, gl.FLOAT, false, 0, 0);
                gl.enableVertexAttribArray(simpleProgInfo.attribLocations.vertexPosition);
                gl.drawArrays(gl.LINE_STRIP, 0, renderer.buffers.curve.count);
                
                gl.bindBuffer(gl.ARRAY_BUFFER, renderer.buffers.sphere.position);
                gl.vertexAttribPointer(simpleProgInfo.attribLocations.vertexPosition, 3, gl.FLOAT, false, 0, 0);
                gl.enableVertexAttribArray(simpleProgInfo.attribLocations.vertexPosition);
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, renderer.buffers.sphere.indices);

                controlPoints.forEach((p, i) => {
                    const isDragged = renderer.dragState.isDragging && renderer.dragState.dragType === 'point' && renderer.dragState.pointIndex === i;
                    gl.uniform3f(simpleProgInfo.uniformLocations.modelPosition, p.x, p.y, p.z);
                    gl.uniform4f(simpleProgInfo.uniformLocations.color, isDragged ? 1.0 : 1.0, isDragged ? 0.41 : 1.0, isDragged ? 0.7 : 1.0, 0.8);
                    gl.drawElements(gl.TRIANGLES, renderer.buffers.sphere.count, gl.UNSIGNED_SHORT, 0);
                });
            }
            
            if (renderer.texture) {
                const planeProgInfo = renderer.programs.plane;
                gl.useProgram(planeProgInfo.program);
                gl.uniformMatrix4fv(planeProgInfo.uniformLocations.projectionMatrix, false, projMatrix);
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, renderer.texture);
                gl.uniform1i(planeProgInfo.uniformLocations.uSampler, 0);

                gl.bindBuffer(gl.ARRAY_BUFFER, planeBuffers.position);
                gl.vertexAttribPointer(planeProgInfo.attribLocations.vertexPosition, 3, gl.FLOAT, false, 0, 0);
                gl.enableVertexAttribArray(planeProgInfo.attribLocations.vertexPosition);

                gl.bindBuffer(gl.ARRAY_BUFFER, planeBuffers.uv);
                gl.vertexAttribPointer(planeProgInfo.attribLocations.textureCoord, 2, gl.FLOAT, false, 0, 0);
                gl.enableVertexAttribArray(planeProgInfo.attribLocations.textureCoord);

                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, planeBuffers.indices);
                gl.drawElements(gl.TRIANGLES, planeBuffers.count, gl.UNSIGNED_SHORT, 0);
            }
            
            renderer.render = render;
            if (!force && !saveMode) renderer.animationFrameId = requestAnimationFrame(() => render({}));
        };

        const findClosestPointOnCurve = (curve: CatmullRomCurve3, worldPos: Vector3) => {
            let minDistanceSq = Infinity;
            let closestT = 0;
            const divisions = 100;
            for (let i = 0; i <= divisions; i++) {
                const t = i / divisions;
                const p = curve.getPointAt(t);
                const distanceSq = p.clone().sub(worldPos).lengthSq();
                if (distanceSq < minDistanceSq) {
                    minDistanceSq = distanceSq;
                    closestT = t;
                }
            }
            return { t: closestT, distance: Math.sqrt(minDistanceSq) };
        };

        const onPointerDown = (e: PointerEvent) => {
            const worldPos = screenToWorld(e.clientX, e.clientY, canvas);
            const state = useWarpStore.getState();
            const { controlPoints, heightScale, warpIntensity, pathOffset } = state;
            const renderer = rendererRef.current;

            // Priority 1: Check for control point drag
            for (let i = 0; i < controlPoints.length; i++) {
                if (worldPos.clone().sub(controlPoints[i]).length() < 0.1) {
                    const dragOffset = controlPoints[i].clone().sub(worldPos);
                    renderer.dragState = {
                        ...renderer.dragState,
                        isDragging: true,
                        dragType: 'point',
                        pointIndex: i,
                        dragOffset,
                    };
                    canvas.style.cursor = 'grabbing';
                    canvas.setPointerCapture(e.pointerId);
                    return;
                }
            }
            
            // Priority 2: Check for plane drag
            const curve = new CatmullRomCurve3(controlPoints);
            const { t: closestT, distance } = findClosestPointOnCurve(curve, worldPos);
            
            const planeClickThreshold = heightScale * warpIntensity * 1.2 + 0.1;

            if (distance < planeClickThreshold) {
                 renderer.dragState = {
                    ...renderer.dragState,
                    isDragging: true,
                    dragType: 'plane',
                    startPoint: worldPos,
                    startOffset: pathOffset,
                    startT: closestT,
                    curve: curve,
                    curveLength: curve.getLength(),
                };
                canvas.style.cursor = 'grabbing';
                canvas.setPointerCapture(e.pointerId);
                return;
            }
        };

        const onPointerMove = (e: PointerEvent) => {
            const renderer = rendererRef.current;
            if (!renderer.dragState.isDragging) {
                const worldPos = screenToWorld(e.clientX, e.clientY, canvas);
                const { controlPoints } = useWarpStore.getState();
                 for (let i = 0; i < controlPoints.length; i++) {
                    if (worldPos.clone().sub(controlPoints[i]).length() < 0.1) {
                         canvas.style.cursor = 'grab';
                         return;
                    }
                }
                canvas.style.cursor = 'auto';
                return;
            };

            const worldPos = screenToWorld(e.clientX, e.clientY, canvas);

            if (renderer.dragState.dragType === 'point') {
                const newPos = worldPos.clone().add(renderer.dragState.dragOffset);
                useWarpStore.getState().updateControlPoint(renderer.dragState.pointIndex, newPos);
            } else if (renderer.dragState.dragType === 'plane' && renderer.dragState.curve) {
                const moveVector = worldPos.clone().sub(renderer.dragState.startPoint);
                const tangent = renderer.dragState.curve.getTangentAt(renderer.dragState.startT);
                const distanceAlongCurve = moveVector.dot(tangent);
                const deltaOffset = distanceAlongCurve / renderer.dragState.curveLength;
                
                useWarpStore.getState().setPathOffset(renderer.dragState.startOffset + deltaOffset);
            }
        };

        const onPointerUp = (e: PointerEvent) => {
            rendererRef.current.dragState.isDragging = false;
            rendererRef.current.dragType = null;
            canvas.style.cursor = 'auto';
            canvas.releasePointerCapture(e.pointerId);
        };

        const resizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                const dpr = window.devicePixelRatio;
                canvas.width = Math.round(width * dpr);
                canvas.height = Math.round(height * dpr);
                gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
                rendererRef.current.viewWidth = rendererRef.current.viewHeight * (width / height);
                render({ force: true });
            }
        });

        const loadImage = (url: string) => {
            const image = new Image();
            image.crossOrigin = "anonymous";
            image.onload = () => {
                rendererRef.current.imageResolution = { width: image.naturalWidth, height: image.naturalHeight };
                const texture = gl.createTexture();
                gl.bindTexture(gl.TEXTURE_2D, texture);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                rendererRef.current.texture = texture;
                render({ force: true });
            };
            image.src = url;
        };

        const initialImageUrl = useWarpStore.getState().imageUrl;
        if (initialImageUrl) {
            loadImage(initialImageUrl);
        }
        
        const unsub = useWarpStore.subscribe((state, prevState) => {
          if(state.imageUrl !== prevState.imageUrl && state.imageUrl) {
            loadImage(state.imageUrl);
          }
        });

        resizeObserver.observe(canvas);
        canvas.addEventListener('pointerdown', onPointerDown);
        canvas.addEventListener('pointermove', onPointerMove);
        canvas.addEventListener('pointerup', onPointerUp);
        canvas.addEventListener('pointerleave', onPointerUp);
        
        render();

        return () => {
            cancelAnimationFrame(rendererRef.current.animationFrameId);
            resizeObserver.disconnect();
            canvas.removeEventListener('pointerdown', onPointerDown);
            canvas.removeEventListener('pointermove', onPointerMove);
            canvas.removeEventListener('pointerup', onPointerUp);
            canvas.removeEventListener('pointerleave', onPointerUp);
            unsub();
        };
    }, [screenToWorld]);

    return (
        <div style={{ width: '100%', height: '100%' }}>
            <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
        </div>
    );
};

export default WarpCanvas;