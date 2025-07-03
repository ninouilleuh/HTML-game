extends Control

# Draws a red X (cross) over the control area
func _draw():
	var cross_color = Color(1, 0, 0, 0.95)
	var thickness = 4.0
	var margin = 10.0
	var size = get_size()
	draw_line(Vector2(margin, margin), Vector2(size.x - margin, size.y - margin), cross_color, thickness)
	draw_line(Vector2(margin, size.y - margin), Vector2(size.x - margin, margin), cross_color, thickness)
