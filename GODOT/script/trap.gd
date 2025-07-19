extends Area2D

@export var open_texture: Texture = preload("res://assets/items/trap.png")
@export var closed_texture: Texture = preload("res://assets/items/closed trap.png")

var is_open := true
var trapped_entity = null

func _ready():
	$Sprite2D.texture = open_texture
	connect("body_entered", Callable(self, "_on_body_entered"))
	z_index = 100 # Ensure trap is drawn above most entities

func _on_body_entered(body):
	if not is_open:
		return
	if body.name == "Player":
		return
	# Trap the entity
	is_open = false
	trapped_entity = body
	$Sprite2D.texture = closed_texture
	# Move the entity to the center of the trap
	if body.has_method("set_global_position"):
		body.set_global_position(global_position)
	elif body.has_method("set_position"):
		body.set_position(global_position)
	elif body.has_method("global_position"):
		body.global_position = global_position
	# Stop the entity's movement
	if body.has_method("set_physics_process"):
		body.set_physics_process(false)
	if body.has_method("set_process"):
		body.set_process(false)
	if body.has_method("set_motion"):
		body.set_motion(Vector2.ZERO)

func release_trap():
	if trapped_entity:
		if trapped_entity.has_method("set_physics_process"):
			trapped_entity.set_physics_process(true)
		if trapped_entity.has_method("set_process"):
			trapped_entity.set_process(true)
	is_open = true
	trapped_entity = null
	$Sprite2D.texture = open_texture
