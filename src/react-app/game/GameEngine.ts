import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private world!: CANNON.World;
  private ball!: THREE.Mesh;
  private ballBody!: CANNON.Body;
  private ground!: THREE.Mesh;
  private isAiming = false;
  private aimStart = new THREE.Vector2();
  private aimCurrent = new THREE.Vector2();
  private strokes = 0;
  private ballStartPos = new THREE.Vector3(0, 1, 8);
  private cameraTarget = new THREE.Vector3(0, 0, 0);
  private clock = new THREE.Clock();
  private isMuted = false;
  private aimingLine: THREE.Line | null = null;
  private ballInHole = false;

  // Camera controls - First Person
  private isPanning = false;
  private panStart = new THREE.Vector2();
  private isFirstPerson = true;
  private firstPersonDistance = 3; // Distance behind the ball
  private firstPersonHeight = 1.2; // Height above ground
  private cameraAngleY = 0; // Horizontal rotation
  private smoothCameraTarget = new THREE.Vector3();
  private goalDirection = new THREE.Vector3(); // Direction toward the goal
  
  // First-person camera settings per level
  private getFirstPersonPreset(level: number) {
    switch (level) {
      case 1:
        return { distance: 3.5, height: 1.4, fov: 70 };
      case 2:
        return { distance: 3.8, height: 1.5, fov: 72 };
      case 3:
        return { distance: 4.0, height: 1.6, fov: 74 };
      case 4:
        return { distance: 3.2, height: 1.3, fov: 68 };
      default:
        return { distance: 3.5, height: 1.4, fov: 70 };
    }
  }

  // Course elements
  private walls: THREE.Mesh[] = [];
  private wallBodies: CANNON.Body[] = [];
  private holeBody!: CANNON.Body;
  private flag!: THREE.Group;
  private holePosition = new THREE.Vector3(0, 0, -12); // Default hole position
  private currentLevel = 1;
  private onLevelComplete?: (level: number, strokes: number) => void;

  constructor(canvas: HTMLCanvasElement, level: number = 1, onLevelComplete?: (level: number, strokes: number) => void) {
    this.canvas = canvas;
    this.currentLevel = level;
    this.onLevelComplete = onLevelComplete;
    this.init();
  }

  private init() {
    this.setupScene();
    this.setupPhysics();
    this.setupLighting();
    this.setupCourse();
    this.setupBall();
    this.setupControls();
    this.setupEventListeners();
  }

  private setupScene() {
    // Scene
    this.scene = new THREE.Scene();
    // Make background transparent so page gradient shows through
    this.scene.background = null as any;

    // Camera - First Person setup
    const preset = this.getFirstPersonPreset(this.currentLevel);
    this.camera = new THREE.PerspectiveCamera(
      preset.fov,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.firstPersonDistance = preset.distance;
    this.firstPersonHeight = preset.height;
    this.updateFirstPersonCamera();

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ 
      canvas: this.canvas,
      antialias: true,
      alpha: true
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  private setupPhysics() {
    this.world = new CANNON.World();
    this.world.gravity.set(0, -9.82, 0);
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    
    // Improve physics stability
    this.world.allowSleep = true;
    this.world.defaultContactMaterial.friction = 0.8;
    this.world.defaultContactMaterial.restitution = 0.2;
    this.world.solver.iterations = 10; // More solver iterations for stability
    this.world.solver.tolerance = 0.1;
    
    // Contact material for ball physics
    const ballMaterial = new CANNON.Material('ball');
    const groundMaterial = new CANNON.Material('ground');
    const wallMaterial = new CANNON.Material('wall');
    
    const ballGroundContact = new CANNON.ContactMaterial(
      ballMaterial,
      groundMaterial,
      {
        friction: 0.1, // Reduced friction as requested
        restitution: 0.2,
        frictionEquationStiffness: 1e7, // Reduced for stability
        frictionEquationRelaxation: 4,
        contactEquationStiffness: 1e8,
        contactEquationRelaxation: 3
      }
    );
    
    const ballWallContact = new CANNON.ContactMaterial(
      ballMaterial,
      wallMaterial,
      {
        friction: 0.2,
        restitution: 0.8, // Very bouncy walls
        frictionEquationStiffness: 1e10,
        frictionEquationRelaxation: 3
      }
    );
    
    this.world.addContactMaterial(ballGroundContact);
    this.world.addContactMaterial(ballWallContact);
  }

  private setupLighting() {
    // Enhanced ambient light for better color visibility
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    // Primary directional light - warmer tone to enhance colors
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(10, 15, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -25;
    directionalLight.shadow.camera.right = 25;
    directionalLight.shadow.camera.top = 25;
    directionalLight.shadow.camera.bottom = -25;
    directionalLight.shadow.bias = -0.0001;
    this.scene.add(directionalLight);

    // Secondary fill light for better color definition
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-5, 8, -10);
    this.scene.add(fillLight);
  }

  private setupCourse() {
    if (this.currentLevel === 1) {
      this.setupLevel1();
    } else if (this.currentLevel === 2) {
      this.setupLevel2();
    } else if (this.currentLevel === 3) {
      this.setupLevel3();
    } else if (this.currentLevel === 4) {
      this.setupLevel4();
    }
    // Calculate goal direction for first-person camera
    this.calculateGoalDirection();
    // Apply first-person camera after level geometry
    this.updateFirstPersonCamera();
  }

  private setupLevel1() {
    // Ground
    const groundGeometry = new THREE.BoxGeometry(20, 0.5, 30);
    const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x78BC61 });
    this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    // Ground physics
    const groundShape = new CANNON.Box(new CANNON.Vec3(10, 0.25, 15));
    const groundBody = new CANNON.Body({ mass: 0 });
    groundBody.material = new CANNON.Material('ground');
    groundBody.addShape(groundShape);
    groundBody.position.set(0, -0.25, 0);
    this.world.addBody(groundBody);

    // Course boundaries - moderate height walls
    this.createWall(0, 1, 15.75, 20.5, 2, 1, 0xD2B48C); // Back wall
    this.createWall(0, 1, -15.75, 20.5, 2, 1, 0xD2B48C); // Front wall
    this.createWall(10.75, 1, 0, 1, 2, 31, 0xD2B48C); // Right wall
    this.createWall(-10.75, 1, 0, 1, 2, 31, 0xD2B48C); // Left wall

    // Level 1 obstacles
    this.createWall(-5, 0.75, 5, 2, 1.5, 8, 0xE9806E); // Left obstacle
    this.createWall(5, 0.75, -2, 6, 1.5, 2, 0xA2C7E5); // Right obstacle
    this.createWall(0, 0.75, 0, 8, 1.5, 2, 0xF5B82E); // Center obstacle

    this.createHole(0, -12);
  }

  private setupLevel2() {
    // Circular ground
    const radius = 18;
    const groundGeometry = new THREE.CylinderGeometry(radius, radius, 0.5, 32);
    const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x78BC61 });
    this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    // Ground physics - circular
    const groundShape = new CANNON.Cylinder(radius, radius, 0.5, 16);
    const groundBody = new CANNON.Body({ mass: 0 });
    groundBody.material = new CANNON.Material('ground');
    groundBody.addShape(groundShape);
    groundBody.position.set(0, -0.25, 0);
    this.world.addBody(groundBody);

    // Circular boundary wall
    this.createCircularWall(0, 1, 0, radius + 1, 2, 0xD2B48C);

    // Level 2 obstacles - reduced for easier navigation
    this.createWall(0, 0.75, 3, 3, 1.5, 2, 0xA2C7E5); // Center obstacle
    this.createWall(-5, 0.75, -5, 2, 1.5, 3, 0xF5B82E); // Left obstacle
    this.createWall(5, 0.75, -5, 2, 1.5, 3, 0xE9806E); // Right obstacle

    this.createHole(0, -15);
  }

  private createCircularWall(x: number, y: number, z: number, radius: number, height: number, color: number = 0xD2B48C) {
    const segments = 36; // Increased segments for smoother circle
    const wallThickness = 1.0; // Thicker walls for better visibility and physics
    
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const wallX = x + Math.cos(angle) * radius;
      const wallZ = z + Math.sin(angle) * radius;
      
      // Visual wall segment - extend into ground to merge with floor
      const extendedHeight = height + 0.5; // Add 0.5 units to go into ground
      const wallGeometry = new THREE.BoxGeometry(wallThickness * 1.5, extendedHeight, wallThickness * 1.5);
      const wallMaterial = new THREE.MeshLambertMaterial({ 
        color: color,
        transparent: true,
        opacity: 0.7 // 70% opacity, 30% transparent
      });
      const wall = new THREE.Mesh(wallGeometry, wallMaterial);
      wall.position.set(wallX, y - 0.25, wallZ); // Lower by 0.25 to merge with ground
      wall.rotation.y = angle;
      wall.castShadow = true;
      wall.receiveShadow = true;
      this.scene.add(wall);
      this.walls.push(wall);

      // Physics wall segment - larger collision box
      const wallShape = new CANNON.Box(new CANNON.Vec3(wallThickness * 0.75, height/2, wallThickness * 0.75));
      const wallBody = new CANNON.Body({ mass: 0 });
      wallBody.material = new CANNON.Material('wall');
      wallBody.addShape(wallShape);
      wallBody.position.set(wallX, y, wallZ); // Keep physics at original position
      wallBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), angle);
      wallBody.type = CANNON.Body.KINEMATIC;
      this.world.addBody(wallBody);
      this.wallBodies.push(wallBody);
    }
  }

  private setupLevel3() {
    // Larger ground for level 3
    const groundGeometry = new THREE.BoxGeometry(30, 0.5, 40);
    const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x78BC61 });
    this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    // Ground physics
    const groundShape = new CANNON.Box(new CANNON.Vec3(15, 0.25, 20));
    const groundBody = new CANNON.Body({ mass: 0 });
    groundBody.material = new CANNON.Material('ground');
    groundBody.addShape(groundShape);
    groundBody.position.set(0, -0.25, 0);
    this.world.addBody(groundBody);

    // Course boundaries
    this.createWall(0, 1, 20.5, 31, 2, 1, 0xD2B48C); // Back wall
    this.createWall(0, 1, -20.5, 31, 2, 1, 0xD2B48C); // Front wall
    this.createWall(15.5, 1, 0, 1, 2, 41, 0xD2B48C); // Right wall
    this.createWall(-15.5, 1, 0, 1, 2, 41, 0xD2B48C); // Left wall

    // Create natural terrain bumps and ridges
    this.createTerrainBumps();

    this.createHole(0, -18);
  }

  private setupLevel4() {
    // Curved slide course: a curving track with continuous side walls
    const segments = 36;
    const trackWidth = 7; // playable width
    const wallHeight = 3.5;
    const wallThickness = 0.8;
    const startZ = 12;
    const endZ = -20;
    const totalLength = startZ - endZ; // positive

    // Parametric centerline: gentle S-curve
    const centerAt = (t: number) => {
      const z = startZ - t * totalLength;
      const x = 5 * Math.sin(t * Math.PI * 0.8); // curve left-right
      return new THREE.Vector3(x, 0, z);
    };

    const up = new THREE.Vector3(0, 1, 0);
    let endPoint = centerAt(1);

    for (let i = 0; i < segments; i++) {
      const t0 = i / segments;
      const t1 = (i + 1) / segments;
      const p0 = centerAt(t0);
      const p1 = centerAt(t1);
      const segmentCenter = new THREE.Vector3().addVectors(p0, p1).multiplyScalar(0.5);
      const dir = new THREE.Vector3().subVectors(p1, p0);
      const segLen = dir.length();
      if (segLen === 0) continue;
      dir.normalize();
      const yaw = Math.atan2(dir.x, dir.z);

      // Slight downhill tilt to keep momentum
      // Use a flat launch pad for first few segments so the ball doesn't roll instantly
      const baseSlope = -Math.PI / 40; // ~4.5 degrees
      const slope = i < 6 ? 0 : baseSlope;

      // Floor piece (visual)
      const floorGeom = new THREE.BoxGeometry(trackWidth, 0.4, segLen);
      const floorMat = new THREE.MeshLambertMaterial({ color: 0x6fbf73 });
      const floor = new THREE.Mesh(floorGeom, floorMat);
      floor.position.set(segmentCenter.x, 0, segmentCenter.z);
      floor.rotation.y = yaw;
      floor.rotation.x = slope;
      floor.receiveShadow = true;
      this.scene.add(floor);

      // Floor physics
      const floorShape = new CANNON.Box(new CANNON.Vec3(trackWidth / 2, 0.2, segLen / 2));
      const floorBody = new CANNON.Body({ mass: 0 });
      floorBody.material = new CANNON.Material('ground');
      floorBody.addShape(floorShape);
      floorBody.position.set(segmentCenter.x, 0, segmentCenter.z);
      floorBody.quaternion.setFromEuler(slope, yaw, 0, 'XYZ');
      this.world.addBody(floorBody);

      // Side walls (left and right)
      const right = new THREE.Vector3().crossVectors(dir, up).normalize();
      const leftOffset = right.clone().multiplyScalar(-trackWidth / 2 - wallThickness / 2);
      const rightOffset = right.clone().multiplyScalar(trackWidth / 2 + wallThickness / 2);

      const placeWall = (offset: THREE.Vector3) => {
        const wallGeom = new THREE.BoxGeometry(wallThickness, wallHeight, segLen);
        const wallMat = new THREE.MeshLambertMaterial({ 
          color: 0xD2B48C,
          transparent: true,
          opacity: 0.7 // 70% opacity, 30% transparent
        });
        const wall = new THREE.Mesh(wallGeom, wallMat);
        wall.position.copy(segmentCenter.clone().add(offset));
        wall.rotation.y = yaw;
        wall.rotation.x = slope;
        wall.castShadow = true;
        wall.receiveShadow = true;
        this.scene.add(wall);
        this.walls.push(wall);

        const wallShape = new CANNON.Box(new CANNON.Vec3(wallThickness / 2, wallHeight / 2, segLen / 2));
        const wallBody = new CANNON.Body({ mass: 0 });
        wallBody.material = new CANNON.Material('wall');
        wallBody.addShape(wallShape);
        wallBody.position.set(wall.position.x, wall.position.y + wallHeight / 2 - 0.2, wall.position.z);
        wallBody.quaternion.setFromEuler(slope, yaw, 0, 'XYZ');
        wallBody.type = CANNON.Body.KINEMATIC;
        this.world.addBody(wallBody);
        this.wallBodies.push(wallBody);
      };

      placeWall(leftOffset);
      placeWall(rightOffset);

      if (i === segments - 1) {
        endPoint = p1.clone();
      }
    }

    // Place hole at the end of the slide centerline
    this.createHole(endPoint.x, endPoint.z + 1);

    // Place oriented catch wall aligned with final direction and slope
    const baseSlope = -Math.PI / 40;
    const endPrev = centerAt(1 - 1 / segments);
    const endDir = new THREE.Vector3().subVectors(endPoint, endPrev).normalize();
    const endYaw = Math.atan2(endDir.x, endDir.z);
    const catchCenter = endPoint.clone().add(endDir.clone().multiplyScalar(0.6));
    this.createRotatedWall(catchCenter.x, 2, catchCenter.z, trackWidth + 2, 4, 1, endYaw, baseSlope, 0xD2B48C);

    // Start ball near the start of the slide
    const startPoint = centerAt(0);
    // Compute local downhill direction and orientation at start
    const nextPoint = centerAt(1 / segments);
    const startDir = new THREE.Vector3().subVectors(nextPoint, startPoint).normalize();
    const startYaw = Math.atan2(startDir.x, startDir.z);
    const startSlope = 0; // first segments are flat

    // Place ball just before a small aligned starter lip
    const backOffset = startDir.clone().multiplyScalar(0.3);
    this.ballStartPos = new THREE.Vector3(startPoint.x - backOffset.x, 1.2, startPoint.z - backOffset.z);

    // Starter lip removed to prevent blocking ball movement

    // Backstop behind the ball to prevent any backward drift
    const backLipDepth = 0.6;
    const backLipHeight = 0.5;
    const lipMat = new THREE.MeshLambertMaterial({ color: 0xC9A671 });
    const backLipGeom = new THREE.BoxGeometry(trackWidth * 0.5, backLipHeight, backLipDepth);
    const backLip = new THREE.Mesh(backLipGeom, lipMat);
    const backLipOffset = startDir.clone().multiplyScalar(-0.5);
    backLip.position.set(this.ballStartPos.x + backLipOffset.x, backLipHeight / 2 - 0.05, this.ballStartPos.z + backLipOffset.z);
    backLip.rotation.y = startYaw;
    backLip.castShadow = true;
    backLip.receiveShadow = true;
    this.scene.add(backLip);

    const backLipShape = new CANNON.Box(new CANNON.Vec3((trackWidth * 0.5) / 2, backLipHeight / 2, backLipDepth / 2));
    const backLipBody = new CANNON.Body({ mass: 0 });
    backLipBody.material = new CANNON.Material('ground');
    backLipBody.addShape(backLipShape);
    backLipBody.position.set(backLip.position.x, backLip.position.y, backLip.position.z);
    backLipBody.quaternion.setFromEuler(0, startYaw, 0, 'XYZ');
    backLipBody.type = CANNON.Body.KINEMATIC;
    this.world.addBody(backLipBody);

    // Small side nubs near the start to further cradle the ball
    const nubDepth = 0.6;
    const nubHeight = 0.4;
    const nubWidth = 0.6;
    const right = new THREE.Vector3().crossVectors(startDir, new THREE.Vector3(0,1,0)).normalize();
    const placeNub = (side: number) => {
      const nub = new THREE.Mesh(new THREE.BoxGeometry(nubWidth, nubHeight, nubDepth), lipMat);
      const lateralOffset = right.clone().multiplyScalar(side * (trackWidth/2 - 0.5));
      const forwardOffset = startDir.clone().multiplyScalar(0.1);
      nub.position.set(this.ballStartPos.x + lateralOffset.x + forwardOffset.x, nubHeight/2 - 0.05, this.ballStartPos.z + lateralOffset.z + forwardOffset.z);
      nub.rotation.y = startYaw;
      this.scene.add(nub);
      const nubShape = new CANNON.Box(new CANNON.Vec3(nubWidth/2, nubHeight/2, nubDepth/2));
      const nubBody = new CANNON.Body({ mass: 0 });
      nubBody.material = new CANNON.Material('ground');
      nubBody.addShape(nubShape);
      nubBody.position.set(nub.position.x, nub.position.y, nub.position.z);
      nubBody.quaternion.setFromEuler(0, startYaw, 0, 'XYZ');
      nubBody.type = CANNON.Body.KINEMATIC;
      this.world.addBody(nubBody);
    };
    placeNub(1);
    placeNub(-1);
  }

  private createTerrainBumps() {
    // Create small rolling hills and ridges scattered across the course
    
    // Ridge 1 - diagonal ridge across the middle (much lower)
    this.createRidge(-8, 0.15, 2, 12, 0.25, 1.8, Math.PI/6, 0xE9806E);
    
    // Ridge 2 - perpendicular ridge (much lower)
    this.createRidge(6, 0.12, 6, 8, 0.2, 1.5, -Math.PI/8, 0xA2C7E5);
    
    // Small bumps scattered around (much lower and wider)
    this.createBump(-5, 0.15, 10, 3.0, 0.25, 0xF5B82E);
    this.createBump(4, 0.12, 0, 2.5, 0.2, 0xDD6031);
    this.createBump(-2, 0.13, -5, 2.8, 0.22, 0xE9806E);
    this.createBump(8, 0.16, -8, 3.2, 0.28, 0xA2C7E5);
    this.createBump(-7, 0.1, -12, 2.0, 0.18, 0xF5B82E);
    
    // Gentle rolling mounds (much lower)
    this.createMound(-10, 0.2, -2, 4.5, 0.35, 0xDD6031);
    this.createMound(10, 0.18, 3, 4.0, 0.32, 0xE9806E);
    this.createMound(0, 0.15, -10, 3.5, 0.28, 0xA2C7E5);
  }

  private createRidge(x: number, y: number, z: number, length: number, height: number, width: number, angle: number, color: number) {
    // Visual ridge using elongated ellipsoid
    const ridgeGeometry = new THREE.CylinderGeometry(width/2, width/2, height, 8, 1);
    ridgeGeometry.scale(length/width, 1, 1); // Stretch to create ridge shape
    const ridgeMaterial = new THREE.MeshLambertMaterial({ color: color });
    const ridge = new THREE.Mesh(ridgeGeometry, ridgeMaterial);
    ridge.position.set(x, y, z);
    ridge.rotation.y = angle; // Rotate around Y-axis for direction
    ridge.castShadow = true;
    ridge.receiveShadow = true;
    this.scene.add(ridge);

    // Physics approximation using multiple small cylinders
    const segments = Math.floor(length / 1.5);
    for (let i = 0; i < segments; i++) {
      const segmentX = x + (i - segments/2) * (length / segments) * Math.cos(angle);
      const segmentZ = z + (i - segments/2) * (length / segments) * Math.sin(angle);
      
      const ridgeShape = new CANNON.Cylinder(width/2, width/2, height, 6);
      const ridgeBody = new CANNON.Body({ mass: 0 });
      ridgeBody.material = new CANNON.Material('ground');
      ridgeBody.addShape(ridgeShape);
      ridgeBody.position.set(segmentX, y, segmentZ);
      this.world.addBody(ridgeBody);
    }
  }

  private createBump(x: number, y: number, z: number, radius: number, height: number, color: number) {
    // Visual bump using flattened sphere
    const bumpGeometry = new THREE.SphereGeometry(radius, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    bumpGeometry.scale(1, height/radius, 1); // Flatten the sphere
    const bumpMaterial = new THREE.MeshLambertMaterial({ color: color });
    const bump = new THREE.Mesh(bumpGeometry, bumpMaterial);
    bump.position.set(x, y, z);
    bump.castShadow = true;
    bump.receiveShadow = true;
    this.scene.add(bump);

    // Physics approximation using cylinder
    const bumpShape = new CANNON.Cylinder(radius * 0.8, radius * 0.8, height, 8);
    const bumpBody = new CANNON.Body({ mass: 0 });
    bumpBody.material = new CANNON.Material('ground');
    bumpBody.addShape(bumpShape);
    bumpBody.position.set(x, y, z);
    this.world.addBody(bumpBody);
  }

  private createMound(x: number, y: number, z: number, radius: number, height: number, color: number) {
    // Visual mound using hemisphere
    const moundGeometry = new THREE.SphereGeometry(radius, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    moundGeometry.scale(1, height/radius, 1);
    const moundMaterial = new THREE.MeshLambertMaterial({ color: color });
    const mound = new THREE.Mesh(moundGeometry, moundMaterial);
    mound.position.set(x, y, z);
    mound.castShadow = true;
    mound.receiveShadow = true;
    this.scene.add(mound);

    // Physics approximation using multiple overlapping cylinders for smooth rolling
    const rings = 4;
    for (let i = 0; i < rings; i++) {
      const ringRadius = radius * (1 - i / rings);
      const ringHeight = height * (1 - i / rings) / rings;
      const ringY = y + (i * height / rings);
      
      if (ringRadius > 0.3) {
        const moundShape = new CANNON.Cylinder(ringRadius, ringRadius, ringHeight, 8);
        const moundBody = new CANNON.Body({ mass: 0 });
        moundBody.material = new CANNON.Material('ground');
        moundBody.addShape(moundShape);
        moundBody.position.set(x, ringY, z);
        this.world.addBody(moundBody);
      }
    }
  }

  private calculateGoalDirection() {
    // Calculate direction from ball start position to hole
    this.goalDirection.copy(this.holePosition).sub(this.ballStartPos);
    this.goalDirection.y = 0; // Keep it horizontal
    this.goalDirection.normalize();
    
    // Set initial camera angle to face the goal
    this.cameraAngleY = Math.atan2(this.goalDirection.x, this.goalDirection.z);
    console.log(`Goal direction calculated for level ${this.currentLevel}:`, this.goalDirection);
  }

  private createHole(x: number, z: number) {
    // Store hole position for camera calculations
    this.holePosition.set(x, 0, z);
    
    // Create realistic hole with multiple layers for depth
    this.createRealisticHole(x, z);
    
    // Create flag
    this.createFlag(x, z);
  }

  private createRealisticHole(x: number, z: number) {
    const holeRadius = 0.54; // Standard golf hole radius (4.25 inches = ~0.54 units)
    const holeDepth = 0.4; // Reasonable hole depth
    
    // Create a clean, simple hole that looks professional
    
    // 1. Create the main hole opening - just a dark circle at ground level
    const holeOpeningGeometry = new THREE.CircleGeometry(holeRadius, 32);
    const holeOpeningMaterial = new THREE.MeshLambertMaterial({ 
      color: 0x0a0a0a 
    });
    const holeOpening = new THREE.Mesh(holeOpeningGeometry, holeOpeningMaterial);
    holeOpening.rotation.x = -Math.PI / 2;
    holeOpening.position.set(x, 0.24, z); // Just below ground level
    holeOpening.receiveShadow = true;
    this.scene.add(holeOpening);

    // 2. Create hole rim at ground level - simple and clean
    const rimGeometry = new THREE.TorusGeometry(holeRadius + 0.01, 0.01, 8, 32);
    const rimMaterial = new THREE.MeshLambertMaterial({ 
      color: 0x444444
    });
    const rim = new THREE.Mesh(rimGeometry, rimMaterial);
    rim.position.set(x, 0.25, z); // Exactly at ground level
    rim.castShadow = true;
    rim.receiveShadow = true;
    this.scene.add(rim);

    // 3. Create subtle grass wear around hole
    const wearGeometry = new THREE.RingGeometry(holeRadius + 0.01, holeRadius + 0.15, 32);
    const wearMaterial = new THREE.MeshLambertMaterial({ 
      color: 0x5a9c4a, // Slightly darker green
      transparent: true,
      opacity: 0.4
    });
    const wear = new THREE.Mesh(wearGeometry, wearMaterial);
    wear.rotation.x = -Math.PI / 2;
    wear.position.set(x, 0.251, z); // Slightly above ground
    wear.receiveShadow = true;
    this.scene.add(wear);

    // Physics setup - Create a more accurate collision detection
    this.createHolePhysics(x, z, holeRadius, holeDepth);
  }

  private createHolePhysics(x: number, z: number, radius: number, depth: number) {
    // Main hole trigger zone - slightly larger than visual hole
    const holeShape = new CANNON.Cylinder(radius + 0.1, radius + 0.1, depth, 16);
    this.holeBody = new CANNON.Body({ mass: 0, isTrigger: true });
    this.holeBody.addShape(holeShape);
    this.holeBody.position.set(x, -depth * 0.5, z);
    this.world.addBody(this.holeBody);

    // Create invisible collision walls around the hole rim for more realistic ball interaction
    const rimSegments = 16;
    for (let i = 0; i < rimSegments; i++) {
      const angle = (i / rimSegments) * Math.PI * 2;
      const rimX = x + Math.cos(angle) * (radius + 0.03);
      const rimZ = z + Math.sin(angle) * (radius + 0.03);
      
      const rimCollisionShape = new CANNON.Box(new CANNON.Vec3(0.02, 0.02, 0.02));
      const rimCollisionBody = new CANNON.Body({ mass: 0 });
      rimCollisionBody.material = new CANNON.Material('rim');
      rimCollisionBody.addShape(rimCollisionShape);
      rimCollisionBody.position.set(rimX, 0.02, rimZ);
      this.world.addBody(rimCollisionBody);

      // Add contact material for rim interaction
      const ballRimContact = new CANNON.ContactMaterial(
        new CANNON.Material('ball'),
        new CANNON.Material('rim'),
        {
          friction: 0.3,
          restitution: 0.4,
          frictionEquationStiffness: 1e7,
          frictionEquationRelaxation: 3
        }
      );
      this.world.addContactMaterial(ballRimContact);
    }
  }

  private createFlag(x: number, z: number) {
    this.flag = new THREE.Group();

    // Flag pole (taller and thicker)
    const poleGeometry = new THREE.CylinderGeometry(0.03, 0.03, 3.5, 8);
    const poleMaterial = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
    const pole = new THREE.Mesh(poleGeometry, poleMaterial);
    pole.position.set(0, 1.75, 0);
    this.flag.add(pole);

    // Flag (bigger and bright red)
    const flagGeometry = new THREE.PlaneGeometry(0.8, 0.6);
    const flagMaterial = new THREE.MeshLambertMaterial({ 
      color: 0xFF2222,
      side: THREE.DoubleSide 
    });
    const flagMesh = new THREE.Mesh(flagGeometry, flagMaterial);
    flagMesh.position.set(0.4, 3.2, 0);
    this.flag.add(flagMesh);

    // Position flag next to hole
    this.flag.position.set(x + 1.2, 0.25, z);
    this.scene.add(this.flag);

    // Animate flag
    this.animateFlag(flagMesh);
  }

  private animateFlag(flagMesh: THREE.Mesh) {
    const animate = () => {
      const time = Date.now() * 0.002;
      flagMesh.rotation.y = Math.sin(time) * 0.1;
      flagMesh.position.x = 0.2 + Math.sin(time * 1.5) * 0.02;
      requestAnimationFrame(animate);
    };
    animate();
  }

  private createWall(x: number, y: number, z: number, width: number, height: number, depth: number, color: number = 0xF4A460) {
    // Visual wall - semi-transparent for better ball visibility
    // Extend wall height slightly below ground to merge with floor
    const extendedHeight = height + 0.5; // Add 0.5 units to go into ground
    const wallGeometry = new THREE.BoxGeometry(width, extendedHeight, depth);
    const wallMaterial = new THREE.MeshLambertMaterial({ 
      color: color,
      transparent: true,
      opacity: 0.7 // 70% opacity, 30% transparent
    });
    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
    // Position wall so it extends into the ground to merge with floor
    wall.position.set(x, y - 0.25, z); // Lower by 0.25 to merge with ground
    wall.castShadow = true;
    wall.receiveShadow = true;
    this.scene.add(wall);
    this.walls.push(wall);

    // Physics wall with bouncy material - ensure it's properly positioned
    const wallShape = new CANNON.Box(new CANNON.Vec3(width/2, height/2, depth/2));
    const wallBody = new CANNON.Body({ mass: 0 });
    wallBody.material = new CANNON.Material('wall');
    wallBody.addShape(wallShape);
    wallBody.position.set(x, y, z); // Keep physics at original position
    // Make sure walls are solid and can't be passed through
    wallBody.type = CANNON.Body.KINEMATIC;
    this.world.addBody(wallBody);
    this.wallBodies.push(wallBody);
  }
  // Oriented wall helper matching yaw (Y) and pitch (X)
  private createRotatedWall(x: number, y: number, z: number, width: number, height: number, depth: number, yaw: number, pitch: number, color: number = 0xD2B48C) {
    // Extend wall height to merge with floor
    const extendedHeight = height + 0.5; // Add 0.5 units to go into ground
    const wallGeometry = new THREE.BoxGeometry(width, extendedHeight, depth);
    const wallMaterial = new THREE.MeshLambertMaterial({ 
      color,
      transparent: true,
      opacity: 0.7 // 70% opacity, 30% transparent
    });
    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
    wall.position.set(x, y - 0.25, z); // Lower by 0.25 to merge with ground
    wall.rotation.set(pitch, yaw, 0, 'XYZ');
    wall.castShadow = true;
    wall.receiveShadow = true;
    this.scene.add(wall);
    this.walls.push(wall);

    const wallShape = new CANNON.Box(new CANNON.Vec3(width/2, height/2, depth/2));
    const wallBody = new CANNON.Body({ mass: 0 });
    wallBody.material = new CANNON.Material('wall');
    wallBody.addShape(wallShape);
    wallBody.position.set(x, y, z); // Keep physics at original position
    wallBody.quaternion.setFromEuler(pitch, yaw, 0, 'XYZ');
    wallBody.type = CANNON.Body.KINEMATIC;
    this.world.addBody(wallBody);
    this.wallBodies.push(wallBody);
  }

  private setupBall() {
    // Visual ball
    const ballGeometry = new THREE.SphereGeometry(0.3, 16, 16);
    const ballMaterial = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
    this.ball = new THREE.Mesh(ballGeometry, ballMaterial);
    this.ball.castShadow = true;
    this.ball.position.copy(this.ballStartPos);
    this.scene.add(this.ball);

    // Physics ball
    const ballShape = new CANNON.Sphere(0.3);
    this.ballBody = new CANNON.Body({ mass: 1 });
    this.ballBody.material = new CANNON.Material('ball');
    this.ballBody.addShape(ballShape);
    this.ballBody.position.set(this.ballStartPos.x, this.ballStartPos.y, this.ballStartPos.z);
    this.ballBody.linearDamping = 0.5;
    this.ballBody.angularDamping = 0.5;
    this.world.addBody(this.ballBody);
  }

  private setupControls() {
    // Orbital controls would go here if using OrbitControls
    // For now, we'll implement basic mouse controls
  }

  private setupEventListeners() {
    // Mouse events for aiming and camera
    this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
    this.canvas.addEventListener('wheel', this.onMouseWheel.bind(this));
    
    // Window resize
    window.addEventListener('resize', this.onWindowResize.bind(this));
    
    // Prevent context menu
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private onMouseDown(event: MouseEvent) {
    const rect = this.canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    if (event.button === 0) { // Left click - aiming
      // Only allow aiming if ball is relatively stationary
      if (this.ballBody.velocity.length() < 0.5) {
        this.isAiming = true;
        this.aimStart.set(x, y);
        this.aimCurrent.copy(this.aimStart);
      }
    } else if (event.button === 2) { // Right click - camera panning
      this.isPanning = true;
      this.panStart.set(event.clientX, event.clientY);
    }
  }

  private onMouseMove(event: MouseEvent) {
    if (this.isAiming) {
      const rect = this.canvas.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      
      this.aimCurrent.set(x, y);
      this.updateAimingUI();
    } else if (this.isPanning && event.buttons === 2) {
      const deltaX = event.clientX - this.panStart.x;
      
      // Only allow horizontal rotation in first-person
      this.cameraAngleY -= deltaX * 0.01;
      
      this.updateFirstPersonCamera();
      
      this.panStart.set(event.clientX, event.clientY);
    }
  }

  private onMouseUp(event: MouseEvent) {
    if (event.button === 0 && this.isAiming) {
      this.shoot();
      this.isAiming = false;
      this.hideAimingUI();
    } else if (event.button === 2) {
      this.isPanning = false;
    }
  }

  private onMouseWheel(event: WheelEvent) {
    event.preventDefault();
    // Adjust first-person distance for zooming in/out
    this.firstPersonDistance = Math.max(1.5, Math.min(8, this.firstPersonDistance + event.deltaY * 0.005));
    this.updateFirstPersonCamera();
  }

  private updateAimingUI() {
    const power = this.aimStart.distanceTo(this.aimCurrent) * 70;
    const clampedPower = Math.min(power, 70);
    
    // Update power meter
    const powerMeter = document.getElementById('power-meter');
    if (powerMeter) {
      powerMeter.style.height = `${(clampedPower / 70) * 100}%`;
    }

    // Update aiming line
    this.updateAimingLine();
  }

  private updateAimingLine() {
    if (this.aimingLine) {
      this.scene.remove(this.aimingLine);
    }

    const aimVector = this.aimCurrent.clone().sub(this.aimStart);
    const aimDistance = aimVector.length();
    
    if (aimDistance > 0.05) {
      // Calculate shot direction in world space
      const direction = new THREE.Vector3(
        -(aimVector.x),
        0,
        aimVector.y
      );
      
      // Transform direction based on camera angle
      const cameraDirection = new THREE.Vector3();
      this.camera.getWorldDirection(cameraDirection);
      cameraDirection.y = 0;
      cameraDirection.normalize();
      
      const rightVector = new THREE.Vector3();
      rightVector.crossVectors(cameraDirection, new THREE.Vector3(0, 1, 0));
      
      const worldDirection = new THREE.Vector3();
      worldDirection.addScaledVector(rightVector, direction.x);
      worldDirection.addScaledVector(cameraDirection, -direction.z);
      worldDirection.normalize();

      // Create dotted trail with varying sizes - more realistic trajectory
      const points = [];
      const ballPos = this.ball.position.clone();
      const power = Math.min(aimDistance * 35 * 1.5, 35);
      const trailLength = Math.min(power * 1.5, 25);
      
      // Create multiple segments for dotted effect
      const segments = 15;
      const dotsPerSegment = 3;
      
      for (let segment = 0; segment < segments; segment++) {
        for (let dot = 0; dot < dotsPerSegment; dot++) {
          const t = (segment * dotsPerSegment + dot) / (segments * dotsPerSegment);
          const distance = t * trailLength;
          
          // Add gravity simulation to the trajectory
          const timeOfFlight = distance / (power * 3);
          const gravityEffect = 0.5 * 9.82 * timeOfFlight * timeOfFlight;
          
          const point = ballPos.clone().add(worldDirection.clone().multiplyScalar(distance));
          point.y = ballPos.y - gravityEffect * 0.1; // Subtle gravity arc
          points.push(point);
          
          // Add slight gap between dots
          if (dot < dotsPerSegment - 1) {
            const gapPoint = point.clone();
            points.push(gapPoint);
          }
        }
      }

      // Create geometry with variable point sizes
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({ 
        color: 0xff6666,
        transparent: true,
        opacity: 0.9,
        linewidth: 4
      });
      
      this.aimingLine = new THREE.Line(geometry, material);
      this.scene.add(this.aimingLine);

      // Add glowing dots along the path for better visibility
      this.createAimingDots(points);
    }
  }

  private createAimingDots(points: THREE.Vector3[]) {
    // Remove existing dots
    const existingDots = this.scene.children.filter(child => child.userData.isAimingDot);
    existingDots.forEach(dot => this.scene.remove(dot));

    // Create glowing dots every few points
    for (let i = 0; i < points.length; i += 6) {
      const dotGeometry = new THREE.SphereGeometry(0.08, 8, 8);
      const dotMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xff3333,
        transparent: true,
        opacity: 0.8
      });
      
      const dot = new THREE.Mesh(dotGeometry, dotMaterial);
      dot.position.copy(points[i]);
      dot.userData.isAimingDot = true;
      this.scene.add(dot);
    }
  }

  private hideAimingUI() {
    const powerMeter = document.getElementById('power-meter');
    if (powerMeter) {
      powerMeter.style.height = '0%';
    }

    // Remove aiming line
    if (this.aimingLine) {
      this.scene.remove(this.aimingLine);
      this.aimingLine = null;
    }

    // Remove aiming dots
    const existingDots = this.scene.children.filter(child => child.userData.isAimingDot);
    existingDots.forEach(dot => this.scene.remove(dot));
  }

  private shoot() {
    const aimVector = this.aimCurrent.clone().sub(this.aimStart);
    const aimDistance = aimVector.length();
    
    if (aimDistance > 0.05) { // Minimum drag distance
      // Calculate power based on drag distance
      const maxPower = 35; // Much higher maximum shot power
      const power = Math.min(aimDistance * maxPower * 1.5, maxPower);
      
      // Get ball position in screen space
      const ballScreenPos = new THREE.Vector3();
      ballScreenPos.copy(this.ball.position);
      ballScreenPos.project(this.camera);
      
      // Calculate shot direction in world space
      const direction = new THREE.Vector3(
        -(aimVector.x), // Invert X for intuitive aiming
        0,
        aimVector.y // Use Y component for Z direction
      );
      
      // Transform direction based on camera angle
      const cameraDirection = new THREE.Vector3();
      this.camera.getWorldDirection(cameraDirection);
      cameraDirection.y = 0;
      cameraDirection.normalize();
      
      const rightVector = new THREE.Vector3();
      rightVector.crossVectors(cameraDirection, new THREE.Vector3(0, 1, 0));
      
      const worldDirection = new THREE.Vector3();
      worldDirection.addScaledVector(rightVector, direction.x);
      worldDirection.addScaledVector(cameraDirection, -direction.z);
      worldDirection.normalize();
      
      // Apply impulse to ball
      const impulse = worldDirection.multiplyScalar(power);
      this.ballBody.applyImpulse(new CANNON.Vec3(impulse.x, 0, impulse.z));
      
      this.strokes++;
      this.updateScore();
      
      console.log(`Shot fired! Power: ${power.toFixed(2)}, Direction:`, worldDirection);
    }
  }

  private updateScore() {
    const scoreElement = document.querySelector('.text-sm.text-gray-600');
    if (scoreElement) {
      scoreElement.innerHTML = `Par 3 • Strokes: <span class="font-semibold">${this.strokes}</span>`;
    }
  }

  private onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  public resetBall() {
    this.ballBody.position.set(this.ballStartPos.x, this.ballStartPos.y, this.ballStartPos.z);
    this.ballBody.velocity.set(0, 0, 0);
    this.ballBody.angularVelocity.set(0, 0, 0);
    this.ball.position.copy(this.ballStartPos);
    this.ball.visible = true;
    this.ball.scale.set(1, 1, 1); // Reset ball scale
    (this.ball.material as THREE.MeshLambertMaterial).opacity = 1;
    (this.ball.material as THREE.MeshLambertMaterial).transparent = false;
    this.ballInHole = false;
    this.holeCompletedTriggered = false;
    this.strokes = 0;
    this.updateScore();
  }

  public getCurrentLevel() {
    return this.currentLevel;
  }

  public getStrokes() {
    return this.strokes;
  }

  public toggleMute() {
    this.isMuted = !this.isMuted;
    // Audio toggle logic would go here
  }

  public start() {
    this.animate();
  }

  private animate() {
    requestAnimationFrame(() => this.animate());
    
    const deltaTime = this.clock.getDelta();
    
    // Clamp deltaTime to prevent physics instability
    const clampedDeltaTime = Math.min(deltaTime, 1/30); // Max 30fps minimum
    
    // Update physics with fixed timestep for stability
    this.world.step(clampedDeltaTime);
    
    // Validate ball physics body
    if (!this.ballBody || isNaN(this.ballBody.position.x) || isNaN(this.ballBody.position.y) || isNaN(this.ballBody.position.z)) {
      console.log('Ball physics body corrupted! Resetting...');
      this.resetBall();
      return;
    }
    
    // Update ball visual position
    this.ball.position.copy(this.ballBody.position as any);
    this.ball.quaternion.copy(this.ballBody.quaternion as any);
    
    // Safety check for physics instability - reset if ball falls too far below ground
    const ballPosition = this.ballBody.position;
    const currentLevel = this.currentLevel;
    
    if (ballPosition.y < -10 && !this.ballInHole) {
      console.log(`Ball fell through floor! Position: x=${ballPosition.x.toFixed(2)}, y=${ballPosition.y.toFixed(2)}, z=${ballPosition.z.toFixed(2)}, Level: ${currentLevel}`);
      this.resetBall();
      return;
    }
    
    // Additional monitoring for suspicious Y positions in Level 3
    if (currentLevel === 3 && ballPosition.y < -2 && !this.ballInHole) {
      console.log(`Warning: Ball Y position is ${ballPosition.y.toFixed(2)} in Level 3`);
    }
    
    // Check for ball out of bounds and reset if needed
    let outOfBounds = false;
    
    if (currentLevel === 1) {
      // Level 1 boundaries
      if (ballPosition.x > 10.5 || ballPosition.x < -10.5 || ballPosition.z > 15.5 || ballPosition.z < -15.5 || ballPosition.y < -5) {
        outOfBounds = true;
      }
    } else if (currentLevel === 2) {
      // Level 2 circular boundaries
      const distanceFromCenter = Math.sqrt(ballPosition.x * ballPosition.x + ballPosition.z * ballPosition.z);
      if (distanceFromCenter > 19 || ballPosition.y < -5) {
        outOfBounds = true;
      }
    } else if (currentLevel === 3) {
      // Level 3 boundaries - larger area
      if (ballPosition.x > 15.5 || ballPosition.x < -15.5 || ballPosition.z > 20.5 || ballPosition.z < -20.5 || ballPosition.y < -5) {
        outOfBounds = true;
      }
    }
    
    if (outOfBounds && !this.ballInHole) {
      console.log('Ball went out of bounds! Resetting...');
      this.resetBall();
      return;
    }

    // Enhanced hole collision detection with realistic physics
    if (!this.ballInHole) {
      const holePos = this.holeBody.position;
      const distanceToHole = Math.sqrt(
        Math.pow(ballPosition.x - holePos.x, 2) + 
        Math.pow(ballPosition.z - holePos.z, 2)
      );
      const ballY = ballPosition.y;
      const ballSpeed = this.ballBody.velocity.length();
      const holeRadius = 0.54;
      
      // Create realistic hole entry conditions
      const isNearHole = distanceToHole < holeRadius + 0.1;
      const isAtGroundLevel = ballY <= 0.35 && ballY > -0.05;
      const isSlowEnough = ballSpeed < 8; // Prevent fast balls from jumping over
      
      // Ball enters hole with more realistic conditions
      if (isNearHole && isAtGroundLevel && distanceToHole < holeRadius) {
        this.ballInHole = true;
        console.log(`Ball entered hole! Distance: ${distanceToHole.toFixed(2)}, Speed: ${ballSpeed.toFixed(2)}`);
        
        // Add satisfying hole entry effects
        this.createHoleEntryEffects(ballPosition.x, ballPosition.z);
        
        // Trigger completion immediately when ball enters hole
        this.onHoleCompleted();
        
        // More realistic hole entry physics
        this.ballBody.velocity.x *= 0.05;
        this.ballBody.velocity.z *= 0.05;
        this.ballBody.velocity.y = Math.min(this.ballBody.velocity.y, -2); // Ensure downward motion
        this.ballBody.angularVelocity.scale(0.1);
      }
      // Ball approaches hole - create attraction effect for realism
      else if (isNearHole && isAtGroundLevel && distanceToHole < holeRadius + 0.2 && ballSpeed < 3) {
        // Subtle attraction force toward hole center (like real golf)
        const attractionStrength = 0.8 * (1 - distanceToHole / (holeRadius + 0.2));
        const directionX = (holePos.x - ballPosition.x) / distanceToHole;
        const directionZ = (holePos.z - ballPosition.z) / distanceToHole;
        
        this.ballBody.applyForce(
          new CANNON.Vec3(
            directionX * attractionStrength,
            0,
            directionZ * attractionStrength
          )
        );
      }
      // Ball hits rim - realistic rim interaction
      else if (distanceToHole > holeRadius - 0.05 && distanceToHole < holeRadius + 0.08 && isAtGroundLevel) {
        // Ball hits the rim - add slight upward bounce and deflection
        const rimNormalX = (ballPosition.x - holePos.x) / distanceToHole;
        const rimNormalZ = (ballPosition.z - holePos.z) / distanceToHole;
        
        // Add rim bounce effect
        this.ballBody.velocity.x += rimNormalX * 0.5;
        this.ballBody.velocity.z += rimNormalZ * 0.5;
        this.ballBody.velocity.y += 0.3; // Small upward bounce
        
        // Create rim hit effect
        this.createRimHitEffect(ballPosition.x, ballPosition.z);
      }
    }

    // Enhanced physics-based hole falling animation
    if (this.ballInHole) {
      const ballPos = this.ballBody.position;
      const holePos = this.holeBody.position;
      const ballY = ballPos.y;
      
      // Calculate distance to hole center in XZ plane
      const distanceToHoleCenter = Math.sqrt(
        Math.pow(ballPos.x - holePos.x, 2) + 
        Math.pow(ballPos.z - holePos.z, 2)
      );
      
      // More realistic hole falling physics
      if (ballY > -0.8) {
        // Spiral effect as ball falls into hole
        const spiralForce = 0.5 * (1 - ballY / -0.8);
        const spiralAngle = Date.now() * 0.01;
        const spiralX = Math.cos(spiralAngle) * spiralForce * 0.3;
        const spiralZ = Math.sin(spiralAngle) * spiralForce * 0.3;
        
        // Horizontal pull toward hole center with spiral
        if (distanceToHoleCenter > 0.03) {
          const pullForceX = ((holePos.x - ballPos.x) * 12) + spiralX;
          const pullForceZ = ((holePos.z - ballPos.z) * 12) + spiralZ;
          this.ballBody.applyForce(new CANNON.Vec3(pullForceX, 0, pullForceZ));
        }
        
        // Gradual downward acceleration (more realistic than instant)
        const depthFactor = Math.abs(ballY) / 0.8;
        const downwardForce = -25 * (1 + depthFactor * 2);
        this.ballBody.applyForce(new CANNON.Vec3(0, downwardForce, 0));
        
        // Gradual friction increase as ball goes deeper
        const frictionFactor = 0.96 - (depthFactor * 0.1);
        this.ballBody.velocity.x *= frictionFactor;
        this.ballBody.velocity.z *= frictionFactor;
        this.ballBody.angularVelocity.scale(0.92 - depthFactor * 0.05);
        
        // Add subtle bouncing against hole walls
        if (distanceToHoleCenter > 0.45) {
          const wallNormalX = (ballPos.x - holePos.x) / distanceToHoleCenter;
          const wallNormalZ = (ballPos.z - holePos.z) / distanceToHoleCenter;
          this.ballBody.velocity.x -= wallNormalX * 0.2;
          this.ballBody.velocity.z -= wallNormalZ * 0.2;
        }
      }
      
      // Enhanced visual effects during fall
      if (ballY < -0.1 && ballY > -0.7) {
        // Create occasional dust particles as ball scrapes the hole sides
        if (Math.random() < 0.1) {
          this.createHoleFallParticles(ballPos.x, ballY, ballPos.z);
        }
      }
      
      // Smooth ball visibility transition
      if (ballY < -0.6) {
        this.ball.visible = false;
      } else if (ballY < -0.1) {
        // Smooth fade based on depth
        const fadeStart = -0.1;
        const fadeEnd = -0.6;
        const fadeProgress = (ballY - fadeStart) / (fadeEnd - fadeStart);
        const opacity = Math.max(0, Math.min(1, fadeProgress));
        
        (this.ball.material as THREE.MeshLambertMaterial).opacity = opacity;
        (this.ball.material as THREE.MeshLambertMaterial).transparent = true;
        
        // Slightly shrink ball as it disappears for depth effect
        const scale = 0.7 + (opacity * 0.3);
        this.ball.scale.set(scale, scale, scale);
      }
    }
    
    // Update first-person camera to follow ball
    this.updateFirstPersonCamera();
    
    this.renderer.render(this.scene, this.camera);
  }

  private holeCompletedTriggered = false;

  private onHoleCompleted() {
    // Only trigger completion once
    if (this.onLevelComplete && this.ballInHole && !this.holeCompletedTriggered) {
      this.holeCompletedTriggered = true;
      console.log(`Level ${this.currentLevel} completed with ${this.strokes} strokes!`);
      // Immediate congratulations when ball falls in
      this.onLevelComplete!(this.currentLevel, this.strokes);
    }
  }

  private updateFirstPersonCamera() {
    // Get ball position
    const ballPos = this.ball ? this.ball.position : this.ballStartPos;
    
    // Calculate camera position behind the ball
    const cameraOffset = new THREE.Vector3(
      -Math.sin(this.cameraAngleY) * this.firstPersonDistance,
      this.firstPersonHeight,
      -Math.cos(this.cameraAngleY) * this.firstPersonDistance
    );
    
    const cameraPos = ballPos.clone().add(cameraOffset);
    
    // Smooth camera movement
    this.smoothCameraTarget.lerp(ballPos, 0.05);
    
    // Position camera
    this.camera.position.copy(cameraPos);
    
    // Look slightly ahead of the ball toward the goal direction
    const lookAtTarget = ballPos.clone().add(
      this.goalDirection.clone().multiplyScalar(2)
    );
    lookAtTarget.y = ballPos.y + 0.2; // Look slightly up to see the ball and hole
    
    this.camera.lookAt(lookAtTarget);
  }

  private updateCameraForLevel() {
    const preset = this.getFirstPersonPreset(this.currentLevel);
    this.firstPersonDistance = preset.distance;
    this.firstPersonHeight = preset.height;
    if (this.camera) {
      this.camera.fov = preset.fov;
      this.camera.updateProjectionMatrix();
    }
    this.updateFirstPersonCamera();
  }

  private createHoleEntryEffects(x: number, z: number) {
    // Create satisfying particle effect when ball enters hole
    const particleCount = 8;
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const distance = 0.3 + Math.random() * 0.2;
      const particleX = x + Math.cos(angle) * distance;
      const particleZ = z + Math.sin(angle) * distance;
      
      // Create small grass particles
      const particleGeometry = new THREE.SphereGeometry(0.02 + Math.random() * 0.01, 4, 4);
      const particleMaterial = new THREE.MeshLambertMaterial({ 
        color: 0x4a8c3a,
        transparent: true,
        opacity: 0.8
      });
      const particle = new THREE.Mesh(particleGeometry, particleMaterial);
      particle.position.set(particleX, 0.1, particleZ);
      this.scene.add(particle);
      
      // Animate particle upward and fade out
      const animateParticle = () => {
        particle.position.y += 0.02;
        particle.material.opacity -= 0.02;
        particle.rotation.x += 0.1;
        particle.rotation.z += 0.1;
        
        if (particle.material.opacity > 0) {
          requestAnimationFrame(animateParticle);
        } else {
          this.scene.remove(particle);
        }
      };
      
      // Start animation with slight delay
      setTimeout(() => animateParticle(), i * 50);
    }

    // Create satisfying "plop" ring effect
    const ringGeometry = new THREE.RingGeometry(0.1, 0.4, 16);
    const ringMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xffffff,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.position.set(x, 0.02, z);
    ring.rotation.x = -Math.PI / 2;
    this.scene.add(ring);
    
    // Animate ring expansion and fade
    const animateRing = () => {
      ring.scale.x += 0.1;
      ring.scale.y += 0.1;
      ring.material.opacity -= 0.05;
      
      if (ring.material.opacity > 0) {
        requestAnimationFrame(animateRing);
      } else {
        this.scene.remove(ring);
      }
    };
    animateRing();
  }

  private createRimHitEffect(x: number, z: number) {
    // Create small spark effect when ball hits rim
    const sparkCount = 4;
    for (let i = 0; i < sparkCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 0.1 + Math.random() * 0.1;
      const sparkX = x + Math.cos(angle) * distance;
      const sparkZ = z + Math.sin(angle) * distance;
      
      const sparkGeometry = new THREE.SphereGeometry(0.01, 4, 4);
      const sparkMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffaa00,
        transparent: true,
        opacity: 1
      });
      const spark = new THREE.Mesh(sparkGeometry, sparkMaterial);
      spark.position.set(sparkX, 0.05, sparkZ);
      this.scene.add(spark);
      
      // Animate spark
      const animateSpark = () => {
        spark.position.y += 0.01;
        spark.material.opacity -= 0.05;
        spark.scale.multiplyScalar(0.95);
        
        if (spark.material.opacity > 0) {
          requestAnimationFrame(animateSpark);
        } else {
          this.scene.remove(spark);
        }
      };
      animateSpark();
    }
  }

  private createHoleFallParticles(x: number, y: number, z: number) {
    // Create small dust particles as ball scrapes hole sides
    const particleCount = 2;
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 0.3 + Math.random() * 0.2;
      const particleX = x + Math.cos(angle) * distance;
      const particleZ = z + Math.sin(angle) * distance;
      
      const dustGeometry = new THREE.SphereGeometry(0.005 + Math.random() * 0.005, 3, 3);
      const dustMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x8B4513, // Brown dust color
        transparent: true,
        opacity: 0.6
      });
      const dust = new THREE.Mesh(dustGeometry, dustMaterial);
      dust.position.set(particleX, y + 0.05, particleZ);
      this.scene.add(dust);
      
      // Animate dust particle
      const velocity = {
        x: (Math.random() - 0.5) * 0.02,
        y: 0.005 + Math.random() * 0.01,
        z: (Math.random() - 0.5) * 0.02
      };
      
      const animateDust = () => {
        dust.position.x += velocity.x;
        dust.position.y += velocity.y;
        dust.position.z += velocity.z;
        velocity.y -= 0.0005; // Gravity
        dust.material.opacity -= 0.02;
        
        if (dust.material.opacity > 0) {
          requestAnimationFrame(animateDust);
        } else {
          this.scene.remove(dust);
        }
      };
      animateDust();
    }
  }

  public dispose() {
    this.renderer.dispose();
    // Clean up other resources
  }
}
