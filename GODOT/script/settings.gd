extends Control

var waiting_for_input := false
var waiting_for_action_input := false
var waiting_for_move_input := "" # "up", "down", "left", "right" or ""
var inventory_key := "i"
var action_key := "e"
var move_keys := {"up": "w", "down": "s", "left": "a", "right": "d"}
var config_path := "user_settings.cfg"

func _ready():
	load_keys()
	$InventoryLineEdit.text = inventory_key
	$InventoryLineEdit.editable = false
	$InventoryLineEdit.mouse_filter = Control.MOUSE_FILTER_STOP
	$InventoryLineEdit.connect("gui_input", Callable(self, "_on_inventory_lineedit_gui_input"))

	$ActionLineEdit.text = action_key
	$ActionLineEdit.editable = false
	$ActionLineEdit.mouse_filter = Control.MOUSE_FILTER_STOP
	$ActionLineEdit.connect("gui_input", Callable(self, "_on_action_lineedit_gui_input"))

	$MoveUpLineEdit.text = move_keys["up"]
	$MoveUpLineEdit.editable = false
	$MoveUpLineEdit.mouse_filter = Control.MOUSE_FILTER_STOP
	$MoveUpLineEdit.connect("gui_input", Callable(self, "_on_moveup_lineedit_gui_input"))

	$MoveDownLineEdit.text = move_keys["down"]
	$MoveDownLineEdit.editable = false
	$MoveDownLineEdit.mouse_filter = Control.MOUSE_FILTER_STOP
	$MoveDownLineEdit.connect("gui_input", Callable(self, "_on_movedown_lineedit_gui_input"))

	$MoveLeftLineEdit.text = move_keys["left"]
	$MoveLeftLineEdit.editable = false
	$MoveLeftLineEdit.mouse_filter = Control.MOUSE_FILTER_STOP
	$MoveLeftLineEdit.connect("gui_input", Callable(self, "_on_moveleft_lineedit_gui_input"))

	$MoveRightLineEdit.text = move_keys["right"]
	$MoveRightLineEdit.editable = false
	$MoveRightLineEdit.mouse_filter = Control.MOUSE_FILTER_STOP
	$MoveRightLineEdit.connect("gui_input", Callable(self, "_on_moveright_lineedit_gui_input"))

	$MainMenuButton.pressed.connect(_on_mainmenu_button_pressed)

func _on_mainmenu_button_pressed():
	get_tree().change_scene_to_file("res://scenes/MainMenu.tscn")
	
func _on_inventory_lineedit_gui_input(event):
	if event is InputEventMouseButton and event.pressed:
		$InventoryLineEdit.text = "waiting for input"
		waiting_for_input = true
		$InventoryLineEdit.editable = false

func _on_action_lineedit_gui_input(event):
	if event is InputEventMouseButton and event.pressed:
		$ActionLineEdit.text = "waiting for input"
		waiting_for_action_input = true
		$ActionLineEdit.editable = false

func _on_moveup_lineedit_gui_input(event):
	if event is InputEventMouseButton and event.pressed:
		$MoveUpLineEdit.text = "waiting for input"
		waiting_for_move_input = "up"
		$MoveUpLineEdit.editable = false

func _on_movedown_lineedit_gui_input(event):
	if event is InputEventMouseButton and event.pressed:
		$MoveDownLineEdit.text = "waiting for input"
		waiting_for_move_input = "down"
		$MoveDownLineEdit.editable = false

func _on_moveleft_lineedit_gui_input(event):
	if event is InputEventMouseButton and event.pressed:
		$MoveLeftLineEdit.text = "waiting for input"
		waiting_for_move_input = "left"
		$MoveLeftLineEdit.editable = false

func _on_moveright_lineedit_gui_input(event):
	if event is InputEventMouseButton and event.pressed:
		$MoveRightLineEdit.text = "waiting for input"
		waiting_for_move_input = "right"
		$MoveRightLineEdit.editable = false

func _unhandled_input(event):
	if waiting_for_input and event is InputEventKey and event.pressed:
		inventory_key = OS.get_keycode_string(event.keycode)
		$InventoryLineEdit.text = inventory_key
		waiting_for_input = false
		$InventoryLineEdit.editable = false
		update_input_map()
		save_keys()
	elif waiting_for_action_input and event is InputEventKey and event.pressed:
		action_key = OS.get_keycode_string(event.keycode)
		$ActionLineEdit.text = action_key
		waiting_for_action_input = false
		$ActionLineEdit.editable = false
		update_input_map()
		save_keys()
	elif waiting_for_move_input != "" and event is InputEventKey and event.pressed:
		var dir = waiting_for_move_input
		move_keys[dir] = OS.get_keycode_string(event.keycode)
		match dir:
			"up": $MoveUpLineEdit.text = move_keys["up"]
			"down": $MoveDownLineEdit.text = move_keys["down"]
			"left": $MoveLeftLineEdit.text = move_keys["left"]
			"right": $MoveRightLineEdit.text = move_keys["right"]
		waiting_for_move_input = ""
		$MoveUpLineEdit.editable = false
		$MoveDownLineEdit.editable = false
		$MoveLeftLineEdit.editable = false
		$MoveRightLineEdit.editable = false
		update_input_map()
		save_keys()

func update_input_map():
	# Inventory
	InputMap.action_erase_events("inventory")
	var ev = InputEventKey.new()
	ev.keycode = OS.find_keycode_from_string(inventory_key)
	InputMap.action_add_event("inventory", ev)
	# Action
	InputMap.action_erase_events("action")
	var ev_action = InputEventKey.new()
	ev_action.keycode = OS.find_keycode_from_string(action_key)
	InputMap.action_add_event("action", ev_action)
	# Movement
	var move_map = {"move_up": move_keys["up"], "move_down": move_keys["down"], "move_left": move_keys["left"], "move_right": move_keys["right"]}
	for action in move_map.keys():
		InputMap.action_erase_events(action)
		var move_ev = InputEventKey.new()
		move_ev.keycode = OS.find_keycode_from_string(move_map[action])
		InputMap.action_add_event(action, move_ev)


func save_keys():
	var config = ConfigFile.new()
	var err = config.load(config_path)
	config.set_value("controls", "inventory", inventory_key)
	config.set_value("controls", "action", action_key)
	config.set_value("controls", "move_up", move_keys["up"])
	config.set_value("controls", "move_down", move_keys["down"])
	config.set_value("controls", "move_left", move_keys["left"])
	config.set_value("controls", "move_right", move_keys["right"])
	config.save(config_path)

func load_keys():
	var config = ConfigFile.new()
	var err = config.load(config_path)
	inventory_key = config.get_value("controls", "inventory", "i")
	action_key = config.get_value("controls", "action", "e")
	move_keys["up"] = config.get_value("controls", "move_up", "w")
	move_keys["down"] = config.get_value("controls", "move_down", "s")
	move_keys["left"] = config.get_value("controls", "move_left", "a")
	move_keys["right"] = config.get_value("controls", "move_right", "d")
	update_input_map()
