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
var chase_accel := 0.0
const CHASE_ACCEL_RATE := 1200.0 # pixels/sec^2, tweak as needed
const CHASE_MIN_SPEED := 250.0   # starting chase speed, tweak as needed
var is_wandering := false
var wander_timer := 0.0
var wander_pause_timer := 0.0
var wander_dir := Vector2.ZERO
const WANDER_DURATION := 1.5 # seconds to walk
const WANDER_PAUSE := 1.0    # seconds to pause
var main = null
var is_savior := false
var is_waiting_for_saviors := false
var is_being_saved := false
var savior_group := []
var savior_target = null
var savior_timer := 0.0
var is_crossing_forest := false
var is_following_saviors := false

func _ready():
	add_to_group("pigs")
	# Find the player node (adjust path if needed)
	navigation = get_tree().get_root().get_node("Main/NavigationRegion2D")
	player = get_tree().get_root().get_node("Main/player") # or "Main/player" if your main node is named Main
	tilemap = get_tree().get_root().get_node("Main/NavigationRegion2D/TileMap") # Adjust path if needed
	forest_tile_id = get_tree().get_root().get_node("Main").TILE_FOREST
	main = get_tree().get_root().get_node("Main")

func _process(delta):
	var current_hour = int(main.time_of_day)
	repath_timer -= delta

	if player and navigation:
		var dist = position.distance_to(player.position)

		# Only start chasing if pig can see player
		if not is_chasing and dist < chase_distance and can_see_player():
			is_chasing = true
			lost_player_timer = 0.0
			chase_accel = CHASE_MIN_SPEED

		if is_chasing:
			if not can_see_player():
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

			var pig_tile = tilemap.local_to_map(position)
			# Accelerate chase speed up to max
			if chase_accel < speed:
				chase_accel = min(chase_accel + CHASE_ACCEL_RATE * delta, speed)
			# If in forest, halve the chase speed
			if tilemap.get_cell_source_id(0, pig_tile) == forest_tile_id:
				chase_speed = chase_accel * 0.5
			else:
				chase_speed = chase_accel

			velocity = target_direction * chase_speed
			move_and_slide()
		elif is_searching:

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
							
				if found:
			
					var exit_pos = tilemap.map_to_local(exit_tile)
					var dir = (exit_pos - position).normalized()
					velocity = dir * speed
					move_and_slide()
					# If reached exit tile, stop being afraid (do not start searching unless you want to)
					if position.distance_to(exit_pos) < 8.0:
						is_afraid = false
				else:
					# If no exit found, keep shaking in fear
			
					fear_timer = FEAR_SHAKE_DURATION - 0.01
					velocity = Vector2(randf() - 0.5, randf() - 0.5).normalized() * (speed * 0.2)
					move_and_slide()
		elif is_wandering:
			if wander_pause_timer > 0.0:
				wander_pause_timer -= delta
				velocity = Vector2.ZERO
			else:
				var pig_tile = tilemap.local_to_map(position)
				if tilemap.get_cell_source_id(0, pig_tile) == forest_tile_id:
					# Try to join the closest pig
					var closest_pig = get_closest_pig()
					var can_join = false
					if closest_pig:
						var dir = (closest_pig.position - position).normalized()
						var steps = 8
						can_join = true
						for j in range(1, steps + 1):
							var check_pos = position.lerp(closest_pig.position, float(j) / steps)
							var check_tile = tilemap.local_to_map(check_pos)
							if tilemap.get_cell_source_id(0, check_tile) == forest_tile_id:
								continue # allow crossing forest to join
							else:
								can_join = true
								break
						if can_join:
							velocity = dir * (speed * 0.3)
							move_and_slide()
							return
					# If can't join, be afraid
					is_wandering = false
					is_afraid = true
					fear_timer = 0.0
					velocity = Vector2.ZERO
					return
				# Normal wandering logic if not on forest tile
				if wander_timer <= 0.0 or wander_dir == Vector2.ZERO:
					var found_dir = false
					# Try up to 10 random directions that do not cross or end on a forest tile
					for i in range(10):
						var dir = Vector2(randf() - 0.5, randf() - 0.5).normalized()
						var valid = true
						var steps = 8 # Number of checks along the path
						for j in range(1, steps + 1):
							var check_pos = position + dir * tile_size * (float(j) / steps)
							var check_tile = tilemap.local_to_map(check_pos)
							if tilemap.get_cell_source_id(0, check_tile) == forest_tile_id:
								valid = false
								break
						# Also check the destination tile
						var dest_pos = position + dir * speed * WANDER_DURATION * 0.3
						var dest_tile = tilemap.local_to_map(dest_pos)
						if tilemap.get_cell_source_id(0, dest_tile) == forest_tile_id:
							valid = false
						if valid:
							wander_dir = dir
							found_dir = true
							break
					if found_dir:
						wander_timer = WANDER_DURATION
					else:
						# No valid direction found, stand still and try again next frame
						wander_dir = Vector2.ZERO
						wander_timer = 0.0
						velocity = Vector2.ZERO
						move_and_slide()
						return
				velocity = wander_dir * (speed * 0.3)
				wander_timer -= delta
				if wander_timer <= 0.0:
					wander_pause_timer = WANDER_PAUSE
					wander_dir = Vector2.ZERO
			move_and_slide()
	# Night: wander (19h to 6h)
	if (current_hour >= 19 or current_hour < 6) and not is_chasing and not is_searching and not is_afraid:
		is_wandering = true
	elif current_hour >= 6 and current_hour < 19:
		is_wandering = false
		velocity = Vector2.ZERO

	if player and position.distance_to(player.position) < 20.0:
		get_tree().get_root().get_node("Main").game_over()

	# If not already a savior/scared and not in forest and is wandering
	if not is_savior and is_wandering and not is_afraid and not is_being_saved and tilemap.get_cell_source_id(0, tilemap.local_to_map(position)) != forest_tile_id:
		for pig in get_tree().get_nodes_in_group("pigs"):
			if pig == self or not pig.is_afraid:
				continue
			# Count current saviors for this pig
			var savior_count = 0
			for other in get_tree().get_nodes_in_group("pigs"):
				if other.is_savior and other.savior_target == pig:
					savior_count += 1
			if savior_count < 3 and position.distance_to(pig.position) < tile_size * 64: # Big radius
	
				is_savior = true
				savior_target = pig
				pig.is_being_saved = true
				break
	if is_savior and not is_waiting_for_saviors:
		if not is_instance_valid(savior_target):
			is_savior = false
			is_waiting_for_saviors = false
			is_crossing_forest = false
			savior_target = null
			return
		# Move directly toward the scared pig, but stop at a small distance
		var dir = (savior_target.position - position).normalized()
		velocity = dir * (speed * 0.4)
		move_and_slide()
		if position.distance_to(savior_target.position) < 32.0:
			is_waiting_for_saviors = true
			savior_timer = 0.0
	if is_waiting_for_saviors:
		# Gather saviors for this target
		if not savior_group:
			savior_group = []
			for pig in get_tree().get_nodes_in_group("pigs"):
				if pig.is_savior and pig.savior_target == savior_target:
					savior_group.append(pig)
		if len(savior_group) == 3:
			savior_timer += delta
			if savior_timer > 1.0:
				# All saviors and the scared pig go to a safe tile
				var safe_tile = null
				var target_tile = tilemap.local_to_map(savior_target.position)
				# Find a safe tile (not forest, surrounded by non-forest)
				for r in range(1, 20): # Increased radius for further search
					for x in range(-r, r+1):
						for y in range(-r, r+1):
							var check_tile = target_tile + Vector2i(x, y)
							var safe = true
							for dx in range(-1, 2):
								for dy in range(-1, 2):
									if tilemap.get_cell_source_id(0, check_tile + Vector2i(dx, dy)) == forest_tile_id:
										safe = false
							if safe and tilemap.get_cell_source_id(0, check_tile) != forest_tile_id:
								safe_tile = check_tile
								break
						if safe_tile:
							break
					if safe_tile:
						break
				if safe_tile:
					var safe_pos = tilemap.map_to_local(safe_tile)
					for pig in savior_group:
						pig.is_waiting_for_saviors = false
						pig.is_crossing_forest = false
						pig.is_savior = false
						pig.savior_target = null
						pig.is_wandering = true
						pig.wander_dir = (safe_pos - pig.position).normalized()
						pig.wander_timer = WANDER_DURATION
						pig.wander_pause_timer = 10.0
					savior_target.is_being_saved = false
					savior_target.is_afraid = false
					savior_target.is_wandering = true
					savior_target.wander_dir = (safe_pos - savior_target.position).normalized()
					savior_target.wander_timer = WANDER_DURATION
					savior_target.wander_pause_timer = 2.0
	if is_crossing_forest:
		if not is_instance_valid(savior_target):
			is_savior = false
			is_waiting_for_saviors = false
			is_crossing_forest = false
			savior_target = null
			return
		var dir = (savior_target.position - position).normalized()
		velocity = dir * (speed * 0.5)
		move_and_slide()
		if position.distance_to(savior_target.position) < 16.0:
			is_crossing_forest = false
			is_waiting_for_saviors = false
	if is_following_saviors:
		if not is_instance_valid(savior_target):
			is_following_saviors = false
			is_afraid = false
			is_wandering = true
			savior_target = null
			return
		# Follow the average position of the savior group
		var avg = Vector2.ZERO
		for pig in get_tree().get_nodes_in_group("pigs"):
			if pig.is_savior and pig.savior_target == self:
				avg += pig.position
		avg /= 3.0
		var dir = (avg - position).normalized()
		velocity = dir * (speed * 0.5)
		move_and_slide()
		# If on a safe tile, reset all
		var my_tile = tilemap.local_to_map(position)
		var safe = true
		for x in range(-1, 2):
			for y in range(-1, 2):
				if tilemap.get_cell_source_id(0, my_tile + Vector2i(x, y)) == forest_tile_id:
					safe = false
		if safe:
			is_following_saviors = false
			for pig in get_tree().get_nodes_in_group("pigs"):
				if pig.is_savior and pig.savior_target == self:
					pig.is_savior = false
					pig.is_waiting_for_saviors = false
					pig.savior_target = null
					# Assign a new random wander direction and reset timers
					pig.is_wandering = true
					pig.wander_dir = Vector2(randf() - 0.5, randf() - 0.5).normalized()
					pig.wander_timer = WANDER_DURATION
					pig.wander_pause_timer = 0.0
			is_afraid = false
			is_wandering = true
			# Also assign a new random wander direction to the rescued pig
			wander_dir = Vector2(randf() - 0.5, randf() - 0.5).normalized()
			wander_timer = WANDER_DURATION
			wander_pause_timer = 0.0

	# Despawn pig if not on a valid tile
	var pig_tile = tilemap.local_to_map(position)
	if tilemap.get_cell_source_id(0, pig_tile) == -1:
		# Remove from group and main.pigs if needed
		remove_from_group("pigs")
		if main and main.pigs.has(self):
			main.pigs.erase(self)
		queue_free()
		return

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

func get_closest_pig():
	var closest_pig = null
	var closest_dist = INF
	for pig in get_tree().get_nodes_in_group("pigs"):
		if pig == self:
			continue
		var d = position.distance_to(pig.position)
		if d < closest_dist:
			closest_dist = d
			closest_pig = pig
	return closest_pig
