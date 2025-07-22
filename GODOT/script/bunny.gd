extends CharacterBody2D

# Bunny hopping and fleeing logic
var hop_cooldown := 0.0
var hop_interval := 0.35 # seconds between hops (faster)
var hop_distance := 64 # pixels per hop (3 tiles if tile is 64x64, further)
var player = null
var tilemap = null
var safe_distance := 5 # tiles


func is_bunny():
	return true

func _ready():
	# Find player and tilemap
	var main = get_tree().get_root().get_node("Main") if get_tree().get_root().has_node("Main") else null
	if main:
		player = main.get_node("player") if main.has_node("player") else null
		tilemap = main.get_node("NavigationRegion2D/TileMap") if main.has_node("NavigationRegion2D/TileMap") else null

func _physics_process(delta):
	hop_cooldown -= delta
	if hop_cooldown > 0:
		velocity = Vector2.ZERO
		move_and_slide()
		return

	var hop_vec = Vector2.ZERO
	var should_flee = false
	if player and tilemap:
		var bunny_tile = tilemap.local_to_map(global_position)
		var player_tile = tilemap.local_to_map(player.global_position)
		var dist = bunny_tile.distance_to(player_tile)
		if dist <= safe_distance:
			# Flee from player, faster and further
			should_flee = true
			var flee_vec = (bunny_tile - player_tile)
			if flee_vec.length() > 0:
				hop_vec = Vector2(flee_vec.x, flee_vec.y).normalized() * (hop_distance + 64)
			else:
				hop_vec = Vector2.RIGHT * hop_distance
			hop_cooldown = hop_interval * 0.5 + randf() * 0.1 # even faster cooldown when fleeing
		else:
			# Random hop
			var dirs = [Vector2.LEFT, Vector2.RIGHT, Vector2.UP, Vector2.DOWN]
			hop_vec = dirs[randi() % dirs.size()] * hop_distance
			hop_cooldown = hop_interval + randf() * 0.3
	else:
		# If no player/tilemap, random hop
		var dirs = [Vector2.LEFT, Vector2.RIGHT, Vector2.UP, Vector2.DOWN]
		hop_vec = dirs[randi() % dirs.size()] * hop_distance

	# Try to hop to a valid tile
	var target_pos = global_position + hop_vec
	if tilemap:
		var target_tile = tilemap.local_to_map(target_pos)
		var tile_type = tilemap.get_cell_source_id(0, target_tile)
		if tile_type in [0, 2, 3]: # forest, grass, hill
			global_position = tilemap.map_to_local(target_tile)
		else:
			# If blocked, don't move
			pass
	else:
		global_position += hop_vec

	# hop_cooldown is set above depending on flee/random
	velocity = Vector2.ZERO
	move_and_slide()
