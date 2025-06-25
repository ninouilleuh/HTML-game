extends Node2D

const TILE_MOUNTAIN = 5 
const TILE_WALL = 11
@export var move_speed := 900  # Pixels per second
var tile_size := 64
var moving := false
var move_target := Vector2.ZERO

var step_player = null
var step_sound := preload("res://assets/step.mp3")
var was_moving := false
var last_step_tile = null
var can_play_step_sound := true
var stopped_time := 0.0

func _ready():
	# Snap player to nearest tile center at start
	var tilemap = get_tree().get_root().get_node("Main/NavigationRegion2D/TileMap")
	var tile_pos = tilemap.local_to_map(position)
	position = tilemap.map_to_local(tile_pos)

	# Add AudioStreamPlayer for step sound
	step_player = AudioStreamPlayer.new()
	step_player.stream = step_sound
	step_player.volume_db = 1 # Boost volume by 12 dB
	step_player.bus = "Master"
	add_child(step_player)

	# Connect finished signal to allow next step sound
	step_player.connect("finished", Callable(self, "_on_step_sound_finished"))

func _on_step_sound_finished():
	can_play_step_sound = true

# Wrap the player's x position horizontally ONLY if out of bounds (in tile coordinates)
func wrap_player_x():
	const WORLD_MIN = -5000
	const WORLD_MAX = 5000
	var tilemap = get_tree().get_root().get_node("Main/NavigationRegion2D/TileMap")
	var tile_pos = tilemap.local_to_map(position)
	var width = WORLD_MAX - WORLD_MIN + 1
	if tile_pos.x < WORLD_MIN or tile_pos.x > WORLD_MAX:
		var wrapped_tile_x = int(fmod(tile_pos.x - WORLD_MIN, width))
		if wrapped_tile_x < 0:
			wrapped_tile_x += width
		wrapped_tile_x += WORLD_MIN
		tile_pos.x = wrapped_tile_x
		position = tilemap.map_to_local(tile_pos)
		move_target.x = position.x # Always sync move_target if wrapped

# Wrap the player's y position vertically ONLY if out of bounds (in tile coordinates)
func wrap_player_y():
	const WORLD_MIN = -5000
	const WORLD_MAX = 5000
	var tilemap = get_tree().get_root().get_node("Main/NavigationRegion2D/TileMap")
	var tile_pos = tilemap.local_to_map(position)
	var height = WORLD_MAX - WORLD_MIN + 1
	if tile_pos.y < WORLD_MIN or tile_pos.y > WORLD_MAX:
		var wrapped_tile_y = int(fmod(tile_pos.y - WORLD_MIN, height))
		if wrapped_tile_y < 0:
			wrapped_tile_y += height
		wrapped_tile_y += WORLD_MIN
		tile_pos.y = wrapped_tile_y
		position = tilemap.map_to_local(tile_pos)
		move_target.y = position.y # Always sync move_target if wrapped

# Given a target x, return the closest wrapped x to the current position
func get_nearest_wrapped_x(target_x: float) -> float:
	const WORLD_MIN = -5000
	const WORLD_MAX = 5000
	var width = WORLD_MAX - WORLD_MIN + 1
	var px = position.x
	var tx = target_x
	# Try all possible wraps (original, -width, +width) and pick the closest
	var candidates = [tx, tx - width, tx + width]
	var best = tx
	var best_dist = abs(px - tx)
	for c in candidates:
		var d = abs(px - c)
		if d < best_dist:
			best = c
			best_dist = d
	return best

func _process(delta):
	var main = get_tree().get_root().get_node("Main") if get_tree().get_root().has_node("Main") else null
	if main and "is_game_over" in main and main.is_game_over:
		return
	
	var tilemap = get_tree().get_root().get_node("Main/NavigationRegion2D/TileMap")
	if not moving:
		move_target = position # Always sync move_target when not moving
		var input_vector = Vector2.ZERO
		if Input.is_action_pressed("move_right"):
			input_vector.x += 1
		if Input.is_action_pressed("move_left"):
			input_vector.x -= 1
		if Input.is_action_pressed("move_down"):
			input_vector.y += 1
		if Input.is_action_pressed("move_up"):
			input_vector.y -= 1

		if input_vector != Vector2.ZERO:
			input_vector = input_vector.normalized()
			var move_delta = Vector2i(round(input_vector.x), round(input_vector.y))
			if tilemap and move_delta != Vector2i.ZERO:
				var current_tile = tilemap.local_to_map(position)
				var target_tile = current_tile + move_delta
				var tile_type = tilemap.get_cell_source_id(0, target_tile)
				var target_pos = tilemap.map_to_local(target_tile)
				# Check for wall at target position
				var wall_blocked = false
				for wall in get_tree().get_nodes_in_group("walls"):
					if wall.position.distance_to(target_pos) < tile_size * 0.5:
						wall_blocked = true
						break

				if tile_type != TILE_MOUNTAIN and tile_type != TILE_WALL and not wall_blocked:
					# Wrap target_pos.x to the nearest equivalent to player
					target_pos.x = get_nearest_wrapped_x(target_pos.x)
					move_target = target_pos
					moving = true
	else:
		var direction = (move_target - position).normalized()
		var distance = move_speed * delta
		if position.distance_to(move_target) <= distance:
			position = move_target
			moving = false
			wrap_player_x()
			wrap_player_y()
		else:
			position += direction * distance
			wrap_player_x()
			wrap_player_y()

	# --- STEP SOUND LOGIC ---
	var current_tile = tilemap.local_to_map(position)
	if moving:
		stopped_time = 0.0
		if last_step_tile == null or current_tile != last_step_tile:
			if can_play_step_sound and not step_player.playing:
				print("DEBUG: Playing step sound for new tile")
				step_player.play()
				can_play_step_sound = false
			last_step_tile = current_tile
	else:
		last_step_tile = null
		stopped_time += delta
		if stopped_time > 0.1 and step_player.playing:
			step_player.stop()
		can_play_step_sound = true
