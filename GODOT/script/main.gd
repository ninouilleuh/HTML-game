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
}

const HOURS_PER_DAY := 24
const SECONDS_PER_HOUR := 60.0 # 1 hour = 1 minute real time
const TILE_FOREST = 0 
const WORLD_MIN = -5000
const WORLD_MAX = 5000

var unloaded_pigs := {} # Key: chunk_coords, Value: Array of pig data (e.g., positions)
const TILE_GRASS = 2 # Use your actual grass tile ID
var pig_scene = preload("res://scenes/pig.tscn")
var pigs = []

func _ready():
	# Instance the player scene
	var player_scene = preload("res://scenes/player.tscn")
	player = player_scene.instantiate()
	add_child(player)

	# Get the TileMap node
	var tilemap = $TileMap

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
	$TileMap.update_visible_chunks(player.position)
	
	# fade to dark at night (between 18:00 and 6:00)
	var overlay = $CanvasLayer/DayNightOverlay # Your ColorRect node
	# Calculate night_strength as a value between 0 (day) and 255 (midnight)
	var night_strength = 0
	if time_of_day < 6.0:
		night_strength = int((6.0 - time_of_day) / 6.0 * 255)
	elif time_of_day > 18.0:
		night_strength = int((time_of_day - 18.0) / 6.0 * 255)
	else:
		night_strength = 0

	# Set overlay alpha (convert 0–255 to 0.0–1.0)
	$CanvasLayer/DayNightOverlay.color.a = night_strength / 255.0

	# Show/Hide Harvest button if player is on a forest tile
	var tilemap = $TileMap
	var player_tile = tilemap.local_to_map(player.position)
	var tile_type = tilemap.get_cell_source_id(0, player_tile)
	$UI/HarvestButton.visible = (tile_type == TILE_FOREST)


func _on_harvest_button_pressed() -> void:
	var rand = randi() % 100
	if rand < 80:
		inventory["stick"] += 1
		print("You found a stick! Total sticks: %d" % inventory["stick"])
		update_inventory_ui()
	else:
		inventory["big_stick"] += 1
		print("You found a big stick! Total big sticks: %d" % inventory["big_stick"])
		update_inventory_ui()

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
		else:
			texture_rect.texture = null
			label.text = ""
			texture_rect.modulate = Color(0.2, 0.2, 0.2, 1) # faded/gray

		slot_container.add_child(slot)

func _on_inventory_button_pressed() -> void:
	$UI/InventoryWindow.visible = not $UI/InventoryWindow.visible
	if $UI/InventoryWindow.visible:
		update_inventory_ui()

func spawn_pigs_on_grass(count: int):
	var tilemap = $TileMap
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
			# When spawning a pig
			pig.chunk_coords = chunk_coords  
			pig.position = tilemap.map_to_local(tile_pos)
			add_child(pig)
			pigs.append(pig)
			spawned += 1
			print("pig spawned!")
		tries += 1
