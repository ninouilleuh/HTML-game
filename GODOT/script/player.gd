extends Node2D

const TILE_MOUNTAIN = 5 
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
			if move_delta != Vector2i.ZERO:
				var current_tile = tilemap.local_to_map(position)
				var target_tile = current_tile + move_delta
				var tile_type = tilemap.get_cell_source_id(0, target_tile)
				if tile_type != TILE_MOUNTAIN:
					move_target = tilemap.map_to_local(target_tile)
					moving = true
	else:
		var direction = (move_target - position).normalized()
		var distance = move_speed * delta
		if position.distance_to(move_target) <= distance:
			position = move_target
			moving = false
		else:
			position += direction * distance
