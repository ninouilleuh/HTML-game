extends Control

var waiting_for_input := false
var inventory_key := "i"
var config_path := "user_settings.cfg"

func _ready():
	load_inventory_key()
	$InventoryLineEdit.text = inventory_key
	$InventoryLineEdit.editable = false
	$InventoryLineEdit.mouse_filter = Control.MOUSE_FILTER_STOP
	$InventoryLineEdit.connect("gui_input", Callable(self, "_on_inventory_lineedit_gui_input"))
	$MainMenuButton.pressed.connect(_on_mainmenu_button_pressed)

func _on_mainmenu_button_pressed():
	get_tree().change_scene_to_file("res://scenes/MainMenu.tscn")
	
func _on_inventory_lineedit_gui_input(event):
	if event is InputEventMouseButton and event.pressed:
		$InventoryLineEdit.text = "waiting for input"
		waiting_for_input = true
		$InventoryLineEdit.editable = false

func _unhandled_input(event):
	if waiting_for_input and event is InputEventKey and event.pressed:
		inventory_key = OS.get_keycode_string(event.keycode)
		$InventoryLineEdit.text = inventory_key
		waiting_for_input = false
		$InventoryLineEdit.editable = false
		update_input_map()
		save_inventory_key()

func update_input_map():
	InputMap.action_erase_events("inventory")
	var ev = InputEventKey.new()
	ev.keycode = OS.find_keycode_from_string(inventory_key)
	InputMap.action_add_event("inventory", ev)

func save_inventory_key():
	var config = ConfigFile.new()
	var err = config.load(config_path)
	config.set_value("controls", "inventory", inventory_key)
	config.save(config_path)

func load_inventory_key():
	var config = ConfigFile.new()
	var err = config.load(config_path)
	if err == OK:
		inventory_key = config.get_value("controls", "inventory", "i")
		update_input_map()
