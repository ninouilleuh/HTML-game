extends CanvasLayer



func _on_new_game_button_pressed() -> void:
	get_tree().paused = false  # Unpause in case it was paused  # Optional: clean name for debugging
	# Remove EVERYTHING from the root
	for child in get_tree().root.get_children():
		if child != self:  # ⬅️ 'self' is the GameOverScreen
			child.queue_free()
	
	# Wait one frame for them to be truly removed
	await get_tree().process_frame

	# Load and add the fresh main scene
	var main_scene = load("res://scenes/main.tscn").instantiate()
	main_scene.name = "Main"  # Optional but helpful for debugging
	get_tree().root.call_deferred("add_child", main_scene)
	self.queue_free()
