extends CanvasLayer



func _on_new_game_button_pressed() -> void:
	# Delete the save file
	var save_path = "user://savegame.json"
	if FileAccess.file_exists(save_path):
		var dir = DirAccess.open("user://")
		dir.remove("savegame.json")
	get_tree().paused = false  # Unpause in case it was paused
	# Remove all GameOverScreen and Main nodes from the root
	for child in get_tree().root.get_children():
		if child != self :
			child.queue_free()
	# Wait one frame for them to be truly removed
	await get_tree().process_frame
	# Load and add the fresh main scene
	var main_scene = load("res://scenes/main.tscn").instantiate()
	main_scene.name = "Main"  # Always set name for consistency
	get_tree().root.call_deferred("add_child", main_scene)
	self.queue_free()
