extends Node2D

const TILE_MOUNTAIN = 5 

@export var move_speed := 900  # Pixels per second

func _process(delta):
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
		var tilemap = get_parent().get_node("TileMap")

		# Try X movement
		if input_vector.x != 0:
			var new_position_x = position + Vector2(input_vector.x, 0) * move_speed * delta
			var tile_type_x = get_tile_type_at_position(new_position_x, tilemap)
			if tile_type_x != TILE_MOUNTAIN:
				position.x = new_position_x.x

		# Try Y movement
		if input_vector.y != 0:
			var new_position_y = position + Vector2(0, input_vector.y) * move_speed * delta
			var tile_type_y = get_tile_type_at_position(new_position_y, tilemap)
			if tile_type_y != TILE_MOUNTAIN:
				position.y = new_position_y.y

		var tile_pos = tilemap.local_to_map(position)

func get_tile_type_at_position(pos: Vector2, tilemap: TileMap) -> int:
	var tile_pos = tilemap.local_to_map(pos)
	return tilemap.get_cell_source_id(0, tile_pos)
