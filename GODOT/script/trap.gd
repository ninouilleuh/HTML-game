extends Area2D

@export var open_texture: Texture = preload("res://assets/items/trap.png")
@export var closed_texture: Texture = preload("res://assets/items/closed trap.png")


var is_open := true
var trapped_entity = null
var trapped_timer := 0.0
const PIG_ESCAPE_TIME := 10.0
const PIG_ESCAPE_DISTANCE := 20

func _process(delta):
	print("[TRAP DEBUG] _process running. trapped_entity:", trapped_entity)
	if trapped_entity:
		print("[TRAP DEBUG] trapped_entity name:", trapped_entity.name)
		print("[TRAP DEBUG] has_method('is_pig'):", trapped_entity.has_method("is_pig"))
		if trapped_entity.has_method("is_pig"):
			print("[TRAP DEBUG] is_pig():", trapped_entity.is_pig())
	if trapped_entity:
		if trapped_entity.has_method("is_goat") and trapped_entity.is_goat():
			print("[TRAP DEBUG] Goat trapped, trap breaks instantly!")
			# Re-enable goat movement
			if trapped_entity.has_method("set_physics_process"):
				trapped_entity.set_physics_process(true)
			if trapped_entity.has_method("set_process"):
				trapped_entity.set_process(true)
			trapped_entity = null
			queue_free()
			return
		# Bunny harvest logic
		if trapped_entity.has_method("is_bunny") and trapped_entity.is_bunny():
			print("[TRAP DEBUG] Bunny trapped! Ready to harvest.")
			var main = get_tree().get_root().get_node("Main") if get_tree().get_root().has_node("Main") else null
			var harvest_button = null
			var player_on_trap = false
			if main:
				var ui = main.get_node("UI") if main.has_node("UI") else null
				if ui and ui.has_node("HarvestButton"):
					harvest_button = ui.get_node("HarvestButton")
				# Check if player is on the same tile as the trap
				var tilemap = main.get_node("NavigationRegion2D/TileMap") if main.has_node("NavigationRegion2D/TileMap") else null
				var player = main.get_node("player") if main.has_node("player") else null
				if tilemap and player:
					var trap_tile = tilemap.local_to_map(global_position)
					var player_tile = tilemap.local_to_map(player.global_position)
					player_on_trap = (trap_tile == player_tile)
				if harvest_button:
					harvest_button.visible = player_on_trap
			# Wait for player to interact (harvest)
			if player_on_trap and Input.is_action_just_pressed("action"):
				if main:
					# Give 1 leather
					if not main.inventory.has("leather"):
						main.inventory["leather"] = 0
					main.inventory["leather"] += 1
					# Return trap to inventory
					if not main.inventory.has("trap"):
						main.inventory["trap"] = 0
					main.inventory["trap"] += 1
					# Remove bunny from world
					if trapped_entity:
						trapped_entity.queue_free()
					main.update_inventory_ui() if main.has_method("update_inventory_ui") else null
					# Hide harvest button after harvesting
					if harvest_button:
						harvest_button.visible = false
				trapped_entity = null
				print("[TRAP DEBUG] Bunny harvested, trap returned to inventory.")
				queue_free()
				return
		if trapped_entity.has_method("is_pig") and trapped_entity.is_pig():
			trapped_timer += delta
			print("[TRAP DEBUG] Pig trapped for ", trapped_timer, " seconds.")
			if trapped_timer >= PIG_ESCAPE_TIME:
				print("[TRAP DEBUG] Pig escapes trap after ", trapped_timer, " seconds!")
				var main = get_tree().get_root().get_node("Main") if get_tree().get_root().has_node("Main") else null
				var player = main.get_node("player") if main and main.has_node("player") else null
				if player:
					var pig_pos = trapped_entity.position
					var player_pos = player.position
					var escape_dir = (pig_pos - player_pos).normalized()
					var tilemap = main.get_node("NavigationRegion2D/TileMap") if main and main.has_node("NavigationRegion2D/TileMap") else null
					if tilemap:
						var pig_tile = tilemap.local_to_map(pig_pos)
						var escape_tile = pig_tile + Vector2i(int(escape_dir.x * PIG_ESCAPE_DISTANCE), int(escape_dir.y * PIG_ESCAPE_DISTANCE))
						# Ensure escape_tile is not a forest tile
						var max_attempts = 10
						var attempt = 0
						while tilemap.get_cell_source_id(0, escape_tile) == main.TILE_FOREST and attempt < max_attempts:
							escape_tile += Vector2i(1 if escape_dir.x > 0 else -1, 1 if escape_dir.y > 0 else -1)
							attempt += 1
						print("[TRAP DEBUG] Pig escape target tile: ", escape_tile)
						trapped_entity.escape_tile = escape_tile
						trapped_entity.is_escaping = true
						if "is_chasing" in trapped_entity:
							trapped_entity.is_chasing = false
				# Re-enable pig movement
				if trapped_entity.has_method("set_physics_process"):
					trapped_entity.set_physics_process(true)
				if trapped_entity.has_method("set_process"):
					trapped_entity.set_process(true)
				trapped_entity = null
				print("[TRAP DEBUG] Trap destroyed after pig escape.")
				queue_free()

func _ready():
	$Sprite2D.texture = open_texture
	connect("body_entered", Callable(self, "_on_body_entered"))
	z_index = 100 # Ensure trap is drawn above most entities

func _on_body_entered(body):
	if not is_open:
		return
	if body.name == "Player":
		return
	# Trap the entity
	is_open = false
	trapped_entity = body
	trapped_timer = 0.0
	print("[TRAP DEBUG] Entity entered trap: ", body.name)
	$Sprite2D.texture = closed_texture
	# Move the entity to the center of the trap
	if body.has_method("set_global_position"):
		body.set_global_position(global_position)
	elif body.has_method("set_position"):
		body.set_position(global_position)
	elif body.has_method("global_position"):
		body.global_position = global_position
	# Stop the entity's movement
	if body.has_method("set_physics_process"):
		body.set_physics_process(false)
	if body.has_method("set_process"):
		body.set_process(false)
	if body.has_method("set_motion"):
		body.set_motion(Vector2.ZERO)
	# For goats, forcibly disable their movement variables if present
	if body.has_method("is_goat") and body.is_goat():
		if "moving" in body:
			body.moving = false
		if "chasing" in body:
			body.chasing = false
		if "demonic" in body:
			body.demonic = false

func release_trap():
	if trapped_entity:
		if trapped_entity.has_method("set_physics_process"):
			trapped_entity.set_physics_process(true)
		if trapped_entity.has_method("set_process"):
			trapped_entity.set_process(true)
	is_open = true
	trapped_entity = null
	$Sprite2D.texture = open_texture
