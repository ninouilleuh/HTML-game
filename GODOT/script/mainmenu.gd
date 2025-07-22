extends Control

func _ready():
	$NewGameButton.pressed.connect(_on_new_game_pressed)
	$LoadGameButton.pressed.connect(_on_load_game_pressed)
	$SettingsButton.pressed.connect(_on_settings_pressed)
	$QuitButton.pressed.connect(_on_quit_pressed)

func _on_new_game_pressed():
	# Replace with your main game scene path
	get_tree().change_scene_to_file("res://scenes/main.tscn")

func _on_load_game_pressed():
	# Implement your load game logic here
	print("Load Game pressed")

func _on_settings_pressed():
	get_tree().change_scene_to_file("res://scenes/settings.tscn")

func _on_quit_pressed():
	get_tree().quit()
