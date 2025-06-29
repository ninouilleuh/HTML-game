shader_type canvas_item;

uniform vec2 player_screen_pos;
uniform float vision_radius = 200.0;

void fragment() {
    float dist = distance(UV * vec2(textureSize(TEXTURE, 0)), player_screen_pos);
    if (dist < vision_radius) {
        COLOR.a = 0.0; // fully transparent (visible)
    } else {
        COLOR.a = 0.8; // mostly opaque (darkness)
    }
}
