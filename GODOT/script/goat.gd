extends CharacterBody2D

var move_delay := 2.5 # seconds to wait before picking a new tile
var move_timer := 0.0
var target_tile = null
var moving := false
var speed := 80 # pixels per second
var chase_speed := 180 # pixels per second, slower than player
var player = null
var chase_distance := 20 # tiles (increased from 5)
var chasing := false
var demonic := false
var demonic_vibrate_timer := 0.0
var demonic_vibrate_speed := 40.0 # how fast to vibrate
var demonic_vibrate_amount := 6.0 # how far to vibrate (pixels)
var demonic_origin := Vector2.ZERO
var has_chased := false # Track if goat has ever chased the player
var demonic_chase_distance := 15 # tiles
var demonic_chase_speed := 4000 # pixels per second, extremely fast
var demonic_pending := false
var demonic_pending_timer := 0.0
var demonic_pending_wait := 10.0 # seconds to wait before turning demonic
var demonic_duration := 300.0 # 5 minutes in seconds
var demonic_timer := 0.0
var transform_player = null
var transform_sound := preload("res://assets/sound/Goat.wav")
var played_transform_sound := false


func _ready():
	set_process(true)
	await get_tree().process_frame
	# Use absolute paths from the scene root
	var tilemap = get_node("/root/Main/NavigationRegion2D/TileMap") if has_node("/root/Main/NavigationRegion2D/TileMap") else null
	# Commented out for debugging: snapping to tilemap may cause huge Y values
	# if tilemap:
	# 	var tile_pos = tilemap.local_to_map(position)
	# 	position = tilemap.map_to_local(tile_pos)
	player = get_node("/root/Main/player") if has_node("/root/Main/player") else null
	if player:
		print("[GOAT DEBUG] Player node found: %s, type: %s" % [player.get_path(), player.get_class()])
	else:
		print("[GOAT DEBUG] Player node NOT found at /root/Main/player!")
	move_timer = move_delay * randf() # randomize initial timer
	demonic_origin = position

	# Add AudioStreamPlayer for transformation sound
	transform_player = AudioStreamPlayer.new()
	transform_player.stream = transform_sound
	transform_player.volume_db = 6 # Louder than default
	transform_player.bus = "Master"
	add_child(transform_player)

func _process(delta):
	# Use absolute paths from the scene root
	var tilemap = get_node("/root/Main/NavigationRegion2D/TileMap") if has_node("/root/Main/NavigationRegion2D/TileMap") else null
	if not tilemap or player == null:
		return

	# --- GAME OVER CHECK (like pig) ---
	if position.distance_to(player.position) < 20.0:
		var main = get_node("/root/Main") if has_node("/root/Main") else null
		if main and main.has_method("game_over"):
			main.game_over()
			self.queue_free()
		else:
			var game_over_scene = preload("res://scenes/GameOverScreen.tscn")
			if game_over_scene:
				get_tree().change_scene_to_file("res://scenes/GameOverScreen.tscn")
				self.queue_free()

	# If waiting to become demonic, stand still for 10 seconds (transformation stage)
	if demonic_pending:
		demonic_pending_timer += delta
		moving = false
		# Play transformation sound once at start of pending
		if not played_transform_sound:
			transform_player.play()
			played_transform_sound = true
		# Fade sound based on player distance
		if player:
			var dist = position.distance_to(player.position)
			var max_dist = 2000.0 # pixels, increased for greater audible range
			var min_db = -40.0 # silence
			var max_db = 6.0 # loudest
			var t = clamp(1.0 - (dist / max_dist), 0.0, 1.0)
			transform_player.volume_db = lerp(min_db, max_db, t)
		# Always squished while pending
		if has_node("Sprite2D"):
			$Sprite2D.scale.y = 0.5
		else:
			for child in get_children():
				if child is Sprite2D:
					child.scale.y = 0.5
					break
		# Do not chase or wander during pending
		if demonic_pending_timer >= demonic_pending_wait:
			demonic = true
			demonic_pending = false
			demonic_origin = position
			has_chased = false # Reset so it can't re-enter pending
			demonic_pending_timer = 0.0
			demonic_timer = 0.0 # <-- Reset timer here
			played_transform_sound = false # Reset for next time
			transform_player.stop() # Stop sound at end of pending
			return
		return

	if demonic:
		demonic_timer += delta
		# Debug: print demonic timer every second
		# Revert to normal if timer exceeds duration
		if demonic_timer >= demonic_duration:
			demonic = false
			demonic_timer = 0.0
			# Restore normal scale and visibility
			if has_node("Sprite2D"):
				$Sprite2D.scale.y = 1.0
				$Sprite2D.visible = true
			else:
				for child in get_children():
					if child is Sprite2D:
						child.scale.y = 1.0
						child.visible = true
						break
			return
		demonic_vibrate_timer += delta * demonic_vibrate_speed
		# Always squished
		if has_node("Sprite2D"):
			$Sprite2D.scale.y = 0.5
		else:
			for child in get_children():
				if child is Sprite2D:
					child.scale.y = 0.5
					break

		# --- FOG VISIBILITY CHECK ---
		var fog_tilemap = get_node("/root/Main/NavigationRegion2D/FogTileMap") if has_node("/root/Main/NavigationRegion2D/FogTileMap") else null
		var current_tile = tilemap.local_to_map(position)
		var is_in_fog = false
		if fog_tilemap:
			var fog_cell = fog_tilemap.get_cell_source_id(0, current_tile)
			is_in_fog = (fog_cell != -1)
		if has_node("Sprite2D"):
			$Sprite2D.visible = not is_in_fog
		else:
			for child in get_children():
				if child is Sprite2D:
					child.visible = not is_in_fog
					break

		current_tile = tilemap.local_to_map(position)
		var player_tile = tilemap.local_to_map(player.position)
		if current_tile.distance_to(player_tile) <= demonic_chase_distance:
			# Chase at high speed, stay squished and vibrate
			var direction = (player_tile - current_tile).clamp(Vector2i(-1, -1), Vector2i(1, 1))
			var next_tile = current_tile + direction
			var target_pos = tilemap.map_to_local(next_tile)
			var chase_move = demonic_chase_speed * delta
			if position.distance_to(target_pos) <= chase_move:
				position = target_pos
			else:
				position += (target_pos - position).normalized() * chase_move
			# Add vibration to position
			position.x += sin(demonic_vibrate_timer) * demonic_vibrate_amount
			return
		# If not chasing player, wander like normal but vibrate in place when idle
		if not moving:
			move_timer -= delta
			if move_timer <= 0.0:
				var possible_moves = [
					current_tile + Vector2i(1, 0),
					current_tile + Vector2i(-1, 0),
					current_tile + Vector2i(0, 1),
					current_tile + Vector2i(0, -1)
				]
				var valid_moves = []
				for t in possible_moves:
					if tilemap.get_cell_source_id(0, t) != -1:
						valid_moves.append(t)
				if valid_moves.size() == 0:
					move_timer = move_delay * randf()
					# Vibrate in place
					position = demonic_origin + Vector2(sin(demonic_vibrate_timer), 0) * demonic_vibrate_amount
					return
				# Pick a random valid move
				target_tile = valid_moves[randi() % valid_moves.size()]
				moving = true
				move_timer = move_delay + randf_range(0.0, 2.0)
				return
			# Vibrate in place while idle
			position = demonic_origin + Vector2(sin(demonic_vibrate_timer), 0) * demonic_vibrate_amount
			return
		else:
			var target_pos = tilemap.map_to_local(target_tile)
			var direction = (target_pos - position).normalized()
			var distance = speed * delta
			if position.distance_to(target_pos) <= distance:
				position = target_pos
				moving = false
				demonic_origin = position # Update origin for vibration
		
			else:
				position += direction * distance
				# Add vibration to position
				position.x += sin(demonic_vibrate_timer) * demonic_vibrate_amount
				
			return

	# Restore normal scale if not demonic or pending
	if has_node("Sprite2D"):
		$Sprite2D.scale.y = 1.0
	else:
		for child in get_children():
			if child is Sprite2D:
				child.scale.y = 1.0
				break

	var current_tile = tilemap.local_to_map(position)
	var player_tile = tilemap.local_to_map(player.position)

	# Check distance to player
	var dist_to_player = current_tile.distance_to(player_tile)
	chasing = dist_to_player <= chase_distance

	# Track if goat has ever chased the player
	if chasing:
		has_chased = true
	

	# Check for nearby goats (excluding self)
	var goats_nearby = false
	var main = get_node("/root/Main") if has_node("/root/Main") else null
	if main:
		for child in main.get_children():
			if child != self and child is CharacterBody2D and child.has_method("is_goat") and child.is_goat():
				if tilemap.local_to_map(child.position).distance_to(current_tile) <= 10:
					goats_nearby = true
					break

	# Enter demonic pending if not chasing, has chased, and just lost the player
	if not chasing and has_chased:
		if not demonic_pending and not demonic:
			# Check for salt in player's inventory; if present, 0% chance to turn demonic
			main = get_node("/root/Main") if has_node("/root/Main") else null
			var has_salt = false
			if main and "inventory" in main and main.inventory.has("salt") and main.inventory["salt"] > 0:
				has_salt = true
			if has_salt:
				print("[GOAT DEBUG] Player has salt, goat will not turn demonic.")
				has_chased = false
				return
			# 30% chance to start demonic transformation if no salt
			if randi() % 100 < 30:
				demonic_pending = true
				demonic_pending_timer = 0.0
				moving = false
			else:
				print("[GOAT DEBUG] 30% chance NOT triggered: Goat stays normal after losing player.")
			has_chased = false
		return
	elif not chasing and goats_nearby:
		# Only reset has_chased if not chasing and not alone
		has_chased = false
		demonic = false
		demonic_pending = false
		demonic_pending_timer = 0.0

	if chasing:
		# Move toward player, on any tile, but faster than wandering
		var direction = (player_tile - current_tile).clamp(Vector2i(-1, -1), Vector2i(1, 1))
		var next_tile = current_tile + direction
		var target_pos = tilemap.map_to_local(next_tile)
		var chase_move = chase_speed * delta
		if position.distance_to(target_pos) <= chase_move:
			position = target_pos
		else:
			position += (target_pos - position).normalized() * chase_move
		moving = false # stop wandering if chasing
		return

	# Normal wandering logic: prefer tiles near mountains
	if not moving:
		move_timer -= delta
		if move_timer <= 0.0:
			var possible_moves = [
				current_tile + Vector2i(1, 0),
				current_tile + Vector2i(-1, 0),
				current_tile + Vector2i(0, 1),
				current_tile + Vector2i(0, -1)
			]
			# Filter out moves that are out of bounds or blocked
			var valid_moves = []
			for t in possible_moves:
				if tilemap.get_cell_source_id(0, t) != -1:
					valid_moves.append(t)
			if valid_moves.size() == 0:
				move_timer = move_delay * randf()
				return
			# Prefer moves adjacent to a mountain tile
			var preferred_moves = []
			for t in valid_moves:
				for offset in [Vector2i(1,0), Vector2i(-1,0), Vector2i(0,1), Vector2i(0,-1)]:
					if tilemap.get_cell_source_id(0, t + offset) == 5: # 5 = TILE_MOUNTAIN
						preferred_moves.append(t)
						break
			var move_choices = preferred_moves if preferred_moves.size() > 0 else  valid_moves
			target_tile = move_choices[randi() % move_choices.size()]
			moving = true
			move_timer = move_delay + randf_range(0.0, 2.0)
	else:
		var target_pos = tilemap.map_to_local(target_tile)
		var direction = (target_pos - position).normalized()
		var distance = speed * delta
		if position.distance_to(target_pos) <= distance:
			position = target_pos
			moving = false
		
		else:
			position += direction * distance
	

func is_goat():
	return true
