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


var noise := FastNoiseLite.new()
var generated_chunks := {}
var active_chunks := {}


func _ready():
	noise.seed = randi()
	noise.frequency = 1.0  # Similar to period in OpenSimplexNoise
	noise.fractal_octaves = 10
	noise.fractal_lacunarity = 2.0
	noise.fractal_gain = 0.5

# Call this from your main/player script after player moves!
func update_visible_chunks(player_pos: Vector2):
	var player_tile = local_to_map(player_pos)
	var player_chunk = Vector2i(floor(player_tile.x / chunk_size), floor(player_tile.y / chunk_size))
	var needed_chunks = {}
	for dx in range(-render_distance, render_distance + 1):
		for dy in range(-render_distance, render_distance + 1):
			var chunk_coords = Vector2i(player_chunk.x + dx, player_chunk.y + dy)
			needed_chunks[chunk_coords] = true
			if not active_chunks.has(chunk_coords):
				generate_chunk(chunk_coords)
			active_chunks[chunk_coords] = true

	# Unload chunks that are no longer needed
	for chunk_coords in active_chunks.keys():
		if not needed_chunks.has(chunk_coords):
			unload_chunk(chunk_coords)
			active_chunks.erase(chunk_coords)
	
	 # After updating chunks, spawn pigs if there are less than 20
	var main = get_tree().get_current_scene() # or "Main" if that's your main node name
	if main and main.has_method("spawn_pigs_on_grass"):
		if main.pigs.size() < 20:
			main.spawn_pigs_on_grass(10)

	# --- Add this for goats ---
	if main and main.has_method("spawn_goats_on_mountains"):
		if main.goats.size() < 10:
			main.spawn_goats_on_mountains(5)


func generate_chunk(chunk_coords: Vector2i):
	var start_x = chunk_coords.x * chunk_size
	var start_y = chunk_coords.y * chunk_size

	# 1. Generate elevation map for the chunk
	var elevation_map = {}
	for x in range(start_x, start_x + chunk_size):
		if x < WORLD_MIN or x > WORLD_MAX:
			continue
		for y in range(start_y, start_y + chunk_size):
			if y < WORLD_MIN or y > WORLD_MAX:
				continue
			var nx = float(x) * 0.012
			var ny = float(y) * 0.012
			var e = noise.get_noise_2d(nx, ny) * 0.5 + 0.5
			elevation_map[Vector2i(x, y)] = e

	# 2. Assign biome/tile based on elevation (as before)
	var tile_map = {}
	for pos in elevation_map.keys():
		var x = pos.x
		var y = pos.y
		var e = elevation_map[pos]
		var elevation = e * 4000
		var tile = TILE_GRASS

		if y >= -500 and y <= 500:
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
		else:
			if elevation <= 400:
				tile = TILE_WATER
			elif elevation <= 1200:
				tile = TILE_GRASS
			elif elevation <= 2000:
				tile = TILE_HILL
			elif elevation <= 3200:
				tile = TILE_MOUNTAIN
			else:
				tile = TILE_SNOW

		tile_map[pos] = tile

	# 3. Find river sources (mountain tiles in this chunk)
	for pos in elevation_map.keys():
		var e = elevation_map[pos]
		if e > 0.96 and randi() % 100 < 10: # 10% chance to start a river at a mountain
			_generate_river_from(pos, elevation_map, tile_map)

	# 4. Set tiles in the TileMap
	for pos in tile_map.keys():
		set_cell(0, pos, tile_map[pos], Vector2i(0, 0), 0)
		# Place fog tile
		var main = get_tree().get_root().get_node("Main")
		var fog_tilemap = main.get_node("NavigationRegion2D/FogTileMap")
		fog_tilemap.set_cell(0, pos, 1, Vector2i(0, 0), 0) # 1 = your fog tile ID
	
	var main = get_tree().get_root().get_node("Main") # Or "Main" if that's your node name
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
			var campfire_scene = preload("res://scenes/Campfire.tscn")
			var campfire = campfire_scene.instantiate()
			campfire.position = campfire_pos
			campfire.add_to_group("campfires")
			main.add_child(campfire)
		main.unloaded_campfires.erase(chunk_coords)

# Helper function to flow river downhill
func _generate_river_from(start_pos: Vector2i, elevation_map, tile_map):
	var pos = start_pos
	var visited = {}
	for i in range(100): # Limit river length
		visited[pos] = true
		tile_map[pos] = TILE_RIVER
		# Find lowest neighbor
		var lowest_e = elevation_map.get(pos, 1.0)
		var next_pos = pos
		for offset in [Vector2i(1,0), Vector2i(-1,0), Vector2i(0,1), Vector2i(0,-1)]:
			var neighbor = pos + offset
			if elevation_map.has(neighbor) and not visited.has(neighbor):
				var ne = elevation_map[neighbor]
				if ne < lowest_e:
					lowest_e = ne
					next_pos = neighbor
		if next_pos == pos or lowest_e < 0.13: # Stop if can't go lower or hit water
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

	# After removing pigs, check if we need to spawn more
	if main and main.has_method("spawn_pigs_on_grass"):
		if main.pigs.size() < 10: # or whatever your minimum is
			main.spawn_pigs_on_grass(10)
