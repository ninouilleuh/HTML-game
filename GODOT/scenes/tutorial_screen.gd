extends CanvasLayer

func _input(event):
	if event.is_action_pressed("accept"):
		var main_scene = load("res://scenes/main.tscn").instantiate()
		get_tree().root.add_child(main_scene)
		self.queue_free()
