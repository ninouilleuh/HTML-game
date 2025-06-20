extends Node2D

var player

var time_of_day := 6.0 # Start at 6:00 (morning)
var day := 1
var inventory = {
	"stick": 0,
	"big_stick": 0
}
var slot_scene := preload("res://scenes/InventorySlot.tscn")
var item_icons = {
	"stick": preload("res://assets/stick.png"),
	"big_stick": preload("res://assets/big_stick.png"),
	"campfire": preload("res://assets/campfire.png")
}

const HOURS_PER_DAY := 24
const SECONDS_PER_HOUR := 60.0 # 1 hour = 1 minute real time
const TILE_FOREST = 0 
const WORLD_MIN = -5000
const WORLD_MAX = 5000

var unloaded_pigs := {} # Key: chunk_coords, Value: Array of pig data (e.g., positions)
var unloaded_campfires := {} # Key: chunk_coords, Value: Array of campfire data (e.g., positions)
const TILE_GRASS = 2 # Use your actual grass tile ID
var pig_scene = preload("res://scenes/pig.tscn")
var pigs = []

var recipes = {
	"campfire": ["stick", "stick", "stick"],
	"torch": ["stick", "coal"],
	"wooden_spear": ["stick", "stone"]
}

var is_placing := false
var placing_item := ""
var preview_sprite = null

func _ready():
	# Instance the player scene
	var player_scene = preload("res://scenes/player.tscn")
	player = player_scene.instantiate()
	add_child(player)

	# Get the TileMap node
	var tilemap = $NavigationRegion2D/TileMap

	# Place player at the center tile (0, 0)
	var center_tile = Vector2i(0, 0)
	player.position = tilemap.map_to_local(center_tile)

	# Generate initial chunks around the player
	tilemap.update_visible_chunks(player.position)
	spawn_pigs_on_grass(20)

func _process(delta):
	# Advance time
	time_of_day += delta / SECONDS_PER_HOUR
	if time_of_day >= HOURS_PER_DAY:
		time_of_day -= HOURS_PER_DAY
		day += 1
		print("Day ", day, " begins!")

	# Update time label
	var hour = int(time_of_day)
	var minute = int((time_of_day - hour) * 60)
	var time_string = "%02d:%02d" % [hour, minute]
	$UI/TimePanel/TimeLabel.text = time_string

	# After player moves, update visible chunks
	$NavigationRegion2D/TileMap.update_visible_chunks(player.position)
	
	# Get the player's current tile and tile_type FIRST
	var tilemap = $NavigationRegion2D/TileMap
	var player_tile = tilemap.local_to_map(player.position)
	var tile_type = tilemap.get_cell_source_id(0, player_tile)

	# fade to dark at night (between 18:00 and 6:00)
	var overlay = $CanvasLayer/DayNightOverlay
	var night_strength = 0
	if time_of_day < 6.0:
		night_strength = int((6.0 - time_of_day) / 6.0 * 255)
	elif time_of_day > 18.0:
		night_strength = int((time_of_day - 18.0) / 6.0 * 255)
	else:
		night_strength = 0

	# Only add forest darkness if player is on a forest tile
	if tile_type == TILE_FOREST:
		var forest_count = 0
		var radius = 2
		for dx in range(-radius, radius + 1):
			for dy in range(-radius, radius + 1):
				var check_tile = player_tile + Vector2i(dx, dy)
				if tilemap.get_cell_source_id(0, check_tile) == TILE_FOREST:
					forest_count += 1
		var total_tiles = pow((radius * 2 + 1), 2) # 25 for 5x5
		var forest_darkness = int(210 * (forest_count / total_tiles))
		night_strength = min(night_strength + forest_darkness, 255)

	overlay.color.a = night_strength / 255.0

	$UI/HarvestButton.visible = (tile_type == TILE_FOREST)
	
	if is_placing and preview_sprite:
		var mouse_pos = get_viewport().get_mouse_position()
		var world_pos = get_global_mouse_position()
		var tile = tilemap.local_to_map(world_pos)
		var tile_center = tilemap.map_to_local(tile)
		preview_sprite.position = tile_center
	
	if Input.is_action_just_pressed("action"):
		_on_harvest_button_pressed()
	if Input.is_action_just_pressed("inventory"):
		_on_inventory_button_pressed()
	if Input.is_action_just_pressed("build"):
		_on_crafting_book_button_pressed()
	
	 # Gather campfire positions in screen UV (0-1) coordinates
	var camera = get_viewport().get_camera_2d()
	var viewport_center = get_viewport().size * 0.5
	# Use the width as the scaling reference (or use .y for height, or average both for diagonal)
	var screen_scale = (get_viewport().size.x + get_viewport().size.y) / (1152.0 + 648.0)
	var campfire_positions = []
	for campfire in get_tree().get_nodes_in_group("campfires"):
		var offset = (campfire.global_position - camera.global_position) * camera.zoom * screen_scale
		var screen_pos = offset + viewport_center
		var uv = Vector2(screen_pos.x / get_viewport().size.x, screen_pos.y / get_viewport().size.y)
		campfire_positions.append(uv)

	var mat = overlay.material
	if mat and mat is ShaderMaterial:
		mat.set_shader_parameter("CAMPFIRE_COUNT", campfire_positions.size())
		mat.set_shader_parameter("CAMPFIRE_POSITIONS", campfire_positions)
		mat.set_shader_parameter("viewport_size", get_viewport().size)
		mat.set_shader_parameter("overlay_color", overlay.color)
		mat.set_shader_parameter("radius", 160.0 * screen_scale)      # <-- Add this
		mat.set_shader_parameter("softness", 48.0 * screen_scale)     # <-- And this
	
func _input(event):
	if is_placing and event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		print("clicked!")
		var tilemap = $NavigationRegion2D/TileMap
		var mouse_pos = get_viewport().get_mouse_position()
		var world_pos = get_global_mouse_position()
		var tile = tilemap.local_to_map(world_pos)
		# Place the campfire (e.g., set a tile, spawn a campfire node, etc.)
		place_object_on_tile(placing_item, tile)
		is_placing = false
		placing_item = ""
		if preview_sprite:
			preview_sprite.queue_free()
			preview_sprite = null

func place_object_on_tile(item_name, tile):
	var tilemap = $NavigationRegion2D/TileMap
	if item_name == "campfire":
		var campfire_scene = preload("res://scenes/Campfire.tscn")
		var campfire = campfire_scene.instantiate()
		campfire.position = tilemap.map_to_local(tile)
		campfire.add_to_group("campfires")
		add_child(campfire)
		inventory[item_name] -= 1
		update_inventory_ui()

func _on_harvest_button_pressed() -> void:
	var rand = randi() % 100
	if rand < 80:
		inventory["stick"] += 1
		print("You found a stick! Total sticks: %d" % inventory["stick"])
	else:
		inventory["big_stick"] += 1
		print("You found a big stick! Total big sticks: %d" % inventory["big_stick"])
	update_inventory_ui()
	update_crafting_book()

func update_inventory_ui():
	var slot_container = $UI/InventoryWindow/BackpackFrame/SlotContainer
	for child in slot_container.get_children():
		child.queue_free()

	var items = []
	for item_name in inventory.keys():
		if inventory[item_name] > 0:
			items.append(item_name)

	var total_slots = max(2, items.size()) # Always show at least 2 slots

	for i in range(total_slots):
		var slot = slot_scene.instantiate()
		var texture_rect = slot.get_node("Control/TextureRect")
		var label = slot.get_node("Control/Label")
		var invname = slot.get_node("Control/Name")
		if i < items.size():
			var item_name = items[i]
			texture_rect.texture = item_icons.get(item_name, null)
			label.text = "%d" % [inventory[item_name]]
			invname.text = "%s" % [item_name.capitalize()]
			texture_rect.modulate = Color(1, 1, 1, 1) # full brightness

			# Only connect for placeable items
			if item_name == "campfire":
				texture_rect.gui_input.connect(func(event):
					if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
						is_placing = true
						placing_item = item_name
						$UI/InventoryWindow.visible = false
						show_placement_preview(item_name)
				)
		else:
			texture_rect.texture = null
			label.text = ""
			texture_rect.modulate = Color(0.2, 0.2, 0.2, 1) # faded/gray
		
		slot_container.add_child(slot)
func _on_inventory_button_pressed() -> void:
	$UI/InventoryWindow.visible = not $UI/InventoryWindow.visible
	if $UI/InventoryWindow.visible:
		update_inventory_ui()

func show_placement_preview(item_name):
	if preview_sprite:
		preview_sprite.queue_free()
	preview_sprite = Sprite2D.new()
	preview_sprite.texture = item_icons.get(item_name, null)
	preview_sprite.modulate = Color(1, 1, 1, 0.5) # semi-transparent
	add_child(preview_sprite)
func spawn_pigs_on_grass(count: int):
	var tilemap = $NavigationRegion2D/TileMap
	var spawned = 0
	var tries = 0
	var min_distance = 50 # in tiles

	var chunk_size = tilemap.chunk_size
	var loaded_chunks = tilemap.active_chunks.keys() # Or adjust if it's an array

	while spawned < count and tries < count * 50:
		# Pick a random loaded chunk
		var chunk_coords = loaded_chunks[randi() % loaded_chunks.size()]
		var start_x = chunk_coords.x * chunk_size
		var start_y = chunk_coords.y * chunk_size

		# Pick a random tile within the chunk
		var x = start_x + randi() % chunk_size
		var y = start_y + randi() % chunk_size
		var tile_pos = Vector2i(x, y)
		var tile_type = tilemap.get_cell_source_id(0, tile_pos)

		# Check grass and distance to other pigs
		var too_close = false
		for pig in pigs:
			var pig_tile = tilemap.local_to_map(pig.position)
			if pig_tile.distance_to(tile_pos) < min_distance:
				too_close = true
				break

		if tile_type == TILE_GRASS and not too_close:
			var pig = pig_scene.instantiate()
			pig.name = "Pig"
			# When spawning a pig
			pig.chunk_coords = chunk_coords  
			pig.position = tilemap.map_to_local(tile_pos)
			add_child(pig)
			pigs.append(pig)
			spawned += 1
		tries += 1

func game_over():
	get_tree().paused = false  # Just in case
	var game_over_scene = load("res://scenes/GameOverScreen.tscn").instantiate()
	get_tree().get_root().add_child(game_over_scene)


func _on_crafting_book_button_pressed() -> void:
	$UI/CraftingBookWindow.visible = not $UI/CraftingBookWindow.visible
	if $UI/CraftingBookWindow.visible:
		update_crafting_book()

func update_crafting_book():
	var recipe_list = $UI/CraftingBookWindow/RecipeList
	for child in recipe_list.get_children():
		child.queue_free()

	for recipe_name in recipes.keys():
		var can_make = can_craft(recipe_name)
		var icon = TextureRect.new()
		icon.texture = item_icons.get(recipe_name, null)
		icon.expand = true
		icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		icon.modulate = Color(1,1,1,1) if can_make else Color(0.5,0.5,0.5,1)
		icon.custom_minimum_size = Vector2(64, 64) # Set custom minimum size
		# Tooltip text
		var ingredient_counts = {}
		for item in recipes[recipe_name]:
			ingredient_counts[item] = ingredient_counts.get(item, 0) + 1
		var tooltip = ""
		for item in ingredient_counts.keys():
			tooltip += "%s x%d\n" % [item.capitalize(), ingredient_counts[item]]
		icon.tooltip_text = tooltip.strip_edges()
		# Click to craft if possible
		if can_make:
			icon.gui_input.connect(func(event):
				if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
					craft_item(recipe_name)
					update_inventory_ui()
					update_crafting_book()
			)
		recipe_list.add_child(icon)

func can_craft(recipe_name):
	var needed = recipes[recipe_name].duplicate()
	var inv = inventory.duplicate()
	for item in needed:
		if inv.get(item, 0) > 0:
			inv[item] -= 1
		else:
			return false
	return true

func craft_item(recipe_name):
	var needed = recipes[recipe_name].duplicate()
	for item in needed:
		inventory[item] -= 1
	# Add crafted item to inventory
	if not inventory.has(recipe_name):
		inventory[recipe_name] = 0
	inventory[recipe_name] += 1
