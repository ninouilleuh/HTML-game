extends Node2D

# player
var player
# time 
var time_of_day := 6.00 # Start at 6:00 (morning)
var day := 1
const HOURS_PER_DAY := 24
const SECONDS_PER_HOUR := 60.0 # 1 hour = 1 minute real time
# Dictionaries
var inventory = {"stick" : 0, "big_stick":0, "salt":0
}
var item_icons = {
	"stick": preload("res://assets/stick.png"),
	"big_stick": preload("res://assets/big_stick.png"),
	"campfire": preload("res://assets/campfire.png"),
	"wall": preload("res://assets/wall.png"),
	"salt": preload("res://assets/salt.png"),
	"leather": preload("res://assets/leather.png")
}
var recipes = {
	"campfire": ["stick", "stick", "stick"],
	"wall": ["big_stick","big_stick","big_stick","big_stick"],
	"big_stick": ["stick","stick","stick","stick","stick","stick"],
	"crafting_table" : ["big_stick","big_stick","big_stick","big_stick","big_stick","big_stick","big_stick","big_stick","big_stick","big_stick","big_stick","big_stick","big_stick","big_stick","big_stick","big_stick","big_stick","big_stick","big_stick","big_stick","big_stick","big_stick","big_stick","big_stick","big_stick","big_stick","big_stick","big_stick","big_stick","big_stick","big_stick","big_stick","big_stick","big_stick","big_stick","big_stick","big_stick","big_stick","big_stick","big_stick","big_stick","big_stick","big_stick","big_stick","big_stick","big_stick","big_stick","big_stick","big_stick", "reed","reed","reed","reed","reed","reed","reed","reed","reed","reed"], #50, 10
	
	"axe" : ["big_stick","big_stick"], #need crafting table
	"rope" : ["reed"], #need crafting table
	"carpet" : ["reed", "leather"], #need crafting table
	"door" : ["reed"], #need crafting table 
	"trap" :  ["reed"], #need crafting table 
	"shovel" :  ["reed"], #need crafting table 
	"cauldron" :  ["iron"], #need crafting table 
	"knife" :  ["iron"], #need crafting table
	"whistle" :  ["iron"], #need crafting table
	"hat" : ["leather"], #need crafting table
	"gloves" : ["leather"], #need crafting table
	"scarecrow" : ["leather"], #need crafting table
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
var wall_scene = preload("res://scenes/wall.tscn")
const TILE_MOUNTAIN = 5
const TILE_GRASS = 2 # Use your actual grass tile ID
# Cave entrance tile ID (choose a unique unused tile ID)
const TILE_HILL = 8 # Set this to the correct tile ID for hill tiles
const TILE_SALTFLATS = 15 # Set this to the correct tile ID for saltflats
# Cave entrance tile ID (choose a unique unused tile ID)
const TILE_CAVE_ENTRANCE = 20
# GROUPS
var pigs = []
var goats = []
var placed_campfires := [] # Array of Vector2i tile positions

# OTHER
var is_placing := false
var placing_item := ""
var preview_sprite = null
var selected_recipe_index := 0
var selected_inventory_index := 0
var ui_focus := "inventory" # or "crafting_book"


# DECONSTRUCTION MODE
var is_deconstructing := false
# Deconstruction selection system
var deconstruct_candidates := [] # Array of {node, type, tile, pos}
var deconstruct_selected_idx := 0
var deconstruct_highlight = null

var step_sound := preload("res://assets/sound/step.mp3")
var prev_player_pos = null
var step_player = null
var ui_sound := preload("res://assets/sound/ui_click.mp3")
var ui_player = null

var is_game_over := false # <-- Add this line

# Add a reference to the quick bar container
var quick_bar_container = null

# Track the order in which items are acquired
var inventory_order := []

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
	# Generate initial chunks around the player
	tilemap.update_visible_chunks(player.position)
	spawn_pigs_on_grass(20)
	spawn_goats_on_mountains(10)
	var fog_tilemap = $NavigationRegion2D/FogTileMap
	# Add AudioStreamPlayer for UI sound
	ui_player = AudioStreamPlayer.new()
	ui_player.stream = ui_sound
	ui_player.volume_db = -20 # Higher volume for UI click sound
	ui_player.bus = "Master"
	add_child(ui_player)
	# Connect UI button signals to play sound
	if $UI.has_node("HarvestButton"):
		$UI/HarvestButton.pressed.connect(play_ui_sound)
	if $UI.has_node("InventoryButton"):
		$UI/InventoryButton.pressed.connect(play_ui_sound)
	if $UI.has_node("CraftingBookButton"):
		$UI/CraftingBookButton.pressed.connect(play_ui_sound)
	# Add QuickBar UI if not present
		quick_bar_container = $UI/QuickBar
		quick_bar_container.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		quick_bar_container.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	update_quick_bar()

# --- CAVE ENTRANCE SPAWN LOGIC ---
var placed_cave_count := 0
var max_caves := 5
var placed_cave_positions := []

# Call this from chunk generation logic, passing the chunk_coords and tilemap
func try_place_cave_in_chunk(tilemap, chunk_coords):
	if placed_cave_count >= max_caves:
		return
	var chunk_size = tilemap.chunk_size
	var start_x = chunk_coords.x * chunk_size
	var start_y = chunk_coords.y * chunk_size
	var possible_tiles = []
	for x in range(start_x, start_x + chunk_size):
		for y in range(start_y, start_y + chunk_size):
			# Not near world edge
			if x <= WORLD_MIN + 50 or x >= WORLD_MAX - 50 or y <= WORLD_MIN + 50 or y >= WORLD_MAX - 50:
				continue
			var tile_pos = Vector2i(x, y)
			var tile_type = tilemap.get_cell_source_id(0, tile_pos)
			if tile_type == TILE_MOUNTAIN and not tile_pos in placed_cave_positions:
				# Check minimum distance to all existing caves
				var too_close = false
				for cave_pos in placed_cave_positions:
					if tile_pos.distance_to(cave_pos) < 1000:
						too_close = true
						break
				if too_close:
					continue
				# Check neighbors: must have at least 2 non-mountain neighbors
				var non_mountain_neighbors = 0
				for dx in range(-1, 2):
					for dy in range(-1, 2):
						if dx == 0 and dy == 0:
							continue
						var neighbor = tile_pos + Vector2i(dx, dy)
						var neighbor_type = tilemap.get_cell_source_id(0, neighbor)
						if neighbor_type != TILE_MOUNTAIN:
							non_mountain_neighbors += 1
				if non_mountain_neighbors >= 2:
					possible_tiles.append(tile_pos)
	# Only a small chance to place a cave in this chunk
	var cave_chance = 50 # percent
	var did_place = false
	if possible_tiles.size() > 0:
		var roll = randi() % 100
		if roll < cave_chance:
			var idx = randi() % possible_tiles.size()
			var pos = possible_tiles[idx]
			tilemap.set_cell(0, pos, TILE_CAVE_ENTRANCE, Vector2i(0, 0), 0)
			tilemap.modified_tiles[pos] = TILE_CAVE_ENTRANCE
			placed_cave_positions.append(pos)
			placed_cave_count += 1
			print("Cave entrance placed at tile coordinate ", pos, " (total: ", placed_cave_count, ") in chunk ", chunk_coords, ". Roll was ", roll, " < ", cave_chance)
			did_place = true
		else:
			print("No cave placed in chunk ", chunk_coords, ". Roll was ", roll, " >= ", cave_chance, ". Possible tiles: ", possible_tiles.size())
	else:
		print("No cave placed in chunk ", chunk_coords, ". No possible mountain tiles with at least 2 non-mountain neighbors and 1000+ distance from other caves.")


#---- PROCESS FUNCTION ---

func _process(delta):
	# --- MAIN GAME PROCESS ---
	var in_cave = has_node("caves")
	$NavigationRegion2D/TileMap.visible = not in_cave
	$NavigationRegion2D/FogTileMap.visible = not in_cave

	# If in cave, skip all overworld logic (handled by caves.gd)
	if in_cave:
		return

	# --- OVERWORLD LOGIC ---
	var tilemap = $NavigationRegion2D/TileMap
	var player_tile = tilemap.local_to_map(player.position)
	var tile_type = tilemap.get_cell_source_id(0, player_tile)

	tilemap.update_visible_chunks(player.position)
	update_quick_bar()
	if player:
		update_fog_of_war()

	# --- CAVE ENTRANCE HANDLING ---
	if tile_type == TILE_CAVE_ENTRANCE and not has_node("caves"):
		print("Entering cave at ", player_tile)
		for pig in pigs:
			pig.queue_free()
		pigs.clear()
		for goat in goats:
			goat.queue_free()
		goats.clear()
		var caves_scene = preload("res://scenes/caves.tscn").instantiate()
		caves_scene.name = "caves"
		add_child(caves_scene)
		if caves_scene.has_method("enter_cave"):
			caves_scene.enter_cave(player)

	# --- TIME ADVANCE ---
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

	# --- NIGHT & FOREST DARKNESS ---
	var overlay = $CanvasLayer/DayNightOverlay
	var night_strength = 0
	if time_of_day < 6.0:
		night_strength = int((6.0 - time_of_day) / 6.0 * 255)
	elif time_of_day > 18.0:
		night_strength = int((time_of_day - 18.0) / 6.0 * 255)
	else:
		night_strength = 0

	if tile_type == TILE_FOREST:
		var forest_count = 0
		var radius = 2
		for dx in range(-radius, radius + 1):
			for dy in range(-radius, radius + 1):
				var check_tile = player_tile + Vector2i(dx, dy)
				if tilemap.get_cell_source_id(0, check_tile) == TILE_FOREST:
					forest_count += 1
		var total_tiles = pow((radius * 2 + 1), 2)
		var forest_darkness = int(210 * (forest_count / total_tiles))
		night_strength = min(night_strength + forest_darkness, 255)

	if player_tile.x > WORLD_MAX - 50 or player_tile.x < WORLD_MIN + 50 or player_tile.y > WORLD_MAX - 50 or player_tile.y < WORLD_MIN + 50:
		overlay.color.a = 1
	else:
		overlay.color.a = night_strength / 255.0

	# --- HARVEST BUTTON ---
	# Show harvest button if on forest, saltflats, or standing on a reed (AnimatedSprite2D with reed sprite_frames)
	var on_reed = false
	for child in tilemap.get_children():
		if child is AnimatedSprite2D:
			var reed_tile = tilemap.local_to_map(child.position)
			if reed_tile == player_tile:
				if child.sprite_frames and child.sprite_frames.resource_path.find("reed") != -1:
					on_reed = true
					break
	$UI/HarvestButton.visible = (tile_type == TILE_FOREST or tile_type == TILE_SALTFLATS or on_reed)
	if Input.is_action_just_released("action") and (tile_type == TILE_FOREST or tile_type == TILE_SALTFLATS or on_reed) and not $UI/CraftingBookWindow.visible:
		_on_harvest_button_pressed()

	# --- PLACING ITEM ---
	if Input.is_action_just_released("place") and placing_item != "":
		place_object_on_tile(placing_item, player_tile)
		if inventory[placing_item] <= 0:
			is_placing = false
			placing_item = ""
			if preview_sprite:
				preview_sprite.queue_free()
				preview_sprite = null
			update_mode_indicator() # Hide building mode label if no more item

	# --- UI NAVIGATION & FOCUS LOGIC ---
	var inventory_open = $UI/InventoryWindow.visible
	var crafting_open = $UI/CraftingBookWindow.visible

	# Deactivate deconstruction mode if inventory is opened
	if inventory_open and is_deconstructing:
		is_deconstructing = false
		update_mode_indicator()

	var items = []
	for item_name in inventory.keys():
		if inventory[item_name] > 0:
			items.append(item_name)
	var recipe_names = recipes.keys()

	if crafting_open and not inventory_open:
		# Crafting book navigation
		if Input.is_action_just_released("ui_up"):
			selected_recipe_index = max(0, selected_recipe_index - 1)
			update_crafting_book()
		elif Input.is_action_just_released("ui_down"):
			selected_recipe_index = min(recipe_names.size() - 1, selected_recipe_index + 1)
			update_crafting_book()
		elif Input.is_action_just_released("action"):
			var selected_recipe = recipe_names[selected_recipe_index]
			if can_craft(selected_recipe):
				craft_item(selected_recipe)
				update_inventory_ui()
				update_crafting_book()

	if inventory_open and not crafting_open:
		# Inventory navigation
		if Input.is_action_just_released("ui_right"):
			selected_inventory_index = min(items.size() - 1, selected_inventory_index + 1)
			update_inventory_ui()
		elif Input.is_action_just_released("ui_left"):
			selected_inventory_index = max(0, selected_inventory_index - 1)
			update_inventory_ui()
		elif Input.is_action_just_released("action"):
			# Always recalculate the current items list in slot order
			var current_items = []
			for n in inventory_order:
				if inventory.has(n) and inventory[n] > 0:
					current_items.append(n)
			for n in inventory.keys():
				if inventory[n] > 0 and not inventory_order.has(n):
					current_items.append(n)
			if current_items.size() > 0 and selected_inventory_index < current_items.size():
				var item_name = current_items[selected_inventory_index]
				if item_name == "campfire" or item_name == "wall":
					is_placing = true
					placing_item = item_name
					$UI/InventoryWindow.visible = false
					update_mode_indicator() # Show building mode label immediately

	elif inventory_open and crafting_open:
		# Focus switching
		if Input.is_action_just_released("ui_right") or Input.is_action_just_released("ui_left"):
			ui_focus = "inventory"
			update_inventory_ui()
			update_crafting_book()
		elif Input.is_action_just_released("ui_up") or Input.is_action_just_released("ui_down"):
			ui_focus = "crafting_book"
			update_inventory_ui()
			update_crafting_book()

		# Only the focused panel handles navigation and action
		if ui_focus == "inventory":
			if Input.is_action_just_released("ui_right"):
				selected_inventory_index = min(items.size() - 1, selected_inventory_index + 1)
				update_inventory_ui()
			elif Input.is_action_just_released("ui_left"):
				selected_inventory_index = max(0, selected_inventory_index - 1)
				update_inventory_ui()
			elif Input.is_action_just_released("action"):
				# Always recalculate the current items list in slot order
				var current_items = []
				for n in inventory_order:
					if inventory.has(n) and inventory[n] > 0:
						current_items.append(n)
				for n in inventory.keys():
					if inventory[n] > 0 and not inventory_order.has(n):
						current_items.append(n)
				if current_items.size() > 0 and selected_inventory_index < current_items.size():
					var item_name = current_items[selected_inventory_index]
					if item_name == "campfire" or item_name == "wall":
						is_placing = true
						placing_item = item_name
						$UI/InventoryWindow.visible = false
						update_mode_indicator() # Show building mode label immediately
		elif ui_focus == "crafting_book":
			if Input.is_action_just_released("ui_up"):
				selected_recipe_index = max(0, selected_recipe_index - 1)
				update_crafting_book()
			elif Input.is_action_just_released("ui_down"):
				selected_recipe_index = min(recipe_names.size() - 1, selected_recipe_index + 1)
				update_crafting_book()
			elif Input.is_action_just_released("action"):
				var selected_recipe = recipe_names[selected_recipe_index]
				if can_craft(selected_recipe):
					craft_item(selected_recipe)
					update_inventory_ui()
					update_crafting_book()

	# --- CAMPFIRE SHADER UPDATE ---
	var camera = get_viewport().get_camera_2d()
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
		mat.set_shader_parameter("radius", 160.0 * screen_scale)
		mat.set_shader_parameter("softness", 48.0 * screen_scale)
	
	


#----------------- GAME OVER ---------------------------
func game_over():
	is_game_over = true # <-- Add this line
	get_tree().paused = false  # Pause the game
	self.hide() # Optionally hide the main node to prevent further processing
	# Remove any existing GameOverScreen nodes before adding a new one
	for child in get_tree().get_root().get_children():
		if (child.name == "GameOverScreen") or ("CanvasLayer" in child.get_class() and child.has_method("get_scene_file_path") and child.get_scene_file_path() == "res://scenes/GameOverScreen.tscn"):
			child.queue_free()
	var game_over_scene = load("res://scenes/GameOverScreen.tscn").instantiate()
	game_over_scene.name = "GameOverScreen"
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
				if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT and not event.double_click:
					craft_item(recipe_name)
					update_inventory_ui()
					update_crafting_book()
			)
		recipe_list.add_child(hbox)

func update_inventory_ui():
	var slot_container = $UI/InventoryWindow/BackpackFrame/SlotContainer
	for child in slot_container.get_children():
		child.queue_free()

	# Remove items with 0 count from inventory_order
	for i in range(inventory_order.size() - 1, -1, -1):
		var item_name = inventory_order[i]
		if not inventory.has(item_name) or inventory[item_name] <= 0:
			inventory_order.remove_at(i)

	# Build items list in acquisition order
	var items = []
	for item_name in inventory_order:
		if inventory.has(item_name) and inventory[item_name] > 0:
			items.append(item_name)
	# Add any new items not yet in inventory_order
	for item_name in inventory.keys():
		if inventory[item_name] > 0 and not inventory_order.has(item_name):
			inventory_order.append(item_name)
			items.append(item_name)

	slot_container.set("custom_constants/vseparation", 12) # Add vertical margin between rows

	var total_slots = max(20, items.size()) # Always show at least 5 slots

	for i in range(total_slots):
		var slot = slot_scene.instantiate()
		slot.inventory_index = i
		slot.main_node = self
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

			# Only highlight selected slot, not mode
			var style = StyleBoxFlat.new()
			if is_selected:
				style.bg_color = Color(1, 1, 1, 0.7) # White with some transparency
				slot.add_theme_stylebox_override("panel", style)
				texture_rect.modulate = Color(1, 1, 1, 0.7) # White overlay on image
			else:
				slot.add_theme_stylebox_override("panel", null) # Reset to default
				texture_rect.modulate = Color(1, 1, 1, 1) # Normal image

			# Only connect for placeable items (after all setup)
			if item_name == "campfire" or item_name == "wall":
				# Always use the current slot's item_name from items array at click time
				texture_rect.gui_input.connect(func(event):
					if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT and event.double_click:
						# Find the current item for this slot index (in case of drag/drop reorder)
						var current_items = []
						for n in inventory_order:
							if inventory.has(n) and inventory[n] > 0:
								current_items.append(n)
						for n in inventory.keys():
							if inventory[n] > 0 and not inventory_order.has(n):
								current_items.append(n)
						if i < current_items.size():
							is_placing = true
							placing_item = current_items[i]
							$UI/InventoryWindow.visible = false
							update_mode_indicator() # Show building mode label immediately
				)
		else:
			texture_rect.texture = null
			label.text = ""
			texture_rect.modulate = Color(0.2, 0.2, 0.2, 1) # faded/gray

		slot_container.add_child(slot)

	# Clamp selected_inventory_index to valid range after UI update
	if selected_inventory_index >= items.size():
		selected_inventory_index = max(0, items.size() - 1)
	update_quick_bar()
	update_mode_indicator()

func update_mode_indicator():
	# Show a HUD indicator for deconstruction/building mode
	# Remove any duplicate ModeIndicator labels
	var mode_labels = []
	for child in $UI.get_children():
		if child is Label and child.name == "ModeIndicator":
			mode_labels.append(child)
	# Keep only one ModeIndicator, remove extras
	while mode_labels.size() > 1:
		var extra = mode_labels.pop_back()
		extra.queue_free()
	# Get or create the single ModeIndicator
	var mode_label: Label
	if mode_labels.size() == 1:
		mode_label = mode_labels[0]
	else:
		mode_label = Label.new()
		mode_label.name = "ModeIndicator"
		mode_label.position = Vector2(24, 24)
		mode_label.z_index = 10000
		mode_label.add_theme_color_override("font_color", Color(1,0,0,1))
		mode_label.add_theme_font_size_override("font_size", 32)
		$UI.add_child(mode_label)
	if is_deconstructing:
		mode_label.text = "DECONSTRUCTION MODE"
		mode_label.visible = true
		mode_label.add_theme_color_override("font_color", Color(1,0,0,1))
	elif is_placing:
		mode_label.text = "BUILDING MODE"
		mode_label.visible = true
		mode_label.add_theme_color_override("font_color", Color(0.2,0.8,1,1))
	else:
		mode_label.visible = false

func update_quick_bar():
	if not quick_bar_container:
		return
	for child in quick_bar_container.get_children():
		child.queue_free()
	# Remove items with 0 count from inventory_order
	for i in range(inventory_order.size() - 1, -1, -1):
		var item_name = inventory_order[i]
		if not inventory.has(item_name) or inventory[item_name] <= 0:
			inventory_order.remove_at(i)
	# Build items list in acquisition order
	var items = []
	for item_name in inventory_order:
		if inventory.has(item_name) and inventory[item_name] > 0:
			items.append(item_name)
	# Add any new items not yet in inventory_order
	for item_name in inventory.keys():
		if inventory[item_name] > 0 and not inventory_order.has(item_name):
			inventory_order.append(item_name)
			items.append(item_name)
	for i in range(5):
		var slot = PanelContainer.new()
		slot.custom_minimum_size = Vector2(64, 64)
		var hbox = VBoxContainer.new()
		hbox.size_flags_vertical = Control.SIZE_EXPAND_FILL
		var icon = TextureRect.new()
		icon.expand = true
		icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		icon.custom_minimum_size = Vector2(48, 48)
		var label = Label.new()
		label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		label.vertical_alignment = VERTICAL_ALIGNMENT_BOTTOM
		if i < items.size():
			var item_name = items[i]
			icon.texture = item_icons.get(item_name, null)
			label.text = "%d" % [inventory[item_name]]
		else:
			icon.texture = null
			label.text = ""
		hbox.add_child(icon)
		hbox.add_child(label)
		slot.add_child(hbox)
		quick_bar_container.add_child(slot)

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
	update_quick_bar()

	# Clamp selected_inventory_index to valid range after crafting
	var items := []
	for item_name in inventory.keys():
		if inventory[item_name] > 0:
			items.append(item_name)
	if selected_inventory_index >= items.size():
		selected_inventory_index = max(0, items.size() - 1)

func place_object_on_tile(item_name, tile):
	var tilemap = $NavigationRegion2D/TileMap
	# Prevent placement near world edge
	if tile.x > WORLD_MAX - 50 or tile.x < WORLD_MIN + 50 or tile.y > WORLD_MAX - 50 or tile.y < WORLD_MIN + 50:
		return # Do not place anything near the edge
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
		var wall = wall_scene.instantiate()
		wall.position = tilemap.map_to_local(tile)
		wall.name = "Wall_%s_%s" % [tile.x, tile.y]
		wall.add_to_group("walls")
		tilemap.add_child(wall)
		inventory[item_name] -= 1
		update_inventory_ui()
		update_quick_bar()

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
				# Don't overwrite edge fog
				if (
					x < tilemap.WORLD_MIN + 50 or x > tilemap.WORLD_MAX - 50 or
					y < tilemap.WORLD_MIN + 50 or y > tilemap.WORLD_MAX - 50
				):
					continue
				fog_tilemap.set_cell(0, Vector2i(x, y), 1, Vector2i(0, 0), 0)

	# 2. Remove fog for visible tiles
	for pos in fov_tiles.keys():
		if (
			pos.x < tilemap.WORLD_MIN + 50 or pos.x > tilemap.WORLD_MAX - 50 or
			pos.y < tilemap.WORLD_MIN + 50 or pos.y > tilemap.WORLD_MAX - 50
		):
			continue # Never clear edge fog
		fog_tilemap.set_cell(0, pos, -1) # -1 removes the fog tile

	# 3. Remove fog around each campfire
	var campfire_radius = 8 # Adjust as needed
	for campfire in get_tree().get_nodes_in_group("campfires"):
		var campfire_tile = tilemap.local_to_map(campfire.position)
		var olive_radius_x = 12 # horizontal radius (wider)
		var olive_radius_y = 6  # vertical radius (narrower)
		for dx in range(-olive_radius_x, olive_radius_x + 1):
			for dy in range(-olive_radius_y, olive_radius_y + 1):
				if (pow(dx / float(olive_radius_x), 2) + pow(dy / float(olive_radius_y), 2)) <= 1.0:
					var pos = campfire_tile + Vector2i(dx, dy)
					if (
						pos.x < tilemap.WORLD_MIN + 50 or pos.x > tilemap.WORLD_MAX - 50 or
						pos.y < tilemap.WORLD_MIN + 50 or pos.y > tilemap.WORLD_MAX - 50
					):
						continue # Never clear edge fog
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
			y = randi_range(500, 500)
		else:
			y = randi_range(-500, -500)
		var x = randi_range(WORLD_MIN, WORLD_MAX)
		var chunk_size = tilemap.chunk_size
		var chunk_coords = Vector2i(floor(x / chunk_size), floor(y / chunk_size))
		if not tilemap.active_chunks.has(chunk_coords):
			tilemap.generate_chunk(chunk_coords)
		var tile_type = tilemap.get_cell_source_id(0, Vector2i(x, y))
		if tile_type != TILE_MOUNTAIN :
			return Vector2i(x,y )
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
	var player_tile = tilemap.local_to_map(player.position)

	while spawned < count and tries < count * 50:
		# Pick a random loaded chunk
		var chunk_coords = loaded_chunks[randi() % loaded_chunks.size()]
		var start_x = chunk_coords.x * chunk_size
		var start_y = chunk_coords.y * chunk_size

		# Pick a random tile within the chunk
		var x = start_x + randi() % chunk_size
		var y = start_y + randi() % chunk_size
		var tile_pos = Vector2i(x, y)
		# Prevent spawn near world edge
		if x > WORLD_MAX - 50 or x < WORLD_MIN + 50 or y > WORLD_MAX - 50 or y < WORLD_MIN + 50:
			tries += 1
			continue
		var tile_type = tilemap.get_cell_source_id(0, tile_pos)

		# Check grass and distance to other pigs and player
		var too_close = false
		for pig in pigs:
			var pig_tile = tilemap.local_to_map(pig.position)
			if pig_tile.distance_to(tile_pos) < min_distance:
				too_close = true
				break
		if player_tile.distance_to(tile_pos) < 15:
			too_close = true
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
	var player_tile = tilemap.local_to_map(player.position)
	var min_goat_distance = 50 # Minimum distance between goats (in tiles)
	var min_player_distance = 50 # Minimum distance from player (in tiles)
	while spawned < count and tries < count * 100:
		var chunk_coords = loaded_chunks[randi() % loaded_chunks.size()]
		var start_x = chunk_coords.x * chunk_size
		var start_y = chunk_coords.y * chunk_size
		var x = start_x + randi() % chunk_size
		var y = start_y + randi() % chunk_size
		var tile_pos = Vector2i(x, y)
		# Prevent spawn near world edge
		if x > WORLD_MAX - 50 or x < WORLD_MIN + 50 or y > WORLD_MAX - 50 or y < WORLD_MIN + 50:
			tries += 1
			continue
		var tile_type = tilemap.get_cell_source_id(0, tile_pos)
		# Enforce minimum distance to all existing goats and player
		var too_close = false
		for goat in goats:
			var goat_tile = tilemap.local_to_map(goat.position)
			if goat_tile.distance_to(tile_pos) < min_goat_distance:
				too_close = true
				break
		if player_tile.distance_to(tile_pos) < min_player_distance:
			too_close = true
		if tile_type == TILE_MOUNTAIN and not too_close:
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
	if event.is_action_pressed("deconstruction"):
	   # Only allow toggling deconstruction mode if inventory is not visible
		if not $UI/InventoryWindow.visible:
			is_deconstructing = not is_deconstructing
			play_ui_sound()
			update_mode_indicator()
			if is_deconstructing:
				print("Deconstruction mode ON")
			else:
				print("Deconstruction mode OFF")
		else:
			print("[DEBUG] Cannot activate deconstruction mode while inventory is open.")

	# --- DECONSTRUCTION ACTION (E) ---
	if event.is_action_pressed("action"):
		print("[DEBUG] _input: action pressed. is_deconstructing=%s, placing_item=%s" % [is_deconstructing, placing_item])
		if is_deconstructing:
			update_mode_indicator()
			var tilemap = $NavigationRegion2D/TileMap
			var player_tile = tilemap.local_to_map(player.position)
			var directions = [Vector2i(0,0), Vector2i(1,0), Vector2i(-1,0), Vector2i(0,1), Vector2i(0,-1)]
			# Gather all candidates
			deconstruct_candidates.clear()
			for dir in directions:
				var check_tile = player_tile + dir
				var check_pos = tilemap.map_to_local(check_tile)
				for wall in tilemap.get_children():
					if wall.is_in_group("walls") and wall.position.distance_to(check_pos) < 2.0:
						deconstruct_candidates.append({"node": wall, "type": "wall", "tile": check_tile, "pos": wall.position})
				for campfire in get_tree().get_nodes_in_group("campfires"):
					var campfire_tile = tilemap.local_to_map(campfire.position)
					if campfire_tile == check_tile:
						deconstruct_candidates.append({"node": campfire, "type": "campfire", "tile": check_tile, "pos": campfire.position})
			if deconstruct_candidates.size() == 0:
				print("[DEBUG] No wall or campfire found to deconstruct in adjacent tiles.")
				if deconstruct_highlight:
					deconstruct_highlight.queue_free()
					deconstruct_highlight = null
				return
			elif deconstruct_candidates.size() == 1:
				# Only one candidate, deconstruct immediately
				var obj = deconstruct_candidates[0]
				_deconstruct_object(obj)
				if deconstruct_highlight:
					deconstruct_highlight.queue_free()
					deconstruct_highlight = null
				return
			else:
				# Multiple candidates, cycle selection
				if deconstruct_highlight:
					deconstruct_highlight.queue_free()
					deconstruct_highlight = null
				if deconstruct_selected_idx >= deconstruct_candidates.size():
					deconstruct_selected_idx = 0
				var obj = deconstruct_candidates[deconstruct_selected_idx]
				_show_deconstruct_highlight(obj.pos)
				print("[DEBUG] Multiple candidates. Highlighting idx %d: %s at %s" % [deconstruct_selected_idx, obj.type, obj.pos])
				deconstruct_selected_idx += 1
				if deconstruct_selected_idx >= deconstruct_candidates.size():
					deconstruct_selected_idx = 0
				# To confirm deconstruction, require a second key (e.g., Enter) or double E press
				# (You can refine this with a timer or use another key for confirmation)

	if is_deconstructing and event.is_action_pressed("ui_accept") and deconstruct_candidates.size() > 1:
		update_mode_indicator()
		# Confirm deconstruction of currently highlighted
		var idx = (deconstruct_selected_idx - 1 + deconstruct_candidates.size()) % deconstruct_candidates.size()
		var obj = deconstruct_candidates[idx]
		_deconstruct_object(obj)
		if deconstruct_highlight:
			deconstruct_highlight.queue_free()
			deconstruct_highlight = null
		deconstruct_candidates.clear()
		deconstruct_selected_idx = 0

func _deconstruct_object(obj):
	if obj.type == "wall":
		obj.node.queue_free()
		if not inventory.has("wall"):
			inventory["wall"] = 0
		inventory["wall"] += 1
	elif obj.type == "campfire":
		obj.node.queue_free()
		if not inventory.has("campfire"):
			inventory["campfire"] = 0
		inventory["campfire"] += 1
	update_inventory_ui()
	update_quick_bar()

func _show_deconstruct_highlight(pos):
	if deconstruct_highlight:
		deconstruct_highlight.queue_free()
	deconstruct_highlight = ColorRect.new()
	deconstruct_highlight.color = Color(1,0,0,0.3)
	deconstruct_highlight.size = Vector2(32,32)
	deconstruct_highlight.position = pos - Vector2(16,16)
	deconstruct_highlight.z_index = 1000
	add_child(deconstruct_highlight)
	# Add to the bottom of the file for input mapping instructions
	# You must add an input action named "deconstruct" in your Godot project settings and bind it to a key (e.g., X)

func play_ui_sound():
	if ui_player:
		ui_player.play()

func _on_crafting_book_button_pressed() -> void:
	play_ui_sound()
	$UI/CraftingBookWindow.visible = not $UI/CraftingBookWindow.visible
	if $UI/CraftingBookWindow.visible:
		selected_recipe_index = 0
		update_crafting_book()

func _on_inventory_button_pressed() -> void:
	play_ui_sound()
	$UI/InventoryWindow.visible = not $UI/InventoryWindow.visible

func _on_harvest_button_pressed() -> void:
	play_ui_sound()
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
						if neighbor_type != TILE_FOREST :
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
						if neighbor_type != TILE_SALTFLATS and neighbor_type != TILE_MOUNTAIN:
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
	else:
		# Check for reed harvest: standing on wetland with a reed node present
		var reed_found = false
		# Find all reed nodes in the scene
		for child in tilemap.get_children():
			if child is AnimatedSprite2D:
				# Check if the reed is at the player's tile (allow some pixel tolerance)
				var reed_tile = tilemap.local_to_map(child.position)
				if reed_tile == player_tile:
					# Optionally check for the correct sprite_frames resource to confirm it's a reed
					if child.sprite_frames and child.sprite_frames.resource_path.find("reed") != -1:
						reed_found = true
						child.queue_free()
						if not inventory.has("reed"):
							inventory["reed"] = 0
						inventory["reed"] += 1
						print("You harvested a reed! Total reeds: %d" % inventory["reed"])
						break
		if not reed_found:
			print("No reed to harvest at this location.")
	update_inventory_ui()
	update_crafting_book()
	# Play step sound if player is moving
func _on_step_player_finished():
	# Only loop if player is still moving
	if player and player.position != prev_player_pos:
		step_player.play()

func swap_inventory_slots(from_index: int, to_index: int) -> void:
	# Only swap if both indices are valid and not the same
	if from_index == to_index:
		return
	if from_index < 0 or from_index >= inventory_order.size():
		return
	if to_index < 0 or to_index >= inventory_order.size():
		return
	# Swap the items in inventory_order using a temporary variable
	var temp = inventory_order[from_index]
	inventory_order[from_index] = inventory_order[to_index]
	inventory_order[to_index] = temp
	update_inventory_ui()
	update_quick_bar()
