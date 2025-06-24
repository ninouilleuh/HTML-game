extends Node2D

# player
var player
# time 
var time_of_day := 6.00 # Start at 6:00 (morning)
var day := 1
const HOURS_PER_DAY := 24
const SECONDS_PER_HOUR := 60.0 # 1 hour = 1 minute real time
# Dictionaries
var inventory = {
	"stick": 0,
	"big_stick": 0,
	"campfire": 0,
	"wall": 0,
	"salt": 0
}
var item_icons = {
	"stick": preload("res://assets/stick.png"),
	"big_stick": preload("res://assets/big_stick.png"),
	"campfire": preload("res://assets/campfire.png"),
	"wall": preload("res://assets/wall.png"),
	#"salt": preload("res://tileset/saltflats.png")
}
var recipes = {
	"campfire": ["stick", "stick", "stick"],
	"wall": ["big_stick"],# "big_stick", "big_stick", "big_stick", "big_stick"],
	"big_stick": ["stick","stick","stick","stick","stick","stick"]
}
var unloaded_pigs := {} # Key: chunk_coords, Value: Array of pig data (e.g., positions)
var unloaded_campfires := {} # Key: chunk_coords, Value: Array of campfire data (e.g., positions)
var unloaded_goats := {} # Key: chunk_coords, Value: Array of goat data (position, demonic, demonic_timer)
var forest_harvest_counts := {} # Key: Vector2i(tile_pos), Value: int
# Instanciate
var slot_scene := preload("res://scenes/InventorySlot.tscn")
var pig_scene = preload("res://scenes/pig.tscn")
var goat_scene = preload("res://scenes/goat.tscn")
#TILE AND MAP RELATED 
const TILE_FOREST = 0 
const WORLD_MIN = -5000
const WORLD_MAX = 5000
const TILE_WALL = 11 # Set this to the correct tile ID for your wall
const TILE_MOUNTAIN = 5
const TILE_GRASS = 2 # Use your actual grass tile ID
const TILE_SALTFLATS = 15 # Set this to the correct tile ID for saltflats
# GROUPS
var pigs = []
var goats = []
var placed_campfires := [] # Array of Vector2i tile positions
#OTHER
var is_placing := false
var placing_item := ""
var preview_sprite = null
var selected_recipe_index := 0
var selected_inventory_index := 0
var ui_focus := "inventory" # or "crafting_book"




#---- START GAME -----
func _ready():
	
	# Instance the player scene
	print("hello world")
	var player_scene = preload("res://scenes/player.tscn")
	player = player_scene.instantiate()
	add_child(player)

	# Get the TileMap node
	var tilemap = $NavigationRegion2D/TileMap

	# Place player 
	var spawn_tile = find_valid_spawn_tile(tilemap)
	player.position = tilemap.map_to_local(spawn_tile)
	
	load_game()
	# Generate initial chunks around the player (must be after setting position!)
	tilemap.update_visible_chunks(player.position)
	spawn_pigs_on_grass(20)
	spawn_goats_on_mountains(10)
	var fog_tilemap = $NavigationRegion2D/FogTileMap
	
	
#---- PROCESS FUNCTION ---

func _process(delta):
		#MAP RELATED 
		# After player moves, update visible chunks
	$NavigationRegion2D/TileMap.update_visible_chunks(player.position)
	
		# Get the player's current tile and tile_type FIRST
	var tilemap = $NavigationRegion2D/TileMap
	var player_tile = tilemap.local_to_map(player.position)
	var tile_type = tilemap.get_cell_source_id(0, player_tile)
	if player :
		update_fog_of_war()
	# TIME RELATED 
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
	
		# fade to dark at NIGHT (between 18:00 and 6:00)
	var overlay = $CanvasLayer/DayNightOverlay
	var night_strength = 0
	if time_of_day < 6.0:
		night_strength = int((6.0 - time_of_day) / 6.0 * 255)
	elif time_of_day > 18.0:
		night_strength = int((time_of_day - 18.0) / 6.0 * 255)
	else:
		night_strength = 0

		#FOREST DARKNESS
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
		#NIGHT + FOREST DARKNESS
	overlay.color.a = night_strength / 255.0
	#ACTION
		# HARVEST ON FOREST 
	$UI/HarvestButton.visible = (tile_type == TILE_FOREST or tile_type == TILE_SALTFLATS)
	if Input.is_action_just_pressed("action") and (tile_type == TILE_FOREST or tile_type == TILE_SALTFLATS) and not $UI/CraftingBookWindow.visible :
		_on_harvest_button_pressed()
		# PLACING ITEM 
	if Input.is_action_just_pressed("place") and placing_item != "":
		place_object_on_tile(placing_item, player_tile)
		# Only stop placing if you run out of the item
		if inventory[placing_item] <= 0:
			is_placing = false
			placing_item = ""
			if preview_sprite:
				preview_sprite.queue_free()
				preview_sprite = null
		# CRAFTING LOGIC FOCUS 
	if $UI/CraftingBookWindow.visible and not $UI/InventoryWindow.visible:
		var recipe_names = recipes.keys()
		if Input.is_action_just_pressed("ui_up"):
			selected_recipe_index = max(0, selected_recipe_index - 1)
			update_crafting_book()
			
		elif Input.is_action_just_pressed("ui_down"):
			selected_recipe_index = min(recipe_names.size() - 1, selected_recipe_index + 1)
			update_crafting_book()
			
		elif Input.is_action_just_pressed("action"):
			var selected_recipe = recipe_names[selected_recipe_index]
			if can_craft(selected_recipe):
				craft_item(selected_recipe)
				update_inventory_ui()
				update_crafting_book()
		# INVENTORY LOGIC FOCUS
	if $UI/InventoryWindow.visible and not  $UI/CraftingBookWindow.visible :
		var items = []
		for item_name in inventory.keys():
			if inventory[item_name] > 0:
				items.append(item_name)
		if Input.is_action_just_pressed("ui_right"):
			selected_inventory_index = min(items.size() - 1, selected_inventory_index + 1)
			update_inventory_ui()
		elif Input.is_action_just_pressed("ui_left"):
			selected_inventory_index = max(0, selected_inventory_index - 1)
			update_inventory_ui()
		elif Input.is_action_just_pressed("action"):
			if items.size() > 0:
				var item_name = items[selected_inventory_index]
				if item_name == "campfire" or item_name == "wall":
					is_placing = true
					placing_item = item_name
					$UI/InventoryWindow.visible = false
		# FOCUS SWITCH LOGIC 
	if $UI/InventoryWindow.visible and $UI/CraftingBookWindow.visible:
		var items = []
		for item_name in inventory.keys():
			if inventory[item_name] > 0:
				items.append(item_name)
		var recipe_names = recipes.keys()

		# Focus switching
		if Input.is_action_just_pressed("ui_right") or Input.is_action_just_pressed("ui_left"):
			ui_focus = "inventory"
			update_inventory_ui()
			update_crafting_book()
		elif Input.is_action_just_pressed("ui_up") or Input.is_action_just_pressed("ui_down"):
			ui_focus = "crafting_book"
			update_inventory_ui()
			update_crafting_book()

		# Inventory navigation and selection
		if ui_focus == "inventory":
			if Input.is_action_just_pressed("ui_right"):
				selected_inventory_index = min(items.size() - 1, selected_inventory_index + 1)
				update_inventory_ui()
			elif Input.is_action_just_pressed("ui_left"):
				selected_inventory_index = max(0, selected_inventory_index - 1)
				update_inventory_ui()
			elif Input.is_action_just_pressed("action"):
				if items.size() > 0:
					var item_name = items[selected_inventory_index]
					if item_name == "campfire" or item_name == "wall":
						is_placing = true
						placing_item = item_name
						$UI/InventoryWindow.visible = false

		# Crafting book navigation and selection
		elif ui_focus == "crafting_book":
			if Input.is_action_just_pressed("ui_up"):
				selected_recipe_index = max(0, selected_recipe_index - 1)
				update_crafting_book()
			elif Input.is_action_just_pressed("ui_down"):
				selected_recipe_index = min(recipe_names.size() - 1, selected_recipe_index + 1)
				update_crafting_book()
			elif Input.is_action_just_pressed("action"):
				var selected_recipe = recipe_names[selected_recipe_index]
				if can_craft(selected_recipe):
					craft_item(selected_recipe)
					update_inventory_ui()
					update_crafting_book()
	
	 # Gather campfire positions in screen UV (0-1) coordinates
	
	#CAMPFIRE SHADERS
	var camera = get_viewport().get_camera_2d()
	var viewport_center = get_viewport().size * 0.5
	# Use the width as the scaling reference (or use .y for height, or average both for diagonal)
	var screen_scale = (get_viewport().size.x + get_viewport().size.y) / (1152.0 + 648.0)
	var campfire_positions = []
	var root = get_tree().root
	var visible_rect = root.get_visible_rect()
	var visible_origin = visible_rect.position
	var visible_size = visible_rect.size

	for campfire in get_tree().get_nodes_in_group("campfires"):
		var screen_pos = (campfire.global_position - camera.global_position) * camera.zoom + (visible_size * 0.5) + visible_origin
		var uv = Vector2(
			screen_pos.x / visible_size.x,
			screen_pos.y / visible_size.y
		)
		campfire_positions.append(uv)

	var mat = overlay.material
	if mat and mat is ShaderMaterial:
		mat.set_shader_parameter("CAMPFIRE_COUNT", campfire_positions.size())
		mat.set_shader_parameter("CAMPFIRE_POSITIONS", campfire_positions)
		mat.set_shader_parameter("viewport_size", get_viewport().size)
		mat.set_shader_parameter("overlay_color", overlay.color)
		mat.set_shader_parameter("radius", 160.0 * screen_scale)      # <-- Add this
		mat.set_shader_parameter("softness", 48.0 * screen_scale)     # <-- And this
	
	


#----------------- GAME OVER ---------------------------
func game_over():
	get_tree().paused = false  # Pause the game
	self.hide() # Optionally hide the main node to prevent further processing
	var game_over_scene = load("res://scenes/GameOverScreen.tscn").instantiate()
	get_tree().get_root().add_child(game_over_scene)


	
#----------------- CRAFT RELATED --------------------
func update_crafting_book():
	var recipe_list = $UI/CraftingBookWindow/RecipeList
	for child in recipe_list.get_children():
		child.queue_free()

	var recipe_names = recipes.keys()
	for i in range(recipe_names.size()):
		var recipe_name = recipe_names[i]
		var can_make = can_craft(recipe_name)
		
		# Create a horizontal container for icon + label
		var hbox = HBoxContainer.new()
		hbox.custom_minimum_size = Vector2(200, 68)

		# Icon
		var icon = TextureRect.new()
		icon.texture = item_icons.get(recipe_name, null)
		icon.expand = true
		icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		icon.modulate = Color(1,1,1,1) if can_make else Color(0.5,0.5,0.5,1)
		icon.custom_minimum_size = Vector2(64, 64)

		# Tooltip text and ingredient label
		var ingredient_counts = {}
		for item in recipes[recipe_name]:
			ingredient_counts[item] = ingredient_counts.get(item, 0) + 1
		var tooltip = ""
		for item in ingredient_counts.keys():
			tooltip += "%s x%d\n" % [item.capitalize(), ingredient_counts[item]]

		# Highlight border
		var panel = PanelContainer.new()
		panel.custom_minimum_size = Vector2(68, 68)
		var style = StyleBoxFlat.new()
		if i == selected_recipe_index and (
			($UI/CraftingBookWindow.visible and not $UI/InventoryWindow.visible) or
			($UI/InventoryWindow.visible and $UI/CraftingBookWindow.visible and ui_focus == "crafting_book")
		):
			style.border_width_left = 3
			style.border_width_top = 3
			style.border_width_right = 3
			style.border_width_bottom = 3
			style.border_color = Color.WHITE
			style.bg_color = Color(0,0,0,0)
		else:
			style.border_width_left = 0
			style.border_width_top = 0
			style.border_width_right = 0
			style.border_width_bottom = 0
			style.bg_color = Color(0,0,0,0)
		var theme = Theme.new()
		theme.set_stylebox("panel", "PanelContainer", style)
		panel.theme = theme
		panel.add_child(icon)

		# Add icon to hbox
		hbox.add_child(panel)

		# Only show ingredient label for the selected recipe
		if i == selected_recipe_index:
			var ingredient_label = Label.new()
			ingredient_label.text = tooltip.strip_edges()
			ingredient_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
			ingredient_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
			ingredient_label.size_flags_vertical = Control.SIZE_EXPAND_FILL
			hbox.add_child(ingredient_label)

		# Click to craft if possible
		if can_make:
			icon.gui_input.connect(func(event):
				if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
					craft_item(recipe_name)
					update_inventory_ui()
					update_crafting_book()
			)
		recipe_list.add_child(hbox)

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

			# Highlight only if inventory is focused
			var is_selected = i == selected_inventory_index and (
				($UI/InventoryWindow.visible and not $UI/CraftingBookWindow.visible) or
				($UI/InventoryWindow.visible and $UI/CraftingBookWindow.visible and ui_focus == "inventory")
			)
			if is_selected:
				var style = StyleBoxFlat.new()
				style.bg_color = Color(1, 1, 1, 0.7) # White with some transparency
				slot.add_theme_stylebox_override("panel", style)
				texture_rect.modulate = Color(1, 1, 1, 0.7) # White overlay on image
			else:
				slot.add_theme_stylebox_override("panel", null) # Reset to default
				texture_rect.modulate = Color(1, 1, 1, 1) # Normal image

			# Only connect for placeable items
			if item_name == "campfire" or item_name == "wall":
				texture_rect.gui_input.connect(func(event):
					if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
						is_placing = true
						placing_item = item_name
						$UI/InventoryWindow.visible = false
				)
		else:
			texture_rect.texture = null
			label.text = ""
			texture_rect.modulate = Color(0.2, 0.2, 0.2, 1) # faded/gray
		
		slot_container.add_child(slot)

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

func place_object_on_tile(item_name, tile):
	var tilemap = $NavigationRegion2D/TileMap
	if item_name == "campfire":
		var campfire_scene = preload("res://scenes/Campfire.tscn")
		var campfire = campfire_scene.instantiate()
		campfire.position = tilemap.map_to_local(tile)
		campfire.add_to_group("campfires")
		add_child(campfire)
		placed_campfires.append(tile) # <-- Track campfire tile
		inventory[item_name] -= 1
		update_inventory_ui()
	elif item_name == "wall":
		var wall_tile_id = TILE_WALL
		tilemap.set_cell(0, tile, wall_tile_id, Vector2i(0, 0), 0)
		tilemap.placed_walls[tile] = true
		tilemap.modified_tiles[tile] = TILE_WALL
		tilemap.queue_redraw() # Request redraw (Godot 4)
		$NavigationRegion2D.bake_navigation_polygon()

		print(tile, TILE_WALL)
		print("Placing wall at tile:", tile, "with ID:", TILE_WALL)
		print("TileSet has tile for ID 3:", tilemap.tile_set.get_source(TILE_WALL) != null)
		inventory[item_name] -= 1
		update_inventory_ui()

#-------------------- FOG OF WAR -----------------
func compute_fov(tilemap: TileMap, origin: Vector2i, radius: int, is_blocker: Callable) -> Dictionary:
	var visible := {}
	visible[origin] = true
	for angle in range(0, 360, 1): # Use 1-degree steps for better coverage
		var rad = deg_to_rad(angle)
		var dx = cos(rad)
		var dy = sin(rad)
		for r in range(1, radius + 1):
			var pos = origin + Vector2i(round(dx * r), round(dy * r))
			if visible.has(pos):
				continue # Already checked this tile
			visible[pos] = true
			if is_blocker(tilemap, pos):
				break
	return visible
func update_fog_of_war():
	var tilemap = $NavigationRegion2D/TileMap
	var fog_tilemap = $NavigationRegion2D/FogTileMap
	var player_tile = tilemap.local_to_map(player.position)
	var fov_tiles = compute_fov(tilemap, player_tile, 32.9, is_blocker)


	# 1. Cover all loaded chunk tiles with fog
	for chunk_coords in tilemap.active_chunks.keys():
		var start_x = chunk_coords.x * tilemap.chunk_size
		var start_y = chunk_coords.y * tilemap.chunk_size
		for x in range(start_x, start_x + tilemap.chunk_size):
			for y in range(start_y, start_y + tilemap.chunk_size):
				fog_tilemap.set_cell(0, Vector2i(x, y), 1, Vector2i(0, 0), 0)

	# 2. Remove fog for visible tiles
	for pos in fov_tiles.keys():
		fog_tilemap.set_cell(0, pos, -1) # -1 removes the fog tile
	
	 # 3. Remove fog around each campfire
	var campfire_radius = 8 # Adjust as needed
	for campfire in get_tree().get_nodes_in_group("campfires"):
		var campfire_tile = tilemap.local_to_map(campfire.position)
		var olive_radius_x = 12 # horizontal radius (wider)
		var olive_radius_y = 6  # vertical radius (narrower)
		for dx in range(-olive_radius_x, olive_radius_x + 1):
			for dy in range(-olive_radius_y, olive_radius_y + 1):
				# Ellipse equation: (x/a)^2 + (y/b)^2 <= 1
				if (pow(dx / float(olive_radius_x), 2) + pow(dy / float(olive_radius_y), 2)) <= 1.0:
					var pos = campfire_tile + Vector2i(dx, dy)
					fog_tilemap.set_cell(0, pos, -1)

func is_blocker(tilemap, pos):
	var tile_type = tilemap.get_cell_source_id(0, pos)
	return tile_type == TILE_FOREST or tile_type == TILE_MOUNTAIN


#--------------SPAWN RELATED  ---------------------------
# PLAYER POSITION
func find_valid_spawn_tile(tilemap):
	var tries = 0
	while tries < 1000:
		var y = 0
		# Pick a y in the grass biome bands
		if randi() % 2 == 0:
			y = randi_range(0, 1500)
		else:
			y = randi_range(-1500, 0)
		var x = randi_range(WORLD_MIN, WORLD_MAX)
		var chunk_size = tilemap.chunk_size
		var chunk_coords = Vector2i(floor(x / chunk_size), floor(y / chunk_size))
		if not tilemap.active_chunks.has(chunk_coords):
			tilemap.generate_chunk(chunk_coords)
		var tile_type = tilemap.get_cell_source_id(0, Vector2i(x, y))
		if tile_type != TILE_MOUNTAIN :
			return Vector2i(x, y)
		tries += 1
	# fallback if not founds
	print("fallback position")
	return Vector2i(0, 0)
# PIG
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
# GOAT 
func spawn_goats_on_mountains(count: int):
	var tilemap = $NavigationRegion2D/TileMap
	var spawned = 0
	var tries = 0
	var chunk_size = tilemap.chunk_size
	var loaded_chunks = tilemap.active_chunks.keys()
	while spawned < count and tries < count * 50:
		var chunk_coords = loaded_chunks[randi() % loaded_chunks.size()]
		var start_x = chunk_coords.x * chunk_size
		var start_y = chunk_coords.y * chunk_size
		var x = start_x + randi() % chunk_size
		var y = start_y + randi() % chunk_size
		var tile_pos = Vector2i(x, y)
		var tile_type = tilemap.get_cell_source_id(0, tile_pos)
		if tile_type == TILE_MOUNTAIN:
			var goat = goat_scene.instantiate()
			goat.position = tilemap.map_to_local(tile_pos)
			goat.add_to_group("goats")
			add_child(goat)
			goats.append(goat)
			spawned += 1
		tries += 1

#------------------------SAVE FILE -----------------------
const SAVE_PATH = "user://savegame.json"

func save_game():
	var tilemap = $NavigationRegion2D/TileMap
	var save_data = {
		"player_pos": player.position,
		"inventory": inventory,
		"modified_tiles": tilemap.modified_tiles,
		"placed_walls": tilemap.placed_walls,
		"placed_campfires": placed_campfires, # <-- Add this
		"forest_harvest_counts": forest_harvest_counts,
		"day": day,
		"time_of_day": time_of_day,
		"noise_seed": tilemap.noise.seed,
	}
	var file = FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	file.store_string(JSON.stringify(save_data))
	file.close()
	print("Game saved!")

func load_game():
	var tilemap = $NavigationRegion2D/TileMap
	if not FileAccess.file_exists(SAVE_PATH):
		print("No save file found.")
		return
	var file = FileAccess.open(SAVE_PATH, FileAccess.READ)
	var save_data = JSON.parse_string(file.get_as_text())
	file.close()
	
	if typeof(save_data) == TYPE_DICTIONARY:
		var pos = save_data.get("player_pos", player.position)
		if typeof(pos) == TYPE_STRING:
			var numbers = pos.strip_edges().trim_prefix("(").trim_suffix(")").split(",")
			if numbers.size() == 2:
				player.position = Vector2(numbers[0].to_float(), numbers[1].to_float())
			else:
				player.position = Vector2.ZERO
		elif typeof(pos) == TYPE_DICTIONARY and pos.has("x") and pos.has("y"):
			player.position = Vector2(pos["x"], pos["y"])
		else:
			player.position = pos

		inventory = save_data.get("inventory", inventory)
		# After loading from save_data:
		tilemap.modified_tiles = save_data.get("modified_tiles", {})
		tilemap.placed_walls = save_data.get("placed_walls", {})

		# Convert string keys to Vector2i for modified_tiles
		var fixed_modified_tiles = {}
		for k in tilemap.modified_tiles.keys():
			var v = tilemap.modified_tiles[k]
			if typeof(k) == TYPE_STRING:
				var numbers = k.strip_edges().trim_prefix("(").trim_suffix(")").split(",")
				if numbers.size() == 2:
					fixed_modified_tiles[Vector2i(numbers[0].to_int(), numbers[1].to_int())] = v
			else:
				fixed_modified_tiles[k] = v
		tilemap.modified_tiles = fixed_modified_tiles

		# Convert string keys to Vector2i for placed_walls
		var fixed_placed_walls = {}
		for k in tilemap.placed_walls.keys():
			var v = tilemap.placed_walls[k]
			if typeof(k) == TYPE_STRING:
				var numbers = k.strip_edges().trim_prefix("(").trim_suffix(")").split(",")
				if numbers.size() == 2:
					fixed_placed_walls[Vector2i(numbers[0].to_int(), numbers[1].to_int())] = v
			else:
				fixed_placed_walls[k] = v
		tilemap.placed_walls = fixed_placed_walls

		placed_campfires = save_data.get("placed_campfires", []) # <-- ADD THIS LINE
		forest_harvest_counts = save_data.get("forest_harvest_counts", {})
		day = save_data.get("day", 1)
		time_of_day = save_data.get("time_of_day", 6.0)
		if save_data.has("noise_seed"):
			tilemap.noise.seed = save_data["noise_seed"]
			tilemap.feature_noise.seed = tilemap.noise.seed + 12345
			tilemap.desert_mask_noise.seed = tilemap.noise.seed + 54321

		# After loading, refresh the world:
		tilemap.update_visible_chunks(player.position)

		# Restore campfires
		for tile in placed_campfires:
			var tile_vec : Vector2i
			if typeof(tile) == TYPE_STRING:
				var numbers = tile.strip_edges().trim_prefix("(").trim_suffix(")").split(",")
				if numbers.size() == 2:
					tile_vec = Vector2i(numbers[0].to_int(), numbers[1].to_int())
				else:
					continue
			else:
				tile_vec = tile
			var campfire_scene = preload("res://scenes/Campfire.tscn")
			var campfire = campfire_scene.instantiate()
			campfire.position = tilemap.map_to_local(tile_vec)
			campfire.add_to_group("campfires")
			add_child(campfire)

		update_inventory_ui()      # <-- ADD THIS
		update_crafting_book()     # <-- AND THIS

		print("Game loaded!")
	else:
		print("Failed to load save data.")

# -----------------------INPUT MANAGEMENT -------------
func _input(event):
	if event.is_action_pressed("ui_save"):
		save_game()
	if event.is_action_pressed("inventory"):
		_on_inventory_button_pressed()
	if event.is_action_pressed("build"):
		_on_crafting_book_button_pressed()

func _on_crafting_book_button_pressed() -> void:
	$UI/CraftingBookWindow.visible = not $UI/CraftingBookWindow.visible
	if $UI/CraftingBookWindow.visible:
		selected_recipe_index = 0
		update_crafting_book()

func _on_inventory_button_pressed() -> void:
	$UI/InventoryWindow.visible = not $UI/InventoryWindow.visible

func _on_harvest_button_pressed() -> void:
	var tilemap = $NavigationRegion2D/TileMap
	var player_tile = tilemap.local_to_map(player.position)
	var tile_type = tilemap.get_cell_source_id(0, player_tile)
	# Track harvest count for this tile
	if tile_type == TILE_FOREST:
		if not forest_harvest_counts.has(player_tile):
			forest_harvest_counts[player_tile] = 0
		forest_harvest_counts[player_tile] += 1
		var rand = randi() % 100
		if rand < 80:
			inventory["stick"] += 1
			print("You found a stick! Total sticks: %d" % inventory["stick"])
		else:
			inventory["big_stick"] += 1
			print("You found a big stick! Total big sticks: %d" % inventory["big_stick"])
		# If harvested more than 5 times, change the tile to the most common neighbor (except forest)
		if forest_harvest_counts[player_tile] > 4: # 5 harvest max
			var max_radius = 20 # You can set this to the number of tiles that covers your screen
			var found = false
			var neighbor_counts = {}
			var new_tile = TILE_GRASS
			for radius in range(1, max_radius + 1):
				neighbor_counts.clear()
				for dx in range(-radius, radius + 1):
					for dy in range(-radius, radius + 1):
						if dx == 0 and dy == 0:
							continue
						var neighbor_tile = player_tile + Vector2i(dx, dy)
						var neighbor_type = tilemap.get_cell_source_id(0, neighbor_tile)
						if neighbor_type != TILE_FOREST and neighbor_type != TILE_WALL:
							neighbor_counts[neighbor_type] = neighbor_counts.get(neighbor_type, 0) + 1
				if neighbor_counts.size() > 0:
					# Found at least one non-forest tile in this radius
					var max_count = 0
					for neighbor_type in neighbor_counts.keys():
						if neighbor_counts[neighbor_type] > max_count:
							max_count = neighbor_counts[neighbor_type]
							new_tile = neighbor_type
					found = true
					break
			# If nothing found after searching, default to grass
			tilemap.set_cell(0, player_tile, new_tile, Vector2i(0, 0), 0)
			tilemap.modified_tiles[player_tile] = new_tile
			print("The forest has been depleted and turned into tile ID %d!" % new_tile)
			forest_harvest_counts.erase(player_tile) # Optional: stop tracking
	elif tile_type == TILE_SALTFLATS:
		# Track harvest count for this tile
		if not forest_harvest_counts.has(player_tile):
			forest_harvest_counts[player_tile] = 0
		forest_harvest_counts[player_tile] += 1
		inventory["salt"] += 1
		print("You found salt! Total salt: %d" % inventory["salt"])
		# Deplete saltflats after 4 harvest, turn into most abundant walkable neighbor
		if forest_harvest_counts[player_tile] >= 4:
			var max_radius = 20
			var found = false
			var neighbor_counts = {}
			var new_tile = 3 # TILE_DESERTSAND, update this if you have a constant
			for radius in range(1, max_radius + 1):
				neighbor_counts.clear()
				for dx in range(-radius, radius + 1):
					for dy in range(-radius, radius + 1):
						if dx == 0 and dy == 0:
							continue
						var neighbor_tile = player_tile + Vector2i(dx, dy)
						var neighbor_type = tilemap.get_cell_source_id(0, neighbor_tile)
						if neighbor_type != TILE_SALTFLATS and neighbor_type != TILE_WALL and neighbor_type != TILE_MOUNTAIN:
							neighbor_counts[neighbor_type] = neighbor_counts.get(neighbor_type, 0) + 1
				if neighbor_counts.size() > 0:
					var max_count = 0
					for neighbor_type in neighbor_counts.keys():
						if neighbor_counts[neighbor_type] > max_count:
							max_count = neighbor_counts[neighbor_type]
							new_tile = neighbor_type
					found = true
					break
			# If nothing found after searching, default to sand (tile ID 3)
			tilemap.set_cell(0, player_tile, new_tile, Vector2i(0, 0), 0)
			tilemap.modified_tiles[player_tile] = new_tile
			print("The saltflats have been depleted and turned into tile ID %d!" % new_tile)
			forest_harvest_counts.erase(player_tile)
	update_inventory_ui()
	update_crafting_book()
