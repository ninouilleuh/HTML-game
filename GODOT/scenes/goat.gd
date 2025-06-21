extends CharacterBody2D

var move_delay := 2.5 # seconds to wait before picking a new tile
var move_timer := 0.0
var target_tile = null
var moving := false
var speed := 80 # pixels per second
var player = null
var chase_distance := 5 # tiles
var chasing := false

func _ready():
	# Snap goat to nearest tile center at start
	var tilemap = get_tree().get_current_scene().get_node("NavigationRegion2D/TileMap")
	var tile_pos = tilemap.local_to_map(position)
	position = tilemap.map_to_local(tile_pos)
	player = get_tree().get_current_scene().get_node("player") # Adjust path if needed

func _process(delta):
	var tilemap = get_tree().get_current_scene().get_node("NavigationRegion2D/TileMap")
	var current_tile = tilemap.local_to_map(position)
	
	var player_tile = tilemap.local_to_map(player.position)

	# Check distance to player
	var dist_to_player = current_tile.distance_to(player_tile)
	chasing = dist_to_player <= chase_distance

	if chasing:
		# Move toward player, on any tile
		var direction = (player_tile - current_tile).clamp(Vector2i(-1, -1), Vector2i(1, 1))
		var next_tile = current_tile + direction
		var target_pos = tilemap.map_to_local(next_tile)
		if position.distance_to(target_pos) <= speed * delta:
			position = target_pos
		else:
			position += (target_pos - position).normalized() * speed * delta
	else:
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
				# Prefer moves adjacent to a mountain tile
				var preferred_moves = []
				for t in possible_moves:
					for offset in [Vector2i(1,0), Vector2i(-1,0), Vector2i(0,1), Vector2i(0,-1)]:
						if tilemap.get_cell_source_id(0, t + offset) == 5: # 5 = TILE_MOUNTAIN
							preferred_moves.append(t)
							break
				var move_choices = preferred_moves if preferred_moves.size() > 0 else possible_moves
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

	# Game over if touching player
	if position.distance_to(player.position) < 10: # 10 pixels threshold
		get_tree().change_scene_to_file("res://scenes/GameOverScreen.tscn") # Or your game over logic
