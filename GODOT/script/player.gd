extends Node2D

const TILE_MOUNTAIN = 5 
const TILE_WALL = 11
@export var move_speed := 900  # Pixels per second
var tile_size := 64
var moving := false
var move_target := Vector2.ZERO

func _ready():
	# Snap player to nearest tile center at start
	var tilemap = get_tree().get_root().get_node("Main/NavigationRegion2D/TileMap")
	var tile_pos = tilemap.local_to_map(position)
	position = tilemap.map_to_local(tile_pos)

func _process(delta):
	var tilemap = get_tree().get_root().get_node("Main/NavigationRegion2D/TileMap")
	if not moving:
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

				if tile_type != TILE_MOUNTAIN and tile_type != TILE_WALL:
					move_target = target_pos
					moving = true
	else:
		var direction = (move_target - position).normalized()
		var distance = move_speed * delta
		if position.distance_to(move_target) <= distance:
			position = move_target
			moving = false
		else:
			position += direction * distance
