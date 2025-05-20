// Wait for the DOM to be fully loaded before initializing Cesium
document.addEventListener('DOMContentLoaded', function() {
    // Set your Cesium ion access token
    Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI0MWQ1MjNlZC1iZDk0LTRlNjUtYTI5MC03OTM0NTZhMjY3ZjQiLCJpZCI6MzAyOTE0LCJpYXQiOjE3NDczNTk2MDJ9.1AFzcOQepepQvuu69poz-NFd_tgIb6k9cxnGl1Wp5qY';
    
    // Initialize the Cesium Viewer
    const viewer = new Cesium.Viewer('cesiumContainer', {
        baseLayerPicker: false,
        timeline: false,
        animation: false,
        vrButton: false,
        fullscreenButton: true,
        homeButton: true,
        navigationHelpButton: false,
        geocoder: false,
        sceneModePicker: false,
        requestRenderMode: false,
        terrainProvider: Cesium.createWorldTerrain()
    });
    
    // Adding a static 3D Tileset layer
    async function addBuildingLayer() {
        try {
            const tileset = await Cesium.Cesium3DTileset.fromUrl(
                'https://data.map.gov.hk/api/3d-data/3dtiles/f2/tileset.json?key=3967f8f365694e0798af3e7678509421'
            );
            viewer.scene.primitives.add(tileset);
            
            // Wait for the tileset to fully load
            return new Promise(resolve => {
                tileset.readyPromise.then(() => {
                    // Get the bounding sphere of the tileset
                    const boundingSphere = tileset.boundingSphere;
                    const center = boundingSphere.center;
                    const cartographic = Cesium.Cartographic.fromCartesian(center);
                    
                    // Get the longitude and latitude of the center
                    const longitude = Cesium.Math.toDegrees(cartographic.longitude);
                    const latitude = Cesium.Math.toDegrees(cartographic.latitude);
                    
                    // Create a rectangle that covers the area of interest                  
                    const west = 113.8;    // Western boundary of Hong Kong
					const south = 22.15;   // Southern boundary of Hong Kong
					const east = 114.45;    // Eastern boundary of Hong Kong
					const north = 22.6;    // Northern boundary of Hong Kong
										
                    // Sample the terrain height at the center of the tileset
                    sampleTerrainHeight(longitude, latitude).then(terrainHeight => {
                        resolve({
                            tileset: tileset,
                            center: center,
                            longitude: longitude,
                            latitude: latitude,
                            terrainHeight: terrainHeight,
                            rectangle: {
                                west: west,
                                south: south,
                                east: east,
                                north: north
                            }
                        });
                    });
                }).catch(error => {
                    console.error("Error loading tileset:", error);
                    resolve(null);
                });
            });
        } catch (error) {
            console.error("Error creating tileset:", error);
            return null;
        }
    }
    
    // Sample the terrain height at a given longitude and latitude
    async function sampleTerrainHeight(longitude, latitude) {
        try {
            // Create a cartographic position
            const position = Cesium.Cartographic.fromDegrees(longitude, latitude);
            
            // Sample the terrain height
            const terrainSamplePositions = [position];
            const updatedPositions = await Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, terrainSamplePositions);
            
            // Return the sampled height
            return updatedPositions[0].height;
        } catch (error) {
            console.error("Error sampling terrain height:", error);
            return 0; // Default to 0 if there's an error
        }
    }
    
    // Create the sea level polygon with terrain clamping
    function createSeaLevelPolygon(tilesetInfo, seaLevelHeight) {
        // Remove previous sea level entity
        if (viewer.entities.getById('seaLevelEntity')) {
            viewer.entities.removeById('seaLevelEntity');
        }
        
        // Create a rectangle that covers the area
        const rect = tilesetInfo.rectangle;
        
        // Create the sea level polygon
        return viewer.entities.add({
            id: 'seaLevelEntity',
            name: 'Sea Level',
            polygon: {
                hierarchy: Cesium.Cartesian3.fromDegreesArray([
                    rect.west, rect.south,
                    rect.east, rect.south,
                    rect.east, rect.north,
                    rect.west, rect.north
                ]),
                material: Cesium.Color.LIGHTBLUE.withAlpha(0.6),
                outline: true,
                outlineColor: Cesium.Color.WHITE.withAlpha(0.8),
                arcType: Cesium.ArcType.RHUMB,
                // Set the base at 0 (sea level)
                height: 0,
                // Set the top at the specified sea level height
                extrudedHeight: seaLevelHeight,
                perPositionHeight: false,
                classificationType: Cesium.ClassificationType.TERRAIN
            }
        });
    }
    
    // Initialize the application
    async function initialize() {
        try {
            // Define the home view position and orientation
            const homeViewPosition = Cesium.Cartesian3.fromDegrees(
                114.09086884578214,
                22.044338206507053,
                35339.14068737606
            );
            
            const homeViewOrientation = {
                heading: 6.280194717481077,
                pitch: -0.7921019105734031,
                roll: 6.283182074536001
            };
            
            // Override the default home button behavior
            viewer.homeButton.viewModel.command.beforeExecute.addEventListener(function(commandInfo) {
                // Cancel the default behavior
                commandInfo.cancel = true;
                
                // Fly to our custom home position
                viewer.camera.flyTo({
                    destination: homeViewPosition,
                    orientation: homeViewOrientation,
                    duration: 1.5
                });
            });
            
            const tilesetInfo = await addBuildingLayer(); // Get the tileset info with terrain height
            
            if (!tilesetInfo) {
                console.error("Failed to load tileset information");
                return;
            }
            
            // Set initial sea level to 0 (sea level)
            const initialSeaLevel = 0;
            
            // Make sure the slider element exists
            const slider = document.getElementById("seaLevel");
            if (!slider) {
                console.error("Slider element not found. Make sure you have an element with id 'seaLevel' in your HTML.");
                return;
            }
            
            // Set up the slider to control sea level
            slider.value = 0; // Start at 0 (sea level)
            slider.min = 0; // Minimum is 0 meters (sea level)
            slider.max = 20; // Set a reasonable maximum (100m above sea level)
            slider.step = 0.1; // For finer control
            
            // Create initial sea level at 0 (sea level)
            createSeaLevelPolygon(tilesetInfo, initialSeaLevel);
            
            // Make sure the seaLevelValue element exists
            const seaLevelValueElement = document.getElementById("seaLevelValue");
            if (seaLevelValueElement) {
                seaLevelValueElement.textContent = "0.0 m";
            } else {
                console.error("Sea level value element not found. Make sure you have an element with id 'seaLevelValue' in your HTML.");
            }
            
            // Fly to the specific location (initial view)
            viewer.camera.flyTo({
                destination: homeViewPosition,
                orientation: homeViewOrientation,
                duration: 0
            });
            
            // Set up the sea level slider event handler
            slider.addEventListener("input", (event) => {
                const seaLevel = parseFloat(event.target.value);
                
                if (seaLevelValueElement) {
                    seaLevelValueElement.textContent = seaLevel.toFixed(1) + " m";
                }
                
                // Update sea level using the slider value directly
                createSeaLevelPolygon(tilesetInfo, seaLevel);
            });
            
            // Add debug info to help verify alignment
            console.log("Terrain height:", tilesetInfo.terrainHeight);
            console.log("Initial sea level (at 0):", initialSeaLevel);
        } catch (error) {
            console.error("Error initializing application:", error);
        }
    }
    
    // Start the application
    initialize();
});
