extends TileMap


@export var chunk_size := 16
@export var render_distance := 4

const WORLD_MIN := -5000
const WORLD_MAX := 5000

# Tile IDs  XXX
const TILE_FOREST = 0
const TILE_GRASS = 2
const TILE_HILL = 3
const TILE_LAKE = 4
const TILE_MOUNTAIN = 5
const TILE_RIVER = 6
const TILE_SNOW = 7
const TILE_SWAMP = 8
const TILE_WATER = 9
const TILE_WETLAND = 10
const FOG_TILE_ID = 1 # Add your fog tile ID here
const TILE_DESERT_SAND = 12
const DRY_GRASS = 13
const TILE_ROCKY_DESERT = 14
const TILE_SALT_FLATS = 15
const DEBUG_ALWAYS_SALT = true # Set to true to force salt everywhere for debugging
const TILE_DRY_RIVERBED = 16
const TILE_WALL = 11
const TILE_OASIS = 17
const TILE_SAVANA_TREE = 18
const TILE_SHRUB_LAND = 19
const FOG_EDGE_TILE_ID = 1 # Set this to your white fog tile ID in FogTileMap

var noise := FastNoiseLite.new()
var generated_chunks := {}
var active_chunks := {}
var feature_noise := FastNoiseLite.new()
var desert_mask_noise := FastNoiseLite.new()
var band_noise := FastNoiseLite.new() # For smooth biome banding
var placed_walls := {} # Key: Vector2i(tile_pos), Value: true
var modified_tiles := {} # Key: Vector2i(tile_pos), Value: tile_id
var chunk_river_exits := {} # Key: chunk_coords, Value: array of {pos, dir}
var global_river_tiles := {} # Key: Vector2i(tile_pos), Value: true

const MAX_FORK_DEPTH = 1 # Lowered for safety
var global_fork_count := 0
const MAX_GLOBAL_FORKS = 200

func _ready():
	if noise.seed == 0:
		noise.seed = randi()
	noise.frequency = 1.0  # Similar to period in OpenSimplexNoise
	noise.fractal_octaves = 10
	noise.fractal_lacunarity = 2.0
	noise.fractal_gain = 0.5

	feature_noise.seed = noise.seed + 12345 # Different seed for variety
	feature_noise.frequency = 0.04          # Lower frequency for bigger features
	desert_mask_noise.seed = noise.seed + 54321
	desert_mask_noise.frequency = 0.003 # Very low frequency for big regions

	band_noise.seed = noise.seed + 98765
	band_noise.frequency = 0.008 # Lower frequency for large, smooth bands
	# generate_global_rivers()  # Removed for non-wrapping world

# Remove wrap_x and wrap_chunk_x functions
# Remove all calls to wrap_x and wrap_chunk_x in generate_chunk, update_visible_chunks, and tile placement

# In generate_chunk, use x0 and chunk_coords.x directly
func generate_chunk(chunk_coords: Vector2i):
	print("Generating chunk at:", chunk_coords)
	var start_x = chunk_coords.x * chunk_size
	var start_y = chunk_coords.y * chunk_size

	# 1. Generate elevation map for the chunk
	var elevation_map = {}
	for x0 in range(start_x, start_x + chunk_size):
		for y in range(start_y, start_y + chunk_size):
			if y < WORLD_MIN or y > WORLD_MAX or x0 < WORLD_MIN or x0 > WORLD_MAX:
				continue
			var nx = float(x0) * 0.012
			var ny = float(y) * 0.012
			var e = noise.get_noise_2d(nx, ny) * 0.5 + 0.5
			elevation_map[Vector2i(x0, y)] = e

	# 2. Assign biome/tile based on elevation (as before)
	var tile_map = {}
	for pos in elevation_map.keys():
		var x = pos.x
		var y = pos.y
		var e = elevation_map[pos]
		var elevation = e * 4000
		var tile = TILE_GRASS

		# --- 1. Blended transition band  ---
		if (y > 500 and y <= 750): #250 
			var p = e
			var blend = float(y - 500) / 250.0 # 0 at y=500, 1 at y=750
			var blend_mask = feature_noise.get_noise_2d(float(x) * 1, float(y) * 1 + 12345) * 0.5 + 0.5

			# Tropical tile (use your tropical logic)
			var tropical_tile = TILE_GRASS
			if p <= 0.30:
				tropical_tile = TILE_FOREST
			elif p <= 0.375:
				tropical_tile = TILE_SWAMP
			elif p <= 0.425:
				tropical_tile = TILE_GRASS
			elif p <= 0.475:
				tropical_tile = TILE_WETLAND
			elif p <= 0.50:
				tropical_tile = TILE_GRASS
			elif p <= 0.675:
				tropical_tile = TILE_FOREST
			elif p <= 0.75:
				tropical_tile = TILE_HILL
			elif p <= 0.87:
				tropical_tile = TILE_HILL
			elif p <= 0.90:
				tropical_tile = TILE_FOREST
			elif p <= 0.938:
				tropical_tile = TILE_MOUNTAIN
			elif p <= 0.98:
				tropical_tile = TILE_FOREST
			else:
				tropical_tile = TILE_MOUNTAIN

			# New subtropical logic for transition band: only sand, mountain, salt
			var mask = desert_mask_noise.get_noise_2d(float(x), float(y)) * 0.5 + 0.5
			var subtropical_tile = TILE_DESERT_SAND
			if mask < 0.7:
				var f = feature_noise.get_noise_2d(float(x), float(y)) * 0.5 + 0.5
				if f < 0.50:
					subtropical_tile = TILE_DESERT_SAND
				elif f < 0.80:
					subtropical_tile = TILE_MOUNTAIN
				else:
					# Salt flats logic: only on sand, not surrounded by mountains, adjacent to sand
					var mountain_neighbors = 0
					var has_sand_neighbor = false
					for dx in range(-1, 2):
						for dy in range(-1, 2):
							if dx == 0 and dy == 0:
								continue
							var neighbor_tile = Vector2i(x + dx, y + dy)
							var neighbor_type = 0
							if has_method("get_cell_source_id"):
								neighbor_type = self.get_cell_source_id(0, neighbor_tile)
							if neighbor_type == TILE_MOUNTAIN:
								mountain_neighbors += 1
							elif neighbor_type == TILE_DESERT_SAND:
								has_sand_neighbor = true
					if has_sand_neighbor and mountain_neighbors < 8 and subtropical_tile == TILE_DESERT_SAND:
						subtropical_tile = TILE_SALT_FLATS
					else:
						subtropical_tile = TILE_DESERT_SAND
			else:
				subtropical_tile = TILE_MOUNTAIN
			tile = subtropical_tile if blend_mask < blend else tropical_tile
		# --- 2. Blended transition band ---
		elif (y >= -750 and y < -500): #250
			var p = e
			var blend = float(y + 750) / 250.0 # 0 at y=-750, 1 at y=-500
			var blend_mask = feature_noise.get_noise_2d(float(x) * 1, float(y) * 1 + 12345) * 0.5 + 0.5
			# Tropical tile (use your tropical logic)
			var tropical_tile = TILE_GRASS
			if p <= 0.30:
				tropical_tile = TILE_FOREST
			elif p <= 0.375:
				tropical_tile = TILE_SWAMP
			elif p <= 0.425:
				tropical_tile = TILE_GRASS
			elif p <= 0.475:
				tropical_tile = TILE_WETLAND
			elif p <= 0.50:
				tropical_tile = TILE_GRASS
			elif p <= 0.675:
				tropical_tile = TILE_FOREST
			elif p <= 0.75:
				tropical_tile = TILE_HILL
			elif p <= 0.87:
				tropical_tile = TILE_HILL
			elif p <= 0.90:
				tropical_tile = TILE_FOREST
			elif p <= 0.938:
				tropical_tile = TILE_MOUNTAIN
			elif p <= 0.98:
				tropical_tile = TILE_FOREST
			else:
				tropical_tile = TILE_MOUNTAIN

			# New subtropical logic for transition band: only sand, mountain, salt
			var mask = desert_mask_noise.get_noise_2d(float(x), float(y)) * 0.5 + 0.5
			var subtropical_tile = TILE_DESERT_SAND
			if mask < 0.7:
				var f = feature_noise.get_noise_2d(float(x), float(y)) * 0.5 + 0.5
				if f < 0.50:
					subtropical_tile = TILE_DESERT_SAND
				elif f < 0.80:
					subtropical_tile = TILE_MOUNTAIN
				else:
					# Salt flats logic: only on sand, not surrounded by mountains, adjacent to sand
					var mountain_neighbors = 0
					var has_sand_neighbor = false
					for dx in range(-1, 2):
						for dy in range(-1, 2):
							if dx == 0 and dy == 0:
								continue
							var neighbor_tile = Vector2i(x + dx, y + dy)
							var neighbor_type = 0
							if has_method("get_cell_source_id"):
								neighbor_type = self.get_cell_source_id(0, neighbor_tile)
							if neighbor_type == TILE_MOUNTAIN:
								mountain_neighbors += 1
							elif neighbor_type == TILE_DESERT_SAND:
								has_sand_neighbor = true
					if has_sand_neighbor and mountain_neighbors < 8 and subtropical_tile == TILE_DESERT_SAND:
						subtropical_tile = TILE_SALT_FLATS
					else:
						subtropical_tile = TILE_DESERT_SAND
			else:
				subtropical_tile = TILE_MOUNTAIN
			tile = tropical_tile if blend_mask < blend else subtropical_tile
		# --- 3. Main tropical biome --- #500 tiny
		elif y >= -500 and y <= 500:
			var p = e
			if p <= 0.30:
				tile = TILE_FOREST
			elif p <= 0.375:
				tile = TILE_SWAMP
			elif p <= 0.425:
				tile = TILE_WETLAND
			elif p <= 0.475:
				tile = TILE_LAKE
			elif p <= 0.50:
				tile = TILE_GRASS  # We'll overwrite with river later
			elif p <= 0.675:
				tile = TILE_FOREST #70% of 0.25
			elif p <= 0.75:
				tile = TILE_HILL # 30% of 0.25
			elif p <= 0.87:
				tile = TILE_HILL # 80% of 0.15
			elif p <= 0.90:
				tile = TILE_FOREST # 20% of 0.15
			elif p <= 0.938:
				tile = TILE_MOUNTAIN #60% OF 0.08
			elif p <= 0.98:
				tile = TILE_FOREST
			else:
				tile = TILE_MOUNTAIN

		# --- 4. Main subtropical biome --- #1000 big 
		elif (y > 750 and y <= 1750) or (y < -750 and y >= -1750): #subtropical biome
			# Maze-like, but more like the transition band: sand, mountain, some salt, but more mountains than transition
			var blend_mask = feature_noise.get_noise_2d(float(x) * 1.0, float(y) * 1.0 + 54321) * 0.5 + 0.5
			var blend = 0.45 # Lower than transition band for more mountains
			var mask = desert_mask_noise.get_noise_2d(float(x), float(y)) * 0.5 + 0.5
			var subtropical_tile = TILE_DESERT_SAND
			if mask < 0.6:
				var f = feature_noise.get_noise_2d(float(x), float(y)) * 0.5 + 0.5
				if f < 0.50:
					subtropical_tile = TILE_DESERT_SAND
				elif f < 0.70 :
					subtropical_tile = TILE_MOUNTAIN
				elif f < 0.80 :
					subtropical_tile = TILE_ROCKY_DESERT
				else:
					subtropical_tile = TILE_SALT_FLATS
			else:
				subtropical_tile = TILE_MOUNTAIN
			tile = subtropical_tile if blend_mask >= blend else TILE_DESERT_SAND
				

		# --- 5. Blended transition band: Subtropical <-> Temperate ---
		elif (y > 1750 and y <= 2000) or (y < -1750 and y >= -2000):
			var blend = float(abs(y) - 1750) / 250.0 # 0 at 1750, 1 at 2000
			var blend_mask = feature_noise.get_noise_2d(float(x) * 1, float(y) * 1 + 54321) * 0.5 + 0.5
			# Subtropical logic (reuse from above)
			var mask = desert_mask_noise.get_noise_2d(float(x), float(y)) * 0.5 + 0.5
			var subtropical_tile = DRY_GRASS
			if mask < 0.6:
				var f = feature_noise.get_noise_2d(float(x), float(y)) * 0.5 + 0.5
				if f < 0.60:
					subtropical_tile = TILE_DESERT_SAND
				elif f < 0.80:
					subtropical_tile = TILE_ROCKY_DESERT
				elif f < 0.81:
					var salt_cluster = feature_noise.get_noise_2d(float(x) * 0.02, float(y) * 0.02) * 0.5 + 0.5
					if salt_cluster > 0.59:
						subtropical_tile = TILE_SALT_FLATS
					else:
						subtropical_tile = TILE_DESERT_SAND
				elif f < 0.98:
					subtropical_tile = TILE_DRY_RIVERBED
				else:
					subtropical_tile = TILE_OASIS
			else:
				var f = feature_noise.get_noise_2d(float(x), float(y)) * 0.5 + 0.5
				if f < 0.20:
					subtropical_tile = DRY_GRASS
				elif f < 0.32:
					subtropical_tile = TILE_SAVANA_TREE
				elif f < 0.38:
					subtropical_tile = TILE_SHRUB_LAND
				elif f < 0.40:
					subtropical_tile = DRY_GRASS
				else:
					subtropical_tile = DRY_GRASS
			# Temperate logic (reuse from above)
			var r = feature_noise.get_noise_2d(float(x), float(y)) * 0.5 + 0.5
			var lake_cluster_noise = band_noise.get_noise_2d(float(x) * 0.2, float(y) * 0.2) * 0.5 + 0.5
			var temperate_tile = TILE_GRASS
			if r < 0.40:
				temperate_tile = TILE_FOREST
			elif r < 0.60:
				temperate_tile = TILE_GRASS
			elif r < 0.63:
				if lake_cluster_noise > 0.54:
					temperate_tile = TILE_LAKE
				else:
					temperate_tile = TILE_GRASS
			elif r < 0.67:
				temperate_tile = TILE_GRASS
			elif r < 0.71:
				temperate_tile = TILE_HILL
			elif r < 0.89:
				temperate_tile = TILE_MOUNTAIN
			else:
				temperate_tile = TILE_WETLAND
			# Blend between subtropical and temperate using blend_mask
			if blend_mask < blend:
				tile = temperate_tile
			else:
				tile = subtropical_tile
		# --- 6. Temperate biome ---
		elif (y > 2000 and y <= 3000) or (y < -2000 and y >= -3000):
			var r = feature_noise.get_noise_2d(float(x), float(y)) * 0.5 + 0.5
			var lake_cluster_noise = band_noise.get_noise_2d(float(x) * 0.2, float(y) * 0.2) * 0.5 + 0.5
			if r < 0.40:
				tile = TILE_FOREST
			elif r < 0.60:
				tile = TILE_GRASS
			elif r < 0.71:
				tile = TILE_HILL
			elif r < 0.89:
				tile = TILE_MOUNTAIN
			else:
				tile = TILE_WETLAND
		# --- 6.5. Blended transition band: Temperate <-> Subpolar (improved blend) ---
		elif (y > 3000 and y <= 3250) or (y < -3000 and y >= -3250):
			var blend = float(abs(y) - 3000) / 250.0 # 0 at 3000, 1 at 3250
			var blend_mask = feature_noise.get_noise_2d(float(x) * 1, float(y) * 1 + 24680) * 0.5 + 0.5
			# Temperate logic (reuse from above)
			var r = feature_noise.get_noise_2d(float(x), float(y)) * 0.5 + 0.5
			var lake_cluster_noise = band_noise.get_noise_2d(float(x) * 0.2, float(y) * 0.2) * 0.5 + 0.5
			var temperate_tile = TILE_GRASS
			if r < 0.40:
				temperate_tile = TILE_FOREST
			elif r < 0.60:
				temperate_tile = TILE_GRASS
			elif r < 0.71:
				temperate_tile = TILE_HILL
			elif r < 0.89:
				temperate_tile = TILE_MOUNTAIN
			else:
				temperate_tile = TILE_WETLAND
			# Subpolar logic (reuse from above)
			var r2 = feature_noise.get_noise_2d(float(x) + 10000, float(y) + 10000) * 0.5 + 0.5
			var subpolar_tile = TILE_GRASS
			if r2 < 0.45:
				subpolar_tile = TILE_FOREST
			elif r2 < 0.62:
				subpolar_tile = TILE_GRASS
			else:
				subpolar_tile = TILE_WATER
			# Improved blend: patchy, favoring subpolar as blend increases
			if blend_mask < (1.0 - blend):
				tile = temperate_tile
			else:
				tile = subpolar_tile
		# --- 7. Subpolar biome ---
		elif (y > 3250 and y <= 3750) or (y < -3250 and y >= -3750):
			var r = feature_noise.get_noise_2d(float(x), float(y)) * 0.5 + 0.5
			if r < 0.45:
				tile = TILE_FOREST
			elif r < 0.62:
				tile = TILE_GRASS
			else:
				tile = TILE_WATER
		# --- 8. Polar biome ---
		elif (y > 4000 and y <= WORLD_MAX) or (y < -4000 and y >= WORLD_MIN):
			var r = feature_noise.get_noise_2d(float(x), float(y)) * 0.5 + 0.5
			if r < 0.40:
				tile = TILE_SNOW
			elif r < 0.55:
				tile = TILE_WETLAND
			elif r < 0.65:
				tile = TILE_WETLAND
			elif r < 0.75:
				tile = TILE_SNOW
			elif r < 0.85:
				tile = TILE_SNOW
			elif r < 0.93:
				tile = TILE_FOREST
			else:
				tile = TILE_FOREST
		else:
			if elevation <= 400:
				tile = TILE_WATER
			elif elevation <= 1200:
				tile = TILE_MOUNTAIN 
			elif elevation <= 2000:
				tile = TILE_HILL
			elif elevation <= 3200:
				tile = TILE_HILL
			else:
				tile = TILE_SNOW
		# Always set river tiles from global_river_tiles, regardless of biome
		if global_river_tiles.has(pos):
			# Subtropical biome: desert or savanna
			if (y > 750 and y <= 1750) or (y < -750 and y >= -1750):
				var mask = desert_mask_noise.get_noise_2d(float(x), float(y)) * 0.5 + 0.5
				if mask < 0.6:
					tile = TILE_DRY_RIVERBED
				else:
					tile = TILE_RIVER
			else:
				tile = TILE_RIVER
		tile_map[Vector2i(x, y)] = tile

	# 3. Set tiles in the TileMap (skip all per-chunk river logic)
	var main = get_tree().get_root().get_node("Main")
	var reed_scene = preload("res://scenes/reed.tscn")
	for pos in tile_map.keys():
		var x = pos.x
		var y = pos.y
		if modified_tiles.has(Vector2i(x, y)):
			tile_map[Vector2i(x, y)] = modified_tiles[Vector2i(x, y)]
		set_cell(0, Vector2i(x, y), tile_map[Vector2i(x, y)], Vector2i(0, 0), 0)
		var fog_tilemap = main.get_node("NavigationRegion2D/FogTileMap")
		fog_tilemap.set_cell(0, Vector2i(x, y), 1, Vector2i(0, 0), 0)
		if placed_walls.has(Vector2i(x, y)):
			set_cell(0, Vector2i(x, y), TILE_WALL, Vector2i(0, 0), 0)
	   # Instance reed on some wetlands BELOW fog (as child of self/TileMap)
		if tile_map[Vector2i(x, y)] == TILE_WETLAND:
		   # 30% chance to spawn a reed on a wetland tile
			if randi() % 100 < 1:
				var reed = reed_scene.instantiate()
				reed.position = Vector2(x * 64 + 32, y * 64 +32)
				reed.add_to_group("reed")
				add_child(reed)

	# --- CAVE ENTRANCE PLACEMENT ---
	if main.has_method("try_place_cave_in_chunk"):
		main.try_place_cave_in_chunk(main.get_node("NavigationRegion2D/TileMap"), chunk_coords)

	if main.unloaded_pigs.has(chunk_coords):
		for pig_pos in main.unloaded_pigs[chunk_coords]:
			var pig = main.pig_scene.instantiate()
			pig.name = "Pig"
			pig.position = pig_pos
			pig.chunk_coords = chunk_coords
			main.add_child(pig)
			main.pigs.append(pig)
		main.unloaded_pigs.erase(chunk_coords)

	if main.unloaded_campfires.has(chunk_coords):
		for campfire_pos in main.unloaded_campfires[chunk_coords]:
			var campfire_scene = preload("res://scenes/placeable/Campfire.tscn")
			var campfire = campfire_scene.instantiate()
			campfire.position = campfire_pos
			campfire.add_to_group("campfires")
			main.add_child(campfire)
		main.unloaded_campfires.erase(chunk_coords)

	if main.unloaded_reed.has(chunk_coords):
		for reed_pos in main.unloaded_reed[chunk_coords]:
			var reed = reed_scene.instantiate()
			reed.position = reed_pos
			reed.add_to_group("reed")
			add_child(reed)
		main.unloaded_reed.erase(chunk_coords)
	
	if main.unloaded_walls.has(chunk_coords):
		for wall_pos in main.unloaded_walls[chunk_coords]:
			var wall_scene = preload("res://scenes/placeable/wall.tscn")
			var wall = wall_scene.instantiate()
			wall.position = wall_pos
			wall.add_to_group("walls")
			main.add_child(wall)
		main.unloaded_walls.erase(chunk_coords)
	# --- RESTORE GOATS ---
	
	if main.unloaded_goats and main.unloaded_goats.has(chunk_coords):
		for goat_data in main.unloaded_goats[chunk_coords]:
			var goat = main.goat_scene.instantiate()
			goat.position = goat_data["position"]
			goat.demonic = goat_data.get("demonic", false)
			goat.demonic_timer = goat_data.get("demonic_timer", 0.0)
			goat.add_to_group("goats")
			main.add_child(goat)
			main.goats.append(goat)
		main.unloaded_goats.erase(chunk_coords)

# Helper function to flow river downhill
func _generate_river_from(start_pos: Vector2i, elevation_map, tile_map, bias_south := false):
	var pos = start_pos
	var visited = {}
	for i in range(120): # Limit river length
		visited[pos] = true
		tile_map[pos] = TILE_RIVER
		# Find lowest neighbor, biasing south if requested
		var lowest_e = elevation_map.get(pos, 1.0)
		var next_pos = pos
		for offset in [Vector2i(1,0), Vector2i(-1,0), Vector2i(0,1), Vector2i(0,-1)]:
			var neighbor = pos + offset
			if elevation_map.has(neighbor) and not visited.has(neighbor):
				var ne = elevation_map[neighbor]
				# Bias south (for north savanna) or north (for south savanna)
				if bias_south and ((pos.y > 0 and offset == Vector2i(0,1)) or (pos.y < 0 and offset == Vector2i(0,-1))):
					ne -= 0.04 # Prefer this direction
				if ne < lowest_e:
					lowest_e = ne
					next_pos = neighbor
		if next_pos == pos or lowest_e < 0.13:
			break
		pos = next_pos
func unload_chunk(chunk_coords: Vector2i):
	var start_x = chunk_coords.x * chunk_size
	var start_y = chunk_coords.y * chunk_size
	for x in range(start_x, start_x + chunk_size):
		for y in range(start_y, start_y + chunk_size):
			if x < WORLD_MIN or x > WORLD_MAX or y < WORLD_MIN or y > WORLD_MAX:
				continue
			set_cell(0, Vector2i(x, y), -1) # Remove terrain tile
			var main = get_tree().get_root().get_node("Main")
			var fog_tilemap = main.get_node("NavigationRegion2D/FogTileMap")
			fog_tilemap.set_cell(0, Vector2i(x, y), -1) # Remove fog tile


	# Remove pigs in this chunk
	var main = get_tree().get_root().get_node("Main")
	for pig in main.get_tree().get_nodes_in_group("pigs").duplicate():
		var pig_tile = local_to_map(pig.position)
		var pig_chunk = Vector2i(floor(pig_tile.x / chunk_size), floor(pig_tile.y / chunk_size))
		if pig_chunk == chunk_coords:
			# Store and remove as before
			if not main.unloaded_pigs.has(chunk_coords):
				main.unloaded_pigs[chunk_coords] = []
			main.unloaded_pigs[chunk_coords].append(pig.position)
			pig.get_parent().remove_child(pig)
			pig.queue_free()
			main.pigs.erase(pig)
	# Remove campfires in this chunk
	for campfire in main.get_tree().get_nodes_in_group("campfires").duplicate():
		var campfire_tile = local_to_map(campfire.position)
		var campfire_chunk = Vector2i(floor(campfire_tile.x / chunk_size), floor(campfire_tile.y / chunk_size))
		if campfire_chunk == chunk_coords:
			if not main.unloaded_campfires.has(chunk_coords):
				main.unloaded_campfires[chunk_coords] = []
			main.unloaded_campfires[chunk_coords].append(campfire.position)
			campfire.queue_free()
	#Remove reed in this chunk
	for reed in main.get_tree().get_nodes_in_group("reed").duplicate():
		var reed_tile = local_to_map(reed.position)
		var reed_chunk = Vector2i(floor(reed_tile.x / chunk_size), floor(reed_tile.y / chunk_size))
		if reed_chunk == chunk_coords:
			if not main.unloaded_reed.has(chunk_coords):
				main.unloaded_reed[chunk_coords] = []
			main.unloaded_reed[chunk_coords].append(reed.position)
			reed.queue_free()

	# Remove walls in this chunk
	for wall in main.get_tree().get_nodes_in_group("walls").duplicate():
		var wall_tile = local_to_map(wall.position)
		var wall_chunk = Vector2i(floor(wall_tile.x / chunk_size), floor(wall_tile.y / chunk_size))
		if wall_chunk == chunk_coords:
			if not main.unloaded_walls.has(chunk_coords):
				main.unloaded_walls[chunk_coords] = []
			main.unloaded_walls[chunk_coords].append(wall.position)
			wall.queue_free()

	# --- UNLOAD GOATS ---
	for goat in main.get_tree().get_nodes_in_group("goats").duplicate():
		var goat_tile = local_to_map(goat.position)
		var goat_chunk = Vector2i(floor(goat_tile.x / chunk_size), floor(goat_tile.y / chunk_size))
		if goat_chunk == chunk_coords:
			if not main.unloaded_goats:
				main.unloaded_goats = {}
			if not main.unloaded_goats.has(chunk_coords):
				main.unloaded_goats[chunk_coords] = []
			# Save position and demonic status
			main.unloaded_goats[chunk_coords].append({
				"position": goat.position,
				"demonic": goat.demonic,
				"demonic_timer": goat.demonic_timer
			})
			goat.get_parent().remove_child(goat)
			goat.queue_free()
			if main.goats.has(goat):
				main.goats.erase(goat)

	# After removing pigs, check if we need to spawn more
	if main and main.has_method("spawn_pigs_on_grass"):
		if main.pigs.size() < 10: # or whatever your minimum is
			main.spawn_pigs_on_grass(10)
	if main and main.has_method("spawn_goats_on_mountains"):
		if main.goats.size() < 5:
			main.spawn_goats_on_mountains(5)

# Loads/generates all chunks within render_distance of the given position, and unloads those outside
func update_visible_chunks(player_pos: Vector2):
	var player_tile = local_to_map(player_pos)
	var player_chunk = Vector2i(floor(player_tile.x / chunk_size), floor(player_tile.y / chunk_size))
	var new_active_chunks = {}
	for dx in range(-render_distance, render_distance + 1):
		for dy in range(-render_distance, render_distance + 1):
			var chunk_coords = Vector2i(player_chunk.x + dx, player_chunk.y + dy)
			# Only generate chunks within world bounds
			var start_x = chunk_coords.x * chunk_size
			var start_y = chunk_coords.y * chunk_size
			if start_x > WORLD_MAX or start_x + chunk_size - 1 < WORLD_MIN:
				continue
			if start_y > WORLD_MAX or start_y + chunk_size - 1 < WORLD_MIN:
				continue
			if not active_chunks.has(chunk_coords):
				generate_chunk(chunk_coords)
				active_chunks[chunk_coords] = true
			new_active_chunks[chunk_coords] = true
			# --- Add white fog at world edge for this chunk only ---
			var main = get_tree().get_root().get_node("Main")
			var fog_tilemap = main.get_node("NavigationRegion2D/FogTileMap")
			for x in range(start_x, start_x + chunk_size):
				for y in range(start_y, start_y + chunk_size):
					if (
						x < WORLD_MIN + 50 or x > WORLD_MAX - 50 or
						y < WORLD_MIN + 50 or y > WORLD_MAX - 50
					):
						fog_tilemap.set_cell(0, Vector2i(x, y), FOG_EDGE_TILE_ID, Vector2i(0, 0), 0)
	# Unload chunks that are no longer needed
	for chunk_coords in active_chunks.keys():
		if not new_active_chunks.has(chunk_coords):
			unload_chunk(chunk_coords)
			active_chunks.erase(chunk_coords)
