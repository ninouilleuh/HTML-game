extends Node2D

# This script manages the cave map generation and player entry

@onready var tilemap: TileMap = $TileMap

const TILE_MOUNTAIN = 5
const TILE_HILL = 8


# Generate the cave map when the scene is loaded
func _ready():
	generate_cave_map()

# Called from main.gd when player enters a cave entrance
func enter_cave(player):
	generate_cave_map()
	# Move player to the center of the cave
	var cave_center = Vector2i(16, 16)
	player.position = tilemap.map_to_local(cave_center)
	player.set_process(false)
	await get_tree().create_timer(0.1).timeout
	player.set_process(true)

func generate_cave_map():
	# Clear any previous cave tiles
	tilemap.clear()
	var cave_size = 32
	for x in range(cave_size):
		for y in range(cave_size):
			var cave_pos = Vector2i(x, y)
			if x == 0 or y == 0 or x == cave_size-1 or y == cave_size-1:
				tilemap.set_cell(0, cave_pos, TILE_MOUNTAIN, Vector2i(0,0), 0)
			else:
				tilemap.set_cell(0, cave_pos, TILE_HILL, Vector2i(0,0), 0)
