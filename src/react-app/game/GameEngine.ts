import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { CatmullRomCurve3 } from 'three';

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
  private ballStartPos = new THREE.Vector3(0, 0.5, 8); // Lower start position
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
        return { distance: 3.8, height: 1.5, fov: 72 }; // Was Level 3 (bumpy terrain)
      case 3:
        return { distance: 4.0, height: 1.6, fov: 74 }; // Was Level 4 (curved slide)
      case 4:
        return { distance: 3.2, height: 1.3, fov: 68 }; // New multi-tier level
      case 5:
        return { distance: 3.8, height: 1.5, fov: 72 }; // Was Level 2 (circular course)
      default:
        return { distance: 3.5, height: 1.4, fov: 70 };
    }
  }

  // Course elements
  private walls: THREE.Mesh[] = [];
  private wallBodies: CANNON.Body[] = [];
  private holeBody!: CANNON.Body;
  private flag!: THREE.Group;
  private trees: THREE.Group[] = []; // Array to store background trees
  private holePosition = new THREE.Vector3(0, 0, -12); // Default hole position
  private currentLevel = 1;
  private onLevelComplete?: (level: number, strokes: number) => void;
  
  // Moving blocks for Level 4
  private movingBlocks: { mesh: THREE.Mesh; body: CANNON.Body; startPos: THREE.Vector3; direction: THREE.Vector3; speed: number; range: number; }[] = [];
  private movingBlockMaterial!: CANNON.Material;

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
    const bouncyWallMaterial = new CANNON.Material('bouncyWall'); // Super bouncy walls for Level 3
    this.movingBlockMaterial = new CANNON.Material('movingBlock'); // Moving blocks for Level 4
    
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
    
    // Super bouncy walls for Level 3 - even more bouncy!
    const ballBouncyWallContact = new CANNON.ContactMaterial(
      ballMaterial,
      bouncyWallMaterial,
      {
        friction: 0.1, // Low friction for more sliding
        restitution: 1.2, // Super bouncy - more than 100% energy return!
        frictionEquationStiffness: 1e10,
        frictionEquationRelaxation: 3,
        contactEquationStiffness: 1e10,
        contactEquationRelaxation: 3
      }
    );
    
    // Wooden barriers for Level 4 - increased push/bounce force
    const ballMovingBlockContact = new CANNON.ContactMaterial(
      ballMaterial,
      this.movingBlockMaterial,
      {
        friction: 0.3, // Slightly less friction for more sliding
        restitution: 1.2, // Much stronger bounce - pushes ball back harder
        frictionEquationStiffness: 1e10,
        frictionEquationRelaxation: 2, // Faster response
        contactEquationStiffness: 1e10,
        contactEquationRelaxation: 2
      }
    );
    
    this.world.addContactMaterial(ballGroundContact);
    this.world.addContactMaterial(ballWallContact);
    this.world.addContactMaterial(ballBouncyWallContact);
    this.world.addContactMaterial(ballMovingBlockContact);
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
    // Set ball start positions for each level - properly positioned on ground surface
    switch (this.currentLevel) {
      case 1:
        this.ballStartPos = new THREE.Vector3(0, 0.3, 8); // Ball radius above ground surface
        this.setupLevel1();
        break;
      case 2:
        this.ballStartPos = new THREE.Vector3(0, 0.3, 12); // Ball radius above ground surface (was Level 3)
        this.setupLevel2();
        break;
      case 3:
        this.setupLevel3(); // Level 3 sets its own ball position (was Level 4)
        break;
      case 4:
        this.setupLevel4(); // Level 4 stays the same
        break;
      case 5:
        this.ballStartPos = new THREE.Vector3(0, 0.3, 15); // Ball radius above ground surface (was Level 2)
        this.setupLevel5();
        break;
    }
    // Create background trees for the current level
    this.createBackgroundTrees(this.currentLevel);
    // Calculate goal direction for first-person camera
    this.calculateGoalDirection();
    // Apply first-person camera after level geometry
    this.updateFirstPersonCamera();
  }

  private setupLevel1() {
    // Ground - thinner so ball sits on top with enhanced grass material
    const groundGeometry = new THREE.BoxGeometry(20, 0.1, 30);
    const groundMaterial = new THREE.MeshLambertMaterial({ 
      color: 0x4CAF50, // More vibrant grass green
      transparent: false
    });
    this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    // Ground physics - much thinner
    const groundShape = new CANNON.Box(new CANNON.Vec3(10, 0.05, 15));
    const groundBody = new CANNON.Body({ mass: 0 });
    groundBody.material = new CANNON.Material('ground');
    groundBody.addShape(groundShape);
    groundBody.position.set(0, -0.05, 0); // Just below surface
    this.world.addBody(groundBody);

    // Course boundaries - moderate height walls
    this.createWall(0, 1, 15.75, 20.5, 2, 1, 0xD2B48C); // Back wall
    this.createWall(0, 1, -15.75, 20.5, 2, 1, 0xD2B48C); // Front wall
    this.createWall(10.75, 1, 0, 1, 2, 31, 0xD2B48C); // Right wall
    this.createWall(-10.75, 1, 0, 1, 2, 31, 0xD2B48C); // Left wall

    // Level 1 obstacles - Simple 3-block layout (transparent)
    // Clean design: 1 center block, 2 side blocks
    
    // Left side block
    this.createWall(-5, 0.75, 2, 3, 1.5, 4, 0xE9806E); // Left obstacle
    
    // Right side block  
    this.createWall(5, 0.75, -2, 3, 1.5, 4, 0xA2C7E5); // Right obstacle
    
    // Center block
    this.createWall(0, 0.75, -6, 4, 1.5, 3, 0xF5B82E); // Center obstacle

    this.createHole(0, -12);
  }

  private setupLevel5() {
    // Circular ground - thinner (advanced level - was Level 2)
    const radius = 18;
    const groundGeometry = new THREE.CylinderGeometry(radius, radius, 0.1, 32);
    const groundMaterial = new THREE.MeshLambertMaterial({ 
      color: 0x4CAF50, // More vibrant grass green
      transparent: false
    });
    this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    // Ground physics - circular, much thinner
    const groundShape = new CANNON.Cylinder(radius, radius, 0.1, 16);
    const groundBody = new CANNON.Body({ mass: 0 });
    groundBody.material = new CANNON.Material('ground');
    groundBody.addShape(groundShape);
    groundBody.position.set(0, -0.05, 0); // Just below surface
    this.world.addBody(groundBody);

    // Circular boundary wall
    this.createCircularWall(0, 1, 0, radius + 1, 2, 0xD2B48C);

    // Level 5 obstacles - challenging circular course navigation
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

  private setupLevel2() {
    // Larger ground for level 2 - thinner (bumpy terrain - was Level 3)
    const groundGeometry = new THREE.BoxGeometry(30, 0.1, 40);
    const groundMaterial = new THREE.MeshLambertMaterial({ 
      color: 0x4CAF50, // More vibrant grass green
      transparent: false
    });
    this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    // Ground physics - much thinner
    const groundShape = new CANNON.Box(new CANNON.Vec3(15, 0.05, 20));
    const groundBody = new CANNON.Body({ mass: 0 });
    groundBody.material = new CANNON.Material('ground');
    groundBody.addShape(groundShape);
    groundBody.position.set(0, -0.05, 0); // Just below surface
    this.world.addBody(groundBody);

    // Course boundaries
    this.createWall(0, 1, 20.5, 31, 2, 1, 0xD2B48C); // Back wall
    this.createWall(0, 1, -20.5, 31, 2, 1, 0xD2B48C); // Front wall
    this.createWall(15.5, 1, 0, 1, 2, 41, 0xD2B48C); // Right wall
    this.createWall(-15.5, 1, 0, 1, 2, 41, 0xD2B48C); // Left wall

    // Create random bumps on the ground
    this.createRandomBumps();

    this.createHole(0, -18);
  }

  private setupLevel3() {
    // Multi-layer jumping course - disconnected platforms at different heights
    const platformMaterial = new THREE.MeshLambertMaterial({ color: 0x87CEEB }); // Sky blue platforms
    const platformSize = 8;
    const platformThickness = 1.0; // Thicker platforms to prevent pass-through
    
    // Layer 1 (Top) - Starting platform
    const layer1Height = 8;
    const layer1Platform = new THREE.BoxGeometry(platformSize, platformThickness, platformSize);
    const layer1Mesh = new THREE.Mesh(layer1Platform, platformMaterial);
    layer1Mesh.position.set(0, layer1Height, 0);
    layer1Mesh.castShadow = true;
    layer1Mesh.receiveShadow = true;
    this.scene.add(layer1Mesh);
    
    // Layer 1 physics
    const layer1Shape = new CANNON.Box(new CANNON.Vec3(platformSize / 2, platformThickness / 2, platformSize / 2));
    const layer1Body = new CANNON.Body({ mass: 0 });
    layer1Body.material = new CANNON.Material('ground');
    layer1Body.addShape(layer1Shape);
    layer1Body.position.set(0, layer1Height, 0);
    this.world.addBody(layer1Body);
    
    // Layer 2 (Middle) - Disconnected from layer 1
    const layer2Height = 6; // Raised higher to make more challenging
    const layer2X = 12; // Offset to the right
    const layer2Z = -8; // Offset backward
    const layer2Platform = new THREE.BoxGeometry(platformSize, platformThickness, platformSize);
    const layer2Mesh = new THREE.Mesh(layer2Platform, platformMaterial);
    layer2Mesh.position.set(layer2X, layer2Height, layer2Z);
    layer2Mesh.castShadow = true;
    layer2Mesh.receiveShadow = true;
    this.scene.add(layer2Mesh);
    
    // Layer 2 physics
    const layer2Shape = new CANNON.Box(new CANNON.Vec3(platformSize / 2, platformThickness / 2, platformSize / 2));
    const layer2Body = new CANNON.Body({ mass: 0 });
    layer2Body.material = new CANNON.Material('ground');
    layer2Body.addShape(layer2Shape);
    layer2Body.position.set(layer2X, layer2Height, layer2Z);
    this.world.addBody(layer2Body);
    
    // Layer 3 (Bottom) - Final platform with hole - Disconnected from layer 2
    const layer3Height = 1;
    const layer3X = -10; // Offset to the left
    const layer3Z = 10; // Offset forward
    const layer3Platform = new THREE.BoxGeometry(platformSize + 2, platformThickness, platformSize + 2);
    const finalPlatformMaterial = new THREE.MeshLambertMaterial({ color: 0x6fbf73 }); // Green for final platform
    const layer3Mesh = new THREE.Mesh(layer3Platform, finalPlatformMaterial);
    layer3Mesh.position.set(layer3X, layer3Height, layer3Z);
    layer3Mesh.castShadow = true;
    layer3Mesh.receiveShadow = true;
    this.scene.add(layer3Mesh);
    
    // Layer 3 physics
    const layer3Shape = new CANNON.Box(new CANNON.Vec3((platformSize + 2) / 2, platformThickness / 2, (platformSize + 2) / 2));
    const layer3Body = new CANNON.Body({ mass: 0 });
    layer3Body.material = new CANNON.Material('ground');
    layer3Body.addShape(layer3Shape);
    layer3Body.position.set(layer3X, layer3Height, layer3Z);
    this.world.addBody(layer3Body);
    
    // Add some smaller intermediate jumping platforms for extra challenge
    // Small platform 1 - between layer 1 and 2
    const smallPlatform1 = new THREE.BoxGeometry(4, platformThickness, 4);
    const smallPlatform1Material = new THREE.MeshLambertMaterial({ color: 0xFFD700 }); // Gold
    const small1Mesh = new THREE.Mesh(smallPlatform1, smallPlatform1Material);
    small1Mesh.position.set(6, 7, -4); // Adjusted height for new layer 2 height
    small1Mesh.castShadow = true;
    small1Mesh.receiveShadow = true;
    this.scene.add(small1Mesh);
    
    // Small platform 1 physics
    const small1Shape = new CANNON.Box(new CANNON.Vec3(2, platformThickness / 2, 2));
    const small1Body = new CANNON.Body({ mass: 0 });
    small1Body.material = new CANNON.Material('ground');
    small1Body.addShape(small1Shape);
    small1Body.position.set(6, 7, -4);
    this.world.addBody(small1Body);
    
    // Small platform 2 - between layer 2 and 3
    const smallPlatform2 = new THREE.BoxGeometry(4, platformThickness, 4);
    const small2Mesh = new THREE.Mesh(smallPlatform2, smallPlatform1Material);
    small2Mesh.position.set(2, 3.5, 2); // Adjusted height between layer 2 (6) and layer 3 (1)
    small2Mesh.castShadow = true;
    small2Mesh.receiveShadow = true;
    this.scene.add(small2Mesh);
    
    // Small platform 2 physics
    const small2Shape = new CANNON.Box(new CANNON.Vec3(2, platformThickness / 2, 2));
    const small2Body = new CANNON.Body({ mass: 0 });
    small2Body.material = new CANNON.Material('ground');
    small2Body.addShape(small2Shape);
    small2Body.position.set(2, 3.5, 2);
    this.world.addBody(small2Body);
    
    // Main ground platform at the very bottom for safety
    const groundGeom = new THREE.BoxGeometry(50, 0.5, 50);
    const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 }); // Brown ground
    this.ground = new THREE.Mesh(groundGeom, groundMaterial);
    this.ground.position.set(0, -2, 0);
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);
    
    // Ground physics
    const groundShape = new CANNON.Box(new CANNON.Vec3(25, 0.25, 25));
    const groundBody = new CANNON.Body({ mass: 0 });
    groundBody.material = new CANNON.Material('ground');
    groundBody.addShape(groundShape);
    groundBody.position.set(0, -2, 0);
    this.world.addBody(groundBody);
    
    // Ball starting position - securely on layer 1 (top platform)
    this.ballStartPos = new THREE.Vector3(0, layer1Height + platformThickness/2 + 0.3, 0);
    
    // Hole on the final platform (layer 3)
    this.createHole(layer3X, layer3Z);
  }

  private setupLevel4() {
    // Simple ground level with moving blocks only
    this.ballStartPos = new THREE.Vector3(0, 0.3, 10);
    
    // Ground - main platform
    const groundGeometry = new THREE.BoxGeometry(25, 0.1, 35);
    const groundMaterial = new THREE.MeshLambertMaterial({ 
      color: 0x4CAF50, // More vibrant grass green
      transparent: false
    });
    this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    // Ground physics
    const groundShape = new CANNON.Box(new CANNON.Vec3(12.5, 0.05, 17.5));
    const groundBody = new CANNON.Body({ mass: 0 });
    groundBody.material = new CANNON.Material('ground');
    groundBody.addShape(groundShape);
    groundBody.position.set(0, -0.05, 0);
    this.world.addBody(groundBody);

    // Course boundaries
    this.createWall(0, 1, 17.75, 25.5, 2, 1, 0xD2B48C); // Back wall
    this.createWall(0, 1, -17.75, 25.5, 2, 1, 0xD2B48C); // Front wall
    this.createWall(12.75, 1, 0, 1, 2, 36, 0xD2B48C); // Right wall
    this.createWall(-12.75, 1, 0, 1, 2, 36, 0xD2B48C); // Left wall
    
    // Add strategic wooden barriers that move in fixed paths
    // These barriers create timing challenges without blocking the hole directly
    
    // Barrier 1: Horizontal gate in middle section - blocks main path
    this.createWoodenBarrier(0, 0.4, 2, 6, 0.8, 1, new THREE.Vector3(1, 0, 0), 2.2, 10); // Much faster, constrained to course width
    
    // Barrier 2: Left side patrol - covers left approach
    this.createWoodenBarrier(-8, 0.4, -2, 4, 0.8, 1.5, new THREE.Vector3(1, 0, 0), 2.5, 6); // Faster, stays within left side
    
    // Barrier 3: Right side patrol - covers right approach
    this.createWoodenBarrier(8, 0.4, -6, 4, 0.8, 1.5, new THREE.Vector3(1, 0, 0), 2.3, 6); // Faster, stays within right side

    this.createHole(0, -14);
  }

  private createElevatedPlatform(x: number, y: number, z: number, width: number, height: number, depth: number, color: number) {
    // Visual platform
    const platformGeometry = new THREE.BoxGeometry(width, height, depth);
    const platformMaterial = new THREE.MeshLambertMaterial({ 
      color: color,
      transparent: true,
      opacity: 0.8
    });
    const platform = new THREE.Mesh(platformGeometry, platformMaterial);
    platform.position.set(x, y, z);
    platform.castShadow = true;
    platform.receiveShadow = true;
    this.scene.add(platform);
    this.walls.push(platform);

    // Physics platform
    const platformShape = new CANNON.Box(new CANNON.Vec3(width/2, height/2, depth/2));
    const platformBody = new CANNON.Body({ mass: 0 });
    platformBody.material = new CANNON.Material('ground');
    platformBody.addShape(platformShape);
    platformBody.position.set(x, y, z);
    platformBody.type = CANNON.Body.KINEMATIC;
    this.world.addBody(platformBody);
    this.wallBodies.push(platformBody);
  }

  private createRamp(x: number, y: number, z: number, width: number, height: number, depth: number, color: number) {
    // Visual ramp
    const rampGeometry = new THREE.BoxGeometry(width, height, depth);
    const rampMaterial = new THREE.MeshLambertMaterial({ 
      color: color,
      transparent: true,
      opacity: 0.7
    });
    const ramp = new THREE.Mesh(rampGeometry, rampMaterial);
    ramp.position.set(x, y, z);
    ramp.rotation.x = -Math.PI / 8; // 22.5 degree slope
    ramp.castShadow = true;
    ramp.receiveShadow = true;
    this.scene.add(ramp);
    this.walls.push(ramp);

    // Physics ramp
    const rampShape = new CANNON.Box(new CANNON.Vec3(width/2, height/2, depth/2));
    const rampBody = new CANNON.Body({ mass: 0 });
    rampBody.material = new CANNON.Material('ground');
    rampBody.addShape(rampShape);
    rampBody.position.set(x, y, z);
    rampBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 8);
    rampBody.type = CANNON.Body.KINEMATIC;
    this.world.addBody(rampBody);
    this.wallBodies.push(rampBody);
  }

  private createSlideBoundaryWall(xOffset: number, wallHeight: number, wallThickness: number, slideLength: number, slideHeight: number, slideAngle: number, material: THREE.MeshLambertMaterial, side: string) {
    // Create boundary wall segments that follow the slide slope
    const segments = 10;
    const segmentLength = slideLength / segments;
    
    for (let i = 0; i < segments; i++) {
      const progress = i / segments;
      const zPos = slideLength/2 - progress * slideLength - segmentLength/2;
      const yPos = slideHeight * (1 - progress) + wallHeight/2;
      
      // Create wall segment
      const wallGeom = new THREE.BoxGeometry(wallThickness, wallHeight, segmentLength);
      const wall = new THREE.Mesh(wallGeom, material);
      wall.position.set(xOffset, yPos, zPos);
      wall.castShadow = true;
      wall.receiveShadow = true;
      this.scene.add(wall);
      
      // Create physics for wall segment
      const wallShape = new CANNON.Box(new CANNON.Vec3(wallThickness/2, wallHeight/2, segmentLength/2));
      const wallBody = new CANNON.Body({ mass: 0 });
      wallBody.material = new CANNON.Material('wall');
      wallBody.addShape(wallShape);
      wallBody.position.set(xOffset, yPos, zPos);
      this.world.addBody(wallBody);
    }
  }

  private createHorizontalSlideBoundaryWall(xCenter: number, zOffset: number, wallHeight: number, wallThickness: number, slideLength: number, slideHeight: number, slideAngle: number, material: THREE.MeshLambertMaterial, side: string) {
    // Create boundary wall segments for horizontal slide
    const segments = 10;
    const segmentLength = slideLength / segments;
    
    for (let i = 0; i < segments; i++) {
      const progress = i / segments;
      const xPos = progress * slideLength - slideLength/2 + segmentLength/2;
      const yPos = -slideHeight * progress + wallHeight/2;
      
      // Create wall segment
      const wallGeom = new THREE.BoxGeometry(segmentLength, wallHeight, wallThickness);
      const wall = new THREE.Mesh(wallGeom, material);
      wall.position.set(xCenter + xPos, yPos, zOffset);
      wall.castShadow = true;
      wall.receiveShadow = true;
      this.scene.add(wall);
      
      // Create physics for wall segment
      const wallShape = new CANNON.Box(new CANNON.Vec3(segmentLength/2, wallHeight/2, wallThickness/2));
      const wallBody = new CANNON.Body({ mass: 0 });
      wallBody.material = new CANNON.Material('wall');
      wallBody.addShape(wallShape);
      wallBody.position.set(xCenter + xPos, yPos, zOffset);
      this.world.addBody(wallBody);
    }
  }

  private createWoodenBarrier(x: number, y: number, z: number, width: number, height: number, depth: number, direction: THREE.Vector3, speed: number, range: number) {
    // Create realistic wooden barrier with proper wood texture and appearance
    const barrierGeometry = new THREE.BoxGeometry(width, height, depth);
    
    // Wooden material with realistic brown wood color and subtle texture
    const woodMaterial = new THREE.MeshLambertMaterial({ 
      color: 0x8B4513, // Saddle brown - natural wood color
      transparent: false,
      opacity: 1.0
    });
    
    const barrier = new THREE.Mesh(barrierGeometry, woodMaterial);
    barrier.position.set(x, y, z);
    barrier.castShadow = true;
    barrier.receiveShadow = true;
    this.scene.add(barrier);
    this.walls.push(barrier);
    
    // Add wood grain effect with darker edges
    const edgeGeometry = new THREE.BoxGeometry(width * 1.02, height * 1.02, depth * 1.02);
    const edgeMaterial = new THREE.MeshLambertMaterial({ 
      color: 0x654321, // Darker brown for wood edges
      transparent: true,
      opacity: 0.3
    });
    const edge = new THREE.Mesh(edgeGeometry, edgeMaterial);
    edge.position.set(x, y, z);
    edge.castShadow = true;
    this.scene.add(edge);
    this.walls.push(edge);

    // Physics barrier - solid and bouncy like real wood
    const barrierShape = new CANNON.Box(new CANNON.Vec3(width/2, height/2, depth/2));
    const barrierBody = new CANNON.Body({ mass: 0 }); // Kinematic body
    barrierBody.material = this.movingBlockMaterial;
    barrierBody.addShape(barrierShape);
    barrierBody.position.set(x, y, z);
    barrierBody.type = CANNON.Body.KINEMATIC;
    this.world.addBody(barrierBody);
    this.wallBodies.push(barrierBody);

    // Store barrier data for fixed-path animation
    this.movingBlocks.push({
      mesh: barrier,
      body: barrierBody,
      startPos: new THREE.Vector3(x, y, z),
      direction: direction.clone().normalize(),
      speed: speed,
      range: range
    });
  }

  private updateMovingBlocks(deltaTime: number) {
    const time = Date.now() * 0.001; // Convert to seconds for smoother animation
    
    this.movingBlocks.forEach((block, index) => {
      // Create strategic fixed-path movement that blocks the hole
      // Each barrier has a different timing to create windows of opportunity
      const phase = time * block.speed + (index * Math.PI / 3); // Staggered timing for strategic gaps
      
      // Use sine wave for smooth back-and-forth movement
      const offset = Math.sin(phase) * block.range;
      
      // Calculate new position along the fixed path
      const newPos = block.startPos.clone().add(
        block.direction.clone().multiplyScalar(offset)
      );
      
      // Update visual mesh position
      block.mesh.position.copy(newPos);
      
      // Update physics body position
      block.body.position.set(newPos.x, newPos.y, newPos.z);
      
      // No rotation for wooden barriers - keep them stable and realistic
      // Wooden barriers should look solid and predictable
    });
  }

  private createRandomBumps() {
    // Create rectangular bumps that span the full width of the course, arranged sequentially
    const bumpColor = 0x8B4513; // Brown color for better visibility
    const courseWidth = 28; // Full width of the course
    const bumpHeight = 0.35; // Lower height - easier to cross but still visible
    const bumpDepth = 2.0; // Longer depth for proper ramp sections
    
    // Create 6 rectangular bumps arranged one after another
    const positions = [8, 4, 0, -4, -8, -12]; // Z positions moving toward the hole
    
    for (let i = 0; i < positions.length; i++) {
      this.createRectangularBump(0, bumpHeight/2, positions[i], courseWidth, bumpHeight, bumpDepth, bumpColor);
    }
  }

  private createRectangularBump(x: number, y: number, z: number, width: number, height: number, depth: number, color: number) {
    // Create a proper ramp with 3 sections: up slope, flat top, down slope
    const slopeAngle = Math.PI / 12; // 15 degrees - gentle slope
    const sectionDepth = depth / 3;
    
    // Up slope - lower to ground
    const upSlopeGeom = new THREE.BoxGeometry(width, height, sectionDepth);
    const upSlope = new THREE.Mesh(upSlopeGeom, new THREE.MeshLambertMaterial({ color: color }));
    upSlope.position.set(x, height/4, z - sectionDepth); // Lower
    upSlope.rotation.x = -slopeAngle;
    upSlope.castShadow = true;
    upSlope.receiveShadow = true;
    this.scene.add(upSlope);
    
    // Flat top - lower peak
    const topGeom = new THREE.BoxGeometry(width, height/2, sectionDepth);
    const top = new THREE.Mesh(topGeom, new THREE.MeshLambertMaterial({ color: color }));
    top.position.set(x, height/3, z); // Lower peak
    top.castShadow = true;
    top.receiveShadow = true;
    this.scene.add(top);
    
    // Down slope - lower to ground
    const downSlopeGeom = new THREE.BoxGeometry(width, height, sectionDepth);
    const downSlope = new THREE.Mesh(downSlopeGeom, new THREE.MeshLambertMaterial({ color: color }));
    downSlope.position.set(x, height/4, z + sectionDepth); // Lower
    downSlope.rotation.x = slopeAngle;
    downSlope.castShadow = true;
    downSlope.receiveShadow = true;
    this.scene.add(downSlope);

    // Physics bodies for each section
    // Up slope physics - lower
    const upSlopeShape = new CANNON.Box(new CANNON.Vec3(width/2, height/2, sectionDepth/2));
    const upSlopeBody = new CANNON.Body({ mass: 0 });
    upSlopeBody.material = new CANNON.Material('ground');
    upSlopeBody.addShape(upSlopeShape);
    upSlopeBody.position.set(x, height/4, z - sectionDepth); // Lower
    upSlopeBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -slopeAngle);
    this.world.addBody(upSlopeBody);
    
    // Top physics - lower
    const topShape = new CANNON.Box(new CANNON.Vec3(width/2, height/4, sectionDepth/2));
    const topBody = new CANNON.Body({ mass: 0 });
    topBody.material = new CANNON.Material('ground');
    topBody.addShape(topShape);
    topBody.position.set(x, height/3, z); // Lower peak
    this.world.addBody(topBody);
    
    // Down slope physics - lower
    const downSlopeShape = new CANNON.Box(new CANNON.Vec3(width/2, height/2, sectionDepth/2));
    const downSlopeBody = new CANNON.Body({ mass: 0 });
    downSlopeBody.material = new CANNON.Material('ground');
    downSlopeBody.addShape(downSlopeShape);
    downSlopeBody.position.set(x, height/4, z + sectionDepth); // Lower
    downSlopeBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), slopeAngle);
    this.world.addBody(downSlopeBody);
  }

  private createTree(x: number, z: number, scale: number = 1) {
    // Create a realistic tree for golf course background
    const tree = new THREE.Group();
    
    // Tree trunk - natural brown color
    const trunkHeight = 4 * scale;
    const trunkRadius = 0.3 * scale;
    const trunkGeometry = new THREE.CylinderGeometry(
      trunkRadius * 0.8, // Top radius (slightly narrower)
      trunkRadius,       // Bottom radius
      trunkHeight,       // Height
      8                  // Segments
    );
    const trunkMaterial = new THREE.MeshLambertMaterial({ 
      color: 0x8B4513 // Saddle brown - natural tree bark color
    });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.set(0, trunkHeight/2, 0);
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    tree.add(trunk);
    
    // Tree foliage - multiple spheres for natural look
    const foliageColors = [
      0x228B22, // Forest green
      0x32CD32, // Lime green  
      0x006400  // Dark green
    ];
    
    // Create multiple foliage clusters for a more natural, full appearance
    for (let i = 0; i < 4; i++) {
      const foliageRadius = (1.2 + Math.random() * 0.8) * scale;
      const foliageGeometry = new THREE.SphereGeometry(foliageRadius, 12, 8);
      const foliageColor = foliageColors[Math.floor(Math.random() * foliageColors.length)];
      const foliageMaterial = new THREE.MeshLambertMaterial({ 
        color: foliageColor,
        transparent: false
      });
      
      const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
      
      // Position foliage clusters at different heights and slight offsets
      const offsetX = (Math.random() - 0.5) * 0.8 * scale;
      const offsetZ = (Math.random() - 0.5) * 0.8 * scale;
      const foliageY = trunkHeight * (0.6 + i * 0.15) + Math.random() * 0.5;
      
      foliage.position.set(offsetX, foliageY, offsetZ);
      foliage.castShadow = true;
      foliage.receiveShadow = true;
      tree.add(foliage);
    }
    
    // Position the complete tree
    tree.position.set(x, 0, z);
    
    // Add slight rotation for natural variation
    tree.rotation.y = Math.random() * Math.PI * 2;
    
    // Add the tree to scene and our tracking array
    this.scene.add(tree);
    this.trees.push(tree);
    
    return tree;
  }

  private createBackgroundTrees(level: number) {
    // Clear existing trees first
    this.trees.forEach(tree => {
      this.scene.remove(tree);
    });
    this.trees = [];
    
    // Different tree arrangements for each level
    switch (level) {
      case 1:
        this.createTreesForLevel1();
        break;
      case 2:
        this.createTreesForLevel2();
        break;
      case 3:
        this.createTreesForLevel3();
        break;
      case 4:
        this.createTreesForLevel4();
        break;
      case 5:
        this.createTreesForLevel5();
        break;
    }
  }

  private createTreesForLevel1() {
    // Level 1: Rectangular course (20x30 units), place trees around perimeter
    const courseWidth = 20;
    const courseDepth = 30;
    const treeDistance = 3; // Distance from course boundary
    
    // Trees along the back (positive Z) - increased spacing from 4 to 7
    for (let x = -courseWidth/2 - treeDistance; x <= courseWidth/2 + treeDistance; x += 7) {
      this.createTree(x, courseDepth/2 + treeDistance, 0.8 + Math.random() * 0.4);
    }
    
    // Trees along the front (negative Z) - increased spacing from 4 to 7
    for (let x = -courseWidth/2 - treeDistance; x <= courseWidth/2 + treeDistance; x += 7) {
      this.createTree(x, -courseDepth/2 - treeDistance, 0.8 + Math.random() * 0.4);
    }
    
    // Trees along the sides - increased spacing from 4 to 8
    for (let z = -courseDepth/2; z <= courseDepth/2; z += 8) {
      // Left side
      this.createTree(-courseWidth/2 - treeDistance, z, 0.8 + Math.random() * 0.4);
      // Right side  
      this.createTree(courseWidth/2 + treeDistance, z, 0.8 + Math.random() * 0.4);
    }
    
    // Add some scattered trees further back for depth - reduced count from 8 to 5
    for (let i = 0; i < 5; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 18 + Math.random() * 8;
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;
      this.createTree(x, z, 0.6 + Math.random() * 0.8);
    }
  }

  private createTreesForLevel2() {
    // Level 2: Larger course (30x40), bumpy terrain
    const courseWidth = 30;
    const courseDepth = 40;
    const treeDistance = 4;
    
    // Tree line around perimeter - increased spacing from 3.5 to 6
    for (let x = -courseWidth/2 - treeDistance; x <= courseWidth/2 + treeDistance; x += 6) {
      this.createTree(x, courseDepth/2 + treeDistance, 0.9 + Math.random() * 0.6);
      this.createTree(x, -courseDepth/2 - treeDistance, 0.9 + Math.random() * 0.6);
    }
    
    for (let z = -courseDepth/2; z <= courseDepth/2; z += 6) {
      this.createTree(-courseWidth/2 - treeDistance, z, 0.9 + Math.random() * 0.6);
      this.createTree(courseWidth/2 + treeDistance, z, 0.9 + Math.random() * 0.6);
    }
    
    // Scattered background trees - reduced count from 12 to 8
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 25 + Math.random() * 12;
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;
      this.createTree(x, z, 0.7 + Math.random() * 0.8);
    }
  }

  private createTreesForLevel3() {
    // Level 3: Multi-layer platforms - place trees around the large ground area
    const groundSize = 50;
    const treeDistance = 5;
    
    // Create a forest around the platform area - increased spacing from 4 to 8
    for (let x = -groundSize/2 - treeDistance; x <= groundSize/2 + treeDistance; x += 8) {
      for (let z = -groundSize/2 - treeDistance; z <= groundSize/2 + treeDistance; z += 8) {
        // Skip the center area where the platforms are
        const distanceFromCenter = Math.sqrt(x*x + z*z);
        if (distanceFromCenter > 20) {
          // Add some randomness to tree placement - reduced probability from 0.3 to 0.5
          if (Math.random() > 0.5) {
            this.createTree(
              x + (Math.random() - 0.5) * 3,
              z + (Math.random() - 0.5) * 3,
              0.8 + Math.random() * 0.7
            );
          }
        }
      }
    }
  }

  private createTreesForLevel4() {
    // Level 4: Ground level with moving blocks (25x35)
    const courseWidth = 25;
    const courseDepth = 35;
    const treeDistance = 3.5;
    
    // Perimeter trees - increased spacing from 3 to 6
    for (let x = -courseWidth/2 - treeDistance; x <= courseWidth/2 + treeDistance; x += 6) {
      this.createTree(x, courseDepth/2 + treeDistance, 0.8 + Math.random() * 0.5);
      this.createTree(x, -courseDepth/2 - treeDistance, 0.8 + Math.random() * 0.5);
    }
    
    for (let z = -courseDepth/2; z <= courseDepth/2; z += 7) {
      this.createTree(-courseWidth/2 - treeDistance, z, 0.8 + Math.random() * 0.5);
      this.createTree(courseWidth/2 + treeDistance, z, 0.8 + Math.random() * 0.5);
    }
    
    // Background forest - reduced count from 10 to 6
    for (let i = 0; i < 6; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 22 + Math.random() * 10;
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;
      this.createTree(x, z, 0.6 + Math.random() * 0.9);
    }
  }

  private createTreesForLevel5() {
    // Level 5: Circular course (radius 18)
    const courseRadius = 18;
    const treeDistance = 4;
    
    // Create concentric rings of trees around the circular course
    // Inner ring - increased spacing from 0.3 to 0.8
    const innerRadius = courseRadius + treeDistance;
    for (let angle = 0; angle < Math.PI * 2; angle += 0.8) {
      const x = Math.cos(angle) * innerRadius;
      const z = Math.sin(angle) * innerRadius;
      this.createTree(x, z, 0.8 + Math.random() * 0.4);
    }
    
    // Outer ring - increased spacing from 0.4 to 0.9
    const outerRadius = courseRadius + treeDistance * 2.5;
    for (let angle = 0; angle < Math.PI * 2; angle += 0.9) {
      const x = Math.cos(angle) * outerRadius;
      const z = Math.sin(angle) * outerRadius;
      this.createTree(x, z, 0.9 + Math.random() * 0.6);
    }
    
    // Very distant trees for depth - reduced count from 15 to 10
    for (let i = 0; i < 10; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 35 + Math.random() * 15;
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;
      this.createTree(x, z, 0.5 + Math.random() * 1.0);
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
      
      const rimCollisionShape = new CANNON.Box(new CANNON.Vec3(0.02, 0.005, 0.02)); // Much smaller height
      const rimCollisionBody = new CANNON.Body({ mass: 0 });
      rimCollisionBody.material = new CANNON.Material('rim');
      rimCollisionBody.addShape(rimCollisionShape);
      rimCollisionBody.position.set(rimX, 0.005, rimZ); // At ground level
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

    // Flag (simple triangular pennant like |> )
    const flagShape = new THREE.Shape();
    flagShape.moveTo(0, 0);     // Left side (top of triangle, attached to pole)
    flagShape.lineTo(0.8, 0.3); // Right point (tip of triangle)
    flagShape.lineTo(0, 0.6);   // Left side (bottom of triangle, attached to pole)
    flagShape.lineTo(0, 0);     // Back to start (complete triangle)
    
    const flagGeometry = new THREE.ShapeGeometry(flagShape);
    const flagMaterial = new THREE.MeshLambertMaterial({ 
      color: 0xFF2222,
      side: THREE.DoubleSide 
    });
    const flagMesh = new THREE.Mesh(flagGeometry, flagMaterial);
    flagMesh.position.set(0.0, 3.2, 0); // Position at top of pole (pole height 3.5, centered at 1.75, so top is at 3.5)
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
      flagMesh.rotation.y = Math.sin(time) * 0.1; // Gentle waving motion
      flagMesh.position.x = Math.sin(time * 1.5) * 0.02; // Very small movement, stays attached to pole
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
    // Use bouncy material for Level 4 walls, regular wall material for others
    wallBody.material = new CANNON.Material(this.currentLevel === 4 ? 'bouncyWall' : 'wall');
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
    
    // Update moving blocks animation (Level 4)
    if (this.currentLevel === 4) {
      this.updateMovingBlocks(clampedDeltaTime);
    }
    
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
    } else if (currentLevel === 4) {
      // Level 4 boundaries - multi-tier level
      if (ballPosition.x > 12.5 || ballPosition.x < -12.5 || ballPosition.z > 17.5 || ballPosition.z < -17.5 || ballPosition.y < -5) {
        outOfBounds = true;
      }
    } else if (currentLevel === 5) {
      // Level 5 circular boundaries (was Level 2)
      const distanceFromCenter = Math.sqrt(ballPosition.x * ballPosition.x + ballPosition.z * ballPosition.z);
      if (distanceFromCenter > 19 || ballPosition.y < -5) {
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
    
    // Clean up moving blocks
    this.movingBlocks.forEach(block => {
      this.scene.remove(block.mesh);
      this.world.removeBody(block.body);
    });
    this.movingBlocks = [];
    
    // Clean up trees
    this.trees.forEach(tree => {
      this.scene.remove(tree);
    });
    this.trees = [];
    
    // Clean up other resources
  }
}
