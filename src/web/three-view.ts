import * as THREE from "three"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"
import { base64, loadFont } from "./font.ts"
export async function mountBoard(container: HTMLElement, svg: string) {
  const bytes = await loadFont()
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = 2048
  const embedded = svg.replace(
    "<g font-family",
    `<defs><style>@font-face{font-family:BoardSans;src:url(data:font/ttf;base64,${base64(bytes)})}</style></defs><g font-family`,
  )
  const image = new Image()
  const url = URL.createObjectURL(new Blob([embedded], { type: "image/svg+xml" }))
  try {
    image.src = url
    await image.decode()
    canvas.getContext("2d")!.drawImage(image, 0, 0, 2048, 2048)
  } finally {
    URL.revokeObjectURL(url)
  }
  if (!container.isConnected) throw new Error("Preview closed")
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.setClearColor(0xeae8df)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1
  container.appendChild(renderer.domElement)
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100)
  camera.position.set(0, 7, 7)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy()
  const side = new THREE.MeshStandardMaterial({ color: 0xb7a886 })
  const top = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9 })
  const geometry = new THREE.BoxGeometry(5, 0.06, 5)
  scene.add(new THREE.Mesh(geometry, [side, side, top, side, side, side]))
  scene.add(new THREE.HemisphereLight(0xffffff, 0x7b796e, 1.4))
  const light = new THREE.DirectionalLight(0xffffff, 1)
  light.position.set(3, 7, 4)
  scene.add(light)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enablePan = false
  controls.minDistance = 4
  controls.maxDistance = 15
  controls.maxPolarAngle = Math.PI * 0.47
  controls.target.set(0, 0, 0)
  controls.update()
  const render = () => renderer.render(scene, camera)
  controls.addEventListener("change", render)
  const resize = () => {
    const w = container.clientWidth,
      h = container.clientHeight
    renderer.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    render()
  }
  const observer = new ResizeObserver(resize)
  observer.observe(container)
  resize()
  return {
    reset() {
      camera.position.set(0, 7, 7)
      controls.target.set(0, 0, 0)
      controls.update()
      render()
    },
    dispose() {
      observer.disconnect()
      controls.dispose()
      geometry.dispose()
      top.dispose()
      side.dispose()
      texture.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    },
  }
}
