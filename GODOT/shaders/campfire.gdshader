shader_type canvas_item;

uniform float radius : hint_range(32, 512) = 160.0;
uniform float softness : hint_range(1, 128) = 48.0;
uniform vec4 overlay_color : source_color = vec4(0,0,0,1);
uniform int CAMPFIRE_COUNT;
uniform vec2 CAMPFIRE_POSITIONS[16];
uniform vec2 viewport_size;

void fragment() {
    vec2 uv = SCREEN_UV;
    float min_dist = 1.0;

    for (int i = 0; i < 16; i++) {
        if (i < CAMPFIRE_COUNT) {
            vec2 campfire = CAMPFIRE_POSITIONS[i];
            float dist = distance(uv, campfire);
            min_dist = min(min_dist, dist);
        }
    }

    float px_radius = radius / viewport_size.x;
    float px_softness = softness / viewport_size.x;
    float alpha = overlay_color.a;

    float min_alpha = 0.4; // 0 = fully transparent, 1 = fully opaque
    float t = smoothstep(px_radius - px_softness, px_radius, min_dist);
    alpha = mix(min_alpha * overlay_color.a, alpha, t);

    COLOR = vec4(overlay_color.rgb, alpha);
}