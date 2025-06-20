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

func _ready():
	# Find the player node (adjust path if needed)
	navigation = get_tree().get_root().get_node("Main/NavigationRegion2D")
	player = get_tree().get_root().get_node("Main/player") # or "Main/player" if your main node is named Main
	tilemap = get_tree().get_root().get_node("Main/NavigationRegion2D/TileMap") # Adjust path if needed


func _process(delta):
	repath_timer -= delta

	if player and navigation:
		var dist = position.distance_to(player.position)

		# Start chasing if close enough
		if not is_chasing and dist < chase_distance:
			is_chasing = true

		if is_chasing:
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

			velocity = target_direction * chase_speed
			move_and_slide()

	if player and position.distance_to(player.position) < 20.0:
		get_tree().get_root().get_node("Main").game_over()
