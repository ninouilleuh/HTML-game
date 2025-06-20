extends CharacterBody2D

var chunk_coords = Vector2i.ZERO
var tile_size := 64.0
var chase_distance := tile_size * 10 # 10 tiles
var speed := 850
var chase_speed := speed          # Pig movement speed in pixels/sec
var player = null           # Reference to player node
var tilemap = null
const TILE_MOUNTAIN = 5 # Replace with your actual mountain tile ID
var navigation = null
var path: PackedVector2Array = []
var path_index := 0
var repath_timer := 0.0
const REPTH_INTERVAL := 0.1  # in seconds
var is_chasing := false
var lost_player_timer := 0.0
const LOST_PLAYER_TIMEOUT := 2.0 # seconds before pig gives up
var forest_tile_id := 0 # Will be set in _ready()
var is_searching := false
var search_timer := 0.0
const SEARCH_DURATION := 2.0 # seconds to search before giving up
var last_known_player_pos := Vector2.ZERO
var random_dir = Vector2.ZERO
var is_afraid := false
var fear_timer := 0.0
const FEAR_SHAKE_DURATION := 0.7 # seconds to shake before running

func _ready():
	# Find the player node (adjust path if needed)
	navigation = get_tree().get_root().get_node("Main/NavigationRegion2D")
	player = get_tree().get_root().get_node("Main/player") # or "Main/player" if your main node is named Main
	tilemap = get_tree().get_root().get_node("Main/NavigationRegion2D/TileMap") # Adjust path if needed
	forest_tile_id = get_tree().get_root().get_node("Main").TILE_FOREST

func _process(delta):
	repath_timer -= delta

	if player and navigation:
		var dist = position.distance_to(player.position)

		# Only start chasing if pig can see player
		if not is_chasing and dist < chase_distance and can_see_player():
			is_chasing = true
			lost_player_timer = 0.0

		if is_chasing:
			if not can_see_player():
				print("where player?")
				lost_player_timer += delta
				if lost_player_timer > LOST_PLAYER_TIMEOUT:
					var pig_tile = tilemap.local_to_map(position)
					if tilemap.get_cell_source_id(0, pig_tile) == forest_tile_id:
						is_chasing = false
						is_afraid = true
						fear_timer = 0.0
						lost_player_timer = 0.0
						path = []
						return
					else:
						is_chasing = false
						is_searching = true
						search_timer = 0.0
						last_known_player_pos = player.position
						lost_player_timer = 0.0
						path = []
						return
			else:
				lost_player_timer = 0.0

			# Repath if needed
			if repath_timer <= 0.0 or path.is_empty():
				path = NavigationServer2D.map_get_path(
					navigation.get_navigation_map(),
					position,
					player.position,
					false
				)
				path_index = 0
				repath_timer = REPTH_INTERVAL

			var target_direction := Vector2.ZERO

			if path.size() > 1 and path_index < path.size():
				var next_point = path[path_index]
				if position.distance_to(next_point) < 4.0:
					if path_index < path.size() - 1:
						path_index += 1
				if path_index < path.size():
					target_direction = (path[path_index] - position).normalized()
				else:
					target_direction = (player.position - position).normalized()
			else:
				# Always fallback to direct pursuit if path is empty or finished
				target_direction = (player.position - position).normalized()

			# Check if pig is in forest and adjust speed
			var pig_tile = tilemap.local_to_map(position)
			if tilemap.get_cell_source_id(0, pig_tile) == forest_tile_id:
				chase_speed = speed * 0.5
			else:
				chase_speed = speed

			velocity = target_direction * chase_speed
			move_and_slide()
		elif is_searching:
			print("searching...")
			search_timer += delta
			if search_timer < SEARCH_DURATION:
				if random_dir == Vector2.ZERO or randf() < 0.05:
					random_dir = (Vector2(randf() - 0.5, randf() - 0.5)).normalized()
				# Stay within a radius of last_known_player_pos
				var to_center = last_known_player_pos - position
				if to_center.length() > 64.0:
					velocity = to_center.normalized() * (speed * 0.5)
				else:
					velocity = random_dir * (speed * 0.5)
				move_and_slide()
			else:
				is_searching = false
				velocity = Vector2.ZERO
		elif is_afraid:
			print("is afraid!")
			fear_timer += delta
			# Shake in place
			if fear_timer < FEAR_SHAKE_DURATION:
				velocity = Vector2(randf() - 0.5, randf() - 0.5).normalized() * (speed * 0.2)
				move_and_slide()
			else:
				# Find the nearest non-forest tile and run to it
				var pig_tile = tilemap.local_to_map(position)
				var exit_tile = pig_tile
				var min_dist = INF
				var found = false
				for r in range(1, 10): # Search radius up to 7 tiles
					for x in range(-r, r+1):
						for y in range(-r, r+1):
							var check_tile = pig_tile + Vector2i(x, y)
							if tilemap.get_cell_source_id(0, check_tile) != forest_tile_id:
								var exit_dist = pig_tile.distance_to(check_tile)
								if exit_dist < min_dist:
									min_dist = exit_dist
									exit_tile = check_tile
									found = true 
									print("found a place to run!")
				if found:
					print("RUN!")
					var exit_pos = tilemap.map_to_local(exit_tile)
					var dir = (exit_pos - position).normalized()
					velocity = dir * speed
					move_and_slide()
					# If reached exit tile, stop being afraid (do not start searching unless you want to)
					if position.distance_to(exit_pos) < 8.0:
						is_afraid = false
				else:
					# If no exit found, keep shaking in fear
					print("lost. scared")
					fear_timer = FEAR_SHAKE_DURATION - 0.01
					velocity = Vector2(randf() - 0.5, randf() - 0.5).normalized() * (speed * 0.2)
					move_and_slide()

	if player and position.distance_to(player.position) < 20.0:
		get_tree().get_root().get_node("Main").game_over()

func can_see_player() -> bool:
	if not player or not tilemap:
		return false
	var pig_tile = tilemap.local_to_map(position)
	var player_tile = tilemap.local_to_map(player.position)
	var base_visibility = 5 # or whatever your base is
	var forest_tiles = count_forest_tiles_between(position, player.position)
	var effective_chase_distance = chase_distance - (forest_tiles * tile_size)
	if effective_chase_distance < tile_size:
		effective_chase_distance = tile_size
	if position.distance_to(player.position) > effective_chase_distance:
		return false
	return true

func count_forest_tiles_between(a: Vector2, b: Vector2) -> int:
	var count = 0
	var steps = int(a.distance_to(b) / tile_size) * 2 # More steps for accuracy
	for i in range(steps + 1):
		var t = float(i) / float(steps)
		var pos = a.lerp(b, t)
		var tile = tilemap.local_to_map(pos)
		if tilemap.get_cell_source_id(0, tile) == forest_tile_id:
			count += 1
	return count
