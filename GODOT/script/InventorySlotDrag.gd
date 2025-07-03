extends Panel

var inventory_index := -1
var main_node = null

func _ready():
	# Ensure TextureRect forwards mouse events to this Panel for drag-and-drop
	var tex_rect = get_node_or_null("Control/TextureRect")
	if tex_rect:
		tex_rect.mouse_filter = Control.MOUSE_FILTER_PASS
		tex_rect.connect("gui_input", Callable(self, "_on_texture_rect_gui_input"))
	# Ensure Panel receives mouse events
	mouse_filter = Control.MOUSE_FILTER_STOP
	# Force minimum size for drag-and-drop debug
	custom_minimum_size = Vector2(64, 64)
	# Print size and position for debug
	# Removed debug red border

func gui_input(event):
	print("[DEBUG] Panel gui_input event:", event)
	# Let Godot handle drag automatically

func _on_texture_rect_gui_input(event):
	# Forward mouse events to the Panel for drag-and-drop
	if event is InputEventMouseButton or event is InputEventMouseMotion:
		print("[DEBUG] Forwarding mouse event from TextureRect to Panel:", event)
		propagate_call("gui_input", [event])

func _get_drag_data(position):
	print("[DEBUG] _get_drag_data called with position:", position)
	if inventory_index >= 0:
		print("[DEBUG] Drag started from slot index:", inventory_index)
		var preview = duplicate()
		preview.modulate = Color(1,1,1,0.7)
		set_drag_preview(preview)
		print("[DEBUG] Drag data:", {"inventory_index": inventory_index})
		return {"inventory_index": inventory_index}

func _can_drop_data(position, data):
	var can_drop = typeof(data) == TYPE_DICTIONARY and data.has("inventory_index")
	print("[DEBUG] Can drop on slot index", inventory_index, ":", can_drop, "Data:", data)
	return can_drop

func _drop_data(position, data):
	if typeof(data) == TYPE_DICTIONARY and data.has("inventory_index") and main_node:
		print("[DEBUG] Dropping data on slot index", inventory_index, "from index", data["inventory_index"])
		main_node.swap_inventory_slots(data["inventory_index"], inventory_index)
